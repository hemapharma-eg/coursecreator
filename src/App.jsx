import React, { useState, useEffect, useRef } from 'react';
import { 
    Book, FileText, Plus, Download, Upload, 
    Trash2, Settings, BookOpen, Save, CheckCircle, 
    AlertCircle, AlertTriangle, FileDown, FilePlus, ExternalLink, Code, RefreshCw,
    Image as ImageIcon, Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Superscript, Subscript, ArrowUp, ArrowDown,
    Strikethrough, Heading1, Heading2, Heading3, Type, Quote, Undo, Redo, AlignJustify, Menu, X,
    BrainCircuit, ListChecks, Trophy, Eye, Edit3, MessageSquare, Send, Bot, Sparkles, User, Lock, Unlock, FileImage, ImagePlus, GripVertical
} from 'lucide-react';

const SOURCE_TYPES = [
    { id: 'link', label: 'Website Link', icon: ExternalLink },
    { id: 'text', label: 'Paste Text', icon: FileText },
    { id: 'file', label: 'Upload File', icon: FilePlus },
    { id: 'code', label: 'App Code', icon: Code },
];

const apiKey = ""; 

const getActiveApiKey = () => {
    const customKey = localStorage.getItem('user_gemini_api_key');
    if (customKey && customKey.trim() !== "") {
        return customKey.trim();
    }
    return apiKey || "";
};

async function fetchWithRetry(url, options, retries = 5) {
    const delays = [1000, 2000, 4000, 8000, 16000];
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429) throw new Error("RATE_LIMIT_EXCEEDED");
            if (response.status === 400 || response.status === 403) {
                const errBody = await response.json().catch(() => ({}));
                const errMsg = errBody?.error?.message?.toLowerCase() || "";
                if (errMsg.includes("key") || errMsg.includes("api") || errBody?.error?.status?.includes("INVALID_ARGUMENT")) {
                    throw new Error("INVALID_API_KEY");
                }
            }
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            if (error.message === "RATE_LIMIT_EXCEEDED" || error.message === "INVALID_API_KEY") throw error;
            if (i === retries - 1) throw error;
            await new Promise(res => setTimeout(res, delays[i]));
        }
    }
}

async function callGeminiText(promptOrParts) {
    const activeKey = getActiveApiKey();
    if (!activeKey) throw new Error("MISSING_API_KEY");
    const parts = Array.isArray(promptOrParts) ? promptOrParts : [{ text: promptOrParts }];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
    const payload = { contents: [{ parts: parts }], tools: [{ google_search: {} }] };
    const options = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
    const result = await fetchWithRetry(url, options);
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGeminiJSON(promptOrParts, schema) {
    const activeKey = getActiveApiKey();
    if (!activeKey) throw new Error("MISSING_API_KEY");
    const parts = Array.isArray(promptOrParts) ? promptOrParts : [{ text: promptOrParts }];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
    const payload = { contents: [{ parts: parts }], generationConfig: { responseMimeType: "application/json", responseSchema: schema } };
    const options = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
    const result = await fetchWithRetry(url, options);
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return JSON.parse(text);
}

async function callGeminiImage(prompt) {
    const activeKey = getActiveApiKey();
    if (!activeKey) throw new Error("MISSING_API_KEY");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${activeKey}`;
    const payload = { instances: { prompt: prompt }, parameters: { sampleCount: 1 } };
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
    const result = await fetchWithRetry(url, options);
    if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
        return `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
    }
    throw new Error("Failed to generate image.");
}

