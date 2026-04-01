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
  const [mode,        setMode]        = useState('manual')
  const [transFee,    setTransFee]    = useState(0) // 'manual' | 'paste'
  const [pasteText,   setPasteText]   = useState('')
  const [pasteResult, setPasteResult] = useState(null) // { matched, unmatched }

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
  const addProduct = (p, qty = 1, format = '') => {
    setItems(prev => {
      const existing = prev.find(i => i.product_id === p.id)
      if (existing) {
        return prev.map(i => i.product_id === p.id ? { ...i, qty: i.qty + qty } : i)
      }
      return [...prev, {
        product_id:   p.id,
        product_name: p.name,
        product_sku:  p.sku || '',
        unit:         p.unit,
        format:       format || p.unit || '',
        unit_cost:    p.avg_cost || 0,
        unit_price:   p.sale_price,
        qty,
      }]
    })
    setSearch('')
    setPickerOpen(false)
    searchRef.current?.focus()
  }

  const updateItem = (key, field, value) => {
    setItems(prev => prev.map(i => (i.product_id === key || i.product_name === key) ? { ...i, [field]: value } : i))
  }

  const removeItem = (key) => {
    setItems(prev => prev.filter(i => i.product_id !== key && i.product_name !== key))
  }

  // ── Paste list parser ────────────────────────────────────────────
  const parsePasteList = () => {
    if (!pasteText.trim()) return
    const lines = pasteText.trim().split('\n').filter(l => l.trim())
    const matched = []
    const unmatched = []

    // Detect if pasted data has tab-separated columns (from Excel/Sheets)
    // Possible column orders: DESCRIPTION, FORMAT, QUANTITY or DESCRIPTION, QUANTITY
    const firstLine = lines[0]
    const hasTabs = firstLine.includes('\t')

    lines.forEach(line => {
      const raw = line.trim()
      if (!raw) return

      let qty = 1
      let name = raw
      let format = ''

      if (hasTabs) {
        // Tab-separated: detect columns
        const cols = raw.split('\t').map(c => c.trim())
        // Try to identify which column is which
        // Heuristic: description is the longest text, quantity is a number
        name = cols[0] || raw

        // Check each column for qty (pure number) and format (non-numeric text)
        cols.slice(1).forEach(col => {
          const num = parseFloat(col.replace(',', '.'))
          if (!isNaN(num) && col.match(/^[\d.,]+$/)) {
            qty = num
          } else if (col && !col.match(/^[\d.,]+$/)) {
            format = col
          }
        })
      } else {
        // Single column — try to extract quantity from name
        const startNum = raw.match(/^(\d+(?:\.\d+)?)\s+(.+)/)
        if (startNum) {
          qty = parseFloat(startNum[1])
          name = startNum[2].trim()
        } else {
          const endNum = raw.match(/^(.+?)[\s\-x*×]+(\d+(?:\.\d+)?)$/)
          if (endNum) {
            name = endNum[1].trim()
            qty = parseFloat(endNum[2])
          }
        }
      }

      // Match name against products — strict only
      const nameLower = name.toLowerCase().trim()
      const words = nameLower.split(/\s+/).filter(w => w.length > 2)

      let bestMatch = null
      let bestScore = 0

      products.forEach(p => {
        const pName = p.name.toLowerCase().trim()
        const pSku  = (p.sku || '').toLowerCase().trim()

        // 1. Exact SKU match
        if (pSku && (nameLower === pSku || nameLower.includes(pSku))) {
          bestMatch = p; bestScore = 1000; return
        }

        // 2. Exact name match (case insensitive)
        if (pName === nameLower) {
          bestMatch = p; bestScore = 999; return
        }

        // 3. Name contains the full search string or vice versa
        if (pName.includes(nameLower) || nameLower.includes(pName)) {
          const score = 500 + pName.length
          if (score > bestScore) { bestScore = score; bestMatch = p }
          return
        }

        // 4. ALL significant words must match — no partial word matches allowed
        if (words.length === 0) return
        const allWordsMatch = words.every(w => pName.includes(w))
        if (allWordsMatch) {
          // Extra: how much of the product name is covered
          const coverage = words.reduce((a, w) => a + w.length, 0) / pName.length
          const score = Math.round(coverage * 100) + words.length * 10
          if (score > bestScore) { bestScore = score; bestMatch = p }
        }
      })

      // High threshold — must cover most of the name to be considered a match
      if (bestMatch && bestScore >= 50) {
        matched.push({ product: bestMatch, qty, format, originalLine: raw })
      } else {
        unmatched.push({ originalLine: raw, qty, name, format })
      }
    })

    setPasteResult({ matched, unmatched })
  }

  const addUnmatched = (item) => {
    setItems(prev => {
      const existing = prev.find(i => i.product_name === item.name && !i.product_id)
      if (existing) return prev
      return [...prev, {
        product_id:   null,
        product_name: item.name,
        product_sku:  '',
        unit:         item.format || 'unidad',
        format:       item.format || '',
        unit_cost:    0,
        unit_price:   '',
        qty:          item.qty,
      }]
    })
  }

  const applyPasteMatches = () => {
    if (!pasteResult) return

    // Rebuild the original ordered list by merging matched and unmatched
    // pasteResult.matched and unmatched both have originalLine — we use
    // the order they appeared in pasteResult (which mirrors paste order)
    const allInOrder = []

    // We need to reconstruct original order from both lists
    // Both were pushed in line order, so interleave them by original index
    const matchedMap = {}
    const unmatchedMap = {}

    pasteResult.matched.forEach((m, i) => { matchedMap[m.originalLine] = m })
    pasteResult.unmatched.forEach((u, i) => { unmatchedMap[u.originalLine] = u })

    // Re-parse lines in order to get correct sequence
    const lines = pasteText.trim().split('\n').filter(l => l.trim())
    const hasTabs = lines[0]?.includes('\t')

    lines.forEach(line => {
      const raw = line.trim()
      if (!raw) return
      const matched = matchedMap[raw]
      const unmatched = unmatchedMap[raw]

      if (matched) {
        allInOrder.push({
          product_id:   matched.product.id,
          product_name: matched.product.name,
          product_sku:  matched.product.sku || '',
          unit:         matched.product.unit,
          format:       matched.format || matched.product.unit || '',
          unit_cost:    matched.product.avg_cost || 0,
          unit_price:   matched.product.sale_price,
          qty:          matched.qty,
        })
      } else if (unmatched) {
        allInOrder.push({
          product_id:   null,
          product_name: unmatched.name,
          product_sku:  '',
          unit:         unmatched.format || 'unidad',
          format:       unmatched.format || '',
          unit_cost:    0,
          unit_price:   '',
          qty:          unmatched.qty,
        })
      }
    })

    // Add to existing items preserving order — append in order, skip duplicates
    setItems(prev => {
      const existingIds = new Set(prev.map(i => i.product_id).filter(Boolean))
      const existingNames = new Set(prev.filter(i => !i.product_id).map(i => i.product_name))
      const toAdd = allInOrder.filter(i => {
        if (i.product_id) return !existingIds.has(i.product_id)
        return !existingNames.has(i.product_name)
      })
      return [...prev, ...toAdd]
    })

    setPasteText('')
    setPasteResult(null)
    setMode('manual')
  }

  // ── Totals ───────────────────────────────────────────────────────
  const subtotal   = items.reduce((a, i) => a + parseFloat(i.unit_price || 0) * parseFloat(i.qty || 0), 0)
  const totalCost  = items.reduce((a, i) => a + parseFloat(i.unit_cost  || 0) * parseFloat(i.qty || 0), 0)
  const discAmt    = subtotal * (parseFloat(discountPct) / 100)
  const transFeeAmt = parseFloat(transFee || 0)
  const total      = subtotal - discAmt + transFeeAmt
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
        transportation_fee: transFeeAmt,
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
        unit:         i.format || i.unit || '',
        unit_cost:    parseFloat(i.unit_cost || 0),
        unit_price:   i.unit_price === '' || i.unit_price === null || i.unit_price === undefined ? 0 : parseFloat(i.unit_price),
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

        {/* Mode toggle */}
        <div className="tabs" style={{ marginBottom: 16 }}>
          <button className={`tab ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}>
            Buscar productos
          </button>
          <button className={`tab ${mode === 'paste' ? 'active' : ''}`} onClick={() => setMode('paste')}>
            Pegar lista desde Excel / Sheets
          </button>
        </div>

        {/* ── PASTE MODE ── */}
        {mode === 'paste' && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">Pegar lista de productos</div>
            </div>
            <div className="alert alert-info" style={{ marginBottom: 14 }}>
              Copia y pega tu lista desde Excel o Google Sheets. El sistema busca cada producto en el catálogo automáticamente.<br />
              <strong>Formatos aceptados por fila:</strong> "2 Aceite de Oliva" · "Aceite de Oliva x2" · "Aceite de Oliva - 3" · "Champagne 1"
            </div>
            <div className="form-group">
              <label className="form-label">Lista de productos (una por línea)</label>
              <textarea
                className="form-textarea"
                style={{ minHeight: 160, fontFamily: 'var(--mono)', fontSize: 13 }}
                placeholder={'Ej:\n2 Aceite de Oliva Extra Virgen\nDetergente Industrial x3\nSalmón Noruego - 5\nChampagne Dom Pérignon 2'}
                value={pasteText}
                onChange={e => { setPasteText(e.target.value); setPasteResult(null) }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => { setPasteText(''); setPasteResult(null) }}>Limpiar</button>
              <button className="btn btn-primary" onClick={parsePasteList} disabled={!pasteText.trim()}>
                Buscar en catálogo →
              </button>
            </div>

            {/* Results */}
            {pasteResult && (
              <div style={{ marginTop: 20 }}>
                <div className="divider" />

                {pasteResult.matched.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, fontWeight: 500 }}>
                      ✓ {pasteResult.matched.length} productos encontrados
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      {pasteResult.matched.map((m, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '9px 14px', background: 'rgba(76,175,125,0.06)',
                          border: '1px solid rgba(76,175,125,0.2)',
                          borderRadius: 8, marginBottom: 6
                        }}>
                          <span style={{ fontSize: 13, color: 'var(--success)' }}>✓</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13 }}>
                              <span style={{ color: 'var(--white-3)', fontFamily: 'var(--mono)', fontSize: 11 }}>"{m.originalLine}"</span>
                              <span style={{ color: 'var(--white-3)', margin: '0 8px' }}>→</span>
                              <span style={{ fontWeight: 500 }}>{m.product.name}</span>
                            </div>
                          </div>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--white-3)' }}>
                            {m.qty} × {fmt(m.product.sale_price)}
                          </span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--gold)', fontWeight: 500 }}>
                            {fmt(m.qty * m.product.sale_price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {pasteResult.unmatched.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, fontWeight: 500 }}>
                      ⚠ {pasteResult.unmatched.length} no encontrados — se agregarán sin precio
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      {pasteResult.unmatched.map((u, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '9px 14px', background: 'rgba(224,160,82,0.06)',
                          border: '1px solid rgba(224,160,82,0.2)',
                          borderRadius: 8, marginBottom: 6,
                        }}>
                          <span style={{ fontSize: 13, color: 'var(--warning)' }}>⚠</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: 'var(--white-2)' }}>{u.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--warning)' }}>No está en catálogo — precio en blanco para llenar manual</div>
                          </div>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--white-3)' }}>{u.qty} uds</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {pasteResult.matched.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--white-3)' }}>
                      Total estimado: <span style={{ color: 'var(--gold)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                        {fmt(pasteResult.matched.reduce((a, m) => a + m.qty * m.product.sale_price, 0))}
                      </span>
                    </div>
                    <button className="btn btn-primary" onClick={applyPasteMatches}>
                      Agregar {pasteResult.matched.length} productos a la cotización →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── MANUAL MODE ── */}
        {mode === 'manual' && (
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
        )}

        {/* Items list */}
        {items.length === 0 ? (
          <div className="alert alert-info">
            {mode === 'manual'
              ? 'Busca y agrega productos para armar la cotización.'
              : 'Pega tu lista arriba y agrega los productos encontrados.'
            }
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">Items ({items.length})</div>
              <div style={{ fontSize: 12, color: 'var(--white-3)' }}>Puedes ajustar precio y cantidad por ítem</div>
            </div>

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <input
                        className="form-input"
                        value={item.format || ''}
                        onChange={e => updateItem(item.product_id ?? item.product_name, 'format', e.target.value)}
                        placeholder="formato / presentación"
                        style={{ padding: '2px 7px', fontSize: 11, color: 'var(--text-3)', width: 160, height: 22, borderRadius: 4 }}
                      />
                    </div>
                  </div>
                  <div>
                    <input
                      className="form-input" type="number" min="0.01" step="0.01"
                      value={item.qty}
                      onChange={e => updateItem(item.product_id ?? item.product_name, 'qty', e.target.value)}
                      style={{ padding: '5px 8px', fontSize: 13, textAlign: 'right' }}
                    />
                  </div>
                  <div>
                    <input
                      className="form-input" type="number" min="0" step="0.01"
                      value={item.unit_price}
                      onChange={e => updateItem(item.product_id ?? item.product_name, 'unit_price', e.target.value)}
                      placeholder="$ precio"
                      style={{ padding: '5px 8px', fontSize: 13, textAlign: 'right', borderColor: item.unit_price === '' ? 'var(--warning)' : undefined }}
                    />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {item.unit_price === ''
                      ? <span style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 500 }}>⚠ sin precio</span>
                      : m !== null
                        ? <span className={marginClass(m)} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{pct(m)}</span>
                        : <span style={{ fontSize: 11, color: 'var(--white-3)' }}>—</span>
                    }
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--gold)', fontSize: 13 }}>
                    {fmt(sub)}
                  </div>
                  <div>
                    <button onClick={() => removeItem(item.product_id ?? item.product_name)}
                      style={{ background: 'none', border: 'none', color: 'var(--white-3)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
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
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Descuento Global (%)</label>
                  <input
                    className="form-input" type="number" min="0" max="100" step="0.5"
                    value={discountPct} onChange={e => setDiscountPct(e.target.value)}
                    style={{ width: 120 }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Transportation Fee ($)</label>
                  <input
                    className="form-input" type="number" min="0" step="0.01"
                    value={transFee} onChange={e => setTransFee(e.target.value)}
                    placeholder="0.00"
                    style={{ width: 130 }}
                  />
                </div>
                {totalCost > 0 && (
                  <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-3)', lineHeight: 2 }}>
                    Margen total: <span className={marginClass(totalMgn)} style={{ fontWeight: 600 }}>{pct(totalMgn)}</span><br />
                    Ganancia estimada: <span style={{ color: 'var(--navy)', fontWeight: 600 }}>{fmt(total - totalCost)}</span>
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Subtotal: {fmt(subtotal)}</div>
                {parseFloat(discountPct) > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 4 }}>
                    Descuento ({discountPct}%): -{fmt(discAmt)}
                  </div>
                )}
                {transFeeAmt > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                    Transportation Fee: {fmt(transFeeAmt)}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>Total</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--navy)', fontFamily: 'var(--mono)' }}>{fmt(total)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
