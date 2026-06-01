import React, { useEffect } from 'react';
import { Menu, Edit3, X, GripVertical, ArrowUp, ArrowDown, Plus, Trash2, BookOpen, Sparkles, Settings } from 'lucide-react';

import { useCourseStore } from './store/useCourseStore';
import Sidebar from './components/Sidebar';
import CourseConfig from './components/CourseConfig';
import RightPanel from './components/RightPanel';
import QuizBuilder from './components/QuizBuilder';
import AITutorChat from './components/AITutorChat';
import RichTextEditor from './components/RichTextEditor';

export default function App() {
    const project = useCourseStore(state => state.project);
    const activeView = useCourseStore(state => state.activeView);
    const activeTab = useCourseStore(state => state.activeTab);
    const setActiveTab = useCourseStore(state => state.setActiveTab);
    const isStudentMode = useCourseStore(state => state.isStudentMode);
    
    const updateChapter = useCourseStore(state => state.updateChapter);
    const updateBlock = useCourseStore(state => state.updateBlock);
    const insertBlock = useCourseStore(state => state.insertBlock);
    const deleteBlock = useCourseStore(state => state.deleteBlock);
    const moveBlock = useCourseStore(state => state.moveBlock);

    const toast = useCourseStore(state => state.toast);
    const showMessage = useCourseStore(state => state.showMessage);

    const isMobileMenuOpen = useCourseStore(state => state.isMobileMenuOpen);
    const setIsMobileMenuOpen = useCourseStore(state => state.setIsMobileMenuOpen);

    const apiKeyInput = useCourseStore(state => state.apiKeyInput);
    const setApiKeyInput = useCourseStore(state => state.setApiKeyInput);
    const isApiKeyModalOpen = useCourseStore(state => state.isApiKeyModalOpen);
    const setIsApiKeyModalOpen = useCourseStore(state => state.setIsApiKeyModalOpen);
    const isTestingKey = useCourseStore(state => state.isTestingKey);
    const setIsTestingKey = useCourseStore(state => state.setIsTestingKey);
    const testResult = useCourseStore(state => state.testResult);
    const setTestResult = useCourseStore(state => state.setTestResult);

    const setStudentAnswers = useCourseStore(state => state.setStudentAnswers);
    const setQuizSubmitted = useCourseStore(state => state.setQuizSubmitted);

    const activeChapter = project.chapters.find(c => c.id === activeView);

    useEffect(() => {
        const saved = localStorage.getItem('book_project_state');
        if (saved) {
            try { 
                const parsed = JSON.parse(saved);
                if (parsed.chapters) {
                    useCourseStore.setState({ 
                        project: parsed, 
                        isStudentMode: parsed.isStudentEdition || false,
                        activeView: parsed.chapters[0]?.id || 'book'
                    });
                }
            } catch (e) { console.error("Failed to parse saved state"); }
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
    }, [activeView, activeTab, isStudentMode, setStudentAnswers, setQuizSubmitted]);

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

    return (
        <div className="flex h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/30 text-slate-900 font-sans overflow-hidden">
            <Sidebar />

            <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative border-r border-slate-200">
                {activeView === 'book' && !project.isStudentEdition ? (
                    <CourseConfig />
                ) : activeChapter ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 shadow-sm">
                            <div className="flex items-center space-x-4">
                                <button className="md:hidden text-slate-600" onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6" /></button>
                                {isStudentMode ? (
                                    <h2 className="text-xl font-bold text-slate-900">{activeChapter.title}</h2>
                                ) : (
                                    <div className="flex items-center space-x-2 group w-full max-w-md">
                                        <input type="text" value={activeChapter.title} onChange={(e) => updateChapter(activeChapter.id, { title: e.target.value })} className="text-xl font-bold bg-white text-slate-900 border border-slate-300 hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-lg px-3 py-1.5 outline-none w-full transition-all" />
                                        <Edit3 className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 opacity-60" />
                                    </div>
                                )}
                            </div>
                            <div className="flex space-x-2">
                                <button className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === 'content' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 border border-slate-200'}`} onClick={() => setActiveTab('content')}>Read</button>
                                <button className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === 'quiz' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 border border-slate-200'}`} onClick={() => setActiveTab('quiz')}>Quiz</button>
                            </div>
                        </header>
                        
                        <div className="flex-1 overflow-y-auto relative bg-slate-50">
                            {activeTab === 'content' && (
                                <div className="max-w-4xl mx-auto pb-16">
                                    <div className="space-y-6 px-4 md:px-8 mt-6">
                                        {activeChapter.blocks.map((block, idx) => (
                                            <div key={block.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden group hover:border-indigo-200 hover:shadow-md transition-all">
                                                {!isStudentMode && (
                                                    <div className="bg-gradient-to-r from-slate-50 to-indigo-50/50 px-3 py-2 border-b border-slate-200 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <div className="flex items-center space-x-2 text-slate-500">
                                                            <GripVertical className="w-4 h-4 cursor-grab" />
                                                            <span className="text-[10px] font-bold uppercase text-indigo-500">TEXT BLOCK</span>
                                                        </div>
                                                        <div className="flex space-x-1">
                                                            <button onClick={() => moveBlock(activeChapter.id, idx, -1)} className="p-1 hover:bg-white rounded text-slate-500 hover:text-indigo-600"><ArrowUp className="w-3 h-3" /></button>
                                                            <button onClick={() => moveBlock(activeChapter.id, idx, 1)} className="p-1 hover:bg-white rounded text-slate-500 hover:text-indigo-600"><ArrowDown className="w-3 h-3" /></button>
                                                            <div className="w-px h-4 bg-slate-200 mx-1" />
                                                            <button onClick={() => insertBlock(activeChapter.id, idx)} className="p-1 hover:bg-white rounded text-blue-500 hover:text-blue-600" title="Insert Text Below"><Plus className="w-3 h-3" /></button>
                                                            <button onClick={() => deleteBlock(activeChapter.id, block.id)} className="p-1 hover:bg-white rounded ml-2 text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                                        </div>
                                                    </div>
                                                )}
                                                <RichTextEditor 
                                                    content={block.content} 
                                                    onChange={(newHtml) => updateBlock(activeChapter.id, block.id, newHtml)} 
                                                    readOnly={isStudentMode} 
                                                />
                                            </div>
                                        ))}
                                        {!isStudentMode && activeChapter.blocks.length === 0 && (
                                            <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl mx-4 mt-4 bg-white">
                                                <Sparkles className="w-10 h-10 text-indigo-300 mx-auto mb-3" />
                                                <p className="text-slate-500 mb-4 font-medium">No content blocks yet.</p>
                                                <button onClick={() => insertBlock(activeChapter.id, -1)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all font-semibold">
                                                    Add First Block
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'quiz' && (
                                <QuizBuilder chapterId={activeChapter.id} />
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <BookOpen className="w-16 h-16 text-slate-200" />
                        <p className="text-slate-400 mt-4 text-sm">Select a module to begin</p>
                    </div>
                )}
            </div>

            {/* Right Panel or Tutor Panel */}
            {activeChapter && (
                isStudentMode ? (
                    <div className="w-80 bg-white flex flex-col border-l border-slate-200 shadow-md flex-shrink-0 z-20">
                        <AITutorChat chapterId={activeChapter.id} />
                    </div>
                ) : (
                    <RightPanel chapterId={activeChapter.id} />
                )
            )}

            {/* API Key Modal */}
            {isApiKeyModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white border border-slate-300 p-6 rounded-2xl max-w-md w-full shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold flex items-center"><Settings className="w-5 h-5 mr-2 text-indigo-400" />API Configuration</h3>
                            <button onClick={() => setIsApiKeyModalOpen(false)} className="text-slate-600 hover:text-slate-900"><X className="w-5 h-5" /></button>
                        </div>
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

            {/* Toasts */}
            {toast && (
                <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-xl text-sm font-semibold z-50 animate-bounce ${toast.type === 'error' ? 'bg-red-600 text-white' : toast.type === 'warning' ? 'bg-amber-500 text-white' : 'bg-indigo-600 text-white'}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
