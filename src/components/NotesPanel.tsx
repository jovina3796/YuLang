'use client'
import { useState } from 'react'
import { PencilLine, Trash2, Plus, Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createNote, updateNote, deleteNote } from '@/app/(dashboard)/notes/actions'

export type Note = { id: string; content: string }

export default function NotesPanel({ notes }: { notes: Note[] }) {
  const router = useRouter()
  const [adding,   setAdding]   = useState(false)
  const [newText,  setNewText]  = useState('')
  const [editId,   setEditId]   = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [busy,     setBusy]     = useState(false)

  async function handleAdd() {
    if (!newText.trim()) return
    setBusy(true)
    const { error } = await createNote(newText)
    setBusy(false)
    if (error) { alert(`新增失敗：${error}`); return }
    setNewText(''); setAdding(false); router.refresh()
  }

  async function handleSaveEdit() {
    if (!editId || !editText.trim()) return
    setBusy(true)
    const { error } = await updateNote(editId, editText)
    setBusy(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setEditId(null); setEditText(''); router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('確定刪除？')) return
    setBusy(true)
    const { error } = await deleteNote(id)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head">
        <div className="card-title">備忘錄</div>
        <button className="icon-btn" title="新增" onClick={() => { setAdding(true); setEditId(null) }}><Plus size={14} /></button>
      </div>
      <div style={{ padding: '4px 0' }}>
        {adding && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
            <input
              autoFocus
              type="text" className="input" value={newText}
              placeholder="輸入備忘事項…"
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewText('') } }}
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={() => { setAdding(false); setNewText('') }} disabled={busy}>取消</button>
              <button className="btn btn-sm btn-primary" onClick={handleAdd} disabled={busy || !newText.trim()}>新增</button>
            </div>
          </div>
        )}

        {notes.length === 0 && !adding ? (
          <div style={{ padding: '24px 16px', color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>
            尚無備忘錄
          </div>
        ) : notes.map(n => (
          <div key={n.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px', borderBottom: '1px solid var(--border)',
          }}>
            {editId === n.id ? (
              <>
                <input
                  autoFocus
                  type="text" className="input" value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') { setEditId(null); setEditText('') } }}
                  style={{ flex: 1 }}
                />
                <button className="icon-btn" onClick={handleSaveEdit} disabled={busy} title="儲存"><Check size={14} /></button>
                <button className="icon-btn" onClick={() => { setEditId(null); setEditText('') }} title="取消"><X size={14} /></button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, fontSize: 13 }}>{n.content}</div>
                <button className="icon-btn" onClick={() => { setEditId(n.id); setEditText(n.content); setAdding(false) }} title="編輯">
                  <PencilLine size={14} />
                </button>
                <button className="icon-btn danger" onClick={() => handleDelete(n.id)} disabled={busy} title="刪除"><Trash2 size={14} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
