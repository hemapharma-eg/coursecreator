import React, { useState, useEffect, useRef } from 'react';
import { 
    Book, FileText, Plus, Download, Upload, 
    Trash2, Settings, BookOpen, Save, CheckCircle, 
    AlertCircle, AlertTriangle, FileDown, FilePlus, ExternalLink, Code, RefreshCw,
    Image as ImageIcon, Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Superscript, Subscript, ArrowUp, ArrowDown,
    Strikethrough, Heading1, Heading2, Heading3, Type, Quote, Undo, Redo, AlignJustify, Menu, X,
    BrainCircuit, ListChecks, Trophy, Eye, Edit3, MessageSquare, Send, Bot, Sparkles, User, Lock, Unlock
} from 'lucide-react';

const SOURCE_TYPES = [
    { id: 'link', label: 'Website Link', icon: ExternalLink },
    { id: 'text', label: 'Paste Text (Word/PDF excerpt)', icon: FileText },
    { id: 'file', label: 'Upload File (PDF, Image, Text)', icon: FilePlus },
    { id: 'code', label: 'Application Code', icon: Code },
];

const apiKey = ""; // Provided by execution environment

const getActiveApiKey = () => {
    const customKey = localStorage.getItem('user_gemini_api_key');
    if (customKey && customKey.trim() !== "") {
        return customKey.trim();
    }
    return apiKey || "";
};

const getWordCount = (blocks) => {
    if (!blocks || blocks.length === 0) return 0;
    const text = blocks.filter(b => b.type === 'html').map(b => b.content).join(' ');
    const plainText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return plainText === '' ? 0 : plainText.split(' ').length;
};

async function fetchWithRetry(url, options, retries = 5) {
    const delays = [1000, 2000, 4000, 8000, 16000];
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429) {
                throw new Error("RATE_LIMIT_EXCEEDED");
            }
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
            if (error.message === "RATE_LIMIT_EXCEEDED" || error.message === "INVALID_API_KEY") {
                throw error;
            }
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
    const payload = {
        contents: [{ parts: parts }],
        tools: [{ google_search: {} }]
    };
    const options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    };
    const result = await fetchWithRetry(url, options);
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGeminiJSON(promptOrParts, schema) {
    const activeKey = getActiveApiKey();
    if (!activeKey) throw new Error("MISSING_API_KEY");
    const parts = Array.isArray(promptOrParts) ? promptOrParts : [{ text: promptOrParts }];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
    const payload = {
        contents: [{ parts: parts }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    };
    const options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    };
    const result = await fetchWithRetry(url, options);
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return JSON.parse(text);
}

