// src/pages/NewQuote.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProducts, createQuote } from '../lib/supabase'
import { fmt, pct, calcMargin, marginClass, today } from '../lib/utils'
import { useAuth } from '../App'

export default function NewQuote() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [products,    setProducts]    = useState([])
  const [search,      setSearch]      = useState('')
  const [pickerOpen,  setPickerOpen]  = useState(false)
  const [items,       setItems]       = useState([])
  const [client,      setClient]      = useState('')
  const [date,        setDate]        = useState(today())
  const [validUntil,  setValidUntil]  = useState('')
  const [discountPct, setDiscountPct] = useState(0)
  const [notes,       setNotes]       = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const searchRef = useRef(null)

  useEffect(() => {
    getProducts().then(({ data }) => setProducts(data || []))
  }, [])

  // ── Filtered picker results ──────────────────────────────────────
  const filtered = search.trim()
    ? products.filter(p => {
        const q = search.toLowerCase()
        return p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
      }).slice(0, 8)
    : []

  // ── Add / remove / update items ──────────────────────────────────
  const addProduct = (p) => {
    setItems(prev => {
      const existing = prev.find(i => i.product_id === p.id)
      if (existing) {
        return prev.map(i => i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, {
        product_id:   p.id,
        product_name: p.name,
        product_sku:  p.sku || '',
        unit:         p.unit,
        unit_cost:    p.avg_cost || 0,
        unit_price:   p.sale_price,
        qty:          1,
      }]
    })
    setSearch('')
    setPickerOpen(false)
    searchRef.current?.focus()
  }

  const updateItem = (productId, field, value) => {
    setItems(prev => prev.map(i => i.product_id === productId ? { ...i, [field]: value } : i))
  }

  const removeItem = (productId) => {
    setItems(prev => prev.filter(i => i.product_id !== productId))
  }

  // ── Totals ───────────────────────────────────────────────────────
  const subtotal   = items.reduce((a, i) => a + parseFloat(i.unit_price || 0) * parseFloat(i.qty || 0), 0)
  const totalCost  = items.reduce((a, i) => a + parseFloat(i.unit_cost  || 0) * parseFloat(i.qty || 0), 0)
  const discAmt    = subtotal * (parseFloat(discountPct) / 100)
  const total      = subtotal - discAmt
  const totalMgn   = total > 0 ? calcMargin(totalCost, total) : 0

  // ── Save ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!client.trim()) { setError('El nombre del cliente/yate es requerido'); return }
    if (items.length === 0) { setError('Agrega al menos un producto'); return }
    setSaving(true)
    setError('')

    const { error } = await createQuote(
      {
        client,
        date,
        valid_until:  validUntil || null,
        status:       'pendiente',
        discount_pct: parseFloat(discountPct),
        notes,
        subtotal,
        total,
        total_cost: totalCost,
        created_by: user?.email,
      },
      items.map(i => ({
        product_id:   i.product_id,
        product_name: i.product_name,
        product_sku:  i.product_sku,
        unit:         i.unit,
        unit_cost:    parseFloat(i.unit_cost || 0),
        unit_price:   parseFloat(i.unit_price),
        qty:          parseFloat(i.qty),
      }))
    )

    if (error) { setError(error.message); setSaving(false); return }
    navigate('/quotes')
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Nueva Cotización</div>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={() => navigate('/quotes')}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || items.length === 0 || !client.trim()}>
            {saving ? 'Guardando...' : 'Guardar Cotización'}
          </button>
        </div>
      </div>

      <div className="page" style={{ maxWidth: 900, margin: '0 auto' }}>
        {error && <div className="alert alert-danger">{error}</div>}

        {/* Client + Date */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 14 }}>Información del Cliente</div>
          <div className="form-grid-2">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Cliente / Nombre del Yate *</label>
              <input className="form-input" value={client} onChange={e => setClient(e.target.value)}
                placeholder="Ej: M/Y Serenity, S/Y Ocean Dream..." autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha</label>
              <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Válida hasta</label>
              <input className="form-input" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Notas / Instrucciones de entrega</label>
            <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Instrucciones especiales, condiciones, punto de entrega..." />
          </div>
        </div>

        {/* Product search */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 14 }}>Agregar Productos</div>
          <div style={{ position: 'relative' }}>
            <div className="search-wrap">
              <span className="search-icon">⌕</span>
              <input
                ref={searchRef}
                className="form-input"
                value={search}
                onChange={e => { setSearch(e.target.value); setPickerOpen(true) }}
                onFocus={() => search && setPickerOpen(true)}
                placeholder="Busca por nombre o SKU para agregar..."
              />
            </div>

            {pickerOpen && filtered.length > 0 && (
              <div className="picker-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4 }}>
                {filtered.map(p => (
                  <div key={p.id} className="picker-item" onClick={() => addProduct(p)}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--white-3)' }}>
                        {p.sku || '—'} · {p.categories?.name || '—'} · {p.unit}
                        {p.avg_cost > 0 && (
                          <> · <span style={{ color: 'var(--white-2)' }}>
                            Margen: <span className={marginClass(calcMargin(p.avg_cost, p.sale_price))}>
                              {pct(calcMargin(p.avg_cost, p.sale_price))}
                            </span>
                          </span></>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'var(--mono)', color: 'var(--gold)', fontSize: 14, fontWeight: 500 }}>{fmt(p.sale_price)}</div>
                      <div style={{ fontSize: 10, color: 'var(--white-3)' }}>por {p.unit}</div>
                    </div>
                    <button className="btn btn-primary btn-sm">+</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Items list */}
        {items.length === 0 ? (
          <div className="alert alert-info">Busca y agrega productos para armar la cotización.</div>
        ) : (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">Items ({items.length})</div>
              <div style={{ fontSize: 12, color: 'var(--white-3)' }}>Puedes ajustar precio y cantidad por ítem</div>
            </div>

            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 90px 90px 36px', gap: 8, padding: '0 0 8px', fontSize: 10, color: 'var(--white-3)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
              <div>Producto</div><div style={{ textAlign: 'right' }}>Cant.</div>
              <div style={{ textAlign: 'right' }}>P. Unit ($)</div>
              <div style={{ textAlign: 'right' }}>Margen</div>
              <div style={{ textAlign: 'right' }}>Subtotal</div>
              <div />
            </div>

            {items.map(item => {
              const m = item.unit_cost > 0 ? calcMargin(item.unit_cost, parseFloat(item.unit_price || 0)) : null
              const sub = parseFloat(item.unit_price || 0) * parseFloat(item.qty || 0)
              return (
                <div key={item.product_id} className="quote-item-row" style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 90px 90px 36px', gap: 8, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.product_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--white-3)' }}>{item.product_sku || '—'} · {item.unit}</div>
                  </div>
                  <div>
                    <input
                      className="form-input" type="number" min="0.01" step="0.01"
                      value={item.qty}
                      onChange={e => updateItem(item.product_id, 'qty', e.target.value)}
                      style={{ padding: '5px 8px', fontSize: 13, textAlign: 'right' }}
                    />
                  </div>
                  <div>
                    <input
                      className="form-input" type="number" min="0" step="0.01"
                      value={item.unit_price}
                      onChange={e => updateItem(item.product_id, 'unit_price', e.target.value)}
                      style={{ padding: '5px 8px', fontSize: 13, textAlign: 'right' }}
                    />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {m !== null
                      ? <span className={marginClass(m)} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{pct(m)}</span>
                      : <span style={{ fontSize: 11, color: 'var(--white-3)' }}>—</span>
                    }
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--gold)', fontSize: 13 }}>
                    {fmt(sub)}
                  </div>
                  <div>
                    <button onClick={() => removeItem(item.product_id)}
                      style={{ background: 'none', border: 'none', color: 'var(--white-3)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
                      title="Eliminar">×</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Totals */}
        {items.length > 0 && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
              <div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Descuento Global (%)</label>
                  <input
                    className="form-input" type="number" min="0" max="100" step="0.5"
                    value={discountPct} onChange={e => setDiscountPct(e.target.value)}
                    style={{ width: 120 }}
                  />
                </div>
                {totalCost > 0 && (
                  <div style={{ marginTop: 12, fontSize: 13, color: 'var(--white-3)', lineHeight: 2 }}>
                    Margen total: <span className={marginClass(totalMgn)} style={{ fontWeight: 600 }}>{pct(totalMgn)}</span><br />
                    Ganancia estimada: <span style={{ color: 'var(--gold)' }}>{fmt(total - totalCost)}</span>
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--white-3)', marginBottom: 4 }}>Subtotal: {fmt(subtotal)}</div>
                {parseFloat(discountPct) > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 4 }}>
                    Descuento ({discountPct}%): -{fmt(discAmt)}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--white-3)', textTransform: 'uppercase', letterSpacing: 1 }}>Total</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--mono)' }}>{fmt(total)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
