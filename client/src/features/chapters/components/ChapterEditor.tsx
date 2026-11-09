import { useEffect } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, Quote, Undo2, Redo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChapterEditorProps {
  value: string
  onChange?: (html: string) => void
  readOnly?: boolean
}

/** Limited formatting schema matches the server's chapter HTML allowlist. */
export default function ChapterEditor({ value, onChange, readOnly = false }: ChapterEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false, codeBlock: false, code: false, heading: { levels: [2, 3] } }),
      Placeholder.configure({ placeholder: 'Nhập hoặc dán nội dung chương…' })],
    content: value,
    editable: !readOnly,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: { role: 'textbox', 'aria-label': 'Nội dung chương', 'aria-multiline': 'true', class: 'min-h-80 min-w-0 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring leading-relaxed text-foreground break-words [&_img]:max-w-full [&_pre]:whitespace-pre-wrap' } },
    onUpdate: ({ editor: current }) => onChange?.(current.getHTML()),
  })
  const state = useEditorState({ editor, selector: ({ editor: current }) => ({
    bold: current?.isActive('bold') ?? false, italic: current?.isActive('italic') ?? false,
    blockquote: current?.isActive('blockquote') ?? false,
    words: current?.getText().trim().split(/\s+/).filter(Boolean).length ?? 0,
  }) })
  useEffect(() => {
    // Publish the initial editor snapshot to useEditorState without changing
    // content or invoking onUpdate. No keystroke is needed to initialize counts.
    if (editor) editor.view.dispatch(editor.state.tr)
  }, [editor])
  useEffect(() => {
    if (editor && editor.getHTML() !== value) editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])
  useEffect(() => { editor?.setEditable(!readOnly, false) }, [editor, readOnly])
  return <div className="rounded-2xl border border-border bg-card">
    {!readOnly && <div role="toolbar" aria-label="Định dạng nội dung" className="flex flex-wrap items-center gap-1 border-b border-border p-2">
      <Button type="button" variant="ghost" size="icon-sm" className="h-9 w-9 rounded-lg text-muted-foreground aria-pressed:bg-secondary aria-pressed:text-link" title="Đậm" aria-label="Đậm" disabled={!editor} aria-pressed={state?.bold} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" aria-hidden="true" /></Button>
      <Button type="button" variant="ghost" size="icon-sm" className="h-9 w-9 rounded-lg text-muted-foreground aria-pressed:bg-secondary aria-pressed:text-link" title="Nghiêng" aria-label="Nghiêng" disabled={!editor} aria-pressed={state?.italic} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" aria-hidden="true" /></Button>
      <Button type="button" variant="ghost" size="icon-sm" className="h-9 w-9 rounded-lg text-muted-foreground aria-pressed:bg-secondary aria-pressed:text-link" title="Trích dẫn" aria-label="Trích dẫn" disabled={!editor} aria-pressed={state?.blockquote} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" aria-hidden="true" /></Button>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      <Button type="button" variant="ghost" size="icon-sm" className="h-9 w-9 rounded-lg text-muted-foreground" title="Hoàn tác" aria-label="Hoàn tác" disabled={!editor} onClick={() => editor?.chain().focus().undo().run()}><Undo2 className="h-4 w-4" aria-hidden="true" /></Button>
      <Button type="button" variant="ghost" size="icon-sm" className="h-9 w-9 rounded-lg text-muted-foreground" title="Làm lại" aria-label="Làm lại" disabled={!editor} onClick={() => editor?.chain().focus().redo().run()}><Redo2 className="h-4 w-4" aria-hidden="true" /></Button>
    </div>}
    <EditorContent editor={editor} />
    {!readOnly && <p className="px-4 pb-3 text-xs text-muted-foreground">{state?.words ?? 0} từ</p>}
  </div>
}
