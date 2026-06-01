import React from 'react';
import { Settings, FileText, Trash2, Plus, Upload, Download } from 'lucide-react';
import { useCourseStore } from '../store/useCourseStore';

export default function Sidebar() {
    const project = useCourseStore(state => state.project);
    const setProject = useCourseStore(state => state.setProject);
    const activeView = useCourseStore(state => state.activeView);
    const setActiveView = useCourseStore(state => state.setActiveView);
    const isStudentMode = useCourseStore(state => state.isStudentMode);
    const setIsStudentMode = useCourseStore(state => state.setIsStudentMode);
    const addChapter = useCourseStore(state => state.addChapter);
    const deleteChapter = useCourseStore(state => state.deleteChapter);
    const showMessage = useCourseStore(state => state.showMessage);

    const importJSON = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                if (imported.chapters) {
                    setProject(imported);
                    setIsStudentMode(imported.isStudentEdition || false);
                    setActiveView(imported.chapters[0]?.id || 'book');
                    showMessage("Loaded successfully!", "success");
                }
            } catch (err) {
                showMessage("Invalid file.", "error");
            }
        };
        reader.readAsText(file);
    };

    const exportInstructorJSON = () => {
        const link = document.createElement('a');
        link.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
        link.download = `${project.title.replace(/\s+/g, '_')}_instructor.json`; link.click();
    };

    const exportStudentJSON = () => {
        const studentCleaned = project.chapters.map(chap => { const { customPrompt, sources, ...safe } = chap; return { ...safe, sources: [] }; });
        const link = document.createElement('a');
        link.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ title: project.title, language: project.language, chapters: studentCleaned, isStudentEdition: true }, null, 2));
        link.download = `${project.title.replace(/\s+/g, '_')}_student.json`; link.click();
    };

    return (
        <div className="w-72 bg-white flex flex-col border-r border-slate-200 z-40 hidden md:flex">
            <div className="p-5 border-b border-slate-200 bg-gradient-to-br from-indigo-50 to-white">
                <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                        <span className="text-white font-black text-xl tracking-tighter">Lx</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight text-slate-800 leading-tight">Course LabX</h1>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{isStudentMode ? 'Student Portal' : 'Instructor Center'}</p>
                    </div>
                </div>
            </div>
            
            <div className="p-4 bg-white border-b border-slate-200 space-y-2">
                <label className="flex items-center space-x-3 text-xs text-slate-700 p-2.5 rounded-lg bg-slate-50 hover:bg-indigo-50/50 cursor-pointer border border-slate-200 hover:border-indigo-200 transition-colors">
                    <Upload className="w-4 h-4 text-indigo-500" />
                    <span className="font-medium">Load Course (.json)</span>
                    <input type="file" accept=".json" className="hidden" onChange={importJSON} />
                </label>
                {!project.isStudentEdition && (
                    <div className="grid grid-cols-1 gap-1.5 pt-1">
                        <button onClick={exportInstructorJSON} className="flex items-center space-x-2 text-[11px] text-slate-700 p-2 rounded-lg bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 transition-colors"><Download className="w-3.5 h-3.5 text-indigo-400" /><span className="font-medium">Save Backup (Teacher)</span></button>
                        <button onClick={exportStudentJSON} className="flex items-center space-x-2 text-[11px] text-slate-700 p-2 rounded-lg bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 transition-colors"><Download className="w-3.5 h-3.5 text-indigo-400" /><span className="font-medium">Export for Students</span></button>
                    </div>
                )}
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 bg-white">
                {!project.isStudentEdition && (
                    <div className={`px-5 py-3 cursor-pointer flex items-center space-x-3 transition-all ${activeView === 'book' ? 'bg-indigo-50 border-l-3 border-indigo-500' : 'border-l-3 border-transparent hover:bg-slate-50'}`} onClick={() => setActiveView('book')}>
                        <Settings className={`w-4 h-4 ${activeView === 'book' ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <span className={`font-semibold text-sm ${activeView === 'book' ? 'text-indigo-700' : 'text-slate-700'}`}>Course Config</span>
                    </div>
                )}
                
                <div className="px-5 mt-6 mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center">
                    Modules<span className="bg-indigo-100 text-indigo-600 py-0.5 px-2 rounded-full text-[10px] font-bold">{project.chapters.length}</span>
                </div>
                
                {project.chapters.map((chap, idx) => (
                    <div key={chap.id} className={`group px-5 py-3 cursor-pointer flex items-center justify-between transition-all ${activeView === chap.id ? 'bg-indigo-50 border-l-3 border-indigo-500' : 'border-l-3 border-transparent hover:bg-slate-50'}`} onClick={() => setActiveView(chap.id)}>
                        <div className="flex items-center space-x-3 truncate">
                            <FileText className={`w-4 h-4 ${activeView === chap.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <span className={`truncate text-sm font-semibold ${activeView === chap.id ? 'text-indigo-700' : 'text-slate-700'}`}>{chap.title || `Module ${idx + 1}`}</span>
                        </div>
                        {!project.isStudentEdition && (
                            <button onClick={(e) => { e.stopPropagation(); deleteChapter(chap.id); }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1 transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                ))}
                
                {!project.isStudentEdition && (
                    <button onClick={addChapter} className="mx-5 mt-4 flex items-center space-x-2 text-xs text-indigo-500 font-medium p-2.5 rounded-lg border border-dashed border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 w-[calc(100%-40px)] transition-colors">
                        <Plus className="w-4 h-4" /><span>New Module</span>
                    </button>
                )}
            </div>
            
            {!project.isStudentEdition && (
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Preview Mode</span>
                    <button onClick={() => { setIsStudentMode(!isStudentMode); showMessage(isStudentMode ? "Instructor Workspace" : "Student View"); }} className={`text-[10px] px-4 py-1.5 rounded-full font-bold transition-all shadow-sm ${isStudentMode ? 'bg-indigo-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                        {isStudentMode ? "Exit Mode" : "Test Mode"}
                    </button>
                </div>
            )}
        </div>
    );
}
