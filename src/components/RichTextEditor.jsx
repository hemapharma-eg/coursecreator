import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Type, ImagePlus } from 'lucide-react';
import { Mark, mergeAttributes } from '@tiptap/core';

const CustomSpan = Mark.create({
    name: 'customSpan',
    addAttributes() { return { class: { default: null } }; },
    parseHTML() { return [{ tag: 'span[class]' }, { tag: 'div[class]' }]; },
    renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes), 0]; },
});

const MenuBar = ({ editor, isStudentMode }) => {
    if (!editor || isStudentMode) return null;

    const btnClass = "p-1 hover:bg-indigo-50 rounded text-slate-600 transition-colors";
    const activeBtnClass = "p-1 bg-indigo-100 rounded text-indigo-700 transition-colors";

    const insertImage = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            editor.chain().focus().setImage({ src: event.target.result }).run();
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm p-1.5 flex flex-wrap items-center gap-0.5 rounded-t-xl mx-4 mt-4">
            <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? activeBtnClass : btnClass} title="Bold"><Bold className="w-3.5 h-3.5" /></button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? activeBtnClass : btnClass} title="Italic"><Italic className="w-3.5 h-3.5" /></button>
            <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? activeBtnClass : btnClass} title="Underline"><UnderlineIcon className="w-3.5 h-3.5" /></button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? activeBtnClass : btnClass} title="Heading 1"><Heading1 className="w-3.5 h-3.5" /></button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? activeBtnClass : btnClass} title="Heading 2"><Heading2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? activeBtnClass : btnClass} title="Heading 3"><Heading3 className="w-3.5 h-3.5" /></button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? activeBtnClass : btnClass} title="Bullet List"><List className="w-3.5 h-3.5" /></button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? activeBtnClass : btnClass} title="Numbered List"><ListOrdered className="w-3.5 h-3.5" /></button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? activeBtnClass : btnClass} title="Align Left"><AlignLeft className="w-3.5 h-3.5" /></button>
            <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? activeBtnClass : btnClass} title="Align Center"><AlignCenter className="w-3.5 h-3.5" /></button>
            <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={editor.isActive({ textAlign: 'right' }) ? activeBtnClass : btnClass} title="Align Right"><AlignRight className="w-3.5 h-3.5" /></button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            
            <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className={`${btnClass} text-[10px] font-semibold`} title="Insert Table"><Type className="w-3.5 h-3.5" /></button>
            <div className="relative group">
                <button className={`${btnClass} flex items-center text-[10px] font-semibold`} title="Table Editor">TBL ▼</button>
                <div className="absolute hidden group-hover:flex flex-col bg-white border border-slate-200 shadow-xl rounded-lg top-full mt-0 z-50 w-32 py-1 left-0">
                    <button onClick={() => editor.chain().focus().addRowAfter().run()} className="px-3 py-1.5 text-left hover:bg-indigo-50 text-xs text-slate-700">Add Row Below</button>
                    <button onClick={() => editor.chain().focus().deleteRow().run()} className="px-3 py-1.5 text-left hover:bg-indigo-50 text-xs text-slate-700">Delete Row</button>
                    <div className="border-t border-slate-100 my-1" />
                    <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-3 py-1.5 text-left hover:bg-indigo-50 text-xs text-slate-700">Add Col Right</button>
                    <button onClick={() => editor.chain().focus().deleteColumn().run()} className="px-3 py-1.5 text-left hover:bg-indigo-50 text-xs text-slate-700">Delete Col</button>
                    <div className="border-t border-slate-100 my-1" />
                    <button onClick={() => editor.chain().focus().mergeCells().run()} className="px-3 py-1.5 text-left hover:bg-indigo-50 text-xs text-slate-700">Merge Cells</button>
                    <button onClick={() => editor.chain().focus().splitCell().run()} className="px-3 py-1.5 text-left hover:bg-indigo-50 text-xs text-slate-700">Split Cell</button>
                    <button onClick={() => editor.chain().focus().deleteTable().run()} className="px-3 py-1.5 text-left hover:bg-red-50 text-xs text-red-600">Delete Table</button>
                </div>
            </div>
            
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <label className={`${btnClass} cursor-pointer flex items-center text-[10px] font-semibold`} title="Insert Inline Image">
                <ImagePlus className="w-3.5 h-3.5" />
                <input type="file" accept="image/*" className="hidden" onChange={insertImage} />
            </label>
        </div>
    );
};

export default function RichTextEditor({ content, onChange, readOnly }) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            CustomSpan,
            Image.configure({ inline: true, allowBase64: true }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: content,
        editable: !readOnly,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    useEffect(() => {
        if (editor && editor.getHTML() !== content) {
            // Only update if content drastically changes externally (like generating chapter)
            // But we don't want to reset cursor position if the user is typing
            // A simple check: if the lengths are very different, it's an external update
            if (Math.abs(editor.getHTML().length - content.length) > 10) {
                editor.commands.setContent(content, false);
            }
        }
    }, [content, editor]);

    return (
        <div className="relative">
            <MenuBar editor={editor} isStudentMode={readOnly} />
            <div className="p-4 md:p-8 min-h-[100px] overflow-x-auto">
                <EditorContent editor={editor} className="tiptap-editor outline-none" />
            </div>
        </div>
    );
}
