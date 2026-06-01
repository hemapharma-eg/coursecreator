import { create } from 'zustand';

export const useCourseStore = create((set, get) => ({
    // --- PROJECT STATE ---
    project: { 
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
    },
    setProject: (project) => set({ project }),
    updateProject: (updates) => set((state) => ({ project: { ...state.project, ...updates } })),

    // --- CHAPTERS API ---
    addChapter: () => set((state) => {
        const newId = 'chap_' + Date.now();
        return { 
            project: { 
                ...state.project, 
                chapters: [...state.project.chapters, { id: newId, title: `Chapter ${state.project.chapters.length + 1}`, blocks: [], mcqs: [], customPrompt: '', sources: [] }] 
            },
            activeView: newId,
            activeTab: 'content'
        };
    }),
    deleteChapter: (id) => set((state) => {
        const newChapters = state.project.chapters.filter(c => c.id !== id);
        return {
            project: { ...state.project, chapters: newChapters },
            activeView: state.activeView === id ? (newChapters[0]?.id || 'config') : state.activeView
        };
    }),
    updateChapter: (id, updates) => set((state) => ({
        project: {
            ...state.project,
            chapters: state.project.chapters.map(c => c.id === id ? { ...c, ...updates } : c)
        }
    })),
    updateBlock: (chapterId, blockId, content) => set((state) => {
        return {
            project: {
                ...state.project,
                chapters: state.project.chapters.map(c => {
                    if (c.id !== chapterId) return c;
                    return {
                        ...c,
                        blocks: c.blocks.map(b => b.id === blockId ? { ...b, content } : b)
                    };
                })
            }
        };
    }),
    insertBlock: (chapterId, index) => set((state) => ({
        project: {
            ...state.project,
            chapters: state.project.chapters.map(c => {
                if (c.id !== chapterId) return c;
                const newBlocks = [...c.blocks];
                const newBlock = { id: `b_${Date.now()}`, type: 'html', content: '' };
                newBlocks.splice(index + 1, 0, newBlock);
                return { ...c, blocks: newBlocks };
            })
        }
    })),
    deleteBlock: (chapterId, blockId) => set((state) => ({
        project: {
            ...state.project,
            chapters: state.project.chapters.map(c => {
                if (c.id !== chapterId) return c;
                return { ...c, blocks: c.blocks.filter(b => b.id !== blockId) };
            })
        }
    })),
    moveBlock: (chapterId, index, dir) => set((state) => {
        return {
            project: {
                ...state.project,
                chapters: state.project.chapters.map(c => {
                    if (c.id !== chapterId) return c;
                    if (index + dir < 0 || index + dir >= c.blocks.length) return c;
                    const newBlocks = [...c.blocks];
                    const temp = newBlocks[index];
                    newBlocks[index] = newBlocks[index + dir];
                    newBlocks[index + dir] = temp;
                    return { ...c, blocks: newBlocks };
                })
            }
        };
    }),
    
    // --- MCQ API ---
    updateMCQ: (chapterId, mcqId, field, value) => set((state) => ({
        project: {
            ...state.project,
            chapters: state.project.chapters.map(c => {
                if (c.id !== chapterId) return c;
                return { ...c, mcqs: c.mcqs.map(m => m.id === mcqId ? { ...m, [field]: value } : m) };
            })
        }
    })),
    updateMCQOption: (chapterId, mcqId, optIdx, value) => set((state) => ({
        project: {
            ...state.project,
            chapters: state.project.chapters.map(c => {
                if (c.id !== chapterId) return c;
                return {
                    ...c,
                    mcqs: c.mcqs.map(m => {
                        if (m.id !== mcqId) return m;
                        const newOpts = [...m.options];
                        newOpts[optIdx] = value;
                        return { ...m, options: newOpts };
                    })
                };
            })
        }
    })),
    deleteMCQ: (chapterId, mcqId) => set((state) => ({
        project: {
            ...state.project,
            chapters: state.project.chapters.map(c => {
                if (c.id !== chapterId) return c;
                return { ...c, mcqs: c.mcqs.filter(m => m.id !== mcqId) };
            })
        }
    })),
    addBlankMCQ: (chapterId) => set((state) => ({
        project: {
            ...state.project,
            chapters: state.project.chapters.map(c => {
                if (c.id !== chapterId) return c;
                return {
                    ...c,
                    mcqs: [...c.mcqs, { id: 'mcq_' + Date.now(), question: 'New Question?', options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'], correctOptionIndex: 0, explanation: '' }]
                };
            })
        }
    })),

    // --- VIEW STATE ---
    activeView: 'chap_starter',
    setActiveView: (view) => set({ activeView: view }),
    
    activeTab: 'content',
    setActiveTab: (tab) => set({ activeTab: tab }),
    
    isStudentMode: false,
    setIsStudentMode: (mode) => set({ isStudentMode: mode }),

    // --- QUIZ STATE ---
    studentAnswers: {},
    setStudentAnswers: (answers) => set({ studentAnswers: answers }),
    quizSubmitted: false,
    setQuizSubmitted: (submitted) => set({ quizSubmitted: submitted }),
    mcqConfig: { count: 5, difficulty: 'Medium' },
    setMcqConfig: (config) => set({ mcqConfig: config }),

    // --- TUTOR STATE ---
    tutorChats: {},
    setTutorChats: (chats) => set({ tutorChats: chats }),

    // --- GLOBAL UI STATE ---
    toast: null,
    setToast: (toast) => set({ toast }),
    
    confirmModal: null,
    setConfirmModal: (modal) => set({ confirmModal: modal }),
    
    isMobileMenuOpen: false,
    setIsMobileMenuOpen: (isOpen) => set({ isMobileMenuOpen: isOpen }),

    // --- API KEY STATE ---
    apiKeyInput: localStorage.getItem('user_gemini_api_key') || '',
    setApiKeyInput: (key) => set({ apiKeyInput: key }),
    isApiKeyModalOpen: false,
    setIsApiKeyModalOpen: (isOpen) => set({ isApiKeyModalOpen: isOpen }),
    isTestingKey: false,
    setIsTestingKey: (isTesting) => set({ isTestingKey: isTesting }),
    testResult: null,
    setTestResult: (result) => set({ testResult: result }),

    // Helpers
    showMessage: (msg, type = 'info') => {
        set({ toast: { msg, type } });
        setTimeout(() => set({ toast: null }), 4000);
    }
}));
