// src/pages/Tasks.jsx
import { useState, useEffect, useRef } from 'react'
import { getTasks, createTask, updateTask, deleteTask, getQuotes, supabase } from '../lib/supabase'
import { formatDate } from '../lib/utils'
import { useAuth } from '../App'

const COLUMNS = [
  { key: 'por_cotizar',  label: 'Por Cotizar',  color: '#d97706', bg: 'rgba(217,119,6,0.06)'    },
  { key: 'aprobadas',    label: 'Aprobadas',    color: '#1a56db', bg: 'rgba(26,86,219,0.06)'    },
  { key: 'por_entregar', label: 'Por Entregar', color: '#dc2626', bg: 'rgba(220,38,38,0.06)'    },
  { key: 'entregadas',   label: 'Entregadas',   color: '#16a34a', bg: 'rgba(22,163,74,0.06)'    },
  { key: 'por_facturar', label: 'Por Facturar', color: '#7c3aed', bg: 'rgba(124,58,237,0.06)'   },
]

const PRIORITY = {
  alta:   { label: 'Alta',   color: '#dc2626', bg: 'rgba(220,38,38,0.1)'  },
  normal: { label: 'Normal', color: '#1a56db', bg: 'rgba(26,86,219,0.1)'  },
  baja:   { label: 'Baja',   color: '#6b7280', bg: 'rgba(107,114,128,0.1)'},
}

