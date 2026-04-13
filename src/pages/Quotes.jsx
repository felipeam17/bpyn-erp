// src/pages/Quotes.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getQuotes, updateQuoteStatus, supabase, updateProduct, getProducts, createProduct } from '../lib/supabase'
import { fmt, pct, calcMargin, marginClass, statusMap, formatDate } from '../lib/utils'

export default function Quotes() {
  const [quotes,  setQuotes]  = useState([])
  const [loading, setLoading] = useState(true)
  const [detail,  setDetail]  = useState(null)
  const [filter,  setFilter]  = useState('')

  const load = () => getQuotes().then(({ data }) => { setQuotes(data || []); setLoading(false) })
  useEffect(() => { load() }, [])

  const filtered = filter ? quotes.filter(q => q.status === filter) : quotes

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta cotización permanentemente? Esta acción no se puede deshacer.')) return
    // Delete quote items first, then quote
    await supabase.from('quote_items').delete().eq('quote_id', id)
    await supabase.from('quotes').delete().eq('id', id)
    await load()
  }

  const handleStatus = async (id, status) => {
    const quote = quotes.find(q => q.id === id)
    await updateQuoteStatus(id, status, quote?.quote_number)
    await load()
    if (detail?.id === id) setDetail(prev => ({
      ...prev,
      status,
      invoice_number: status === 'aceptada' ? quote?.quote_number?.replace('COT-', 'INV-') : prev.invoice_number
    }))
  }

  const exportQuote = async (q) => {
    if (!q.quote_items?.length) { alert('Esta cotización no tiene items para exportar'); return }
    try {
      // Build a map of product_id -> supplier name for this quote's items
      const supplierMap = {}
      const productIds = q.quote_items.filter(i => i.product_id).map(i => i.product_id)
      if (productIds.length > 0) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, suppliers(name)')
          .in('id', productIds)
        if (prods) prods.forEach(p => { supplierMap[p.id] = p.suppliers?.name || '' })
      }

      const res = await fetch('/api/export-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote: {
            quote_number: q.invoice_number || q.quote_number,
            is_invoice: !!q.invoice_number,
            client: q.client,
            date: q.date,
            marina: q.notes || '',
            discount_pct: q.discount_pct || 0,
            transportation_fee: q.transportation_fee || 0,
            notes: q.notes || '',
          },
          items: q.quote_items.map(i => ({
            product_name: i.product_name,
            format: i.unit || '',
            qty: i.qty,
            unit_price: i.unit_price,
            supplier: i.product_id ? (supplierMap[i.product_id] || '') : '',
          }))
        })
      })
      if (!res.ok) { alert('Error generando el Excel'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `BYN_${q.invoice_number || q.quote_number}_${q.client}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const openDetail = (q) => {
    // Always get fresh data from quotes array
    const fresh = quotes.find(x => x.id === q.id) || q
    setDetail(fresh)
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Cotizaciones</div>
        <div className="topbar-actions">
          <Link to="/quotes/new" className="btn btn-primary">+ Nueva Cotización</Link>
        </div>
      </div>

      <div className="page">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['', 'Todas'], ['pendiente', 'Pendientes'], ['aceptada', 'Aceptadas'], ['rechazada', 'Rechazadas']].map(([v, l]) => (
            <button key={v}
              className={`btn ${filter === v ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              onClick={() => setFilter(v)}>
              {l} {v && <span style={{ marginLeft: 4, opacity: 0.7 }}>({quotes.filter(q => q.status === v).length})</span>}
            </button>
          ))}
        </div>

        <div className="card">
          {loading ? (
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Cargando cotizaciones...</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Cotización</th><th>Invoice</th><th>Cliente / Yate</th><th>Fecha</th><th>Items</th><th>Total</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>
                      Sin cotizaciones {filter ? 'en este estado' : 'aún'}
                    </td></tr>
                  )}
                  {filtered.map(q => {
                    const s = statusMap[q.status] || statusMap.pendiente
                    return (
                      <tr key={q.id}>
                        <td className="td-mono td-muted" style={{ fontSize: 11 }}>{q.quote_number}</td>
                        <td className="td-mono" style={{ fontSize: 11, color: q.invoice_number ? 'var(--success)' : 'var(--text-3)' }}>
                          {q.invoice_number || '—'}
                        </td>
                        <td className="td-bold">{q.client}</td>
                        <td className="td-muted" style={{ fontSize: 12 }}>{formatDate(q.date)}</td>
                        <td className="td-muted" style={{ fontSize: 12 }}>{q.quote_items?.length ?? 0} artículos</td>
                        <td className="td-mono" style={{ color: 'var(--navy)', fontWeight: 600 }}>{fmt(q.total)}</td>
                        <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openDetail(q)}>Ver / Editar</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => exportQuote(q)}>⬇ Excel</button>
                            {q.status === 'pendiente' && (
                              <>
                                <button className="btn btn-success btn-xs" onClick={() => handleStatus(q.id, 'aceptada')}>✓</button>
                                <button className="btn btn-danger btn-xs" onClick={() => handleStatus(q.id, 'rechazada')}>✗</button>
                              </>
                            )}
                            <button className="btn btn-danger btn-xs" onClick={() => handleDelete(q.id)} title="Eliminar cotización">🗑</button>
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

      {detail && (
        <QuoteDetail
          quote={detail}
          onClose={() => { setDetail(null); load() }}
          onStatusChange={handleStatus}
          onExport={exportQuote}
          onDelete={handleDelete}
        />
      )}
    </>
  )
}

