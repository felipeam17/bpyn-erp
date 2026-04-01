// src/pages/Suppliers.jsx
import { useState, useEffect } from 'react'
import { getSuppliers, createSupplier, updateSupplier } from '../lib/supabase'

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(null) // null | 'new' | supplier_obj

  const load = async () => {
    const { data } = await getSuppliers()
    setSuppliers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Proveedores</div>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={() => setModal('new')}>+ Nuevo Proveedor</button>
        </div>
      </div>

      <div className="page">
        <div className="card">
          {loading ? (
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Cargando...</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th><th>País</th><th>Tipo de Pago</th>
                    <th>Términos</th><th>Contacto</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>
                      Sin proveedores aún. Agrega el primero.
                    </td></tr>
                  )}
                  {suppliers.map(s => (
                    <tr key={s.id}>
                      <td className="td-bold">{s.name}</td>
                      <td className="td-muted">{s.country || '—'}</td>
                      <td>
                        <span className={`badge ${s.credit ? 'badge-info' : 'badge-warning'}`}>
                          {s.credit ? 'Crédito' : 'Contado'}
                        </span>
                      </td>
                      <td className="td-muted">{s.terms || '—'}</td>
                      <td className="td-muted" style={{ fontSize: 12 }}>{s.contact || '—'}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal(s)}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <SupplierModal
          supplier={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={load}
        />
      )}
    </>
  )
}

function SupplierModal({ supplier, onClose, onSave }) {
  const isNew = !supplier
  const [form, setForm] = useState({
    name:    supplier?.name    || '',
    country: supplier?.country || '',
    contact: supplier?.contact || '',
    terms:   supplier?.terms   || 'Contado',
    credit:  supplier?.credit  ?? false,
    notes:   supplier?.notes   || '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    setError('')
    if (isNew) {
      const { error } = await createSupplier(form)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await updateSupplier(supplier.id, form)
      if (error) { setError(error.message); setSaving(false); return }
    }
    await onSave()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isNew ? 'Nuevo Proveedor' : 'Editar Proveedor'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-group">
          <label className="form-label">Nombre de la Empresa *</label>
          <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="Nombre del proveedor" autoFocus />
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">País</label>
            <input className="form-input" value={form.country} onChange={e => set('country', e.target.value)}
              placeholder="País de origen" />
          </div>
          <div className="form-group">
            <label className="form-label">Tipo de Pago</label>
            <select className="form-select" value={form.credit ? 'true' : 'false'}
              onChange={e => set('credit', e.target.value === 'true')}>
              <option value="false">Contado (débito)</option>
              <option value="true">Crédito</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Términos de Pago</label>
            <select className="form-select" value={form.terms} onChange={e => set('terms', e.target.value)}>
              <option>Contado</option>
              <option>15 días</option>
              <option>30 días</option>
              <option>45 días</option>
              <option>60 días</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Contacto (email o tel)</label>
            <input className="form-input" value={form.contact} onChange={e => set('contact', e.target.value)}
              placeholder="email@empresa.com" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notas</label>
          <input className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Observaciones opcionales..." />
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : isNew ? 'Crear Proveedor' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
