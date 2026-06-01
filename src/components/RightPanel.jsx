import React, { useState } from 'react';
import { BrainCircuit, Edit3, ListChecks, FileDown, RefreshCw, Sparkles, Trophy, FileText, Trash2 } from 'lucide-react';
import { useCourseStore } from '../store/useCourseStore';
import { callGeminiText, callGeminiJSON, mcqResponseSchema } from '../utils/geminiApi';

const SOURCE_TYPES = [
    { id: 'file', label: 'Upload File' },
    { id: 'text', label: 'Paste Text' },
    { id: 'code', label: 'App Code' }
];
function convertFractionSlashes(html) {
    if (!html) return html;
    
    let processedHtml = html;
    let startIndex = 0;
    while (true) {
        let indexFrac = processedHtml.indexOf('\u2044', startIndex);
        let indexSlash = processedHtml.indexOf('/', startIndex);
        
        let index = -1;
        if (indexFrac !== -1 && indexSlash !== -1) index = Math.min(indexFrac, indexSlash);
        else if (indexFrac !== -1) index = indexFrac;
        else if (indexSlash !== -1) index = indexSlash;
        else break; // No more slashes
        
        const isNormalSlash = (processedHtml[index] === '/');
        
        if (isNormalSlash) {
            // Safety checks for normal slash
            if (index > 0 && processedHtml[index - 1] === '<') {
                startIndex = index + 1;
                continue;
            }
            if (index < processedHtml.length - 1 && processedHtml[index + 1] === '>') {
                startIndex = index + 1;
                continue;
            }
            let insideTag = false;
            for (let i = index - 1; i >= 0; i--) {
                if (processedHtml[i] === '>') break;
                if (processedHtml[i] === '<') { insideTag = true; break; }
            }
            if (insideTag) {
                startIndex = index + 1;
                continue;
            }
            const textBefore = processedHtml.slice(Math.max(0, index - 6), index).toLowerCase();
            if (textBefore.includes('http:/') || textBefore.includes('https:')) {
                startIndex = index + 1;
                continue;
            }
        }
        
        // Scan backward for numerator
        let start = index - 1;
        let brackets = 0;
        let parens = 0;
        while (start >= 0) {
            const char = processedHtml[start];
            
            if (char === '>') {
                let tagStart = start - 1;
                while (tagStart >= 0 && processedHtml[tagStart] !== '<') {
                    tagStart--;
                }
                if (tagStart >= 0) {
                    const tagContent = processedHtml.slice(tagStart + 1, start);
                    const tagName = tagContent.trim().split(/\s+/)[0].toLowerCase();
                    const allowedTags = ['sub', '/sub', 'sup', '/sup', 'span', '/span', 'strong', '/strong', 'em', '/em', 'i', '/i', 'b', '/b'];
                    if (allowedTags.includes(tagName)) {
                        start = tagStart;
                        if (start > 0) {
                            start--;
                            continue;
                        } else {
                            break;
                        }
                    }
                }
                break;
            }
            
            if (char === '<') break;
            
            if (char === ']') brackets++;
            if (char === '[') brackets--;
            if (char === ')') parens++;
            if (char === '(') parens--;
            
            if (brackets === 0 && parens === 0) {
                if (['=', ';', '\n', '+', '-', '×', '*', '•', ':'].includes(char)) {
                    start++;
                    break;
                }
                if (char === '.' || char === ',') {
                    if (start > 0 && /[0-9]/.test(processedHtml[start - 1])) {
                        // Keep going, it's a decimal/thousands separator
                    } else {
                        start++;
                        break;
                    }
                }
            }
            start--;
        }
        if (start < 0) start = 0;
        
        // Scan forward for denominator
        let end = index + 1;
        brackets = 0;
        parens = 0;
        while (end < processedHtml.length) {
            const char = processedHtml[end];
            
            if (char === '<') {
                let tagEnd = end + 1;
                while (tagEnd < processedHtml.length && processedHtml[tagEnd] !== '>') {
                    tagEnd++;
                }
                if (tagEnd < processedHtml.length) {
                    const tagContent = processedHtml.slice(end + 1, tagEnd);
                    const tagName = tagContent.trim().split(/\s+/)[0].toLowerCase();
                    const allowedTags = ['sub', '/sub', 'sup', '/sup', 'span', '/span', 'strong', '/strong', 'em', '/em', 'i', '/i', 'b', '/b'];
                    if (allowedTags.includes(tagName)) {
                        end = tagEnd;
                        end++;
                        continue;
                    }
                }
                break;
            }
            
            if (char === '>') break;
            
            if (char === '[') brackets++;
            if (char === ']') brackets--;
            if (char === '(') parens++;
            if (char === ')') parens--;
            
            if (brackets === 0 && parens === 0) {
                if (['=', ';', '\n', '+', '-', '×', '*', '•', ':'].includes(char)) {
                    break;
                }
                if (char === '.' || char === ',') {
                    if (end < processedHtml.length - 1 && /[0-9]/.test(processedHtml[end + 1])) {
                        // Keep going, it's a decimal/thousands separator
                    } else {
                        break;
                    }
                }
            }
            end++;
        }
        
        const numerator = processedHtml.slice(start, index).trim();
        const denominator = processedHtml.slice(index + 1, end).trim();
        
        const hasAlphaNum = (str) => /[a-zA-Z0-9]/.test(str);
        
        if (!numerator || !denominator || (isNormalSlash && (!hasAlphaNum(numerator) || !hasAlphaNum(denominator)))) {
            startIndex = index + 1;
            continue;
        }
        
        if (isNormalSlash && numerator.toLowerCase().endsWith('and') && denominator.toLowerCase().startsWith('or')) {
            startIndex = index + 1;
            continue;
        }
        
        const fractionHtml = `<span class="frac"><span class="num">${numerator}</span><span class="den">${denominator}</span></span>`;
        processedHtml = processedHtml.slice(0, start) + fractionHtml + processedHtml.slice(end);
        startIndex = start + fractionHtml.length;
    }
    
    return processedHtml;
}

