import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send } from 'lucide-react';
import { useCourseStore } from '../store/useCourseStore';
import { callGeminiText } from '../utils/geminiApi';

export default function AITutorChat({ chapterId }) {
    const project = useCourseStore(state => state.project);
    const activeChapter = project.chapters.find(c => c.id === chapterId);
    
    const tutorChats = useCourseStore(state => state.tutorChats);
    const setTutorChats = useCourseStore(state => state.setTutorChats);
    const showMessage = useCourseStore(state => state.showMessage);

    const [tutorQuery, setTutorQuery] = useState('');
    const [tutorLoading, setTutorLoading] = useState(false);
    const tutorChatEndRef = useRef(null);

    useEffect(() => {
        if (tutorChatEndRef.current) tutorChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [tutorChats, tutorLoading]);

    const handleTutorSubmit = async (e) => {
        e.preventDefault();
        if (!tutorQuery.trim() || !activeChapter) return;
        
        const currentMsg = tutorQuery; 
        setTutorQuery('');
        
        const newHistory = [...(tutorChats[activeChapter.id] || []), { role: 'user', text: currentMsg }];
        setTutorChats({ ...tutorChats, [activeChapter.id]: newHistory });
        
        setTutorLoading(true);
        try {
            const chapterText = activeChapter.blocks.filter(b => b.type === 'html').map(b => b.content).join('\n\n').replace(/<[^>]+>/g, '');
            const tutorPrompt = `You are an AI Tutor. CHAPTER CONTEXT:\n${chapterText}\nDISCUSSION LOG:\n${newHistory.map(h => `${h.role}: ${h.text}`).join('\n')}\nLATEST STUDENT QUESTION: "${currentMsg}"\nRespond in ${project.language}.`;
            const aiReply = await callGeminiText(tutorPrompt);
            
            setTutorChats({ 
                ...tutorChats, 
                [activeChapter.id]: [...newHistory, { role: 'model', text: aiReply }] 
            });
        } catch (err) {
            showMessage(err.message || 'API error', 'error');
        } finally {
            setTutorLoading(false);
        }
    };

    if (!activeChapter) return null;

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-200 bg-indigo-600 flex items-center space-x-3">
                <Bot className="w-6 h-6 text-indigo-200" />
                <h3 className="font-bold text-white">AI Tutor Chat</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                <div className="bg-white p-3 rounded-xl rounded-tl-sm text-sm text-slate-700 shadow-sm border border-slate-100">
                    <p>Hello! I am your AI Tutor for <strong className="text-indigo-700">{activeChapter.title}</strong>. Ask me any questions about the material!</p>
                </div>
                
                {(tutorChats[activeChapter.id] || []).map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white text-slate-800 rounded-tl-sm border border-slate-100'}`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                
                {tutorLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white p-3 rounded-xl rounded-tl-sm text-sm text-indigo-500 flex space-x-1 shadow-sm border border-slate-100">
                            <span className="animate-bounce">.</span>
                            <span className="animate-bounce delay-100">.</span>
                            <span className="animate-bounce delay-200">.</span>
                        </div>
                    </div>
                )}
                <div ref={tutorChatEndRef} />
            </div>
            
            <form onSubmit={handleTutorSubmit} className="p-4 border-t border-indigo-100 bg-white relative">
                <input 
                    type="text" 
                    value={tutorQuery} 
                    onChange={(e) => setTutorQuery(e.target.value)} 
                    placeholder="Ask a question..." 
                    className="w-full bg-slate-50 border border-indigo-200 rounded-full py-2.5 pl-4 pr-12 text-sm text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" 
                />
                <button type="submit" disabled={tutorLoading || !tutorQuery.trim()} className="absolute right-6 top-1/2 -translate-y-1/2 text-indigo-500 hover:text-indigo-700 disabled:opacity-50">
                    <Send className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
}
