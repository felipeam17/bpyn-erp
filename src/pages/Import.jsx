// src/pages/Import.jsx
import { useState, useEffect } from 'react'
import { getCategories, getSuppliers, createProduct, createCategory } from '../lib/supabase'

const EXPECTED_COLS = ['nombre', 'precio_venta', 'categoria', 'sku', 'proveedor', 'costo', 'stock', 'unidad']

export default function Import() {
  const [categories, setCategories] = useState([])
  const [suppliers,  setSuppliers]  = useState([])
  const [step,       setStep]       = useState(1) // 1: paste | 2: map | 3: preview | 4: done
  const [rawText,    setRawText]    = useState('')
  const [headers,    setHeaders]    = useState([])
  const [rows,       setRows]       = useState([])
  const [mapping,    setMapping]    = useState({})
  const [preview,    setPreview]    = useState([])
  const [importing,  setImporting]  = useState(false)
  const [results,    setResults]    = useState(null)
  const [dragOver,   setDragOver]   = useState(false)

  useEffect(() => {
    Promise.all([getCategories(), getSuppliers()]).then(([c, s]) => {
      setCategories(c.data || [])
      setSuppliers(s.data || [])
    })
  }, [])

  // ── Step 1: Parse pasted text ────────────────────────────────────
  const parsePaste = (text) => {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) { alert('Necesitas al menos encabezados + 1 fila de datos'); return }

    const separator = lines[0].includes('\t') ? '\t' : ','
    const hdrs = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, ''))
    const dataRows = lines.slice(1).map(line =>
      line.split(separator).map(cell => cell.trim().replace(/^"|"$/g, ''))
    )

    setHeaders(hdrs)
    setRows(dataRows)

    // Auto-map columns
    const autoMap = {}
    hdrs.forEach((h, i) => {
      const hl = h.toLowerCase()
      if (hl.includes('nombre') || hl.includes('name') || hl.includes('descripci')) autoMap.nombre = i
      if (hl.includes('precio') && (hl.includes('venta') || hl.includes('sale') || hl.includes('price'))) autoMap.precio_venta = i
      if (hl.includes('costo') || hl.includes('cost')) autoMap.costo = i
      if (hl.includes('categ')) autoMap.categoria = i
      if (hl.includes('sku') || hl.includes('codigo') || hl.includes('código') || hl.includes('ref')) autoMap.sku = i
      if (hl.includes('prov')) autoMap.proveedor = i
      if (hl.includes('stock') || hl.includes('inventario') || hl.includes('cantidad')) autoMap.stock = i
      if (hl.includes('unidad') || hl.includes('unit')) autoMap.unidad = i
    })
    setMapping(autoMap)
    setStep(2)
  }

  const parsePrice = (val) => {
    if (!val) return 0
    let s = val.toString().replace(/[$€£¥\s]/g, '')
    if (s.includes('.') && s.includes(',')) { s = s.replace(/,/g, '') }
    else if (s.includes(',') && !s.includes('.')) {
      const parts = s.split(',')
      s = parts[parts.length-1].length <= 2 ? s.replace(',', '.') : s.replace(/,/g, '')
    }
    return parseFloat(s) || 0
  }

  // ── Step 2 → 3: Build preview ────────────────────────────────────
  const buildPreview = () => {
    if (mapping.nombre === undefined) { alert('Debes mapear al menos la columna "Nombre del Producto"'); return }
    if (mapping.precio_venta === undefined) { alert('Debes mapear la columna "Precio de Venta"'); return }

    const prev = rows.map(row => ({
      name:        row[mapping.nombre]       || '',
      sale_price:  parsePrice(row[mapping.precio_venta]),
      avg_cost:    mapping.costo    !== undefined ? parsePrice(row[mapping.costo]) : 0,
      category:    mapping.categoria !== undefined ? row[mapping.categoria]  || '' : '',
      sku:         mapping.sku       !== undefined ? row[mapping.sku]        || '' : '',
      supplier:    mapping.proveedor !== undefined ? row[mapping.proveedor]  || '' : '',
      stock:       mapping.stock     !== undefined ? parseInt(row[mapping.stock]) || 0 : 0,
      unit:        mapping.unidad    !== undefined ? row[mapping.unidad]     || 'unidad' : 'unidad',
    })).filter(r => r.name && r.sale_price > 0)

    setPreview(prev)
    setStep(3)
  }

  // ── Step 3 → 4: Import ───────────────────────────────────────────
  const runImport = async () => {
    setImporting(true)
    let created = 0, skipped = 0

    // Ensure all categories exist
    const catMap = {}
    for (const cat of categories) catMap[cat.name] = cat.id

    for (const row of preview) {
      let categoryId = null
      if (row.category) {
        if (!catMap[row.category]) {
          const { data } = await createCategory(row.category)
          if (data) { catMap[row.category] = data.id; setCategories(prev => [...prev, data]) }
        }
        categoryId = catMap[row.category] || null
      }

      const supplierId = row.supplier
        ? suppliers.find(s => s.name.toLowerCase().includes(row.supplier.toLowerCase()))?.id || null
        : null

      const { error } = await createProduct({
        name:        row.name,
        sale_price:  row.sale_price,
        avg_cost:    row.avg_cost || 0,
        category_id: categoryId,
        supplier_id: supplierId,
        sku:         row.sku || null,
        stock:       row.stock || 0,
        unit:        row.unit || 'unidad',
      })

      if (error) skipped++ ; else created++
    }

    setResults({ created, skipped })
    setImporting(false)
    setStep(4)
  }

  const reset = () => {
    setStep(1); setRawText(''); setHeaders([]); setRows([])
    setMapping({}); setPreview([]); setResults(null)
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Importar Productos</div>
      </div>

      <div className="page" style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Steps indicator */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 28, alignItems: 'center' }}>
          {['Pegar datos', 'Mapear columnas', 'Revisar', 'Listo'].map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: step > i + 1 ? 'var(--success)' : step === i + 1 ? 'var(--gold)' : 'var(--navy-3)',
                border: `1px solid ${step === i + 1 ? 'var(--gold)' : 'var(--border-l)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600,
                color: step >= i + 1 ? 'var(--navy)' : 'var(--white-3)',
              }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 12, color: step === i + 1 ? 'var(--white)' : 'var(--white-3)', marginLeft: 8, flex: 1 }}>{label}</div>
              {i < 3 && <div style={{ height: 1, flex: 1, background: 'var(--border-l)', margin: '0 8px' }} />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Paste ── */}
        {step === 1 && (
          <div className="card">
            <div className="card-header"><div className="card-title">Pega tu tabla de Google Sheets o CSV</div></div>
            <div className="alert alert-info">
              Abre tu Google Sheets → selecciona toda la tabla con encabezados → Ctrl+C → pega aquí abajo.<br />
              La primera fila debe ser los nombres de las columnas.
            </div>
            <div className="form-group">
              <label className="form-label">Datos de la tabla</label>
              <textarea
                className="form-textarea" style={{ minHeight: 200, fontFamily: 'var(--mono)', fontSize: 12 }}
                placeholder={'Nombre\tPrecio Venta\tCategoría\nAceite de Oliva 5L\t45.00\tAlimentos\n...'}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => parsePaste(rawText)} disabled={!rawText.trim()}>
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Map columns ── */}
        {step === 2 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Mapear columnas</div>
              <span style={{ fontSize: 12, color: 'var(--white-3)' }}>{rows.length} filas detectadas</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--white-2)', marginBottom: 16 }}>
              Indica qué columna de tu tabla corresponde a cada campo del sistema.
              Los campos con * son requeridos.
            </p>

            <div className="form-grid-2">
              {[
                ['nombre',      'Nombre del Producto *',  true],
                ['precio_venta','Precio de Venta *',      true],
                ['costo',       'Costo (opcional)',        false],
                ['categoria',   'Categoría (opcional)',    false],
                ['sku',         'SKU / Código (opcional)', false],
                ['proveedor',   'Proveedor (opcional)',    false],
                ['stock',       'Stock (opcional)',        false],
                ['unidad',      'Unidad (opcional)',       false],
              ].map(([key, label]) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{label}</label>
                  <select className="form-select"
                    value={mapping[key] !== undefined ? mapping[key] : ''}
                    onChange={e => setMapping(m => ({ ...m, [key]: e.target.value === '' ? undefined : parseInt(e.target.value) }))}>
                    <option value="">— No mapear —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview of first row */}
            {rows[0] && (
              <div style={{ background: 'var(--navy-3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--white-2)' }}>
                <strong style={{ color: 'var(--white-3)', fontSize: 10, letterSpacing: 1 }}>PREVIEW PRIMERA FILA: </strong>
                {mapping.nombre !== undefined && <span>📦 {rows[0][mapping.nombre]} </span>}
                {mapping.precio_venta !== undefined && <span>· 💵 {rows[0][mapping.precio_venta]} </span>}
                {mapping.categoria !== undefined && <span>· 🏷 {rows[0][mapping.categoria]} </span>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Atrás</button>
              <button className="btn btn-primary" onClick={buildPreview}>Ver preview →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Preview ── */}
        {step === 3 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Revisar antes de importar</div>
              <span style={{ fontSize: 12, color: 'var(--white-3)' }}>{preview.length} productos a importar</span>
            </div>

            <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table>
                <thead><tr><th>Nombre</th><th>P. Venta</th><th>Costo</th><th>Categoría</th><th>SKU</th><th>Stock</th></tr></thead>
                <tbody>
                  {preview.map((p, i) => (
                    <tr key={i}>
                      <td className="td-bold" style={{ maxWidth: 220 }}>{p.name}</td>
                      <td className="td-gold" style={{ fontFamily: 'var(--mono)' }}>${p.sale_price.toFixed(2)}</td>
                      <td style={{ fontFamily: 'var(--mono)', color: p.avg_cost > 0 ? 'var(--white-2)' : 'var(--white-3)' }}>
                        {p.avg_cost > 0 ? `$${p.avg_cost.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--white-2)' }}>{p.category || '—'}</td>
                      <td className="td-muted" style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{p.sku || '—'}</td>
                      <td>{p.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="alert alert-info" style={{ marginTop: 14 }}>
              Si una categoría no existe en el sistema, se creará automáticamente.
              Los proveedores se buscan por nombre aproximado.
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>← Atrás</button>
              <button className="btn btn-primary" onClick={runImport} disabled={importing}>
                {importing ? 'Importando...' : `Importar ${preview.length} productos`}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Done ── */}
        {step === 4 && results && (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--success)', marginBottom: 8 }}>
              Importación completada
            </div>
            <div style={{ fontSize: 14, color: 'var(--white-2)', marginBottom: 24 }}>
              {results.created} producto{results.created !== 1 ? 's' : ''} importado{results.created !== 1 ? 's' : ''} correctamente
              {results.skipped > 0 && ` · ${results.skipped} con errores`}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={reset}>Importar más</button>
              <a href="/catalog" className="btn btn-primary">Ver Catálogo →</a>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
