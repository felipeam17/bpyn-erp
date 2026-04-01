// src/pages/Quotes.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getQuotes, updateQuoteStatus } from '../lib/supabase'
import { fmt, pct, calcMargin, marginClass, statusMap, formatDate } from '../lib/utils'

export default function Quotes() {
  const [quotes,  setQuotes]  = useState([])
  const [loading, setLoading] = useState(true)
  const [detail,  setDetail]  = useState(null)
  const [filter,  setFilter]  = useState('') // '' | 'pendiente' | 'aceptada' | 'rechazada'

  const load = () => getQuotes().then(({ data }) => { setQuotes(data || []); setLoading(false) })
  useEffect(() => { load() }, [])

  const filtered = filter ? quotes.filter(q => q.status === filter) : quotes

  const handleStatus = async (id, status) => {
    await updateQuoteStatus(id, status)
    await load()
    if (detail?.id === id) setDetail(prev => ({ ...prev, status }))
  }


  const exportQuote = async (q) => {
    if (!q.quote_items?.length) { alert('Esta cotización no tiene items para exportar'); return }
    try {
      const res = await fetch('/api/export-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote: {
            quote_number: q.quote_number,
            client: q.client,
            date: q.date,
            marina: q.notes || '',
            discount_pct: q.discount_pct || 0,
            notes: q.notes || '',
          },
          items: q.quote_items.map(i => ({
            product_name: i.product_name,
            format: i.unit || '',
            qty: i.qty,
            unit_price: i.unit_price,
            supplier: '',
          }))
        })
      })
      if (!res.ok) { alert('Error generando el Excel'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `BYN_${q.quote_number}_${q.client}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Error: ' + err.message)
    }
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
        {/* Filter tabs */}
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
            <p style={{ color: 'var(--white-3)', fontSize: 13 }}>Cargando cotizaciones...</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Número</th><th>Cliente / Yate</th><th>Fecha</th><th>Items</th><th>Total</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--white-3)' }}>
                      Sin cotizaciones {filter ? 'en este estado' : 'aún'}
                    </td></tr>
                  )}
                  {filtered.map(q => {
                    const s = statusMap[q.status] || statusMap.pendiente
                    return (
                      <tr key={q.id}>
                        <td className="td-mono td-muted" style={{ fontSize: 11 }}>{q.quote_number}</td>
                        <td className="td-bold">{q.client}</td>
                        <td className="td-muted" style={{ fontSize: 12 }}>{formatDate(q.date)}</td>
                        <td className="td-muted" style={{ fontSize: 12 }}>{q.quote_items?.length ?? 0} artículos</td>
                        <td className="td-gold">{fmt(q.total)}</td>
                        <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setDetail(q)}>Ver</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => exportQuote(q)} title="Exportar Excel">⬇ Excel</button>
                            {q.status === 'pendiente' && (
                              <>
                                <button className="btn btn-success btn-xs" onClick={() => handleStatus(q.id, 'aceptada')}>✓</button>
                                <button className="btn btn-danger btn-xs" onClick={() => handleStatus(q.id, 'rechazada')}>✗</button>
                              </>
                            )}
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

      {detail && <QuoteDetail quote={detail} onClose={() => setDetail(null)} onStatusChange={handleStatus} onExport={exportQuote} />}
    </>
  )
}

function QuoteDetail({ quote: q, onClose, onStatusChange, onExport }) {
  const items = q.quote_items || []
  const s = statusMap[q.status] || statusMap.pendiente
  const hasCost = q.total_cost > 0
  const margin = hasCost ? calcMargin(q.total_cost, q.total) : null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div className="modal-title">{q.quote_number}</div>
              <span className={`badge ${s.cls}`}>{s.label}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--white-3)' }}>
              {q.client} · {formatDate(q.date)}
              {q.valid_until && ` · Válida hasta ${formatDate(q.valid_until)}`}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {items.length === 0 ? (
          <p style={{ color: 'var(--white-3)', fontSize: 13 }}>Sin items en esta cotización.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Producto</th><th>SKU</th><th>Cant.</th><th>P. Unitario</th><th>Subtotal</th></tr></thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id}>
                    <td className="td-bold">{i.product_name}</td>
                    <td className="td-mono td-muted" style={{ fontSize: 11 }}>{i.product_sku || '—'}</td>
                    <td>{parseFloat(i.qty)} {i.unit}</td>
                    <td className="td-mono">{fmt(i.unit_price)}</td>
                    <td className="td-gold">{fmt(i.unit_price * i.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="divider" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--white-3)', lineHeight: 1.9 }}>
            {q.notes && <div>📋 {q.notes}</div>}
            {hasCost && margin !== null && (
              <div>Margen: <span className={marginClass(margin)} style={{ fontWeight: 600 }}>{pct(margin)}</span>
                {' · '}Ganancia: <span style={{ color: 'var(--gold)' }}>{fmt(q.total - q.total_cost)}</span>
              </div>
            )}
            {q.discount_pct > 0 && <div>Descuento aplicado: {q.discount_pct}%</div>}
            {q.created_by && <div style={{ fontSize: 11 }}>Creada por {q.created_by}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            {q.discount_pct > 0 && (
              <div style={{ fontSize: 12, color: 'var(--white-3)', marginBottom: 2 }}>Subtotal: {fmt(q.subtotal)}</div>
            )}
            <div style={{ fontSize: 11, color: 'var(--white-3)', textTransform: 'uppercase', letterSpacing: 1 }}>Total</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--mono)' }}>{fmt(q.total)}</div>
          </div>
        </div>

        <div className="divider" />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => onExport(q)}>⬇ Exportar Excel</button>
          {q.status === 'pendiente' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger" onClick={() => { onStatusChange(q.id, 'rechazada'); onClose() }}>Rechazar</button>
              <button className="btn btn-success" onClick={() => { onStatusChange(q.id, 'aceptada'); onClose() }}>✓ Marcar como Aceptada</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
