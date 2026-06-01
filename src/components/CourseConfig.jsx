import React from 'react';
import { Settings } from 'lucide-react';
import { useCourseStore } from '../store/useCourseStore';

export default function CourseConfig() {
    const project = useCourseStore(state => state.project);
    const updateProject = useCourseStore(state => state.updateProject);

    if (project.isStudentEdition) return null;

    return (
        <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full">
            <h2 className="text-2xl font-bold mb-6 flex items-center text-slate-900">
                <Settings className="w-6 h-6 mr-3 text-indigo-500" />
                Course Configuration
            </h2>
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Course Title</label>
                    <input 
                        type="text" 
                        value={project.title} 
                        onChange={(e) => updateProject({ title: e.target.value })} 
                        className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm" 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Language</label>
                    <select 
                        value={project.language} 
                        onChange={(e) => updateProject({ language: e.target.value })} 
                        className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:border-indigo-500 outline-none shadow-sm"
                    >
                        <option value="English">English</option>
                        <option value="Spanish">Spanish</option>
                        <option value="French">French</option>
                        <option value="German">German</option>
                        <option value="Arabic">Arabic</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