export default function Tasks() {
  const { user } = useAuth()
  const [tasks,   setTasks]   = useState([])
  const [quotes,  setQuotes]  = useState([])
  const [team,    setTeam]    = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)
  const [dragId,  setDragId]  = useState(null)
  const [dragOver, setDragOver] = useState(null)

  const load = async () => {
    const [t, q] = await Promise.all([getTasks(), getQuotes()])
    setTasks(t.data || [])
    setQuotes(q.data || [])
    setLoading(false)
  }

  const loadTeam = async () => {
    const { data } = await supabase.rpc('get_team_members')
    if (data) setTeam(data.map(u => u.email))
  }

  useEffect(() => { load(); loadTeam() }, [])

  // ── Drag & Drop ───────────────────────────────────────────────────
  const handleDragStart = (e, taskId) => {
    setDragId(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, colKey) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(colKey)
  }

  const handleDrop = async (e, colKey) => {
    e.preventDefault()
    setDragOver(null)
    if (!dragId || colKey === tasks.find(t => t.id === dragId)?.status) {
      setDragId(null)
      return
    }
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === dragId ? { ...t, status: colKey } : t))
    await updateTask(dragId, { status: colKey })
    setDragId(null)
  }

  const handleDragEnd = () => {
    setDragId(null)
    setDragOver(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta tarea?')) return
    await deleteTask(id)
    await load()
  }

  const isOverdue = (t) => t.due_date && t.status !== 'entregadas'
    && new Date(t.due_date) < new Date()

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Operaciones</div>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={() => setModal('new')}>+ Nueva Tarea</button>
        </div>
      </div>

      <div className="page" style={{ padding: '20px 16px' }}>
        {loading ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Cargando...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, alignItems: 'start', minHeight: '70vh' }}>
            {COLUMNS.map(col => {
              const colTasks = tasks.filter(t => t.status === col.key)
              const isOver = dragOver === col.key
              return (
                <div
                  key={col.key}
                  onDragOver={e => handleDragOver(e, col.key)}
                  onDrop={e => handleDrop(e, col.key)}
                  onDragLeave={() => setDragOver(null)}
                  style={{
                    background: isOver ? col.bg : 'var(--gray-1)',
                    border: `2px solid ${isOver ? col.color : 'var(--border-l)'}`,
                    borderRadius: 14,
                    minHeight: 200,
                    transition: 'all 0.15s',
                  }}
                >
                  {/* Column header */}
                  <div style={{
                    padding: '12px 14px 10px',
                    borderBottom: `2px solid ${col.color}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: col.color }}>{col.label}</div>
                    <div style={{
                      background: col.color, color: '#fff',
                      borderRadius: 20, fontSize: 11, fontWeight: 700,
                      padding: '2px 8px', minWidth: 24, textAlign: 'center',
                    }}>{colTasks.length}</div>
                  </div>

                  {/* Tasks */}
                  <div style={{ padding: '10px 10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {colTasks.map(task => {
                      const overdue = isOverdue(task)
                      const p = PRIORITY[task.priority] || PRIORITY.normal
                      const isDragging = dragId === task.id
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={e => handleDragStart(e, task.id)}
                          onDragEnd={handleDragEnd}
                          style={{
                            background: '#fff',
                            border: `1px solid ${overdue ? 'rgba(220,38,38,0.3)' : 'var(--border-l)'}`,
                            borderLeft: `3px solid ${overdue ? '#dc2626' : col.color}`,
                            borderRadius: 10,
                            padding: '11px 12px',
                            cursor: 'grab',
                            opacity: isDragging ? 0.4 : 1,
                            transform: isDragging ? 'scale(0.98)' : 'scale(1)',
                            transition: 'opacity 0.15s, transform 0.15s',
                            boxShadow: isDragging ? 'none' : '0 1px 3px rgba(13,31,49,0.06)',
                          }}
                        >
                          {/* Task title */}
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 6, lineHeight: 1.4 }}>
                            {task.title}
                          </div>

                          {/* Description */}
                          {task.description && (
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, lineHeight: 1.4 }}>
                              {task.description}
                            </div>
                          )}

                          {/* Quote link */}
                          {task.quotes && (
                            <div style={{ fontSize: 11, color: 'var(--navy)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
                              {task.quotes.quote_number} · <span style={{ fontFamily: 'var(--font)', color: 'var(--text-3)' }}>{task.quotes.client}</span>
                            </div>
                          )}

                          {/* Footer */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 4 }}>
                            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                                background: p.bg, color: p.color,
                              }}>{p.label}</span>
                              {task.assigned_to && (
                                <span style={{
                                  fontSize: 10, padding: '2px 7px', borderRadius: 20,
                                  background: 'var(--gray-2)', color: 'var(--text-2)',
                                  maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {task.assigned_to.split('@')[0]}
                                </span>
                              )}
                              {task.due_date && (
                                <span style={{
                                  fontSize: 10, padding: '2px 7px', borderRadius: 20,
                                  background: overdue ? 'rgba(220,38,38,0.1)' : 'var(--gray-2)',
                                  color: overdue ? '#dc2626' : 'var(--text-3)',
                                  fontWeight: overdue ? 600 : 400,
                                }}>
                                  {overdue ? '⚠ ' : ''}{formatDate(task.due_date)}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                onClick={() => setModal(task)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 13, padding: '2px 4px', borderRadius: 4 }}
                                title="Editar">✏</button>
                              <button
                                onClick={() => handleDelete(task.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 13, padding: '2px 4px', borderRadius: 4, opacity: 0.6 }}
                                title="Eliminar">✕</button>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {/* Drop zone hint when empty */}
                    {colTasks.length === 0 && (
                      <div style={{
                        border: `2px dashed ${isOver ? col.color : 'var(--border)'}`,
                        borderRadius: 10, padding: '20px 12px', textAlign: 'center',
                        color: isOver ? col.color : 'var(--text-3)', fontSize: 12,
                        transition: 'all 0.15s',
                      }}>
                        {isOver ? 'Soltar aquí' : 'Sin tareas'}
                      </div>
                    )}

                    {/* Quick add button */}
                    <button
                      onClick={() => setModal({ _defaultStatus: col.key })}
                      style={{
                        background: 'none', border: `1px dashed var(--border)`,
                        borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
                        color: 'var(--text-3)', fontSize: 12, width: '100%',
                        textAlign: 'left', fontFamily: 'var(--font)',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.target.style.borderColor = col.color; e.target.style.color = col.color }}
                      onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-3)' }}
                    >
                      + Agregar tarea
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <TaskModal
          task={modal === 'new' ? null : (modal._defaultStatus ? null : modal)}
          defaultStatus={modal._defaultStatus || (modal === 'new' ? 'por_cotizar' : null)}
          quotes={quotes}
          team={team}
          onClose={() => setModal(null)}
          onSave={load}
          userEmail={user?.email}
        />
      )}
    </>
  )
}

function TaskModal({ task, defaultStatus, quotes, team, onClose, onSave, userEmail }) {
  const isNew = !task
  const [form, setForm] = useState({
    title:       task?.title       || '',
    description: task?.description || '',
    quote_id:    task?.quote_id    || '',
    assigned_to: task?.assigned_to || '',
    status:      task?.status      || defaultStatus || 'por_cotizar',
    priority:    task?.priority    || 'normal',
    due_date:    task?.due_date    || '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.title.trim()) { setError('El título es requerido'); return }
    setSaving(true)
    setError('')
    const payload = { ...form, quote_id: form.quote_id || null, created_by: userEmail }
    if (isNew) {
      const { error } = await createTask(payload)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await updateTask(task.id, payload)
      if (error) { setError(error.message); setSaving(false); return }
    }
    await onSave()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isNew ? 'Nueva Tarea' : 'Editar Tarea'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-group">
          <label className="form-label">Título *</label>
          <input className="form-input" value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Ej: Comprar salmón para MY Serenity" autoFocus />
        </div>

        <div className="form-group">
          <label className="form-label">Descripción</label>
          <textarea className="form-textarea" value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Detalles adicionales..." style={{ minHeight: 70 }} />
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Cotización vinculada</label>
            <select className="form-select" value={form.quote_id} onChange={e => set('quote_id', e.target.value)}>
              <option value="">— Sin cotización —</option>
              {quotes.map(q => (
                <option key={q.id} value={q.id}>{q.quote_number} · {q.client}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Asignado a</label>
            <select className="form-select" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
              <option value="">— Sin asignar —</option>
              {team.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Prioridad</label>
            <select className="form-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
              {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Estado</label>
            <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
              {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Fecha límite</label>
            <input className="form-input" type="date" value={form.due_date}
              onChange={e => set('due_date', e.target.value)} />
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : isNew ? 'Crear Tarea' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
