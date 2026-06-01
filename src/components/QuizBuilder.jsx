import React from 'react';
import { Plus, Trash2, ListChecks, CheckCircle } from 'lucide-react';
import { useCourseStore } from '../store/useCourseStore';

export default function QuizBuilder({ chapterId }) {
    const project = useCourseStore(state => state.project);
    const activeChapter = project.chapters.find(c => c.id === chapterId);
    
    const isStudentMode = useCourseStore(state => state.isStudentMode);
    const studentAnswers = useCourseStore(state => state.studentAnswers);
    const setStudentAnswers = useCourseStore(state => state.setStudentAnswers);
    const quizSubmitted = useCourseStore(state => state.quizSubmitted);
    const setQuizSubmitted = useCourseStore(state => state.setQuizSubmitted);
    
    const updateMCQ = useCourseStore(state => state.updateMCQ);
    const updateMCQOption = useCourseStore(state => state.updateMCQOption);
    const deleteMCQ = useCourseStore(state => state.deleteMCQ);
    const addBlankMCQ = useCourseStore(state => state.addBlankMCQ);

    if (!activeChapter) return null;

    return (
        <div className="max-w-3xl mx-auto pb-20 mt-8">
            {(!isStudentMode) && (
                <div className="flex justify-end mb-4 mx-4">
                    <button onClick={() => addBlankMCQ(activeChapter.id)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center transition-all shadow-sm">
                        <Plus className="w-4 h-4 mr-1"/> Add Question
                    </button>
                </div>
            )}
            
            {activeChapter.mcqs.length > 0 ? (
                <div className="space-y-8 px-4">
                    {activeChapter.mcqs.map((mcq, idx) => (
                        <div key={mcq.id} className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 relative group hover:border-indigo-200 hover:shadow-md transition-all">
                            {!isStudentMode && (
                                <button onClick={() => deleteMCQ(activeChapter.id, mcq.id)} className="absolute top-4 right-4 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100">
                                    <Trash2 className="w-5 h-5"/>
                                </button>
                            )}
                            
                            {isStudentMode ? (
                                <h3 className="text-lg font-bold mb-4">{idx + 1}. {mcq.question}</h3>
                            ) : (
                                <div className="mb-4">
                                    <label className="text-xs text-slate-600 font-bold uppercase mb-1 block">Question {idx + 1}</label>
                                    <textarea 
                                        value={mcq.question} 
                                        onChange={(e) => updateMCQ(activeChapter.id, mcq.id, 'question', e.target.value)} 
                                        className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 outline-none focus:border-indigo-500 min-h-[60px]" 
                                    />
                                </div>
                            )}
                            
                            <div className="space-y-3">
                                {mcq.options.map((opt, oIdx) => (
                                    <div 
                                        key={oIdx} 
                                        className={`p-3 rounded-lg border flex items-center space-x-3 ${
                                            isStudentMode 
                                                ? quizSubmitted 
                                                    ? oIdx === mcq.correctOptionIndex 
                                                        ? 'bg-emerald-100/30 border-emerald-500/50' 
                                                        : studentAnswers[mcq.id] === oIdx 
                                                            ? 'bg-red-100/30 border-red-500/50' 
                                                            : 'bg-white/50 border-slate-300' 
                                                    : studentAnswers[mcq.id] === oIdx 
                                                        ? 'bg-indigo-100/40 border-indigo-500/50 cursor-pointer' 
                                                        : 'bg-white/50 border-slate-300 cursor-pointer' 
                                                : oIdx === mcq.correctOptionIndex 
                                                    ? 'bg-emerald-100/30 border-emerald-500/50 text-emerald-200' 
                                                    : 'bg-white/50 border-slate-300'
                                        }`} 
                                        onClick={() => { if (isStudentMode && !quizSubmitted) setStudentAnswers({ ...studentAnswers, [mcq.id]: oIdx }); }}
                                    >
                                        {!isStudentMode ? (
                                            <input 
                                                type="radio" 
                                                name={`correct_${mcq.id}`} 
                                                checked={mcq.correctOptionIndex === oIdx} 
                                                onChange={() => updateMCQ(activeChapter.id, mcq.id, 'correctOptionIndex', oIdx)} 
                                                className="w-4 h-4 cursor-pointer" 
                                            />
                                        ) : (
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                                ((isStudentMode && quizSubmitted && oIdx === mcq.correctOptionIndex) || (!isStudentMode && oIdx === mcq.correctOptionIndex)) 
                                                    ? 'border-emerald-500 bg-emerald-500' 
                                                    : studentAnswers[mcq.id] === oIdx 
                                                        ? 'border-indigo-500 bg-indigo-500' 
                                                        : 'border-slate-300'
                                            }`}>
                                                {((isStudentMode && quizSubmitted && oIdx === mcq.correctOptionIndex) || (!isStudentMode && oIdx === mcq.correctOptionIndex)) && <CheckCircle className="w-3 h-3 text-slate-900" />}
                                            </div>
                                        )}
                                        
                                        {isStudentMode ? (
                                            <span>{opt}</span>
                                        ) : (
                                            <input 
                                                value={opt} 
                                                onChange={(e) => updateMCQOption(activeChapter.id, mcq.id, oIdx, e.target.value)} 
                                                className="w-full bg-transparent text-slate-900 outline-none focus:border-b focus:border-indigo-500" 
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            {(quizSubmitted || !isStudentMode) && (
                                <div className="mt-4 p-4 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 flex flex-col">
                                    <strong className="mb-1 text-slate-600 text-xs uppercase">Feedback / Explanation:</strong>
                                    {isStudentMode ? mcq.explanation : (
                                        <textarea 
                                            value={mcq.explanation} 
                                            onChange={(e) => updateMCQ(activeChapter.id, mcq.id, 'explanation', e.target.value)} 
                                            className="w-full bg-transparent text-slate-900 outline-none focus:border-indigo-500 border border-transparent hover:border-slate-300 p-1 rounded min-h-[60px]" 
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {isStudentMode && !quizSubmitted && (
                        <button onClick={() => setQuizSubmitted(true)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all">
                            Submit Answers
                        </button>
                    )}
                </div>
            ) : (
                <div className="text-center p-12 bg-white rounded-2xl border-2 border-dashed border-slate-200 mx-4">
                    <ListChecks className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-500">No Quiz Available</h3>
                    <p className="text-sm text-slate-400 mt-2">Generate quiz questions from the right panel</p>
                </div>
            )}
        </div>
    );
}