export default function RightPanel({ chapterId }) {
    const project = useCourseStore(state => state.project);
    const activeChapter = project.chapters.find(c => c.id === chapterId);
    const updateChapter = useCourseStore(state => state.updateChapter);
    const showMessage = useCourseStore(state => state.showMessage);
    const setIsApiKeyModalOpen = useCourseStore(state => state.setIsApiKeyModalOpen);
    const mcqConfig = useCourseStore(state => state.mcqConfig);
    const setMcqConfig = useCourseStore(state => state.setMcqConfig);

    const [sourceType, setSourceType] = useState('file');
    const [sourceName, setSourceName] = useState('');
    const [sourceValue, setSourceValue] = useState('');
    const [sourceFile, setSourceFile] = useState(null);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingMCQs, setIsGeneratingMCQs] = useState(false);

    const handleApiError = (err) => {
        if (err.message === "RATE_LIMIT_EXCEEDED") { showMessage("Rate limit reached. Google limits free-tier usage per IP address. Please wait 60 seconds.", "warning"); setIsApiKeyModalOpen(true); } 
        else if (err.message === "INVALID_API_KEY") { showMessage("Invalid API Key.", "error"); setIsApiKeyModalOpen(true); } 
        else if (err.message === "MISSING_API_KEY") { showMessage("API Key is missing.", "error"); setIsApiKeyModalOpen(true); } 
        else { showMessage(`Operation failed: ${err.message}`, "error"); }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5000000) return showMessage("File size must be under 5MB for the free tier API.", "error");
        setSourceFile(file);
        setSourceName(file.name);
    };

    const handleAddSource = async () => {
        if (!activeChapter) return;
        let newSource = { id: 'src_' + Date.now(), name: sourceName || 'Untitled Source' };
        
        if (sourceType === 'file' && sourceFile) {
            try {
                if (sourceFile.type === 'application/pdf') {
                    const base64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result.split(',')[1]);
                        reader.onerror = error => reject(error);
                        reader.readAsDataURL(sourceFile);
                    });
                    newSource.inlineData = { mimeType: 'application/pdf', data: base64 };
                    newSource.value = `File: ${sourceFile.name} (PDF Document)`;
                } else {
                    const text = await sourceFile.text();
                    newSource.textData = text;
                    newSource.value = `File: ${sourceFile.name}`;
                }
            } catch (err) {
                return showMessage("Error reading file.", "error");
            }
        } else {
            if (!sourceValue) return showMessage("Please provide a source.", "warning");
            newSource.value = sourceValue;
        }
        
        updateChapter(activeChapter.id, { sources: [...(activeChapter.sources || []), newSource] });
        setSourceName(''); 
        setSourceValue(''); 
        setSourceFile(null); 
        showMessage("Source added.", "success");
    };

    const handleDeleteSource = (srcId) => {
        if (!activeChapter) return;
        updateChapter(activeChapter.id, { sources: (activeChapter.sources || []).filter(s => s.id !== srcId) });
    };

    const regenerateChapter = async () => {
        if (!activeChapter) return;
        setIsGenerating(true);
        const sourcesToUse = activeChapter.sources || [];
        try {
            const currentContent = activeChapter.blocks?.map(b => b.content).join('\n\n');
            const textPrompt = `You are an elite course designer. CURRENT CONTENT:
${currentContent || "Empty."}
CUSTOM PROMPT:
${activeChapter.customPrompt || "None."}
LANGUAGE: ${project.language}
INSTRUCTIONS:
1. Generate an immersive educational chapter using HTML structures. Use tables, <h1>, <h2>, <h3>, <blockquote>.
2. Output all equations, formulas, fractions, and mathematical ratios using the strict HTML fraction structure:
   <span class="frac"><span class="num">Numerator Content</span><span class="den">Denominator Content</span></span>
   DO NOT use normal slashes "/" or unicode slashes "⁄" for fractions or equations in the text. For example:
   - "peak area of A⁄peak area of IS" must be formatted as: <span class="frac"><span class="num">peak area of A</span><span class="den">peak area of IS</span></span>
   - "% Relative Bioavailability = [AUC]T⁄[AUC]R × 100" must be formatted as: % Relative Bioavailability = <span class="frac"><span class="num">[AUC]<sub>T</sub></span><span class="den">[AUC]<sub>R</sub></span></span> &times; 100
   Make sure you use subscripts (<sub>) and superscripts (<sup>) inside the numerator/denominator where appropriate.
   CRITICAL: DO NOT convert percentage values (like "85%") into fractions. Keep them exactly as "85%". Only use the fraction structure for mathematical equations and ratios.
3. Do not output markdown. Do not include <style>, <head>, or <html> tags. Only output the raw inner HTML content.
4. Focus only on rich text.
5. Ensure thorough coverage.`;
            const parts = [{ text: textPrompt }];
            
            if (sourcesToUse?.length > 0) {
                parts.push({ text: "\n\n--- KNOWLEDGE SOURCES ---\n" });
                sourcesToUse.forEach((s, i) => {
                    parts.push({ text: `\n[Source ${i+1}: ${s.name}]\n` });
                    if (s.textData) {
                        parts.push({ text: s.textData });
                    } else if (s.inlineData) {
                        parts.push({ inlineData: s.inlineData });
                    } else {
                        parts.push({ text: s.value });
                    }
                });
            }
            
            let rawOutput = await callGeminiText(parts);
            rawOutput = rawOutput
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<\/?(?:html|head|body|script)[^>]*>/gi, '')
                .replace(/^```html/gm, '')
                .replace(/^```/gm, '')
                .trim();
                
            let processedOutput = convertFractionSlashes(rawOutput);
            const newBlocks = [{ id: `b_${Date.now()}`, type: 'html', content: processedOutput }];
            updateChapter(activeChapter.id, { blocks: newBlocks, sources: sourcesToUse });
            showMessage("Chapter generated!", "success");
        } catch (err) { 
            handleApiError(err); 
        } finally { 
            setIsGenerating(false); 
        }
    };

    const handleGenerateMCQs = async () => {
        if (!activeChapter) return;
        const content = activeChapter.blocks.filter(b => b.type === 'html').map(b => b.content).join('\n');
        if (!content) return showMessage("Generate content first.", "warning");
        
        setIsGeneratingMCQs(true);
        try {
            const prompt = `Based on the following chapter content, generate exactly ${mcqConfig.count} premium multiple-choice questions. Difficulty: ${mcqConfig.difficulty}. Language: ${project.language}. Keep the question stem concise unless necessary; do not artificially inflate stem length just to make the question seem harder. CONTENT:\n${content}`;
            const response = await callGeminiJSON(prompt, mcqResponseSchema);
            if (response?.mcqs) {
                const newMCQs = response.mcqs.map(q => ({ id: 'mcq_' + Date.now() + Math.random(), ...q }));
                updateChapter(activeChapter.id, { mcqs: newMCQs });
                showMessage(`Synthesized ${newMCQs.length} Quiz questions!`, "success");
            }
        } catch (e) { 
            handleApiError(e); 
        } finally { 
            setIsGeneratingMCQs(false); 
        }
    };

    const handleDownloadWord = () => {
        if (!activeChapter) return;
        const contentHtml = activeChapter.blocks.map(b => b.content).join('<br/>');
        const inlineCss = `
        <style>
            table { width: 100%; border-collapse: collapse; margin-bottom: 1.5em; background-color: #ffffff; font-family: sans-serif; }
            th { background: #f8fafc; font-weight: bold; border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
            td { border: 1px solid #e2e8f0; padding: 8px 12px; }
            .frac { display: inline-block; vertical-align: middle; text-align: center; margin: 0 4px; }
            .frac .num { display: block; border-bottom: 1px solid #000; padding: 0 2px; }
            .frac .den { display: block; padding: 0 2px; }
            h1 { font-size: 24pt; border-left: 4px solid #6366f1; padding-left: 10px; margin-top: 1.5em; margin-bottom: 0.75em; }
            h2 { font-size: 18pt; margin-top: 1.5em; margin-bottom: 0.75em; }
            h3 { font-size: 14pt; margin-top: 1.5em; margin-bottom: 0.75em; }
            blockquote { border-left: 4px solid #818cf8; padding: 10px 15px; background: #f8fafc; font-style: italic; }
            p { line-height: 1.6; margin-bottom: 1em; }
        </style>`;
        const preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title>" + inlineCss + "</head><body>";
        const postHtml = "</body></html>";
        const blob = new Blob(['\ufeff', preHtml + contentHtml + postHtml], { type: 'application/msword' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${activeChapter.title.replace(/\s+/g, '_')}_Module.doc`;
        link.click();
    };

    if (!activeChapter) return null;

    return (
        <div className="w-80 bg-white flex flex-col border-l border-slate-200 shadow-md flex-shrink-0 z-20">
            <div className="flex-1 overflow-y-auto p-5 space-y-8">
                <div>
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center"><BrainCircuit className="w-4 h-4 mr-2 text-indigo-500" /> Knowledge Base</h3>
                    <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
                        <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 outline-none">
                            {SOURCE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                        {sourceType === 'file' ? (
                            <div className="space-y-2">
                                <label className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-100 transition-colors">
                                    <FileDown className="w-6 h-6 text-slate-600 mb-2" />
                                    <span className="text-xs text-slate-600">{sourceFile ? sourceFile.name : 'Select File (Max 5MB)'}</span>
                                    <input type="file" className="hidden" onChange={handleFileUpload} />
                                </label>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <input type="text" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Resource Name (optional)" className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 outline-none" />
                                <textarea value={sourceValue} onChange={(e) => setSourceValue(e.target.value)} placeholder="Paste text here..." className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 outline-none h-24" />
                            </div>
                        )}
                        <button onClick={handleAddSource} disabled={(!sourceValue && !sourceFile)} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-xs transition-all">Add to Context</button>
                    </div>

                    {activeChapter.sources?.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <span className="text-[10px] uppercase text-slate-500 font-bold block">Current Sources</span>
                            {activeChapter.sources.map(src => (
                                <div key={src.id} className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded text-xs group">
                                    <div className="flex items-center space-x-2 truncate pr-2">
                                        <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center flex-shrink-0"><FileText className="w-3 h-3 text-indigo-400" /></div>
                                        <span className="truncate text-slate-700" title={src.name}>{src.name}</span>
                                    </div>
                                    <button onClick={() => handleDeleteSource(src.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="pt-6 border-t border-slate-200">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center"><Edit3 className="w-4 h-4 mr-2 text-indigo-500" /> Course Generation</h3>
                    <div className="space-y-4">
                        <textarea value={activeChapter.customPrompt || ''} onChange={(e) => updateChapter(activeChapter.id, { customPrompt: e.target.value })} placeholder="Add any optional instructions here..." className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 outline-none h-24 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50" />
                        <button onClick={regenerateChapter} disabled={isGenerating || (!activeChapter.customPrompt?.trim() && (!activeChapter.sources || activeChapter.sources.length === 0))} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg text-sm flex items-center justify-center disabled:opacity-50 transition-all shadow-sm hover:shadow-md">
                            {isGenerating ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Synthesizing...</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate Chapter Content</>}
                        </button>
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-200">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center"><ListChecks className="w-4 h-4 mr-2 text-indigo-500" /> Quiz Builder</h3>
                    <div className="space-y-3">
                        <div className="flex space-x-2">
                            <div className="flex-1"><label className="text-[10px] text-slate-500 uppercase block mb-1 font-semibold">Count</label><input type="number" min="1" max="20" value={mcqConfig.count} onChange={e => setMcqConfig({...mcqConfig, count: parseInt(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 outline-none" /></div>
                            <div className="flex-1"><label className="text-[10px] text-slate-500 uppercase block mb-1 font-semibold">Level</label><select value={mcqConfig.difficulty} onChange={e => setMcqConfig({...mcqConfig, difficulty: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 outline-none"><option>Easy</option><option>Medium</option><option>Hard</option></select></div>
                        </div>
                        <button onClick={handleGenerateMCQs} disabled={isGeneratingMCQs || activeChapter.blocks.length === 0} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg text-xs flex items-center justify-center disabled:opacity-50 transition-all shadow-sm hover:shadow-md">
                            {isGeneratingMCQs ? <><RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> Generating Quiz...</> : <><Trophy className="w-3.5 h-3.5 mr-2" /> Build MCQs from Text</>}
                        </button>
                    </div>
                </div>
                
                <div className="pt-6 border-t border-slate-200">
                    <button onClick={handleDownloadWord} className="w-full flex items-center justify-center space-x-2 text-sm text-slate-600 font-medium bg-slate-50 hover:bg-indigo-50/50 py-3 rounded-lg border border-slate-200 hover:border-indigo-200 transition-all"><FileDown className="w-4 h-4 text-indigo-400" /><span>Export Module to Word</span></button>
                </div>
            </div>
        </div>
    );
}