async function callGeminiImage(prompt) {
    const activeKey = getActiveApiKey();
    if (!activeKey) throw new Error("MISSING_API_KEY");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${activeKey}`;
    const payload = { instances: { prompt: prompt }, parameters: { sampleCount: 1 } };
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    };
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
        contents: [{
            parts: [
                { text: prompt },
                { inlineData: { mimeType: referenceImage.mimeType, data: referenceImage.data } }
            ]
        }],
        generationConfig: {
            responseModalities: ['TEXT', 'IMAGE']
        }
    };
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    };
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
                    question: { type: "STRING", description: "The multiple choice question text." },
                    options: { type: "ARRAY", items: { type: "STRING" }, description: "Exactly 4 possible options/answers." },
                    correctOptionIndex: { type: "INTEGER", description: "The array index (0-3) of the correct option." },
                    explanation: { type: "STRING", description: "A detailed educational explanation of why the correct answer is right and others are wrong." }
                },
                required: ["question", "options", "correctOptionIndex", "explanation"]
            }
        }
    },
    required: ["mcqs"]
};

const ContentEditableBlock = ({ html, onChange, dir, readOnly }) => {
    const contentRef = useRef(null);

    useEffect(() => {
        if (contentRef.current && contentRef.current.innerHTML !== html) {
            contentRef.current.innerHTML = html;
        }
    }, [html]);

    const handleBlur = () => {
        if (contentRef.current && !readOnly) {
            onChange(contentRef.current.innerHTML);
        }
    };

    return (
        <div 
            ref={contentRef}
            contentEditable={!readOnly}
            onBlur={handleBlur}
            className={`rich-text-editor outline-none p-4 md:p-6 min-h-[60px] w-full ${readOnly ? 'prose max-w-none' : 'focus:bg-indigo-50/20'}`}
            dir={dir}
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
                mcqs: [
                    {
                        id: 'mcq_starter',
                        question: 'What is the primary objective of a student-facing course JSON file in this application?',
                        options: [
                            'To edit the chapter content and modify instruction templates',
                            'To read the material, take auto-graded quizzes, and interact with a personal AI Tutor',
                            'To manage course settings and delete instructor backups',
                            'To design vector artwork and export LaTeX tables'
                        ],
                        correctOptionIndex: 1,
                        explanation: 'The Student Edition is a read-only environment centered around consumption, assessments, and AI guided explanations.'
                    }
                ],
                customPrompt: 'Focus heavily on structural system design and explain complex logic flows.',
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
                        if (c.content && (!c.blocks || c.blocks.length === 0)) {
                            c.blocks = [{ id: 'b_' + Date.now() + Math.random(), type: 'html', content: c.content }];
                        }
                        if (!c.blocks) c.blocks = [];
                        if (!c.mcqs) c.mcqs = []; 
                        return c;
                    });
                }
                setProject(parsed); 
                if (parsed.isStudentEdition) {
                    setIsStudentMode(true);
                }
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
                            if (!safeSource.value.includes("[MEMORY SAVED]")) {
                                safeSource.value += " [MEMORY SAVED: Source content was too large to keep in browser cache. Please re-upload if regenerating.]";
                            }
                        }
                        return safeSource;
                    })
                }))
            };
            localStorage.setItem('book_project_state', JSON.stringify(safeProject));
        } catch (e) {
            console.warn("Storage quota exceeded. Project might be too large to auto-save to browser.");
        }
    }, [project]);

    useEffect(() => {
        setStudentAnswers({});
        setQuizSubmitted(false);
    }, [activeView, activeTab, isStudentMode]);

    useEffect(() => {
        if (tutorChatEndRef.current) {
            tutorChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [tutorChats, tutorLoading]);

    const showMessage = (msg, type = 'info') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const handleSaveApiKey = (keyToSave) => {
        const trimmed = keyToSave.trim();
        localStorage.setItem('user_gemini_api_key', trimmed);
        setApiKeyInput(trimmed);
        showMessage("AI API Credentials saved locally!", "success");
        setIsApiKeyModalOpen(false);
    };

    const handleTestApiKey = async () => {
        if (!apiKeyInput.trim()) {
            setTestResult({ success: false, msg: "Please insert a key before testing." });
            return;
        }
        setIsTestingKey(true);
        setTestResult(null);

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKeyInput.trim()}`;
            const payload = {
                contents: [{ parts: [{ text: "Respond in 1 word: active." }] }]
            };
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error?.message || `HTTP ${response.status}`);
            }

            setTestResult({ success: true, msg: "Connection Verified! Your key is active on Google's Free Tier." });
        } catch (err) {
            setTestResult({ success: false, msg: err.message || "Failed to make test inquiry." });
        } finally {
            setIsTestingKey(false);
        }
    };

    const handleApiError = (err) => {
        console.error("AI Operations Error Log:", err);
        if (err.message === "RATE_LIMIT_EXCEEDED") {
            showMessage("AI rate limit exceeded on Google Free tier! Paste another key or wait 60 seconds.", "warning");
            setIsApiKeyModalOpen(true);
        } else if (err.message === "INVALID_API_KEY") {
            showMessage("The API Key configured is invalid or deactivated. Please check your AI settings.", "error");
            setIsApiKeyModalOpen(true);
        } else if (err.message === "MISSING_API_KEY") {
            showMessage("API Key is missing. Click AI Configuration in the sidebar to add yours.", "error");
            setIsApiKeyModalOpen(true);
        } else {
            showMessage(`Operation failed: ${err.message || err}`, "error");
        }
    };

    const addChapter = () => {
        const newId = 'chap_' + Date.now();
        const newChapter = {
            id: newId,
            title: `Chapter ${project.chapters.length + 1}`,
            blocks: [],
            mcqs: [],
            customPrompt: '',
            sources: []
        };
        setProject({ ...project, chapters: [...project.chapters, newChapter] });
        setActiveView(newId);
        setActiveTab('content');
        setIsMobileMenuOpen(false);
        showMessage("New chapter added.");
    };

    const updateChapter = (id, updates) => {
        setProject({
            ...project,
            chapters: project.chapters.map(c => c.id === id ? { ...c, ...updates } : c)
        });
    };

    const updateBlock = (chapterId, blockId, updates) => {
        setProject(prev => ({
            ...prev,
            chapters: prev.chapters.map(c => c.id === chapterId ? {
                ...c,
                blocks: c.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b)
            } : c)
        }));
    };

    const deleteChapter = (id) => {
        setProject({
            ...project,
            chapters: project.chapters.filter(c => c.id !== id)
        });
        if (activeView === id) {
            const remaining = project.chapters.filter(c => c.id !== id);
            setActiveView(remaining.length > 0 ? remaining[0].id : 'book');
        }
        showMessage("Chapter deleted.");
    };

    const importJSON = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                setProject(parsed);
                if (parsed.chapters && parsed.chapters.length > 0) {
                    setActiveView(parsed.chapters[0].id);
                }
                if (parsed.isStudentEdition) {
                    setIsStudentMode(true);
                }
                showMessage("Course project successfully loaded!", "success");
            } catch (err) {
                showMessage("Failed to parse JSON project file.", "error");
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const exportInstructorJSON = () => {
        const payload = {
            ...project,
            isStudentEdition: false
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
        const link = document.createElement('a');
        link.href = dataStr;
        link.download = `${project.title.replace(/\s+/g, '_')}_instructor_state.json`;
        link.click();
        showMessage("Instructor syllabus file exported.", "success");
    };

    const exportStudentJSON = () => {
        const studentCleanedChapters = project.chapters.map(chap => {
            const { customPrompt, sources, ...studentSafeChap } = chap;
            return {
                ...studentSafeChap,
                sources: [] 
            };
        });

        const studentPayload = {
            title: project.title,
            language: project.language,
            chapters: studentCleanedChapters,
            isStudentEdition: true 
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(studentPayload, null, 2));
        const link = document.createElement('a');
        link.href = dataStr;
        link.download = `${project.title.replace(/\s+/g, '_')}_student_syllabus.json`;
        link.click();
        showMessage("IP-Protected Student Course exported successfully!", "success");
    };

    const activeChapter = project.chapters.find(c => c.id === activeView);

    return (
        <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
            <style>{`
                .rich-text-editor { color: #f1f5f9; font-size: 1.1rem; }
                .rich-text-editor h1, .rich-text-editor h2, .rich-text-editor h3 { font-weight: 800; color: #ffffff; margin-top: 1.5em; margin-bottom: 0.75em; }
                .rich-text-editor h1 { font-size: 1.85rem; border-left: 4px solid #6366f1; padding-left: 10px; }
                .rich-text-editor h2 { font-size: 1.45rem; }
                .rich-text-editor h3 { font-size: 1.25rem; }
                .rich-text-editor p { margin-bottom: 1.25em; line-height: 1.8; color: #cbd5e1; }
                .rich-text-editor ul { list-style-type: disc; padding-inline-start: 2.2em; margin-bottom: 1.25em; }
                .rich-text-editor ol { list-style-type: decimal; padding-inline-start: 2.2em; margin-bottom: 1.25em; }
                .rich-text-editor li { margin-bottom: 0.5em; color: #cbd5e1; }
                .rich-text-editor table { width: 100%; border-collapse: collapse; margin-bottom: 1.5em; background-color: #1e293b; border-radius: 8px; overflow: hidden; }
                .rich-text-editor th { background-color: #334155; font-weight: bold; border: 1px solid #475569; padding: 0.75em; color: #f8fafc; }
                .rich-text-editor td { border: 1px solid #475569; padding: 0.75em; color: #cbd5e1; }
                .rich-text-editor blockquote { border-left: 4px solid #6366f1; padding: 0.8rem 1.25rem; margin: 1.5em 0; background-color: #1e293b; color: #94a3b8; font-style: italic; border-radius: 4px; }
                .rich-text-editor .frac { display: inline-block; vertical-align: middle; text-align: center; margin: 0 0.3em; font-size: 0.9em; line-height: 1.2; }
                .rich-text-editor .frac .num { display: block; border-bottom: 1px solid #94a3b8; padding: 0.1em 0.2em; }
                .rich-text-editor .frac .den { display: block; padding: 0.1em 0.2em; }
            `}</style>

            {isMobileMenuOpen && (
                <div className="fixed inset-0 bg-black/70 z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
            )}

            <div className={`fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition duration-300 ease-in-out z-50 w-72 bg-slate-950 text-slate-300 flex flex-col h-full shadow-2xl flex-shrink-0 border-r border-slate-800`}>
                <div className="p-5 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <Book className="w-8 h-8 text-indigo-500" />
                        <div>
                            <h1 className="text-lg font-black text-white tracking-wide">Syllabus AI</h1>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                {project.isStudentEdition ? 'Student Hub View' : 'Instructor Center'}
                            </span>
                        </div>
                    </div>
                    <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-4 bg-slate-900 border-b border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest block">AI Engine settings</span>
                        <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] font-bold text-slate-400">
                                {localStorage.getItem('user_gemini_api_key') ? 'Custom override' : apiKey ? 'Auto-Preview' : 'Not Connected'}
                            </span>
                            <span className={`w-2.5 h-2.5 rounded-full ${getActiveApiKey() ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => {
                            setApiKeyInput(localStorage.getItem('user_gemini_api_key') || '');
                            setTestResult(null);
                            setIsApiKeyModalOpen(true);
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800/80 transition-all text-xs"
                    >
                        <div className="flex items-center space-x-2 text-slate-300 truncate">
                            <Settings className="w-4 h-4 text-indigo-400" />
                            <span className="font-semibold truncate">
                                {localStorage.getItem('user_gemini_api_key') ? 'Custom Private Key Active' : apiKey ? 'System API Key Active' : 'Enter Free API Key'}
                            </span>
                        </div>
                        <span className="text-[9px] bg-indigo-900 text-indigo-300 px-1.5 py-0.5 rounded font-black flex-shrink-0">
                            {localStorage.getItem('user_gemini_api_key') ? 'Edit' : 'Add'}
                        </span>
                    </button>
                </div>

                <div className="p-4 bg-slate-900/60 border-b border-slate-800 space-y-2">
                    <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest block mb-1">Exchange Data</span>
                    <label className="flex items-center space-x-3 text-xs text-slate-300 hover:text-white cursor-pointer w-full p-2 rounded bg-slate-800 hover:bg-slate-700 transition-all border border-slate-700/50">
                        <Upload className="w-4 h-4 text-emerald-400" />
                        <span>Load Course (.json)</span>
                        <input type="file" accept=".json" className="hidden" onChange={importJSON} />
                    </label>

                    {!project.isStudentEdition ? (
                        <div className="grid grid-cols-1 gap-2 pt-1">
                            <button 
                                onClick={exportInstructorJSON}
                                className="flex items-center space-x-2 text-left text-[11px] text-slate-300 hover:text-white p-2 rounded bg-slate-800/40 hover:bg-slate-800 transition-all border border-slate-800"
                            >
                                <Download className="w-3.5 h-3.5 text-blue-400" />
                                <span>Save Backup (Teacher)</span>
                            </button>
                            <button 
                                onClick={exportStudentJSON}
                                className="flex items-center space-x-2 text-left text-[11px] text-amber-300 hover:text-amber-200 p-2 rounded bg-amber-950/20 hover:bg-amber-950/40 transition-all border border-amber-900/40"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                                <span className="font-semibold">Export for Students</span>
                            </button>
                        </div>
                    ) : (
                        <div className="p-2 bg-slate-800/30 rounded border border-indigo-900/40 flex items-center space-x-2">
                            <Lock className="w-4 h-4 text-indigo-400" />
                            <span className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider">Locked Student Edition</span>
                        </div>
                    )}
                </div>
                
                <div className="flex-1 overflow-y-auto py-4">
                    {!project.isStudentEdition && (
                        <div 
                            className={`px-5 py-3 cursor-pointer flex items-center space-x-3 hover:bg-slate-900 transition-all ${activeView === 'book' ? 'bg-indigo-600/20 border-l-4 border-indigo-500 text-white' : 'border-l-4 border-transparent'}`}
                            onClick={() => { setActiveView('book'); setIsMobileMenuOpen(false); }}
                        >
                            <Settings className="w-4 h-4 text-slate-400" />
                            <span className="font-semibold text-sm">Course Configuration</span>
                        </div>
                    )}
                    
                    <div className="px-5 mt-6 mb-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest flex justify-between items-center">
                        Active Syllabi Modules
                        <span className="bg-slate-800 text-slate-400 py-0.5 px-2 rounded-full text-xs">{project.chapters.length}</span>
                    </div>
                    
                    {project.chapters.map((chap, idx) => (
                        <div 
                            key={chap.id}
                            className={`group px-5 py-3 cursor-pointer flex items-center justify-between hover:bg-slate-900/80 transition-all ${activeView === chap.id ? 'bg-indigo-950/60 border-l-4 border-indigo-500 text-white' : 'border-l-4 border-transparent'}`}
                            onClick={() => { setActiveView(chap.id); setActiveTab('content'); setIsMobileMenuOpen(false); }}
                        >
                            <div className="flex items-center space-x-3 truncate pr-2">
                                <FileText className={`w-4 h-4 flex-shrink-0 ${activeView === chap.id ? 'text-indigo-400' : 'text-slate-500'}`} />
                                <span className="truncate text-sm font-semibold">{chap.title || `Module ${idx + 1}`}</span>
                            </div>
                            {!project.isStudentEdition && (
                                <button 
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setConfirmModal({
                                            title: "Erase Module",
                                            message: `Delete "${chap.title || `Module ${idx + 1}`}" completely?`,
                                            onConfirm: () => deleteChapter(chap.id)
                                        });
                                    }} 
                                    className="text-slate-600 hover:text-red-400 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                    
                    {!project.isStudentEdition && (
                        <button 
                            onClick={addChapter}
                            className="mx-5 mt-4 flex items-center space-x-2 text-xs text-indigo-400 hover:text-indigo-300 font-bold p-2.5 rounded border border-dashed border-indigo-900/50 hover:bg-slate-900 transition-all w-[calc(100%-40px)]"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create New Module</span>
                        </button>
                    )}
                </div>

                {!project.isStudentEdition && (
                    <div className="p-4 border-t border-slate-800 bg-slate-950/80">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium">Author Mode Switcher</span>
                            <button
                                onClick={() => {
                                    setIsStudentMode(!isStudentMode);
                                    setActiveTab('content');
                                    showMessage(isStudentMode ? "Returned to Instructor Workspace" : "Switched to Student View");
                                }}
                                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded"
                            >
                                {isStudentMode ? "Exit Mode" : "Test Mode"}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative">
                {activeView === 'book' && !project.isStudentEdition ? (
                    <div className="flex-1 overflow-y-auto p-8">
                        <h2 className="text-2xl font-bold mb-6 flex items-center">
                            <Settings className="w-6 h-6 mr-3 text-indigo-500" />
                            Course Configuration
                        </h2>
                        <div className="space-y-6 max-w-2xl">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Course Title</label>
                                <input 
                                    type="text" 
                                    value={project.title}
                                    onChange={(e) => setProject({...project, title: e.target.value})}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Language</label>
                                <select
                                    value={project.language}
                                    onChange={(e) => setProject({...project, language: e.target.value})}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                >
                                    <option value="English">English</option>
                                    <option value="Spanish">Spanish</option>
                                    <option value="French">French</option>
                                    <option value="German">German</option>
                                </select>
                            </div>
                        </div>
                    </div>
                ) : activeChapter ? (
                    <div className="flex-1 overflow-y-auto flex flex-col">
                        <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
                            <div className="flex items-center space-x-4">
                                <button className="md:hidden text-slate-400" onClick={() => setIsMobileMenuOpen(true)}>
                                    <Menu className="w-6 h-6" />
                                </button>
                                {isStudentMode ? (
                                    <h2 className="text-xl font-bold text-white truncate max-w-[200px] md:max-w-md">{activeChapter.title}</h2>
                                ) : (
                                    <input 
                                        type="text"
                                        value={activeChapter.title}
                                        onChange={(e) => updateChapter(activeChapter.id, { title: e.target.value })}
                                        className="text-xl font-bold bg-transparent text-white border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none pb-1 transition-colors w-full max-w-[200px] md:max-w-md"
                                        placeholder="Chapter Title"
                                    />
                                )}
                            </div>
                            
                            <div className="flex space-x-2">
                                <button 
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'content' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                                    onClick={() => setActiveTab('content')}
                                >
                                    Read
                                </button>
                                <button 
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'quiz' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                                    onClick={() => setActiveTab('quiz')}
                                >
                                    Quiz
                                </button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-4 md:p-8">
                            {activeTab === 'content' && (
                                <div className="max-w-4xl mx-auto space-y-6">
                                    {activeChapter.blocks.map(block => (
                                        <div key={block.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden relative group">
                                            {block.type === 'html' ? (
                                                <ContentEditableBlock
                                                    html={block.content}
                                                    readOnly={isStudentMode}
                                                    onChange={(newContent) => updateBlock(activeChapter.id, block.id, { content: newContent })}
                                                />
                                            ) : (
                                                <div className="p-4 flex flex-col items-center justify-center min-h-[200px] bg-slate-900/50">
                                                    {block.url ? (
                                                        <img src={block.url} alt={block.prompt} className="max-w-full rounded-lg" />
                                                    ) : (
                                                        <div className="text-slate-500 flex flex-col items-center">
                                                            <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                                                            <p className="text-sm italic">{block.prompt}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
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
                                                            <div 
                                                                key={oIdx} 
                                                                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center space-x-3
                                                                    ${isStudentMode 
                                                                        ? quizSubmitted
                                                                            ? oIdx === mcq.correctOptionIndex 
                                                                                ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-200'
                                                                                : studentAnswers[mcq.id] === oIdx 
                                                                                    ? 'bg-red-900/30 border-red-500/50 text-red-200'
                                                                                    : 'bg-slate-900/50 border-slate-700 text-slate-400'
                                                                            : studentAnswers[mcq.id] === oIdx
                                                                                ? 'bg-indigo-900/40 border-indigo-500/50 text-indigo-200'
                                                                                : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'
                                                                        : oIdx === mcq.correctOptionIndex 
                                                                            ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-200'
                                                                            : 'bg-slate-900/50 border-slate-700 text-slate-300'
                                                                    }`}
                                                                onClick={() => {
                                                                    if (isStudentMode && !quizSubmitted) {
                                                                        setStudentAnswers(prev => ({ ...prev, [mcq.id]: oIdx }));
                                                                    }
                                                                }}
                                                            >
                                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0
                                                                    ${isStudentMode && quizSubmitted 
                                                                        ? oIdx === mcq.correctOptionIndex 
                                                                            ? 'border-emerald-500 bg-emerald-500' 
                                                                            : studentAnswers[mcq.id] === oIdx 
                                                                                ? 'border-red-500 bg-red-500'
                                                                                : 'border-slate-600'
                                                                        : studentAnswers[mcq.id] === oIdx || (!isStudentMode && oIdx === mcq.correctOptionIndex)
                                                                            ? 'border-indigo-500 bg-indigo-500'
                                                                            : 'border-slate-600'
                                                                    }`}
                                                                >
                                                                    {(isStudentMode && quizSubmitted && oIdx === mcq.correctOptionIndex) || (!isStudentMode && oIdx === mcq.correctOptionIndex) ? (
                                                                        <CheckCircle className="w-3 h-3 text-white" />
                                                                    ) : null}
                                                                </div>
                                                                <span>{opt}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {(quizSubmitted || !isStudentMode) && mcq.explanation && (
                                                        <div className="mt-4 p-4 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-slate-300">
                                                            <strong>Explanation:</strong> {mcq.explanation}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            
                                            {isStudentMode && !quizSubmitted && (
                                                <button 
                                                    onClick={() => setQuizSubmitted(true)}
                                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-colors"
                                                >
                                                    Submit Answers
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center p-12 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
                                            <ListChecks className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                                            <h3 className="text-lg font-medium text-slate-300 mb-2">No Quiz Available</h3>
                                            <p className="text-sm text-slate-500">
                                                {isStudentMode ? 'The instructor has not added a quiz for this chapter yet.' : 'Generate a quiz based on the chapter content to test student knowledge.'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                        <BookOpen className="w-16 h-16 mb-4 opacity-20" />
                        <h2 className="text-xl font-semibold mb-2 text-slate-400">Welcome to Syllabus AI</h2>
                        <p className="max-w-md text-sm text-slate-500">Select a chapter from the sidebar or configure your course settings to begin building educational content.</p>
                    </div>
                )}
            </div>

            {/* API Key Modal */}
            {isApiKeyModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-md w-full shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold flex items-center">
                                <Settings className="w-5 h-5 mr-2 text-indigo-400" />
                                API Configuration
                            </h3>
                            <button onClick={() => setIsApiKeyModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <p className="text-sm text-slate-400">
                                Provide your Google Gemini API key to enable AI generation features. Your key is stored locally in your browser.
                            </p>
                            
                            <input
                                type="password"
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                placeholder="AIzaSy..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white font-mono text-sm focus:border-indigo-500 focus:outline-none"
                            />
                            
                            {testResult && (
                                <div className={`p-3 rounded-lg text-sm border ${testResult.success ? 'bg-emerald-900/20 border-emerald-800 text-emerald-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
                                    {testResult.msg}
                                </div>
                            )}

                            <div className="flex space-x-3 pt-2">
                                <button
                                    onClick={handleTestApiKey}
                                    disabled={isTestingKey || !apiKeyInput.trim()}
                                    className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-medium rounded-lg transition-colors text-sm"
                                >
                                    {isTestingKey ? 'Testing...' : 'Test Connection'}
                                </button>
                                <button
                                    onClick={() => handleSaveApiKey(apiKeyInput)}
                                    className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-indigo-900/20"
                                >
                                    Save Key
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            {confirmModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
                        <div className="flex items-center space-x-3 mb-4 text-red-400">
                            <AlertTriangle className="w-6 h-6" />
                            <h3 className="text-lg font-bold">{confirmModal.title}</h3>
                        </div>
                        <p className="text-slate-300 mb-6">{confirmModal.message}</p>
                        <div className="flex space-x-3 justify-end">
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notifications */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-up">
                    <div className={`flex items-center space-x-2 px-4 py-3 rounded-full shadow-2xl border ${
                        toast.type === 'error' ? 'bg-red-900/90 border-red-500/50 text-red-100' :
                        toast.type === 'warning' ? 'bg-amber-900/90 border-amber-500/50 text-amber-100' :
                        toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100' :
                        'bg-slate-800/90 border-slate-600 text-slate-100'
                    }`}>
                        {toast.type === 'error' && <AlertCircle className="w-4 h-4" />}
                        {toast.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
                        {toast.type === 'success' && <CheckCircle className="w-4 h-4" />}
                        <span className="text-sm font-medium">{toast.msg}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
