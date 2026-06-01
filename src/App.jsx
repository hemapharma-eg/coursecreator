import React, { useState, useEffect, useRef } from 'react';
import { 
    Book, FileText, Plus, Download, Upload, 
    Trash2, Settings, BookOpen, Save, CheckCircle, 
    AlertCircle, AlertTriangle, FileDown, FilePlus, ExternalLink, Code, RefreshCw,
    Image as ImageIcon, Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Superscript, Subscript, ArrowUp, ArrowDown,
    Strikethrough, Heading1, Heading2, Heading3, Type, Quote, Undo, Redo, AlignJustify, Menu, X,
    BrainCircuit, ListChecks, Trophy, Eye, Edit3, MessageSquare, Send, Bot, Sparkles, User, Lock, Unlock, FileImage, ImagePlus, GripVertical
} from 'lucide-react';
import LZString from 'lz-string';

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

let lastKnownSelection = null;
let activeEditorRef = null;

if (typeof document !== 'undefined') {
    document.addEventListener('selectionchange', () => {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const node = sel.anchorNode;
            const element = node.nodeType === 3 ? node.parentNode : node;
            if (element && element.closest && element.closest('.rich-text-editor')) {
                lastKnownSelection = sel.getRangeAt(0).cloneRange();
            }
        }
    });
}

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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey}`;
    const payload = { contents: [{ parts: parts }], tools: [{ google_search: {} }] };
    const options = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
    const result = await fetchWithRetry(url, options);
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGeminiJSON(promptOrParts, schema) {
    const activeKey = getActiveApiKey();
    if (!activeKey) throw new Error("MISSING_API_KEY");
    const parts = Array.isArray(promptOrParts) ? promptOrParts : [{ text: promptOrParts }];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey}`;
    const payload = { contents: [{ parts: parts }], generationConfig: { responseMimeType: "application/json", responseSchema: schema } };
    const options = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
    const result = await fetchWithRetry(url, options);
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return JSON.parse(text);
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

    const handleFocus = () => {
        if (!readOnly) activeEditorRef = contentRef.current;
    };

    return (
        <div 
            ref={contentRef}
            contentEditable={!readOnly}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className={`rich-text-editor outline-none p-6 min-h-[60px] w-full overflow-x-auto ${readOnly ? 'prose max-w-none' : 'focus:bg-slate-50/80'}`}
        />
    );
};

