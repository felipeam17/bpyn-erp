// src/pages/Tasks.jsx
import { useState, useEffect } from 'react'
import { getTasks, createTask, updateTask, deleteTask, getQuotes, supabase } from '../lib/supabase'
import { formatDate } from '../lib/utils'
import { useAuth } from '../App'

const STATUS = {
  por_cotizar:  { label: 'Por Cotizar',  cls: 'badge-warning', color: 'var(--warning)' },
  aprobadas:    { label: 'Aprobadas',    cls: 'badge-info',    color: 'var(--info)'    },
  por_entregar: { label: 'Por Entregar', cls: 'badge-danger',  color: 'var(--danger)'  },
  entregadas:   { label: 'Entregadas',   cls: 'badge-success', color: 'var(--success)' },
}

const PRIORITY = {
  alta:   { label: 'Alta',   cls: 'badge-danger'  },
  normal: { label: 'Normal', cls: 'badge-info'    },
  baja:   { label: 'Baja',   cls: 'badge-muted'   },
}



export default function Tasks() {
  const { user } = useAuth()
  const [tasks,   setTasks]   = useState([])
  const [quotes,  setQuotes]  = useState([])
  const [team,    setTeam]    = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null) // null | 'new' | task_obj
  const [filters, setFilters] = useState({ status: '', priority: '', assigned: '' })

  const load = async () => {
    const [t, q] = await Promise.all([getTasks(), getQuotes()])
    setTasks(t.data || [])
    setQuotes(q.data || [])
    setLoading(false)
  }

  const loadTeam = async () => {
    // Get team members from auth users via RPC
    const { data, error } = await supabase.rpc('get_team_members')
    if (data && !error) {
      setTeam(data.map(u => u.email))
    }
  }

  useEffect(() => { load(); loadTeam() }, [])

  const filtered = tasks.filter(t => {
    const matchStatus   = !filters.status   || t.status === filters.status
    const matchPriority = !filters.priority || t.priority === filters.priority
    const matchAssigned = !filters.assigned || t.assigned_to === filters.assigned
    return matchStatus && matchPriority && matchAssigned
  })

  const handleStatusChange = async (id, status) => {
    await updateTask(id, { status })
    await load()
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta tarea?')) return
    await deleteTask(id)
    await load()
  }

  // Summary counts
  const counts = {
    por_cotizar:  tasks.filter(t => t.status === 'por_cotizar').length,
    aprobadas:    tasks.filter(t => t.status === 'aprobadas').length,
    por_entregar: tasks.filter(t => t.status === 'por_entregar').length,
    entregadas:   tasks.filter(t => t.status === 'entregadas').length,
  }

  const isOverdue = (t) => t.due_date && t.status !== 'completado' && t.status !== 'cancelado'
    && new Date(t.due_date) < new Date()

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Operaciones</div>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={() => setModal('new')}>+ Nueva Tarea</button>
        </div>
      </div>

      <div className="page">
        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          {[
            { key: 'por_cotizar',  label: 'Por Cotizar',  color: 'var(--warning)' },
            { key: 'aprobadas',    label: 'Aprobadas',    color: 'var(--info)'    },
            { key: 'por_entregar', label: 'Por Entregar', color: 'var(--danger)'  },
            { key: 'entregadas',   label: 'Entregadas',   color: 'var(--success)' },
          ].map(s => (
            <div key={s.key} className="stat-card" style={{ borderTop: `3px solid ${s.color}` }}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{counts[s.key]}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <select className="form-select" style={{ width: 160 }}
            value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="form-select" style={{ width: 160 }}
            value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}>
            <option value="">Toda prioridad</option>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="form-select" style={{ width: 180 }}
            value={filters.assigned} onChange={e => setFilters(f => ({ ...f, assigned: e.target.value }))}>
            <option value="">Todo el equipo</option>
            {TEAM.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {(filters.status || filters.priority || filters.assigned) && (
            <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ status: '', priority: '', assigned: '' })}>
              ✕ Limpiar filtros
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-3)', alignSelf: 'center', marginLeft: 'auto' }}>
            {filtered.length} tareas
          </span>
        </div>

        <div className="card">
          {loading ? (
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Cargando tareas...</p>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">◎</div>
              <div className="empty-title">Sin tareas{filters.status || filters.priority || filters.assigned ? ' para este filtro' : ' aún'}</div>
              <p style={{ fontSize: 13 }}>Crea la primera tarea para empezar a organizar las operaciones del equipo.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tarea</th>
                    <th>Cotización</th>
                    <th>Asignado a</th>
                    <th>Prioridad</th>
                    <th>Fecha límite</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => {
                    const overdue = isOverdue(t)
                    const s = STATUS[t.status] || STATUS.pendiente
                    const p = PRIORITY[t.priority] || PRIORITY.normal
                    return (
                      <tr key={t.id} style={{ background: overdue ? 'rgba(220,38,38,0.03)' : undefined }}>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{t.title}</div>
                          {t.description && (
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{t.description}</div>
                          )}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {t.quotes
                            ? <span style={{ fontFamily: 'var(--mono)', color: 'var(--navy)', fontSize: 11 }}>
                                {t.quotes.quote_number}<br />
                                <span style={{ fontFamily: 'var(--font)', color: 'var(--text-3)' }}>{t.quotes.client}</span>
                              </span>
                            : <span style={{ color: 'var(--text-3)' }}>—</span>
                          }
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {t.assigned_to
                            ? <span className="badge badge-muted">{t.assigned_to}</span>
                            : <span style={{ color: 'var(--text-3)' }}>—</span>
                          }
                        </td>
                        <td><span className={`badge ${p.cls}`}>{p.label}</span></td>
                        <td style={{ fontSize: 12 }}>
                          {t.due_date
                            ? <span style={{ color: overdue ? 'var(--danger)' : 'var(--text-2)', fontWeight: overdue ? 600 : 400 }}>
                                {overdue && '⚠ '}{formatDate(t.due_date)}
                              </span>
                            : <span style={{ color: 'var(--text-3)' }}>—</span>
                          }
                        </td>
                        <td>
                          <select
                            className="form-select"
                            value={t.status}
                            onChange={e => handleStatusChange(t.id, e.target.value)}
                            style={{ width: 130, padding: '4px 8px', fontSize: 12 }}
                          >
                            {Object.entries(STATUS).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setModal(t)}>Editar</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <TaskModal
          task={modal === 'new' ? null : modal}
          quotes={quotes}
          onClose={() => setModal(null)}
          onSave={load}
          userEmail={user?.email}
        />
      )}
    </>
  )
}

function TaskModal({ task, quotes, onClose, onSave, userEmail }) {
  const isNew = !task
  const [form, setForm] = useState({
    title:       task?.title       || '',
    description: task?.description || '',
    quote_id:    task?.quote_id    || '',
    assigned_to: task?.assigned_to || '',
    status:      task?.status      || 'por_cotizar',
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
                <option key={q.id} value={q.id}>
                  {q.quote_number} · {q.client}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Asignado a</label>
            <select className="form-select" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
              <option value="">— Sin asignar —</option>
              {TEAM.map(t => <option key={t} value={t}>{t}</option>)}
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
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