async function callGeminiImageToImage(prompt, referenceImage) {
    const activeKey = getActiveApiKey();
    if (!activeKey) throw new Error("MISSING_API_KEY");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${activeKey}`;
    const payload = {
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: referenceImage.mimeType, data: referenceImage.data } }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
    };
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
    const result = await fetchWithRetry(url, options);
    const inlineData = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;
    if (inlineData && inlineData.data) {
        return `data:${inlineData.mimeType};base64,${inlineData.data}`;
    }
    throw new Error("Failed to generate image from reference.");
}

const mcqResponseSchema = {
    type: "OBJECT",
    properties: {
        mcqs: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    question: { type: "STRING" },
                    options: { type: "ARRAY", items: { type: "STRING" } },
                    correctOptionIndex: { type: "INTEGER" },
                    explanation: { type: "STRING" }
                },
                required: ["question", "options", "correctOptionIndex", "explanation"]
            }
        }
    },
    required: ["mcqs"]
};

const ContentEditableBlock = ({ html, onChange, readOnly }) => {
    const contentRef = useRef(null);
    useEffect(() => {
        if (contentRef.current && contentRef.current.innerHTML !== html) {
            contentRef.current.innerHTML = html;
        }
    }, [html]);

    const handleBlur = () => {
        if (contentRef.current && !readOnly) onChange(contentRef.current.innerHTML);
    };

    return (
        <div 
            ref={contentRef}
            contentEditable={!readOnly}
            onBlur={handleBlur}
            className={`rich-text-editor outline-none p-6 min-h-[60px] w-full ${readOnly ? 'prose max-w-none' : 'focus:bg-slate-800/50'}`}
        />
    );
};

export default function App() {
    const [project, setProject] = useState({ 
        title: 'New Online Syllabus',
        language: 'English',
        chapters: [
            {
                id: 'chap_starter',
                title: 'Introduction to AI Systems',
                blocks: [
                    { id: 'b_starter', type: 'html', content: '<h2>Welcome to Chapter 1</h2><p>This is where your AI-generated course content will live. Instructors can feed raw sources, links, documents, and code blocks into the system and get a beautifully formatted academic chapter containing figures, equations, vertical fractions, tables, and rich citations.</p>' }
                ],
                mcqs: [],
                customPrompt: '',
                sources: []
            }
        ],
        isStudentEdition: false 
    });
    
    const [activeView, setActiveView] = useState('chap_starter');
    const [activeTab, setActiveTab] = useState('content');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingMCQs, setIsGeneratingMCQs] = useState(false);
    const [toast, setToast] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem('user_gemini_api_key') || '');
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [isTestingKey, setIsTestingKey] = useState(false);
    const [testResult, setTestResult] = useState(null);

    const [sourceType, setSourceType] = useState('link');
    const [sourceName, setSourceName] = useState('');
    const [sourceValue, setSourceValue] = useState('');
    const [sourceFile, setSourceFile] = useState(null);

    const [isStudentMode, setIsStudentMode] = useState(false);
    const [studentAnswers, setStudentAnswers] = useState({});
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [mcqConfig, setMcqConfig] = useState({ count: 5, difficulty: 'Medium' });

    const [tutorQuery, setTutorQuery] = useState('');
    const [tutorChats, setTutorChats] = useState({});
    const [tutorLoading, setTutorLoading] = useState(false);
    const tutorChatEndRef = useRef(null);

    useEffect(() => {
        const saved = localStorage.getItem('book_project_state');
        if (saved) {
            try { 
                const parsed = JSON.parse(saved);
                if (parsed.chapters) {
                    parsed.chapters = parsed.chapters.map(c => {
                        if (c.content && (!c.blocks || c.blocks.length === 0)) c.blocks = [{ id: 'b_' + Date.now(), type: 'html', content: c.content }];
                        if (!c.blocks) c.blocks = [];
                        if (!c.mcqs) c.mcqs = []; 
                        return c;
                    });
                }
                setProject(parsed); 
                if (parsed.isStudentEdition) setIsStudentMode(true);
            } catch(e) { console.error("Error loading save"); }
        }
    }, []);

    useEffect(() => {
        try {
            const safeProject = {
                ...project,
                chapters: project.chapters.map(chap => ({
                    ...chap,
                    sources: (chap.sources || []).map(src => {
                        const safeSource = { ...src };
                        if (safeSource.inlineData) delete safeSource.inlineData; 
                        if (safeSource.textData && safeSource.textData.length > 150000) {
                            delete safeSource.textData; 
                            if (!safeSource.value.includes("[MEMORY SAVED]")) safeSource.value += " [MEMORY SAVED]";
                        }
                        return safeSource;
                    })
                }))
            };
            localStorage.setItem('book_project_state', JSON.stringify(safeProject));
        } catch (e) {
            console.warn("Storage quota exceeded.");
        }
    }, [project]);

    useEffect(() => {
        setStudentAnswers({});
        setQuizSubmitted(false);
    }, [activeView, activeTab, isStudentMode]);

    useEffect(() => {
        if (tutorChatEndRef.current) tutorChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [tutorChats, tutorLoading]);

    const showMessage = (msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

    const handleSaveApiKey = (keyToSave) => {
        const trimmed = keyToSave.trim();
        localStorage.setItem('user_gemini_api_key', trimmed);
        setApiKeyInput(trimmed);
        showMessage("AI API Credentials saved locally!", "success");
        setIsApiKeyModalOpen(false);
    };

    const handleTestApiKey = async () => {
        if (!apiKeyInput.trim()) { setTestResult({ success: false, msg: "Please insert a key before testing." }); return; }
        setIsTestingKey(true);
        setTestResult(null);
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKeyInput.trim()}`;
            const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: "Respond in 1 word: active." }] }] }) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            setTestResult({ success: true, msg: "Connection Verified! Your key is active." });
        } catch (err) {
            setTestResult({ success: false, msg: err.message || "Failed to make test inquiry." });
        } finally { setIsTestingKey(false); }
    };

    const handleApiError = (err) => {
        if (err.message === "RATE_LIMIT_EXCEEDED") { showMessage("AI rate limit exceeded! Wait 60 seconds.", "warning"); setIsApiKeyModalOpen(true); } 
        else if (err.message === "INVALID_API_KEY") { showMessage("Invalid API Key.", "error"); setIsApiKeyModalOpen(true); } 
        else if (err.message === "MISSING_API_KEY") { showMessage("API Key is missing.", "error"); setIsApiKeyModalOpen(true); } 
        else { showMessage(`Operation failed: ${err.message}`, "error"); }
    };

    const addChapter = () => {
        const newId = 'chap_' + Date.now();
        setProject({ ...project, chapters: [...project.chapters, { id: newId, title: `Chapter ${project.chapters.length + 1}`, blocks: [], mcqs: [], customPrompt: '', sources: [] }] });
        setActiveView(newId); setActiveTab('content'); setIsMobileMenuOpen(false); showMessage("New chapter added.");
    };

    const updateChapter = (id, updates) => setProject({ ...project, chapters: project.chapters.map(c => c.id === id ? { ...c, ...updates } : c) });

    const updateBlock = (chapterId, blockId, updates) => {
        setProject(prev => ({ ...prev, chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, blocks: c.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b) } : c) }));
    };

    const deleteBlock = (chapterId, blockId) => {
        setProject(prev => ({ ...prev, chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, blocks: c.blocks.filter(b => b.id !== blockId) } : c) }));
    };

    const moveBlock = (chapterId, index, direction) => {
        setProject(prev => {
            const chapter = prev.chapters.find(c => c.id === chapterId);
            const blocks = [...chapter.blocks];
            if (index + direction < 0 || index + direction >= blocks.length) return prev;
            const temp = blocks[index]; blocks[index] = blocks[index + direction]; blocks[index + direction] = temp;
            return { ...prev, chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, blocks } : c) };
        });
    };

    const insertBlock = (chapterId, index, type) => {
        setProject(prev => {
            const chapter = prev.chapters.find(c => c.id === chapterId);
            const newBlock = type === 'image' 
                ? { id: 'b_' + Date.now(), type: 'image', prompt: 'A simple schematic diagram of...', url: '', isLoading: false }
                : { id: 'b_' + Date.now(), type: 'html', content: '<p>New text section...</p>' };
            const blocks = [...chapter.blocks];
            blocks.splice(index + 1, 0, newBlock);
            return { ...prev, chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, blocks } : c) };
        });
    };

    const deleteChapter = (id) => {
        const remaining = project.chapters.filter(c => c.id !== id);
        setProject({ ...project, chapters: remaining });
        if (activeView === id) setActiveView(remaining.length > 0 ? remaining[0].id : 'book');
        showMessage("Chapter deleted.");
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { showMessage("File is too large (max 5MB).", "error"); e.target.value = ''; return; }
        const reader = new FileReader();
        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
            reader.onload = (event) => setSourceFile({ name: file.name, type: 'binary', mimeType: file.type, data: event.target.result.split(',')[1], preview: `[${file.type.toUpperCase()}] ${file.name}` });
            reader.readAsDataURL(file);
        } else {
            reader.onload = (event) => setSourceFile({ name: file.name, type: 'text', data: event.target.result, preview: `[TEXT] ${file.name}\n\n${event.target.result.substring(0, 100)}...` });
            reader.readAsText(file);
        }
    };

    const handleAddSource = async () => {
        const activeChapter = project.chapters.find(c => c.id === activeView);
        if (!activeChapter) return;
        const newSource = { id: Date.now().toString(), name: sourceName || 'Unnamed Source', type: sourceType, dateAdded: new Date().toISOString() };
        
        if (sourceType === 'file' && sourceFile) {
            newSource.name = sourceName || sourceFile.name; newSource.value = sourceFile.preview; 
            if (sourceFile.type === 'binary') newSource.inlineData = { mimeType: sourceFile.mimeType, data: sourceFile.data };
            else newSource.textData = sourceFile.data;
        } else if (sourceType === 'text' || sourceType === 'code') {
            newSource.value = sourceValue.substring(0, 300) + '...'; newSource.textData = sourceValue; 
        } else {
            newSource.value = sourceValue;
        }
        updateChapter(activeChapter.id, { sources: [...(activeChapter.sources || []), newSource] });
        setSourceName(''); setSourceValue(''); setSourceFile(null); showMessage("Source added.", "success");
    };

    const regenerateChapter = async (chapterId, sourcesToUse) => {
        const activeChapter = project.chapters.find(c => c.id === chapterId);
        if (!activeChapter) return;
        setIsGenerating(true);
        try {
            const currentContent = activeChapter.blocks?.map(b => b.type === 'html' ? b.content : `[IMAGE: ${b.prompt}]`).join('\n\n');
            const textPrompt = `You are an elite course designer. CURRENT CONTENT:\n${currentContent || "Empty."}\nCUSTOM PROMPT:\n${activeChapter.customPrompt || "None."}\nLANGUAGE: ${project.language}\nINSTRUCTIONS:\n1. Generate an immersive educational chapter using HTML structures. Use tables, <h1>, <h2>, <h3>, <blockquote>.\n2. Output equations in HTML.\n3. Do not output markdown.\n4. Insert [IMAGE: <description>] on its own line for diagrams.\n5. Ensure thorough coverage.`;
            const parts = [{ text: textPrompt }];
            if (sourcesToUse?.length > 0) {
                parts.push({ text: "\n\n--- KNOWLEDGE SOURCES ---\n" });
                sourcesToUse.forEach((s, i) => {
                    parts.push({ text: `\n[Source ${i+1}: ${s.name}]` });
                    if (s.inlineData) parts.push({ inlineData: s.inlineData });
                    else if (s.textData) parts.push({ text: s.textData });
                    else parts.push({ text: s.value });
                });
            }
            let rawOutput = await callGeminiText(parts);
            rawOutput = rawOutput.replace(/^```html/gm, '').replace(/^```/gm, '').trim();
            const newBlocks = []; const regex = /\[IMAGE:\s*(.*?)\]/g; let lastIndex = 0; let match;
            while ((match = regex.exec(rawOutput)) !== null) {
                const textContent = rawOutput.substring(lastIndex, match.index).trim();
                if (textContent) newBlocks.push({ id: `b_${Date.now()}_${Math.random()}`, type: 'html', content: textContent });
                newBlocks.push({ id: `b_${Date.now()}_${Math.random()}`, type: 'image', prompt: match[1].trim(), url: '', isLoading: true });
                lastIndex = regex.lastIndex;
            }
            const remainingText = rawOutput.substring(lastIndex).trim();
            if (remainingText) newBlocks.push({ id: `b_${Date.now()}_${Math.random()}`, type: 'html', content: remainingText });
            updateChapter(activeChapter.id, { blocks: newBlocks, sources: sourcesToUse });
            showMessage("Chapter generated!", "success");
            newBlocks.filter(b => b.type === 'image').forEach(imgBlock => handleRegenerateImage(activeChapter.id, imgBlock));
        } catch (err) { handleApiError(err); } finally { setIsGenerating(false); }
    };

    const handleGenerateMCQs = async () => {
        const activeChapter = project.chapters.find(c => c.id === activeView);
        if (!activeChapter) return;
        const content = activeChapter.blocks.filter(b => b.type === 'html').map(b => b.content).join('\n');
        if (!content) return showMessage("Generate content first.", "warning");
        setIsGeneratingMCQs(true);
        try {
            const prompt = `Based on the following chapter content, generate exactly ${mcqConfig.count} premium multiple-choice questions. Difficulty: ${mcqConfig.difficulty}. Language: ${project.language}. CONTENT:\n${content}`;
            const response = await callGeminiJSON(prompt, mcqResponseSchema);
            if (response?.mcqs) {
                const newMCQs = response.mcqs.map(q => ({ id: 'mcq_' + Date.now() + Math.random(), ...q }));
                updateChapter(activeChapter.id, { mcqs: newMCQs });
                showMessage(`Synthesized ${newMCQs.length} Quiz questions!`, "success");
            }
        } catch (e) { handleApiError(e); } finally { setIsGeneratingMCQs(false); }
    };

    const handleRegenerateImage = async (chapterId, block) => {
        updateBlock(chapterId, block.id, { isLoading: true });
        try {
            const url = block.referenceImage ? await callGeminiImageToImage(block.prompt, block.referenceImage) : await callGeminiImage(block.prompt);
            updateBlock(chapterId, block.id, { url, isLoading: false });
        } catch (e) { handleApiError(e); updateBlock(chapterId, block.id, { isLoading: false }); }
    };

    const handleTutorSubmit = async (e) => {
        e.preventDefault();
        if (!tutorQuery.trim() || !activeChapter) return;
        const currentMsg = tutorQuery; setTutorQuery('');
        const newHistory = [...(tutorChats[activeChapter.id] || []), { role: 'user', text: currentMsg }];
        setTutorChats(prev => ({ ...prev, [activeChapter.id]: newHistory }));
        setTutorLoading(true);
        try {
            const chapterText = activeChapter.blocks.filter(b => b.type === 'html').map(b => b.content).join('\n\n').replace(/<[^>]+>/g, '');
            const tutorPrompt = `You are an AI Tutor. CHAPTER CONTEXT:\n${chapterText}\nDISCUSSION LOG:\n${newHistory.map(h => `${h.role}: ${h.text}`).join('\n')}\nLATEST STUDENT QUESTION: "${currentMsg}"\nRespond in ${project.language}.`;
            const aiReply = await callGeminiText(tutorPrompt);
            setTutorChats(prev => ({ ...prev, [activeChapter.id]: [...newHistory, { role: 'model', text: aiReply }] }));
        } catch (err) { handleApiError(err); } finally { setTutorLoading(false); }
    };

    const exportInstructorJSON = () => {
        const link = document.createElement('a');
        link.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ ...project, isStudentEdition: false }, null, 2));
        link.download = `${project.title.replace(/\s+/g, '_')}_instructor.json`; link.click();
    };

    const exportStudentJSON = () => {
        const studentCleaned = project.chapters.map(chap => { const { customPrompt, sources, ...safe } = chap; return { ...safe, sources: [] }; });
        const link = document.createElement('a');
        link.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ title: project.title, language: project.language, chapters: studentCleaned, isStudentEdition: true }, null, 2));
        link.download = `${project.title.replace(/\s+/g, '_')}_student.json`; link.click();
    };

    const handleDownloadWord = (activeChapter) => {
        const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title></head><body><h1>${activeChapter.title}</h1>${activeChapter.blocks.filter(b => b.type === 'html').map(b => b.content).join('<br/>')}</body></html>`;
        const link = document.createElement('a');
        link.href = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(html);
        link.download = `${activeChapter.title.replace(/\s+/g, '_')}.doc`; link.click();
        showMessage("Exported to Word.", "success");
    };

    const activeChapter = project.chapters.find(c => c.id === activeView);

    return (
        <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
            <style>{`
                .rich-text-editor { color: #f1f5f9; font-size: 1.05rem; }
                .rich-text-editor h1, .rich-text-editor h2, .rich-text-editor h3 { font-weight: 800; color: #ffffff; margin-top: 1.5em; margin-bottom: 0.75em; }
                .rich-text-editor h1 { font-size: 1.85rem; border-left: 4px solid #6366f1; padding-left: 10px; }
                .rich-text-editor h2 { font-size: 1.45rem; }
                .rich-text-editor h3 { font-size: 1.25rem; }
                .rich-text-editor p { margin-bottom: 1.25em; line-height: 1.8; color: #cbd5e1; }
                .rich-text-editor ul, .rich-text-editor ol { padding-inline-start: 2.2em; margin-bottom: 1.25em; }
                .rich-text-editor ul { list-style-type: disc; } .rich-text-editor ol { list-style-type: decimal; }
                .rich-text-editor li { margin-bottom: 0.5em; color: #cbd5e1; }
                .rich-text-editor table { width: 100%; border-collapse: collapse; margin-bottom: 1.5em; background-color: #1e293b; border-radius: 8px; overflow: hidden; }
                .rich-text-editor th { background-color: #334155; font-weight: bold; border: 1px solid #475569; padding: 0.75em; color: #f8fafc; }
                .rich-text-editor td { border: 1px solid #475569; padding: 0.75em; color: #cbd5e1; }
                .rich-text-editor blockquote { border-left: 4px solid #6366f1; padding: 0.8rem 1.25rem; margin: 1.5em 0; background-color: #1e293b; color: #94a3b8; font-style: italic; border-radius: 4px; }
            `}</style>

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition duration-300 z-50 w-72 bg-slate-950 flex flex-col h-full border-r border-slate-800`}>
                <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center space-x-3"><Book className="w-8 h-8 text-indigo-500" /><div><h1 className="text-lg font-black text-white">Syllabus AI</h1><span className="text-[10px] text-slate-500 font-bold uppercase">{project.isStudentEdition ? 'Student Hub View' : 'Instructor Center'}</span></div></div>
                    <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}><X className="w-6 h-6" /></button>
                </div>
                <div className="p-4 bg-slate-900 border-b border-slate-800 space-y-2">
                    <div className="flex items-center justify-between"><span className="text-[10px] uppercase text-slate-500 font-bold">AI Engine</span><div className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /></div></div>
                    <button onClick={() => setIsApiKeyModalOpen(true)} className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800/80 text-xs text-slate-300"><div className="flex items-center space-x-2"><Settings className="w-4 h-4 text-indigo-400" /><span>{getActiveApiKey() ? 'API Key Active' : 'Configure API Key'}</span></div></button>
                </div>
                <div className="p-4 bg-slate-900/60 border-b border-slate-800 space-y-2">
                    <label className="flex items-center space-x-3 text-xs text-slate-300 p-2 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer border border-slate-700/50"><Upload className="w-4 h-4 text-emerald-400" /><span>Load Course (.json)</span><input type="file" accept=".json" className="hidden" onChange={importJSON} /></label>
                    {!project.isStudentEdition && (
                        <div className="grid grid-cols-1 gap-2 pt-1">
                            <button onClick={exportInstructorJSON} className="flex items-center space-x-2 text-[11px] text-slate-300 p-2 rounded bg-slate-800/40 hover:bg-slate-800 border border-slate-800"><Download className="w-3.5 h-3.5 text-blue-400" /><span>Save Backup (Teacher)</span></button>
                            <button onClick={exportStudentJSON} className="flex items-center space-x-2 text-[11px] text-amber-300 p-2 rounded bg-amber-950/20 hover:bg-amber-950/40 border border-amber-900/40"><Sparkles className="w-3.5 h-3.5 text-amber-400" /><span>Export for Students</span></button>
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto py-4">
                    {!project.isStudentEdition && <div className={`px-5 py-3 cursor-pointer flex items-center space-x-3 hover:bg-slate-900 ${activeView === 'book' ? 'bg-indigo-600/20 border-l-4 border-indigo-500 text-white' : 'border-l-4 border-transparent'}`} onClick={() => setActiveView('book')}><Settings className="w-4 h-4 text-slate-400" /><span className="font-semibold text-sm">Course Config</span></div>}
                    <div className="px-5 mt-6 mb-3 text-[11px] font-bold text-slate-500 uppercase flex justify-between items-center">Modules<span className="bg-slate-800 text-slate-400 py-0.5 px-2 rounded-full text-xs">{project.chapters.length}</span></div>
                    {project.chapters.map((chap, idx) => (
                        <div key={chap.id} className={`group px-5 py-3 cursor-pointer flex items-center justify-between hover:bg-slate-900/80 ${activeView === chap.id ? 'bg-indigo-950/60 border-l-4 border-indigo-500 text-white' : 'border-l-4 border-transparent'}`} onClick={() => setActiveView(chap.id)}>
                            <div className="flex items-center space-x-3 truncate"><FileText className={`w-4 h-4 ${activeView === chap.id ? 'text-indigo-400' : 'text-slate-500'}`} /><span className="truncate text-sm font-semibold">{chap.title || `Module ${idx + 1}`}</span></div>
                            {!project.isStudentEdition && <button onClick={(e) => { e.stopPropagation(); deleteChapter(chap.id); }} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 p-1"><Trash2 className="w-3.5 h-3.5" /></button>}
                        </div>
                    ))}
                    {!project.isStudentEdition && <button onClick={addChapter} className="mx-5 mt-4 flex items-center space-x-2 text-xs text-indigo-400 p-2.5 rounded border border-dashed border-indigo-900/50 hover:bg-slate-900 w-[calc(100%-40px)]"><Plus className="w-4 h-4" /><span>New Module</span></button>}
                </div>
                {!project.isStudentEdition && (
                    <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium">Author Mode Switcher</span>
                        <button onClick={() => { setIsStudentMode(!isStudentMode); showMessage(isStudentMode ? "Instructor Workspace" : "Student View"); }} className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md font-bold transition-colors">{isStudentMode ? "Exit Mode" : "Test Mode"}</button>
                    </div>
                )}
            </div>

            {/* Main Center Area */}
            <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative border-r border-slate-800">
                {activeView === 'book' && !project.isStudentEdition ? (
                    <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full"><h2 className="text-2xl font-bold mb-6 flex items-center"><Settings className="w-6 h-6 mr-3 text-indigo-500" />Course Configuration</h2><div className="space-y-6"><div><label className="block text-sm font-medium text-slate-400 mb-2">Course Title</label><input type="text" value={project.title} onChange={(e) => setProject({...project, title: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none" /></div><div><label className="block text-sm font-medium text-slate-400 mb-2">Language</label><select value={project.language} onChange={(e) => setProject({...project, language: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none"><option value="English">English</option><option value="Spanish">Spanish</option><option value="French">French</option><option value="German">German</option></select></div></div></div>
                ) : activeChapter ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
                            <div className="flex items-center space-x-4"><button className="md:hidden text-slate-400" onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6" /></button>
                            {isStudentMode ? <h2 className="text-xl font-bold text-white">{activeChapter.title}</h2> : <input type="text" value={activeChapter.title} onChange={(e) => updateChapter(activeChapter.id, { title: e.target.value })} className="text-xl font-bold bg-transparent text-white border-b border-transparent hover:border-slate-700 focus:border-indigo-500 outline-none pb-1 w-full max-w-md" />}</div>
                            <div className="flex space-x-2"><button className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'content' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`} onClick={() => setActiveTab('content')}>Read</button><button className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'quiz' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`} onClick={() => setActiveTab('quiz')}>Quiz</button></div>
                        </header>
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
                            {activeTab === 'content' && (
                                <div className="max-w-4xl mx-auto space-y-6">
                                    {activeChapter.blocks.map((block, idx) => (
                                        <div key={block.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden group hover:border-indigo-500/30 transition-colors">
                                            {!isStudentMode && (
                                                <div className="bg-slate-950 px-3 py-2 border-b border-slate-800 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="flex items-center space-x-2 text-slate-400"><GripVertical className="w-4 h-4 cursor-grab" /><span className="text-[10px] font-bold uppercase">{block.type} BLOCK</span></div>
                                                    <div className="flex space-x-1">
                                                        <button onClick={() => moveBlock(activeChapter.id, idx, -1)} className="p-1 hover:bg-slate-800 rounded"><ArrowUp className="w-3 h-3 text-slate-400" /></button>
                                                        <button onClick={() => moveBlock(activeChapter.id, idx, 1)} className="p-1 hover:bg-slate-800 rounded"><ArrowDown className="w-3 h-3 text-slate-400" /></button>
                                                        <div className="w-px h-4 bg-slate-800 mx-1" />
                                                        <button onClick={() => insertBlock(activeChapter.id, idx, 'html')} className="p-1 hover:bg-slate-800 rounded" title="Insert Text Below"><Type className="w-3 h-3 text-blue-400" /></button>
                                                        <button onClick={() => insertBlock(activeChapter.id, idx, 'image')} className="p-1 hover:bg-slate-800 rounded" title="Insert Image Below"><ImagePlus className="w-3 h-3 text-emerald-400" /></button>
                                                        <button onClick={() => deleteBlock(activeChapter.id, block.id)} className="p-1 hover:bg-slate-800 rounded ml-2"><Trash2 className="w-3 h-3 text-red-400" /></button>
                                                    </div>
                                                </div>
                                            )}
                                            {block.type === 'html' ? (
                                                <ContentEditableBlock html={block.content} readOnly={isStudentMode} onChange={(content) => updateBlock(activeChapter.id, block.id, { content })} />
                                            ) : (
                                                <div className="p-6 flex flex-col items-center justify-center min-h-[250px] bg-slate-950">
                                                    {block.isLoading ? (
                                                        <div className="flex flex-col items-center text-indigo-400"><RefreshCw className="w-8 h-8 animate-spin mb-4" /><p className="text-sm">Synthesizing Image...</p></div>
                                                    ) : block.url ? (
                                                        <div className="relative group/img"><img src={block.url} alt={block.prompt} className="max-w-full rounded-lg shadow-xl" />
                                                            {!isStudentMode && <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover/img:opacity-100"><button onClick={() => handleRegenerateImage(activeChapter.id, block)} className="bg-slate-900/90 text-white p-2 rounded-lg hover:bg-indigo-600"><RefreshCw className="w-4 h-4" /></button></div>}
                                                        </div>
                                                    ) : (
                                                        <div className="text-slate-500 flex flex-col items-center max-w-md text-center"><ImageIcon className="w-12 h-12 mb-4 opacity-50" /><input type="text" value={block.prompt} onChange={(e) => updateBlock(activeChapter.id, block.id, { prompt: e.target.value })} disabled={isStudentMode} className="w-full bg-transparent border-b border-slate-700 text-center focus:border-indigo-500 outline-none mb-4 italic p-1" placeholder="Describe image here..." />
                                                            {!isStudentMode && <div className="flex space-x-3"><button onClick={() => handleRegenerateImage(activeChapter.id, block)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm flex items-center"><Sparkles className="w-4 h-4 mr-2" /> Generate Image</button><label className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm cursor-pointer hover:bg-slate-700">Upload Base<input type="file" accept="image/*" className="hidden" onChange={(e) => handleBlockImageUpload(activeChapter.id, block.id, e)} /></label></div>}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {!isStudentMode && activeChapter.blocks.length === 0 && (
                                        <div className="text-center p-12 border border-dashed border-slate-700 rounded-xl"><p className="text-slate-500 mb-4">No content blocks yet.</p><button onClick={() => insertBlock(activeChapter.id, -1, 'html')} className="bg-indigo-600 text-white px-4 py-2 rounded-lg">Add First Block</button></div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'quiz' && (
                                <div className="max-w-3xl mx-auto">
                                    {activeChapter.mcqs.length > 0 ? (
                                        <div className="space-y-8">
                                            {activeChapter.mcqs.map((mcq, idx) => (
                                                <div key={mcq.id} className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                                                    <h3 className="text-lg font-bold mb-4">{idx + 1}. {mcq.question}</h3>
                                                    <div className="space-y-3">
                                                        {mcq.options.map((opt, oIdx) => (
                                                            <div key={oIdx} className={`p-3 rounded-lg border cursor-pointer flex items-center space-x-3 ${isStudentMode ? quizSubmitted ? oIdx === mcq.correctOptionIndex ? 'bg-emerald-900/30 border-emerald-500/50' : studentAnswers[mcq.id] === oIdx ? 'bg-red-900/30 border-red-500/50' : 'bg-slate-900/50 border-slate-700' : studentAnswers[mcq.id] === oIdx ? 'bg-indigo-900/40 border-indigo-500/50' : 'bg-slate-900/50 border-slate-700' : oIdx === mcq.correctOptionIndex ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-200' : 'bg-slate-900/50 border-slate-700'}`} onClick={() => { if (isStudentMode && !quizSubmitted) setStudentAnswers(prev => ({ ...prev, [mcq.id]: oIdx })); }}>
                                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${(isStudentMode && quizSubmitted && oIdx === mcq.correctOptionIndex) || (!isStudentMode && oIdx === mcq.correctOptionIndex) ? 'border-emerald-500 bg-emerald-500' : studentAnswers[mcq.id] === oIdx ? 'border-indigo-500 bg-indigo-500' : 'border-slate-600'}`}>
                                                                    {((isStudentMode && quizSubmitted && oIdx === mcq.correctOptionIndex) || (!isStudentMode && oIdx === mcq.correctOptionIndex)) && <CheckCircle className="w-3 h-3 text-white" />}
                                                                </div>
                                                                <span>{opt}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {(quizSubmitted || !isStudentMode) && mcq.explanation && <div className="mt-4 p-4 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-300"><strong>Explanation:</strong> {mcq.explanation}</div>}
                                                </div>
                                            ))}
                                            {isStudentMode && !quizSubmitted && <button onClick={() => setQuizSubmitted(true)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg">Submit Answers</button>}
                                        </div>
                                    ) : (
                                        <div className="text-center p-12 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700"><ListChecks className="w-12 h-12 text-slate-500 mx-auto mb-4" /><h3 className="text-lg font-medium text-slate-300">No Quiz Available</h3></div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : <div className="flex-1 flex flex-col items-center justify-center"><BookOpen className="w-16 h-16 opacity-20" /></div>}
            </div>

            {/* Right Panel / Tool Panel */}
            {activeChapter && (
                <div className="w-80 bg-slate-950 flex flex-col border-l border-slate-800 shadow-xl flex-shrink-0 z-20">
                    {isStudentMode ? (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-slate-800 bg-indigo-900/20 flex items-center space-x-3"><Bot className="w-6 h-6 text-indigo-400" /><h3 className="font-bold text-indigo-100">AI Tutor Chat</h3></div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <div className="bg-slate-800 p-3 rounded-xl rounded-tl-sm text-sm text-slate-300"><p>Hello! I am your AI Tutor for <strong>{activeChapter.title}</strong>. Ask me any questions about the material!</p></div>
                                {(tutorChats[activeChapter.id] || []).map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm'}`}>{msg.text}</div>
                                    </div>
                                ))}
                                {tutorLoading && <div className="flex justify-start"><div className="bg-slate-800 p-3 rounded-xl rounded-tl-sm text-sm text-slate-400 flex space-x-1"><span className="animate-bounce">.</span><span className="animate-bounce delay-100">.</span><span className="animate-bounce delay-200">.</span></div></div>}
                                <div ref={tutorChatEndRef} />
                            </div>
                            <form onSubmit={handleTutorSubmit} className="p-4 border-t border-slate-800 bg-slate-900 relative">
                                <input type="text" value={tutorQuery} onChange={(e) => setTutorQuery(e.target.value)} placeholder="Ask a question..." className="w-full bg-slate-800 border border-slate-700 rounded-full py-2.5 pl-4 pr-12 text-sm text-white focus:border-indigo-500 outline-none" />
                                <button type="submit" disabled={tutorLoading || !tutorQuery.trim()} className="absolute right-6 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300 disabled:opacity-50"><Send className="w-4 h-4" /></button>
                            </form>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-5 space-y-8">
                            <div>
                                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center"><BrainCircuit className="w-4 h-4 mr-2 text-indigo-400" /> Knowledge Base</h3>
                                <div className="space-y-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
                                    <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white outline-none">
                                        {SOURCE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                    </select>
                                    {sourceType === 'file' ? (
                                        <div className="space-y-2">
                                            <label className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-600 rounded cursor-pointer hover:bg-slate-800 transition-colors">
                                                <FileDown className="w-6 h-6 text-slate-400 mb-2" />
                                                <span className="text-xs text-slate-400">{sourceFile ? sourceFile.name : 'Select File (Max 5MB)'}</span>
                                                <input type="file" className="hidden" onChange={handleFileUpload} />
                                            </label>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <input type="text" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Resource Name (optional)" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white outline-none" />
                                            {sourceType === 'link' ? <input type="url" value={sourceValue} onChange={(e) => setSourceValue(e.target.value)} placeholder="https://..." className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white outline-none" /> : <textarea value={sourceValue} onChange={(e) => setSourceValue(e.target.value)} placeholder="Paste text here..." className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white outline-none h-24" />}
                                        </div>
                                    )}
                                    <button onClick={handleAddSource} disabled={(!sourceValue && !sourceFile)} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2 rounded text-xs transition-colors">Add to Context</button>
                                </div>

                                {activeChapter.sources?.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        <span className="text-[10px] uppercase text-slate-500 font-bold block">Current Sources</span>
                                        {activeChapter.sources.map(src => (
                                            <div key={src.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2 rounded text-xs group">
                                                <div className="flex items-center space-x-2 truncate pr-2"><div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center flex-shrink-0"><FileText className="w-3 h-3 text-indigo-400" /></div><span className="truncate text-slate-300" title={src.name}>{src.name}</span></div>
                                                <button onClick={() => handleDeleteSource(src.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3" /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="pt-6 border-t border-slate-800">
                                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center"><Edit3 className="w-4 h-4 mr-2 text-emerald-400" /> Course Generation</h3>
                                <div className="space-y-4">
                                    <textarea value={activeChapter.customPrompt || ''} onChange={(e) => updateChapter(activeChapter.id, { customPrompt: e.target.value })} placeholder="Custom Instructor Guidelines (e.g., 'Focus on X, explain Y simply...')" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 outline-none h-24 focus:border-emerald-500" />
                                    <button onClick={() => regenerateChapter(activeChapter.id, activeChapter.sources || [])} disabled={isGenerating} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg text-sm flex items-center justify-center disabled:opacity-50 transition-colors">
                                        {isGenerating ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Synthesizing...</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate Chapter Content</>}
                                    </button>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-800">
                                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center"><ListChecks className="w-4 h-4 mr-2 text-amber-400" /> Quiz Builder</h3>
                                <div className="space-y-3">
                                    <div className="flex space-x-2">
                                        <div className="flex-1"><label className="text-[10px] text-slate-500 uppercase block mb-1">Count</label><input type="number" min="1" max="20" value={mcqConfig.count} onChange={e => setMcqConfig({...mcqConfig, count: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none" /></div>
                                        <div className="flex-1"><label className="text-[10px] text-slate-500 uppercase block mb-1">Level</label><select value={mcqConfig.difficulty} onChange={e => setMcqConfig({...mcqConfig, difficulty: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none"><option>Easy</option><option>Medium</option><option>Hard</option></select></div>
                                    </div>
                                    <button onClick={handleGenerateMCQs} disabled={isGeneratingMCQs || activeChapter.blocks.length === 0} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-lg text-xs flex items-center justify-center disabled:opacity-50 transition-colors">
                                        {isGeneratingMCQs ? <><RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> Generating Quiz...</> : <><Trophy className="w-3.5 h-3.5 mr-2" /> Build MCQs from Text</>}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="pt-6 border-t border-slate-800">
                                <button onClick={() => handleDownloadWord(activeChapter)} className="w-full flex items-center justify-center space-x-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 py-3 rounded-lg border border-slate-700 transition-colors"><FileDown className="w-4 h-4 text-blue-400" /><span>Export Module to Word</span></button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* API Key Modal */}
            {isApiKeyModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-md w-full shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                        <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold flex items-center"><Settings className="w-5 h-5 mr-2 text-indigo-400" />API Configuration</h3><button onClick={() => setIsApiKeyModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>
                        <div className="space-y-4">
                            <div className="text-sm text-slate-400 space-y-3">
                                <p>This app runs using Gemini's highly optimized models. Both professors and students can use their own <strong>completely free</strong> API Keys without requiring paid, premium accounts.</p>
                                <div><h4 className="font-bold text-slate-300 mb-1">How to retrieve your Free Key</h4>
                                    <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                                        <li>Visit the <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Google AI Studio Dashboard</a>.</li>
                                        <li>Log in with any normal, free Google email address.</li>
                                        <li>Click the prominent "Get API Key" button on the upper left.</li>
                                        <li>Click "Create API Key", copy it, and paste it in the field below!</li>
                                    </ol>
                                </div>
                            </div>
                            <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="AIzaSy..." className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white font-mono text-sm focus:border-indigo-500 outline-none" />
                            {testResult && <div className={`p-3 rounded-lg text-sm border ${testResult.success ? 'bg-emerald-900/20 border-emerald-800 text-emerald-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>{testResult.msg}</div>}
                            <div className="flex space-x-3 pt-2">
                                <button onClick={handleTestApiKey} disabled={isTestingKey || !apiKeyInput.trim()} className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-medium rounded-lg text-sm transition-colors">{isTestingKey ? 'Testing...' : 'Test Connection'}</button>
                                <button onClick={() => handleSaveApiKey(apiKeyInput)} className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-lg">Save Key</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            {confirmModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
                        <div className="flex items-center space-x-3 mb-4 text-red-400"><AlertTriangle className="w-6 h-6" /><h3 className="text-lg font-bold">{confirmModal.title}</h3></div>
                        <p className="text-slate-300 mb-6">{confirmModal.message}</p>
                        <div className="flex space-x-3 justify-end"><button onClick={() => setConfirmModal(null)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors">Cancel</button><button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors">Confirm</button></div>
                    </div>
                </div>
            )}

            {/* Toast Notifications */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-up">
                    <div className={`flex items-center space-x-2 px-4 py-3 rounded-full shadow-2xl border ${toast.type === 'error' ? 'bg-red-900/90 border-red-500/50 text-red-100' : toast.type === 'warning' ? 'bg-amber-900/90 border-amber-500/50 text-amber-100' : toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100' : 'bg-slate-800/90 border-slate-600 text-slate-100'}`}>
                        {toast.type === 'error' && <AlertCircle className="w-4 h-4" />}{toast.type === 'warning' && <AlertTriangle className="w-4 h-4" />}{toast.type === 'success' && <CheckCircle className="w-4 h-4" />}<span className="text-sm font-medium">{toast.msg}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