const EditorToolbar = ({ isStudentMode }) => {
    if (isStudentMode) return null;

    const execCmd = (cmd, value = null) => {
        document.execCommand(cmd, false, value);
    };

    const insertTable = () => {
        const tableHTML = `<table class="w-full border-collapse mb-4 bg-slate-100 rounded overflow-hidden">
            <tr><th class="border border-slate-300 p-2 text-slate-900 font-bold bg-slate-200">Header 1</th><th class="border border-slate-300 p-2 text-slate-900 font-bold bg-slate-200">Header 2</th></tr>
            <tr><td class="border border-slate-300 p-2">Cell 1</td><td class="border border-slate-300 p-2">Cell 2</td></tr>
        </table>`;
        document.execCommand('insertHTML', false, tableHTML);
    };

    const insertImageInline = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            if (activeEditorRef) {
                activeEditorRef.focus();
            }
            if (lastKnownSelection) {
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(lastKnownSelection);
            }
            document.execCommand('insertImage', false, event.target.result);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleTableCmd = (cmd) => {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        let node = sel.getRangeAt(0).startContainer;
        while (node && node.nodeName !== 'TD' && node.nodeName !== 'TH') {
            node = node.parentNode;
        }
        if (!node) { alert("Please click inside a table cell first."); return; }
        
        const tr = node.parentNode;
        const cellIndex = Array.from(tr.children).indexOf(node);

        if (cmd === 'addRow') {
            const newRow = document.createElement('tr');
            for (let i = 0; i < tr.children.length; i++) {
                const td = document.createElement(node.nodeName);
                td.className = "border border-slate-300 p-2";
                td.innerHTML = "New Cell";
                newRow.appendChild(td);
            }
            tr.parentNode.insertBefore(newRow, tr.nextSibling);
        } else if (cmd === 'delRow') {
            tr.parentNode.removeChild(tr);
        } else if (cmd === 'addCol') {
            Array.from(tr.parentNode.children).forEach(row => {
                const td = document.createElement(row.children[cellIndex]?.nodeName || 'td');
                td.className = "border border-slate-300 p-2";
                td.innerHTML = "New Cell";
                if (row.children[cellIndex]) {
                    row.insertBefore(td, row.children[cellIndex].nextSibling);
                } else {
                    row.appendChild(td);
                }
            });
        } else if (cmd === 'delCol') {
            Array.from(tr.parentNode.children).forEach(row => {
                if (row.children[cellIndex]) row.removeChild(row.children[cellIndex]);
            });
        } else if (cmd === 'mergeRight') {
            if (node.nextSibling) {
                node.colSpan = (node.colSpan || 1) + (node.nextSibling.colSpan || 1);
                node.parentNode.removeChild(node.nextSibling);
            }
        } else if (cmd === 'split') {
            if (node.colSpan > 1) {
                const td = document.createElement(node.nodeName);
                td.className = "border border-slate-300 p-2";
                td.innerHTML = "Split Cell";
                td.colSpan = Math.floor(node.colSpan / 2);
                node.colSpan = Math.ceil(node.colSpan / 2);
                tr.insertBefore(td, node.nextSibling);
            }
        }
    };

    const btnClass = "p-1 hover:bg-indigo-50 rounded text-slate-600 transition-colors";

    return (
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm p-1.5 flex items-center gap-0.5 rounded-b-lg mb-4 mx-4">
            <button onMouseDown={e => { e.preventDefault(); execCmd('bold'); }} className={btnClass} title="Bold"><Bold className="w-3.5 h-3.5" /></button>
            <button onMouseDown={e => { e.preventDefault(); execCmd('italic'); }} className={btnClass} title="Italic"><Italic className="w-3.5 h-3.5" /></button>
            <button onMouseDown={e => { e.preventDefault(); execCmd('underline'); }} className={btnClass} title="Underline"><Underline className="w-3.5 h-3.5" /></button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', 'H1'); }} className={btnClass} title="Heading 1"><Heading1 className="w-3.5 h-3.5" /></button>
            <button onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', 'H2'); }} className={btnClass} title="Heading 2"><Heading2 className="w-3.5 h-3.5" /></button>
            <button onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', 'H3'); }} className={btnClass} title="Heading 3"><Heading3 className="w-3.5 h-3.5" /></button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button onMouseDown={e => { e.preventDefault(); execCmd('insertUnorderedList'); }} className={btnClass} title="Bullet List"><List className="w-3.5 h-3.5" /></button>
            <button onMouseDown={e => { e.preventDefault(); execCmd('insertOrderedList'); }} className={btnClass} title="Numbered List"><ListOrdered className="w-3.5 h-3.5" /></button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button onMouseDown={e => { e.preventDefault(); execCmd('justifyLeft'); }} className={btnClass} title="Align Left"><AlignLeft className="w-3.5 h-3.5" /></button>
            <button onMouseDown={e => { e.preventDefault(); execCmd('justifyCenter'); }} className={btnClass} title="Align Center"><AlignCenter className="w-3.5 h-3.5" /></button>
            <button onMouseDown={e => { e.preventDefault(); execCmd('justifyRight'); }} className={btnClass} title="Align Right"><AlignRight className="w-3.5 h-3.5" /></button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button onMouseDown={e => { e.preventDefault(); insertTable(); }} className={`${btnClass} text-[10px] font-semibold`} title="Insert Table"><Type className="w-3.5 h-3.5" /></button>
            <div className="relative group">
                <button className={`${btnClass} flex items-center text-[10px] font-semibold`} title="Table Editor">TBL ▼</button>
                <div className="absolute hidden group-hover:flex flex-col bg-white border border-slate-200 shadow-xl rounded-lg top-full mt-0 z-50 w-32 py-1 left-0">
                    <button onMouseDown={e => { e.preventDefault(); handleTableCmd('addRow'); }} className="px-3 py-1.5 text-left hover:bg-indigo-50 text-xs text-slate-700">Add Row Below</button>
                    <button onMouseDown={e => { e.preventDefault(); handleTableCmd('delRow'); }} className="px-3 py-1.5 text-left hover:bg-indigo-50 text-xs text-slate-700">Delete Row</button>
                    <div className="border-t border-slate-100 my-1" />
                    <button onMouseDown={e => { e.preventDefault(); handleTableCmd('addCol'); }} className="px-3 py-1.5 text-left hover:bg-indigo-50 text-xs text-slate-700">Add Col Right</button>
                    <button onMouseDown={e => { e.preventDefault(); handleTableCmd('delCol'); }} className="px-3 py-1.5 text-left hover:bg-indigo-50 text-xs text-slate-700">Delete Col</button>
                    <div className="border-t border-slate-100 my-1" />
                    <button onMouseDown={e => { e.preventDefault(); handleTableCmd('mergeRight'); }} className="px-3 py-1.5 text-left hover:bg-indigo-50 text-xs text-slate-700">Merge Right</button>
                    <button onMouseDown={e => { e.preventDefault(); handleTableCmd('split'); }} className="px-3 py-1.5 text-left hover:bg-indigo-50 text-xs text-slate-700">Split Cell</button>
                </div>
            </div>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <label className={`${btnClass} cursor-pointer flex items-center text-[10px] font-semibold`} title="Insert Inline Image" onMouseDown={e => { e.preventDefault(); }}>
                <ImagePlus className="w-3.5 h-3.5" />
                <input type="file" accept="image/*" className="hidden" onChange={insertImageInline} />
            </label>
        </div>
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
                blocks: [],
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
    
    const [isSharing, setIsSharing] = useState(false);
    const [shareUrl, setShareUrl] = useState(null);

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
                        if (c.blocks && c.blocks.length === 1 && c.blocks[0].id === 'b_starter') {
                            c.blocks = [];
                        }
                        if (c.mcqs && c.mcqs.length === 1 && c.mcqs[0].id === 'mcq_starter') {
                            c.mcqs = [];
                        }
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
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('course');
        if (courseId) {
            setIsStudentMode(true);
            fetch(`https://jsonblob.com/api/jsonBlob/${courseId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.c) {
                        try {
                            const decompressed = LZString.decompressFromBase64(data.c);
                            const parsed = JSON.parse(decompressed);
                            setProject(parsed);
                            if (parsed.chapters && parsed.chapters.length > 0) {
                                setActiveView(parsed.chapters[0].id);
                            }
                        } catch(e) {
                            console.error("Failed to decompress", e);
                            alert("Corrupted course data.");
                        }
                    } else {
                        setProject(data);
                        if (data.chapters && data.chapters.length > 0) {
                            setActiveView(data.chapters[0].id);
                        }
                    }
                    showMessage("Course loaded from link!", "success");
                    window.history.replaceState({}, document.title, window.location.pathname);
                })
                .catch(err => {
                    console.error("Failed to load shared course", err);
                    alert("Failed to load shared course. The link might be expired or invalid.");
                });
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
        if (err.message === "RATE_LIMIT_EXCEEDED") { showMessage("Rate limit reached. Google limits free-tier usage per IP address. Please wait 60 seconds.", "warning"); setIsApiKeyModalOpen(true); } 
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

    const insertBlock = (chapterId, index) => {
        setProject(prev => {
            const chapter = prev.chapters.find(c => c.id === chapterId);
            const newBlock = { id: 'b_' + Date.now(), type: 'html', content: '<p>New text section...</p>' };
            const blocks = [...chapter.blocks];
            blocks.splice(index + 1, 0, newBlock);
            return { ...prev, chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, blocks } : c) };
        });
    };

    const deleteChapter = (id) => {
        setConfirmModal({
            title: "Delete Module",
            message: "Are you sure you want to permanently delete this module? This cannot be undone.",
            onConfirm: () => {
                const remaining = project.chapters.filter(c => c.id !== id);
                setProject({ ...project, chapters: remaining });
                if (activeView === id) setActiveView(remaining.length > 0 ? remaining[0].id : 'book');
                showMessage("Chapter deleted.");
                setConfirmModal(null);
            },
            onCancel: () => setConfirmModal(null)
        });
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
            const currentContent = activeChapter.blocks?.map(b => b.content).join('\n\n');
            const textPrompt = `You are an elite course designer. CURRENT CONTENT:\n${currentContent || "Empty."}\nCUSTOM PROMPT:\n${activeChapter.customPrompt || "None."}\nLANGUAGE: ${project.language}\nINSTRUCTIONS:\n1. Generate an immersive educational chapter using HTML structures. Use tables, <h1>, <h2>, <h3>, <blockquote>.\n2. Output equations in HTML.\n3. Do not output markdown. Do not include <style>, <head>, or <html> tags. Only output the raw inner HTML content.\n4. Focus only on rich text.\n5. Ensure thorough coverage.`;
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
            rawOutput = rawOutput
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<\/?(?:html|head|body|script)[^>]*>/gi, '')
                .replace(/^```html/gm, '')
                .replace(/^```/gm, '')
                .trim();
            const newBlocks = [{ id: `b_${Date.now()}`, type: 'html', content: rawOutput }];
            updateChapter(activeChapter.id, { blocks: newBlocks, sources: sourcesToUse });
            showMessage("Chapter generated!", "success");
        } catch (err) { handleApiError(err); } finally { setIsGenerating(false); }
    };

    const handleGenerateMCQs = async () => {
        const activeChapter = project.chapters.find(c => c.id === activeView);
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
        } catch (e) { handleApiError(e); } finally { setIsGeneratingMCQs(false); }
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

    const handleCreateShareLink = async () => {
        setIsSharing(true);
        try {
            const studentCleaned = project.chapters.map(chap => {
                const { customPrompt, sources, ...safe } = chap;
                const lightBlocks = (safe.blocks || []).map(b => ({
                    ...b,
                    content: (b.content || '').replace(/<img[^>]*src="data:image\/[^"]*"[^>]*>/gi, '<p style="color:#6366f1;font-style:italic">[Image removed for link sharing — use Export for full version]</p>')
                }));
                return { ...safe, blocks: lightBlocks, sources: [] };
            });
            const payload = { title: project.title, language: project.language, chapters: studentCleaned, isStudentEdition: true };
            const payloadString = JSON.stringify(payload);
            const compressed = LZString.compressToBase64(payloadString);
            
            const finalPayload = { c: compressed };
            const finalPayloadString = JSON.stringify(finalPayload);

            if (finalPayloadString.length > 1000000) {
                showMessage("Course is still too large even after removing images. Please reduce text content or use Export.", "error");
                setIsSharing(false);
                return;
            }

            const response = await fetch("https://jsonblob.com/api/jsonBlob", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: finalPayloadString
            });
            if (response.ok) {
                const location = response.headers.get("Location");
                const id = location ? location.split('/').pop() : response.headers.get("x-jsonblob-id");
                if (id) {
                    const link = `${window.location.origin}${window.location.pathname}?course=${id}`;
                    setShareUrl(link);
                } else {
                    showMessage("Failed to retrieve share ID.", "error");
                }
            } else {
                showMessage("Failed to create share link. Server rejected the request.", "error");
            }
        } catch (e) {
            console.error(e);
            showMessage("Network error during sharing.", "error");
        }
        setIsSharing(false);
    };

    const updateMCQ = (mcqId, field, value) => {
        const activeChap = project.chapters.find(c => c.id === activeView);
        if (!activeChap) return;
        const updatedMCQs = activeChap.mcqs.map(q => q.id === mcqId ? { ...q, [field]: value } : q);
        updateChapter(activeChap.id, { mcqs: updatedMCQs });
    };
    
    const updateMCQOption = (mcqId, optIdx, value) => {
        const activeChap = project.chapters.find(c => c.id === activeView);
        if (!activeChap) return;
        const updatedMCQs = activeChap.mcqs.map(q => {
            if (q.id === mcqId) {
                const newOpts = [...q.options];
                newOpts[optIdx] = value;
                return { ...q, options: newOpts };
            }
            return q;
        });
        updateChapter(activeChap.id, { mcqs: updatedMCQs });
    };

    const addBlankMCQ = () => {
        const activeChap = project.chapters.find(c => c.id === activeView);
        if (!activeChap) return;
        const newMCQ = { id: 'mcq_' + Date.now(), question: "New Question?", options: ["Option A", "Option B", "Option C", "Option D"], correctOptionIndex: 0, explanation: "Explanation here." };
        updateChapter(activeChap.id, { mcqs: [...(activeChap.mcqs || []), newMCQ] });
    };

    const deleteMCQ = (mcqId) => {
        setConfirmModal({
            title: "Delete Question",
            message: "Are you sure you want to delete this question?",
            onConfirm: () => {
                const activeChap = project.chapters.find(c => c.id === activeView);
                updateChapter(activeChap.id, { mcqs: activeChap.mcqs.filter(q => q.id !== mcqId) });
                setConfirmModal(null);
            },
            onCancel: () => setConfirmModal(null)
        });
    };

    const handleDownloadWord = (activeChapter) => {
        const customStyle = `<style>
            body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 40px; }
            h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 5px; margin-bottom: 20px; font-size: 24pt; }
            h2 { color: #34495e; margin-top: 24px; margin-bottom: 12px; font-size: 18pt; }
            h3 { color: #7f8c8d; font-size: 14pt; }
            p { margin-bottom: 12px; font-size: 11pt; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; border: 1px solid #ddd; }
            th, td { border: 1px solid #000; padding: 10px; text-align: left; font-size: 11pt; }
            th { background-color: #f4f4f4; font-weight: bold; }
            img { max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 15px 0; }
            blockquote { border-left: 4px solid #ccc; margin-left: 0; padding-left: 15px; font-style: italic; color: #555; background: #f9f9f9; padding: 10px 15px; }
            .frac { display: inline-block; vertical-align: middle; text-align: center; font-size: 0.9em; margin: 0 4px; }
            .frac .num { display: block; border-bottom: 1px solid #000; padding: 0 2px; }
            .frac .den { display: block; padding: 0 2px; }
            ul, ol { margin-bottom: 12px; padding-left: 24px; font-size: 11pt; }
            li { margin-bottom: 4px; }
        </style>`;
        const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title>${customStyle}</head><body><h1>${activeChapter.title}</h1>${activeChapter.blocks.map(b => b.content).join('<br/><br/>')}</body></html>`;
        const link = document.createElement('a');
        link.href = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(html);
        link.download = `${activeChapter.title.replace(/\s+/g, '_')}.doc`; link.click();
        showMessage("Exported to Word.", "success");
    };



    const handleDeleteSource = (sourceId) => {
        const activeChapter = project.chapters.find(c => c.id === activeView);
        if (!activeChapter) return;
        updateChapter(activeChapter.id, { sources: (activeChapter.sources || []).filter(s => s.id !== sourceId) });
        showMessage("Source removed.");
    };

    const importJSON = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                setProject(parsed);
                if (parsed.chapters && parsed.chapters.length > 0) setActiveView(parsed.chapters[0].id);
                if (parsed.isStudentEdition) setIsStudentMode(true);
                showMessage("Course loaded!", "success");
            } catch (err) { showMessage("Failed to parse JSON", "error"); }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const activeChapter = project.chapters.find(c => c.id === activeView);

    return (
        <div className="flex h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/30 text-slate-900 font-sans overflow-hidden">
            <style>{`
                .rich-text-editor { color: #1e293b; font-size: 1.05rem; }
                .rich-text-editor h1, .rich-text-editor h2, .rich-text-editor h3 { font-weight: 800; color: #0f172a; margin-top: 1.5em; margin-bottom: 0.75em; }
                .rich-text-editor h1 { font-size: 1.85rem; border-left: 4px solid #6366f1; padding-left: 10px; }
                .rich-text-editor h2 { font-size: 1.45rem; color: #1e293b; }
                .rich-text-editor h3 { font-size: 1.25rem; color: #374151; }
                .rich-text-editor p { margin-bottom: 1.25em; line-height: 1.8; color: #334155; }
                .rich-text-editor ul, .rich-text-editor ol { padding-inline-start: 2.2em; margin-bottom: 1.25em; }
                .rich-text-editor ul { list-style-type: disc; } .rich-text-editor ol { list-style-type: decimal; }
                .rich-text-editor li { margin-bottom: 0.5em; color: #334155; }
                .rich-text-editor table { width: max-content; min-width: 100%; border-collapse: collapse; margin-bottom: 1.5em; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
                .rich-text-editor th { background: #f8fafc; font-weight: 700; border: 1px solid #e2e8f0; padding: 0.75em 1em; color: #1e293b; white-space: nowrap; }
                .rich-text-editor td { border: 1px solid #e2e8f0; padding: 0.75em 1em; color: #334155; }
                .rich-text-editor blockquote { border-left: 4px solid #818cf8; padding: 0.8rem 1.25rem; margin: 1.5em 0; background: #f8fafc; color: #475569; font-style: italic; border-radius: 4px; }
                .rich-text-editor img { max-width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 1em 0; }
                .table-scroll-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 1em; }
                .rich-text-editor table { display: table; }
            `}</style>

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition duration-300 z-50 w-72 bg-white flex flex-col h-full border-r border-slate-200 shadow-lg`}>
                <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-indigo-700 flex flex-col space-y-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3"><Book className="w-7 h-7 text-indigo-200" /><div><h1 className="text-lg font-black text-white tracking-tight">Course LabX</h1><span className="text-[10px] text-indigo-300 font-bold uppercase">{project.isStudentEdition ? 'Student Hub View' : 'Instructor Center'}</span></div></div>
                        <button className="md:hidden text-indigo-200 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}><X className="w-6 h-6" /></button>
                    </div>
                    {project.isStudentEdition && <div className="text-xs font-bold text-indigo-100 bg-white/15 backdrop-blur p-2 rounded-lg border border-white/20 truncate" title={project.title}>{project.title}</div>}
                </div>
                <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-2">
                    <div className="flex items-center justify-between"><span className="text-[10px] uppercase text-slate-500 font-bold">AI Engine</span><div className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /></div></div>
                    <button onClick={() => setIsApiKeyModalOpen(true)} className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-xs text-slate-700 shadow-sm transition-colors"><div className="flex items-center space-x-2"><Settings className="w-4 h-4 text-indigo-500" /><span className="text-slate-700 font-medium">{getActiveApiKey() ? 'API Key Active' : 'Configure API Key'}</span></div></button>
                </div>
                <div className="p-4 bg-white border-b border-slate-200 space-y-2">
                    <label className="flex items-center space-x-3 text-xs text-slate-700 p-2.5 rounded-lg bg-slate-50 hover:bg-indigo-50/50 cursor-pointer border border-slate-200 hover:border-indigo-200 transition-colors"><Upload className="w-4 h-4 text-indigo-500" /><span className="font-medium">Load Course (.json)</span><input type="file" accept=".json" className="hidden" onChange={importJSON} /></label>
                    {!project.isStudentEdition && (
                        <div className="grid grid-cols-1 gap-1.5 pt-1">
                            <button onClick={exportInstructorJSON} className="flex items-center space-x-2 text-[11px] text-slate-700 p-2 rounded-lg bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 transition-colors"><Download className="w-3.5 h-3.5 text-indigo-400" /><span className="font-medium">Save Backup (Teacher)</span></button>
                            <button onClick={exportStudentJSON} className="flex items-center space-x-2 text-[11px] text-slate-700 p-2 rounded-lg bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 transition-colors"><Download className="w-3.5 h-3.5 text-indigo-400" /><span className="font-medium">Export for Students</span></button>
                            <button onClick={handleCreateShareLink} disabled={isSharing} className="flex items-center space-x-2 text-[11px] text-slate-700 p-2 rounded-lg bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 transition-colors"><ExternalLink className="w-3.5 h-3.5 text-indigo-400" /><span className="font-medium">{isSharing ? 'Generating...' : 'Create Share Link'}</span></button>
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto py-4 bg-white">
                    {!project.isStudentEdition && <div className={`px-5 py-3 cursor-pointer flex items-center space-x-3 transition-all ${activeView === 'book' ? 'bg-indigo-50 border-l-3 border-indigo-500' : 'border-l-3 border-transparent hover:bg-slate-50'}`} onClick={() => setActiveView('book')}><Settings className={`w-4 h-4 ${activeView === 'book' ? 'text-indigo-600' : 'text-slate-400'}`} /><span className={`font-semibold text-sm ${activeView === 'book' ? 'text-indigo-700' : 'text-slate-700'}`}>Course Config</span></div>}
                    <div className="px-5 mt-6 mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center">Modules<span className="bg-indigo-100 text-indigo-600 py-0.5 px-2 rounded-full text-[10px] font-bold">{project.chapters.length}</span></div>
                    {project.chapters.map((chap, idx) => (
                        <div key={chap.id} className={`group px-5 py-3 cursor-pointer flex items-center justify-between transition-all ${activeView === chap.id ? 'bg-indigo-50 border-l-3 border-indigo-500' : 'border-l-3 border-transparent hover:bg-slate-50'}`} onClick={() => setActiveView(chap.id)}>
                            <div className="flex items-center space-x-3 truncate"><FileText className={`w-4 h-4 ${activeView === chap.id ? 'text-indigo-600' : 'text-slate-400'}`} /><span className={`truncate text-sm font-semibold ${activeView === chap.id ? 'text-indigo-700' : 'text-slate-700'}`}>{chap.title || `Module ${idx + 1}`}</span></div>
                            {!project.isStudentEdition && <button onClick={(e) => { e.stopPropagation(); deleteChapter(chap.id); }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>}
                        </div>
                    ))}
                    {!project.isStudentEdition && <button onClick={addChapter} className="mx-5 mt-4 flex items-center space-x-2 text-xs text-indigo-500 font-medium p-2.5 rounded-lg border border-dashed border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 w-[calc(100%-40px)] transition-colors"><Plus className="w-4 h-4" /><span>New Module</span></button>}
                </div>
                {!project.isStudentEdition && (
                    <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">Preview Mode</span>
                        <button onClick={() => { setIsStudentMode(!isStudentMode); showMessage(isStudentMode ? "Instructor Workspace" : "Student View"); }} className={`text-[10px] px-4 py-1.5 rounded-full font-bold transition-all shadow-sm ${isStudentMode ? 'bg-indigo-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>{isStudentMode ? "Exit Mode" : "Test Mode"}</button>
                    </div>
                )}
            </div>

            {/* Main Center Area */}
            <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative border-r border-slate-200">
                {activeView === 'book' && !project.isStudentEdition ? (
                    <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full"><h2 className="text-2xl font-bold mb-6 flex items-center text-slate-900"><Settings className="w-6 h-6 mr-3 text-indigo-500" />Course Configuration</h2><div className="space-y-6"><div><label className="block text-sm font-medium text-slate-700 mb-2">Course Title</label><input type="text" value={project.title} onChange={(e) => setProject({...project, title: e.target.value})} className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm" /></div><div><label className="block text-sm font-medium text-slate-700 mb-2">Language</label><select value={project.language} onChange={(e) => setProject({...project, language: e.target.value})} className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:border-indigo-500 outline-none shadow-sm"><option value="English">English</option><option value="Spanish">Spanish</option><option value="French">French</option><option value="German">German</option></select></div></div></div>
                ) : activeChapter ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 shadow-sm">
                            <div className="flex items-center space-x-4"><button className="md:hidden text-slate-600" onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6" /></button>
                            {isStudentMode ? <h2 className="text-xl font-bold text-slate-900">{activeChapter.title}</h2> : (
                                <div className="flex items-center space-x-2 group w-full max-w-md">
                                    <input type="text" value={activeChapter.title} onChange={(e) => updateChapter(activeChapter.id, { title: e.target.value })} className="text-xl font-bold bg-white text-slate-900 border border-slate-300 hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-lg px-3 py-1.5 outline-none w-full transition-all" />
                                    <Edit3 className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 opacity-60" />
                                </div>
                            )}</div>
                            <div className="flex space-x-2"><button className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === 'content' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 border border-slate-200'}`} onClick={() => setActiveTab('content')}>Read</button><button className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === 'quiz' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 border border-slate-200'}`} onClick={() => setActiveTab('quiz')}>Quiz</button></div>
                        </header>
                        <div className="flex-1 overflow-y-auto relative bg-slate-50">
                            {activeTab === 'content' && (
                                <div className="max-w-4xl mx-auto pb-16">
                                    <EditorToolbar isStudentMode={isStudentMode} />
                                    <div className="space-y-6 px-4 md:px-8">
                                    {activeChapter.blocks.map((block, idx) => (
                                        <div key={block.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden group hover:border-indigo-200 hover:shadow-md transition-all">
                                            {!isStudentMode && (
                                                <div className="bg-gradient-to-r from-slate-50 to-indigo-50/50 px-3 py-2 border-b border-slate-200 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="flex items-center space-x-2 text-slate-500"><GripVertical className="w-4 h-4 cursor-grab" /><span className="text-[10px] font-bold uppercase text-indigo-500">TEXT BLOCK</span></div>
                                                    <div className="flex space-x-1">
                                                        <button onClick={() => moveBlock(activeChapter.id, idx, -1)} className="p-1 hover:bg-white rounded text-slate-500 hover:text-indigo-600"><ArrowUp className="w-3 h-3" /></button>
                                                        <button onClick={() => moveBlock(activeChapter.id, idx, 1)} className="p-1 hover:bg-white rounded text-slate-500 hover:text-indigo-600"><ArrowDown className="w-3 h-3" /></button>
                                                        <div className="w-px h-4 bg-slate-200 mx-1" />
                                                        <button onClick={() => insertBlock(activeChapter.id, idx)} className="p-1 hover:bg-white rounded text-blue-500 hover:text-blue-600" title="Insert Text Below"><Plus className="w-3 h-3" /></button>
                                                        <button onClick={() => deleteBlock(activeChapter.id, block.id)} className="p-1 hover:bg-white rounded ml-2 text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                                    </div>
                                                </div>
                                            )}
                                            <ContentEditableBlock html={block.content} readOnly={isStudentMode} onChange={(content) => updateBlock(activeChapter.id, block.id, { content })} />
                                        </div>
                                    ))}
                                    {!isStudentMode && activeChapter.blocks.length === 0 && (
                                        <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl mx-4 mt-4 bg-white"><Sparkles className="w-10 h-10 text-indigo-300 mx-auto mb-3" /><p className="text-slate-500 mb-4 font-medium">No content blocks yet.</p><button onClick={() => insertBlock(activeChapter.id, -1)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all font-semibold">Add First Block</button></div>
                                    )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'quiz' && (
                                <div className="max-w-3xl mx-auto pb-20 mt-8">
                                    {(!isStudentMode) && (
                                        <div className="flex justify-end mb-4 mx-4">
                                            <button onClick={addBlankMCQ} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center transition-all shadow-sm"><Plus className="w-4 h-4 mr-1"/> Add Question</button>
                                        </div>
                                    )}
                                    {activeChapter.mcqs.length > 0 ? (
                                        <div className="space-y-8 px-4">
                                            {activeChapter.mcqs.map((mcq, idx) => (
                                                <div key={mcq.id} className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 relative group hover:border-indigo-200 hover:shadow-md transition-all">
                                                    {!isStudentMode && (
                                                        <button onClick={() => deleteMCQ(mcq.id)} className="absolute top-4 right-4 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 className="w-5 h-5"/></button>
                                                    )}
                                                    {isStudentMode ? <h3 className="text-lg font-bold mb-4">{idx + 1}. {mcq.question}</h3> : (
                                                        <div className="mb-4">
                                                            <label className="text-xs text-slate-600 font-bold uppercase mb-1 block">Question {idx + 1}</label>
                                                            <textarea value={mcq.question} onChange={(e) => updateMCQ(mcq.id, 'question', e.target.value)} className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 outline-none focus:border-indigo-500 min-h-[60px]" />
                                                        </div>
                                                    )}
                                                    <div className="space-y-3">
                                                        {mcq.options.map((opt, oIdx) => (
                                                            <div key={oIdx} className={`p-3 rounded-lg border flex items-center space-x-3 ${isStudentMode ? quizSubmitted ? oIdx === mcq.correctOptionIndex ? 'bg-emerald-100/30 border-emerald-500/50' : studentAnswers[mcq.id] === oIdx ? 'bg-red-100/30 border-red-500/50' : 'bg-white/50 border-slate-300' : studentAnswers[mcq.id] === oIdx ? 'bg-indigo-100/40 border-indigo-500/50 cursor-pointer' : 'bg-white/50 border-slate-300 cursor-pointer' : oIdx === mcq.correctOptionIndex ? 'bg-emerald-100/30 border-emerald-500/50 text-emerald-200' : 'bg-white/50 border-slate-300'}`} onClick={() => { if (isStudentMode && !quizSubmitted) setStudentAnswers(prev => ({ ...prev, [mcq.id]: oIdx })); }}>
                                                                {!isStudentMode ? (
                                                                    <input type="radio" name={`correct_${mcq.id}`} checked={mcq.correctOptionIndex === oIdx} onChange={() => updateMCQ(mcq.id, 'correctOptionIndex', oIdx)} className="w-4 h-4 cursor-pointer" />
                                                                ) : (
                                                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${(isStudentMode && quizSubmitted && oIdx === mcq.correctOptionIndex) || (!isStudentMode && oIdx === mcq.correctOptionIndex) ? 'border-emerald-500 bg-emerald-500' : studentAnswers[mcq.id] === oIdx ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
                                                                        {((isStudentMode && quizSubmitted && oIdx === mcq.correctOptionIndex) || (!isStudentMode && oIdx === mcq.correctOptionIndex)) && <CheckCircle className="w-3 h-3 text-slate-900" />}
                                                                    </div>
                                                                )}
                                                                {isStudentMode ? <span>{opt}</span> : (
                                                                    <input value={opt} onChange={(e) => updateMCQOption(mcq.id, oIdx, e.target.value)} className="w-full bg-transparent text-slate-900 outline-none focus:border-b focus:border-indigo-500" />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {(quizSubmitted || !isStudentMode) && (
                                                        <div className="mt-4 p-4 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 flex flex-col">
                                                            <strong className="mb-1 text-slate-600 text-xs uppercase">Feedback / Explanation:</strong>
                                                            {isStudentMode ? mcq.explanation : (
                                                                <textarea value={mcq.explanation} onChange={(e) => updateMCQ(mcq.id, 'explanation', e.target.value)} className="w-full bg-transparent text-slate-900 outline-none focus:border-indigo-500 border border-transparent hover:border-slate-300 p-1 rounded min-h-[60px]" />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {isStudentMode && !quizSubmitted && <button onClick={() => setQuizSubmitted(true)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all">Submit Answers</button>}
                                        </div>
                                    ) : (
                                        <div className="text-center p-12 bg-white rounded-2xl border-2 border-dashed border-slate-200 mx-4"><ListChecks className="w-12 h-12 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-slate-500">No Quiz Available</h3><p className="text-sm text-slate-400 mt-2">Generate quiz questions from the right panel</p></div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : <div className="flex-1 flex flex-col items-center justify-center"><BookOpen className="w-16 h-16 text-slate-200" /><p className="text-slate-400 mt-4 text-sm">Select a module to begin</p></div>}
            </div>

            {/* Right Panel / Tool Panel */}
            {activeChapter && (
                <div className="w-80 bg-white flex flex-col border-l border-slate-200 shadow-md flex-shrink-0 z-20">
                    {isStudentMode ? (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-slate-200 bg-indigo-600 flex items-center space-x-3"><Bot className="w-6 h-6 text-indigo-200" /><h3 className="font-bold text-white">AI Tutor Chat</h3></div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                                <div className="bg-white p-3 rounded-xl rounded-tl-sm text-sm text-slate-700 shadow-sm border border-slate-100"><p>Hello! I am your AI Tutor for <strong className="text-indigo-700">{activeChapter.title}</strong>. Ask me any questions about the material!</p></div>
                                {(tutorChats[activeChapter.id] || []).map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white text-slate-800 rounded-tl-sm border border-slate-100'}`}>{msg.text}</div>
                                    </div>
                                ))}
                                {tutorLoading && <div className="flex justify-start"><div className="bg-white p-3 rounded-xl rounded-tl-sm text-sm text-indigo-500 flex space-x-1 shadow-sm border border-slate-100"><span className="animate-bounce">.</span><span className="animate-bounce delay-100">.</span><span className="animate-bounce delay-200">.</span></div></div>}
                                <div ref={tutorChatEndRef} />
                            </div>
                            <form onSubmit={handleTutorSubmit} className="p-4 border-t border-indigo-100 bg-white relative">
                                <input type="text" value={tutorQuery} onChange={(e) => setTutorQuery(e.target.value)} placeholder="Ask a question..." className="w-full bg-slate-50 border border-indigo-200 rounded-full py-2.5 pl-4 pr-12 text-sm text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" />
                                <button type="submit" disabled={tutorLoading || !tutorQuery.trim()} className="absolute right-6 top-1/2 -translate-y-1/2 text-indigo-500 hover:text-indigo-700 disabled:opacity-50"><Send className="w-4 h-4" /></button>
                            </form>
                        </div>
                    ) : (
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
                                            {sourceType === 'link' ? <input type="url" value={sourceValue} onChange={(e) => setSourceValue(e.target.value)} placeholder="https://..." className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 outline-none" /> : <textarea value={sourceValue} onChange={(e) => setSourceValue(e.target.value)} placeholder="Paste text here..." className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 outline-none h-24" />}
                                        </div>
                                    )}
                                    <button onClick={handleAddSource} disabled={(!sourceValue && !sourceFile)} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-xs transition-all">Add to Context</button>
                                </div>

                                {activeChapter.sources?.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        <span className="text-[10px] uppercase text-slate-500 font-bold block">Current Sources</span>
                                        {activeChapter.sources.map(src => (
                                            <div key={src.id} className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded text-xs group">
                                                <div className="flex items-center space-x-2 truncate pr-2"><div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center flex-shrink-0"><FileText className="w-3 h-3 text-indigo-400" /></div><span className="truncate text-slate-700" title={src.name}>{src.name}</span></div>
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
                                    <button onClick={() => regenerateChapter(activeChapter.id, activeChapter.sources || [])} disabled={isGenerating || (!activeChapter.customPrompt?.trim() && (!activeChapter.sources || activeChapter.sources.length === 0))} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg text-sm flex items-center justify-center disabled:opacity-50 transition-all shadow-sm hover:shadow-md">
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
                                <button onClick={() => handleDownloadWord(activeChapter)} className="w-full flex items-center justify-center space-x-2 text-sm text-slate-600 font-medium bg-slate-50 hover:bg-indigo-50/50 py-3 rounded-lg border border-slate-200 hover:border-indigo-200 transition-all"><FileDown className="w-4 h-4 text-indigo-400" /><span>Export Module to Word</span></button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* API Key Modal */}
            {isApiKeyModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white border border-slate-300 p-6 rounded-2xl max-w-md w-full shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                        <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold flex items-center"><Settings className="w-5 h-5 mr-2 text-indigo-400" />API Configuration</h3><button onClick={() => setIsApiKeyModalOpen(false)} className="text-slate-600 hover:text-slate-900"><X className="w-5 h-5" /></button></div>
                        <div className="space-y-4">
                            <div className="text-sm text-slate-600 space-y-3">
                                <p>This app runs using Gemini's highly optimized models. Both professors and students can use their own <strong>completely free</strong> API Keys without requiring paid, premium accounts.</p>
                                <div><h4 className="font-bold text-slate-700 mb-1">How to retrieve your Free Key</h4>
                                    <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                                        <li>Visit the <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Google AI Studio Dashboard</a>.</li>
                                        <li>Log in with any normal, free Google email address.</li>
                                        <li>Click the prominent "Get API Key" button on the upper left.</li>
                                        <li>Click "Create API Key", copy it, and paste it in the field below!</li>
                                    </ol>
                                </div>
                            </div>
                            <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="AIzaSy..." className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-900 font-mono text-sm focus:border-indigo-500 outline-none" />
                            {testResult && <div className={`p-3 rounded-lg text-sm border ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{testResult.msg}</div>}
                            <div className="flex space-x-3 pt-2">
                                <button onClick={handleTestApiKey} disabled={isTestingKey || !apiKeyInput.trim()} className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-medium rounded-lg text-sm transition-colors">{isTestingKey ? 'Testing...' : 'Test Connection'}</button>
                                <button onClick={() => handleSaveApiKey(apiKeyInput)} className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-lg">Save Key</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Share Link Modal */}
            {shareUrl && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white border border-slate-300 p-6 rounded-2xl max-w-lg w-full shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold flex items-center"><ExternalLink className="w-5 h-5 mr-2 text-emerald-400" />Student Link Created!</h3>
                            <button onClick={() => setShareUrl(null)} className="text-slate-600 hover:text-slate-900"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-slate-700 mb-4 text-sm">Share this secure link with your students. They can open it directly in their browser without downloading any files!</p>
                        <input type="text" readOnly value={shareUrl} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-emerald-400 font-mono text-sm mb-6 focus:outline-none focus:border-emerald-500" />
                        <div className="flex space-x-3">
                            <button onClick={() => { navigator.clipboard.writeText(shareUrl); showMessage("Copied to clipboard!", "success"); }} className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors shadow-lg flex items-center justify-center">Copy Link</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            {confirmModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white border border-slate-300 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
                        <div className="flex items-center space-x-3 mb-4 text-red-400"><AlertTriangle className="w-6 h-6" /><h3 className="text-lg font-bold">{confirmModal.title}</h3></div>
                        <p className="text-slate-700 mb-6">{confirmModal.message}</p>
                        <div className="flex space-x-3 justify-end"><button onClick={() => setConfirmModal(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm transition-colors">Cancel</button><button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors">Confirm</button></div>
                    </div>
                </div>
            )}

            {/* Toast Notifications */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-up">
                    <div className={`flex items-center space-x-2 px-4 py-3 rounded-full shadow-2xl border ${toast.type === 'error' ? 'bg-red-500 text-white' : toast.type === 'warning' ? 'bg-amber-500 text-white' : toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white'}`}>
                        {toast.type === 'error' && <AlertCircle className="w-4 h-4" />}{toast.type === 'warning' && <AlertTriangle className="w-4 h-4" />}{toast.type === 'success' && <CheckCircle className="w-4 h-4" />}<span className="text-sm font-medium">{toast.msg}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
