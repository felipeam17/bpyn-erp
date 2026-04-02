// src/pages/Catalog.jsx
import { useState, useEffect, useCallback } from 'react'
import { getProducts, getCategories, getSuppliers, createProduct, updateProduct, archiveProduct, logPriceChange, getPriceHistory } from '../lib/supabase'
import { fmt, pct, calcMargin, marginClass, catColorMap, formatDate } from '../lib/utils'
import { useAuth } from '../App'

export default function Catalog() {
  const { user } = useAuth()
  const [products,   setProducts]   = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers,  setSuppliers]  = useState([])
  const [search,     setSearch]     = useState('')
  const [catFilter,  setCatFilter]  = useState('')
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState(null) // null | 'new' | product_obj
  const [selected,   setSelected]   = useState(new Set()) // selected product ids
  const [deleting,   setDeleting]   = useState(false)
  const [bulkCat,    setBulkCat]    = useState(false)
  const [bulkCatId,  setBulkCatId]  = useState('')
  const [bulkSup,    setBulkSup]    = useState(false)
  const [bulkSupId,  setBulkSupId]  = useState('')
  const [supFilter,  setSupFilter]  = useState('')
  const [sortCol,    setSortCol]    = useState('')
  const [sortDir,    setSortDir]    = useState('asc')

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(p => p.id)))
    }
  }

  const deleteSelected = async () => {
    if (selected.size === 0) return
    if (!confirm(`¿Eliminar permanentemente ${selected.size} producto(s)? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    for (const id of selected) {
      await archiveProduct(id)
    }
    setSelected(new Set())
    setDeleting(false)
    await load()
  }

  const applyBulkCategory = async () => {
    if (!bulkCatId) return
    for (const id of selected) {
      await updateProduct(id, { category_id: bulkCatId })
    }
    setSelected(new Set())
    setBulkCat(false)
    setBulkCatId('')
    await load()
  }

  const applyBulkSupplier = async () => {
    if (!bulkSupId) return
    for (const id of selected) {
      await updateProduct(id, { supplier_id: bulkSupId })
    }
    setSelected(new Set())
    setBulkSup(false)
    setBulkSupId('')
    await load()
  }

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const load = useCallback(async () => {
    const [p, c, s] = await Promise.all([getProducts(), getCategories(), getSuppliers()])
    setProducts(p.data || [])
    setCategories(c.data || [])
    setSuppliers(s.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = (() => {
    let result = products.filter(p => {
      const q = search.toLowerCase()
      const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
      const matchCat = !catFilter || p.categories?.name === catFilter
      const matchSup = !supFilter || p.suppliers?.name === supFilter
      return matchSearch && matchCat && matchSup
    })
    if (sortCol) {
      result = [...result].sort((a, b) => {
        let av, bv
        if (sortCol === 'name')       { av = a.name; bv = b.name }
        if (sortCol === 'price')      { av = a.sale_price; bv = b.sale_price }
        if (sortCol === 'cost')       { av = a.avg_cost; bv = b.avg_cost }
        if (sortCol === 'margin')     { av = calcMargin(a.avg_cost, a.sale_price); bv = calcMargin(b.avg_cost, b.sale_price) }
        if (sortCol === 'stock')      { av = a.stock ?? -1; bv = b.stock ?? -1 }
        if (sortCol === 'category')   { av = a.categories?.name || ''; bv = b.categories?.name || '' }
        if (sortCol === 'supplier')   { av = a.suppliers?.name || ''; bv = b.suppliers?.name || '' }
        if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
        return sortDir === 'asc' ? av - bv : bv - av
      })
    }
    return result
  })()

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Catálogo de Productos</div>
        <div className="topbar-actions">
          {selected.size > 0 && (
            <>
              <button className="btn btn-ghost" onClick={() => setBulkCat(true)}>
                🏷 Categoría
              </button>
              <button className="btn btn-ghost" onClick={() => setBulkSup(true)}>
                🚚 Proveedor
              </button>
              <button className="btn btn-danger" onClick={deleteSelected} disabled={deleting}>
                {deleting ? 'Eliminando...' : `✕ Eliminar ${selected.size}`}
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={() => setModal('new')}>+ Nuevo Producto</button>
        </div>
      </div>

      <div className="page">
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
            <span className="search-icon">⌕</span>
            <input className="form-input" placeholder="Buscar por nombre o SKU..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 180 }} value={catFilter} onChange={e => { setCatFilter(e.target.value); setSelected(new Set()) }}>
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select className="form-select" style={{ width: 180 }} value={supFilter} onChange={e => { setSupFilter(e.target.value); setSelected(new Set()) }}>
            <option value="">Todos los proveedores</option>
            {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={toggleAll} style={{ whiteSpace: 'nowrap' }}>
            {selected.size === filtered.length && filtered.length > 0 ? '☐ Deseleccionar todos' : '☑ Seleccionar todos'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--white-3)', whiteSpace: 'nowrap' }}>
            {selected.size > 0 ? selected.size + ' de ' + filtered.length + ' seleccionados' : filtered.length + ' productos'}
          </span>
        </div>

        <div className="card">
          {loading ? (
            <p style={{ color: 'var(--white-3)', fontSize: 13 }}>Cargando productos...</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>
                      <input type="checkbox"
                        checked={filtered.length > 0 && selected.size === filtered.length}
                        onChange={toggleAll}
                        style={{ cursor: 'pointer', accentColor: 'var(--navy)' }}
                      />
                    </th>
                    <th>SKU</th>
                    <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Producto {sortCol==='name' ? (sortDir==='asc'?'↑':'↓') : '↕'}
                    </th>
                    <th onClick={() => toggleSort('category')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Categoría {sortCol==='category' ? (sortDir==='asc'?'↑':'↓') : '↕'}
                    </th>
                    <th onClick={() => toggleSort('supplier')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Proveedor {sortCol==='supplier' ? (sortDir==='asc'?'↑':'↓') : '↕'}
                    </th>
                    <th onClick={() => toggleSort('cost')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                      Costo {sortCol==='cost' ? (sortDir==='asc'?'↑':'↓') : '↕'}
                    </th>
                    <th onClick={() => toggleSort('price')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                      P. Venta {sortCol==='price' ? (sortDir==='asc'?'↑':'↓') : '↕'}
                    </th>
                    <th onClick={() => toggleSort('margin')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Margen {sortCol==='margin' ? (sortDir==='asc'?'↑':'↓') : '↕'}
                    </th>
                    <th onClick={() => toggleSort('stock')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Stock {sortCol==='stock' ? (sortDir==='asc'?'↑':'↓') : '↕'}
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--white-3)' }}>
                      {search || catFilter ? 'Sin resultados para esta búsqueda' : 'Sin productos aún. Agrega el primero o importa desde Google Sheets.'}
                    </td></tr>
                  )}
                  {filtered.map(p => {
                    const m = calcMargin(p.avg_cost, p.sale_price)
                    const hasCost = p.avg_cost > 0
                    return (
                      <tr key={p.id} style={{ background: selected.has(p.id) ? 'rgba(201,168,76,0.06)' : undefined }}>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => toggleSelect(p.id)}
                            style={{ cursor: 'pointer', accentColor: 'var(--gold)' }}
                          />
                        </td>
                        <td className="td-mono td-muted" style={{ fontSize: 11 }}>{p.sku || '—'}</td>
                        <td className="td-bold">{p.name}</td>
                        <td>
                          <span className={`badge ${catColorMap[p.categories?.name] || 'badge-muted'}`}>
                            {p.categories?.name || '—'}
                          </span>
                        </td>
                        <td className="td-muted" style={{ fontSize: 12 }}>{p.suppliers?.name?.substring(0, 22) || '—'}</td>
                        <td className="td-mono" style={{ color: hasCost ? 'var(--white-2)' : 'var(--white-3)', fontSize: 12 }}>
                          {hasCost ? fmt(p.avg_cost) : <span style={{ fontStyle: 'italic' }}>pendiente</span>}
                        </td>
                        <td className="td-gold">{fmt(p.sale_price)}</td>
                        <td>
                          {hasCost
                            ? <span className={`${marginClass(m)}`} style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 500 }}>{pct(m)}</span>
                            : <span style={{ fontSize: 11, color: 'var(--white-3)' }}>—</span>
                          }
                        </td>
                        <td>
                          <span className={`badge ${p.stock === null ? 'badge-muted' : p.stock < 5 ? 'badge-danger' : p.stock < 10 ? 'badge-warning' : 'badge-success'}`}>
                            {p.stock ?? '—'}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal(p)} style={{ marginRight: 4 }}>Editar</button>
                          <button className="btn btn-danger btn-sm" onClick={async () => {
                            if (!confirm(`¿Eliminar "${p.name}"?`)) return
                            await archiveProduct(p.id)
                            await load()
                          }}>✕</button>
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

      {bulkSup && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setBulkSup(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">Asignar Proveedor</div>
              <button className="modal-close" onClick={() => setBulkSup(false)}>×</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
              Se asignará el proveedor a <strong>{selected.size} producto{selected.size > 1 ? 's' : ''}</strong>.
            </p>
            <div className="form-group">
              <label className="form-label">Proveedor</label>
              <select className="form-select" value={bulkSupId} onChange={e => setBulkSupId(e.target.value)} autoFocus>
                <option value="">— Selecciona un proveedor —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setBulkSup(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={applyBulkSupplier} disabled={!bulkSupId}>
                Aplicar a {selected.size} producto{selected.size > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkCat && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setBulkCat(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">Asignar Categoría</div>
              <button className="modal-close" onClick={() => setBulkCat(false)}>×</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
              Se asignará la categoría seleccionada a <strong>{selected.size} producto{selected.size > 1 ? 's' : ''}</strong>.
            </p>
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-select" value={bulkCatId} onChange={e => setBulkCatId(e.target.value)} autoFocus>
                <option value="">— Selecciona una categoría —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setBulkCat(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={applyBulkCategory} disabled={!bulkCatId}>
                Aplicar a {selected.size} producto{selected.size > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'new' && (
        <ProductModal
          categories={categories} suppliers={suppliers}
          onClose={() => setModal(null)} onSave={load}
          userEmail={user?.email}
        />
      )}
      {modal && modal !== 'new' && (
        <ProductModal
          product={modal} categories={categories} suppliers={suppliers}
          onClose={() => setModal(null)} onSave={load}
          userEmail={user?.email}
        />
      )}
    </>
  )
}

// ── Product Modal ─────────────────────────────────────────────────
function ProductModal({ product, categories, suppliers, onClose, onSave, userEmail }) {
  const isNew = !product
  const [form, setForm] = useState({
    name:        product?.name        || '',
    sku:         product?.sku         || '',
    category_id: product?.category_id || '',
    supplier_id: product?.supplier_id || '',
    unit:        product?.unit        || 'unidad',
    avg_cost:    product?.avg_cost    || '',
    sale_price:  product?.sale_price  || '',
    stock:       product?.stock       ?? 0,
    notes:       product?.notes       || '',
  })
  const [history, setHistory] = useState([])
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [tab,     setTab]     = useState('data') // 'data' | 'history'

  useEffect(() => {
    if (product?.id) {
      getPriceHistory(product.id).then(({ data }) => setHistory(data || []))
    }
  }, [product])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const margin = form.avg_cost && form.sale_price
    ? calcMargin(parseFloat(form.avg_cost), parseFloat(form.sale_price))
    : null

  const handleSave = async () => {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    if (!form.sale_price)  { setError('El precio de venta es requerido'); return }

    // Check for duplicate name (case insensitive), skip check when editing same product
    const allProds = await getProducts(true)
    const duplicate = (allProds.data || []).find(p =>
      p.name.trim().toLowerCase() === form.name.trim().toLowerCase() &&
      p.id !== product?.id &&
      p.active
    )
    if (duplicate) {
      setError(`Ya existe un producto con el nombre "${duplicate.name}". Verifica el catálogo.`)
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      ...form,
      avg_cost:   form.avg_cost   ? parseFloat(form.avg_cost)   : 0,
      sale_price: parseFloat(form.sale_price),
      stock:      parseInt(form.stock || 0),
      category_id: form.category_id || null,
      supplier_id: form.supplier_id || null,
    }

    if (isNew) {
      const { error } = await createProduct(payload)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      // log price changes
      if (product.avg_cost !== payload.avg_cost)
        await logPriceChange(product.id, 'avg_cost', product.avg_cost, payload.avg_cost, userEmail)
      if (product.sale_price !== payload.sale_price)
        await logPriceChange(product.id, 'sale_price', product.sale_price, payload.sale_price, userEmail)

      const { error } = await updateProduct(product.id, payload)
      if (error) { setError(error.message); setSaving(false); return }
    }

    await onSave()
    onClose()
  }

  const handleArchive = async () => {
    if (!confirm('¿Archivar este producto? Seguirá en cotizaciones existentes.')) return
    await archiveProduct(product.id)
    await onSave()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">{isNew ? 'Nuevo Producto' : 'Editar Producto'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {!isNew && (
          <div className="tabs">
            <button className={`tab ${tab === 'data' ? 'active' : ''}`} onClick={() => setTab('data')}>Datos</button>
            <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>Historial de Precios</button>
          </div>
        )}

        {tab === 'data' && (
          <>
            <div className="col-span-2 form-group">
              <label className="form-label">Nombre del Producto *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Aceite de Oliva Extra Virgen 5L" />
            </div>
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">SKU / Código</label>
                <input className="form-input" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="ALM-001" />
              </div>
              <div className="form-group">
                <label className="form-label">Unidad</label>
                <select className="form-select" value={form.unit} onChange={e => set('unit', e.target.value)}>
                  {['unidad','kg','libra','litro','botella','caja','paquete','bidón','set','spray','frasco','pack','rollo','metro','juego'].map(u => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Stock Actual</label>
                <input className="form-input" type="number" value={form.stock} onChange={e => set('stock', e.target.value)} />
              </div>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Categoría</label>
                <select className="form-select" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Proveedor</label>
                <select className="form-select" value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)}>
                  <option value="">Sin proveedor</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Costo Promedio ($)</label>
                <input className="form-input" type="number" step="0.01" value={form.avg_cost}
                  onChange={e => set('avg_cost', e.target.value)} placeholder="0.00 — puedes dejarlo vacío" />
                <div className="form-hint">Déjalo vacío si aún no tienes el costo de factura</div>
              </div>
              <div className="form-group">
                <label className="form-label">Precio de Venta ($) *</label>
                <input className="form-input" type="number" step="0.01" value={form.sale_price}
                  onChange={e => set('sale_price', e.target.value)} placeholder="0.00" />
              </div>
            </div>

            {margin !== null && (
              <div style={{ background: 'var(--navy-3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                Margen: <span className={marginClass(margin)} style={{ fontWeight: 600 }}>{pct(margin)}</span>
                {' · '}Ganancia: <span style={{ color: 'var(--gold)' }}>{fmt(parseFloat(form.sale_price) - parseFloat(form.avg_cost))}</span> por {form.unit}
                {parseFloat(form.avg_cost) >= parseFloat(form.sale_price) && (
                  <span style={{ color: 'var(--danger)', marginLeft: 12 }}>⚠ El costo supera el precio de venta</span>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Notas internas</label>
              <input className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Observaciones opcionales..." />
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              {!isNew
                ? <button className="btn btn-danger" onClick={handleArchive}>Archivar</button>
                : <span />
              }
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : isNew ? 'Crear Producto' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </>
        )}

        {tab === 'history' && (
          <div>
            {history.length === 0
              ? <p style={{ color: 'var(--white-3)', fontSize: 13 }}>Sin cambios de precio registrados</p>
              : (
                <table>
                  <thead><tr><th>Campo</th><th>Anterior</th><th>Nuevo</th><th>Por</th><th>Fecha</th></tr></thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id}>
                        <td><span className="badge badge-muted">{h.field === 'avg_cost' ? 'Costo' : 'P. Venta'}</span></td>
                        <td className="td-mono" style={{ color: 'var(--white-3)' }}>{fmt(h.old_value)}</td>
                        <td className="td-mono td-gold">{fmt(h.new_value)}</td>
                        <td className="td-muted" style={{ fontSize: 12 }}>{h.changed_by}</td>
                        <td className="td-muted" style={{ fontSize: 12 }}>{formatDate(h.created_at?.split('T')[0])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>
        )}
      </div>
    </div>
  )
}