function QuoteDetail({ quote: initialQuote, onClose, onStatusChange, onExport, onDelete }) {
  const [q, setQ]           = useState(initialQuote)
  const [items, setItems]   = useState(initialQuote.quote_items || [])
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [newItem, setNewItem] = useState({ name: '', format: '', qty: 1, price: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [search,  setSearch]  = useState('')
  const [catalog, setCatalog] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)

  const s = statusMap[q.status] || statusMap.pendiente

  useEffect(() => {
    getProducts().then(({ data }) => setCatalog(data || []))
  }, [])

  const filteredCatalog = search.trim()
    ? catalog.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku||'').toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : []

  const updateItemField = (itemId, field, value) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, [field]: value } : i))
    setSaved(false)
  }

  const removeItem = async (itemId) => {
    await supabase.from('quote_items').delete().eq('id', itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
    setSaved(false)
  }

  const addFromCatalog = async (p) => {
    const { data } = await supabase.from('quote_items').insert({
      quote_id: q.id, product_id: p.id,
      product_name: p.name, product_sku: p.sku || '',
      unit: p.unit, unit_cost: p.avg_cost || 0,
      unit_price: p.sale_price, qty: 1,
    }).select().single()
    if (data) setItems(prev => [...prev, data])
    setSearch(''); setPickerOpen(false); setSaved(false)
  }

  const addManualItem = async () => {
    if (!newItem.name.trim()) return
    const { data } = await supabase.from('quote_items').insert({
      quote_id: q.id, product_id: null,
      product_name: newItem.name.trim(),
      product_sku: '',
      unit: newItem.format || 'unidad',
      unit_cost: 0,
      unit_price: newItem.price ? parseFloat(newItem.price) : 0,
      qty: parseFloat(newItem.qty) || 1,
    }).select().single()
    if (data) setItems(prev => [...prev, data])
    setNewItem({ name: '', format: '', qty: 1, price: '' })
    setShowAdd(false); setSaved(false)
  }

  const saveChanges = async () => {
    setSaving(true)
    for (const item of items) {
      const price = parseFloat(item.unit_price || 0)
      await supabase.from('quote_items').update({
        product_name: item.product_name,
        unit_price: price,
        qty: parseFloat(item.qty || 1),
        unit: item.unit || '',
      }).eq('id', item.id)
      if (item.product_id && price > 0) {
        await updateProduct(item.product_id, { sale_price: price })
      }
    }
    const subtotal = items.reduce((a, i) => a + parseFloat(i.unit_price || 0) * parseFloat(i.qty || 1), 0)
    const disc = parseFloat(q.discount_pct || 0) / 100
    const transFee = parseFloat(q.transportation_fee || 0)
    const total = subtotal * (1 - disc) + transFee
    await supabase.from('quotes').update({ subtotal, total }).eq('id', q.id)
    setQ(prev => ({ ...prev, subtotal, total }))
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const subtotal = items.reduce((a, i) => a + parseFloat(i.unit_price || 0) * parseFloat(i.qty || 1), 0)
  const disc     = parseFloat(q.discount_pct || 0) / 100
  const transFee = parseFloat(q.transportation_fee || 0)
  const total    = subtotal * (1 - disc) + transFee

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div className="modal-title">{q.quote_number}</div>
              {q.invoice_number && <span className="badge badge-success">→ {q.invoice_number}</span>}
              <span className={`badge ${s.cls}`}>{s.label}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {q.client} · {formatDate(q.date)}
              {q.valid_until && ` · Válida hasta ${formatDate(q.valid_until)}`}
              {q.invoiced_at && ` · Facturado ${formatDate(q.invoiced_at?.split('T')[0])}`}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Alert that price changes update catalog */}
        <div className="alert alert-info" style={{ marginBottom: 14, fontSize: 12 }}>
          💡 Al editar precios aquí y guardar, el catálogo se actualiza automáticamente con el nuevo precio de venta.
        </div>

        {items.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Sin items en esta cotización.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Formato</th>
                  <th style={{ textAlign: 'right' }}>Cant.</th>
                  <th style={{ textAlign: 'right' }}>P. Unitario</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map(i => {
                  const price = parseFloat(i.unit_price || 0)
                  const qty   = parseFloat(i.qty || 1)
                  const hasPrice = price > 0
                  return (
                    <tr key={i.id}>
                      <td className="td-bold">{i.product_name}</td>
                      <td className="td-muted" style={{ fontSize: 12 }}>{i.unit || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="number" min="0.01" step="0.01"
                          value={i.qty}
                          onChange={e => updateItemQty(i.id, e.target.value)}
                          style={{
                            width: 70, padding: '4px 8px', fontSize: 13,
                            background: 'var(--gray-1)', border: '1px solid var(--border)',
                            borderRadius: 6, textAlign: 'right',
                            fontFamily: 'var(--mono)', color: 'var(--text-1)'
                          }}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="number" min="0" step="0.01"
                          value={i.unit_price}
                          onChange={e => updateItemPrice(i.id, e.target.value)}
                          placeholder="0.00"
                          style={{
                            width: 100, padding: '4px 8px', fontSize: 13,
                            background: hasPrice ? 'var(--gray-1)' : 'rgba(217,119,6,0.08)',
                            border: `1px solid ${hasPrice ? 'var(--border)' : 'rgba(217,119,6,0.4)'}`,
                            borderRadius: 6, textAlign: 'right',
                            fontFamily: 'var(--mono)', color: 'var(--text-1)'
                          }}
                        />
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--navy)' }}>
                        {fmt(price * qty)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="divider" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.9 }}>
            {q.notes && <div>📋 {q.notes}</div>}
            {q.discount_pct > 0 && <div>Descuento: {q.discount_pct}%</div>}
            {transFee > 0 && <div>Transportation Fee: {fmt(transFee)}</div>}
            {q.created_by && <div style={{ fontSize: 11 }}>Creada por {q.created_by}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            {q.discount_pct > 0 && <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 2 }}>Subtotal: {fmt(subtotal)}</div>}
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>Total</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--navy)', fontFamily: 'var(--mono)' }}>{fmt(total)}</div>
          </div>
        </div>

        <div className="divider" />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => onExport({ ...q, quote_items: items })}>⬇ Exportar Excel</button>
            <button className="btn btn-primary" onClick={saveChanges} disabled={saving}>
              {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar Cambios'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {q.status === 'pendiente' && (
              <>
                <button className="btn btn-danger" onClick={() => { onStatusChange(q.id, 'rechazada'); onClose() }}>Rechazar</button>
                <button className="btn btn-success" onClick={() => { onStatusChange(q.id, 'aceptada'); onClose() }}>✓ Aceptada</button>
              </>
            )}
            <button className="btn btn-danger btn-sm" onClick={() => { onDelete(q.id); onClose() }} style={{ marginLeft: 8 }}>🗑 Eliminar cotización</button>
          </div>
        </div>
      </div>
    </div>
  )
}
