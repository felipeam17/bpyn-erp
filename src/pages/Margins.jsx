// src/pages/Margins.jsx
import { useState, useEffect } from 'react'
import { getProducts } from '../lib/supabase'
import { fmt, pct, calcMargin, marginClass, catColorMap } from '../lib/utils'

export default function Margins() {
  const [products, setProducts] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [sortBy,   setSortBy]   = useState('margin_desc')
  const [catFilter, setCatFilter] = useState('')

  useEffect(() => {
    getProducts().then(({ data }) => { setProducts(data || []); setLoading(false) })
  }, [])

  const withCost = products.filter(p => p.avg_cost > 0)
  const withoutCost = products.filter(p => !p.avg_cost || p.avg_cost === 0)

  const categories = [...new Set(withCost.map(p => p.categories?.name).filter(Boolean))]

  const filtered = withCost.filter(p => !catFilter || p.categories?.name === catFilter)

  const sorted = [...filtered].sort((a, b) => {
    const ma = calcMargin(a.avg_cost, a.sale_price)
    const mb = calcMargin(b.avg_cost, b.sale_price)
    switch (sortBy) {
      case 'margin_desc': return mb - ma
      case 'margin_asc':  return ma - mb
      case 'price_desc':  return b.sale_price - a.sale_price
      case 'name':        return a.name.localeCompare(b.name)
      default: return 0
    }
  })

  const avgMargin = filtered.length
    ? filtered.reduce((a, p) => a + calcMargin(p.avg_cost, p.sale_price), 0) / filtered.length
    : 0

  const best  = sorted[0]
  const worst = sorted[sorted.length - 1]

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Análisis de Márgenes</div>
      </div>

      <div className="page">
        {withoutCost.length > 0 && (
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            {withoutCost.length} producto{withoutCost.length > 1 ? 's' : ''} sin costo cargado — no aparecen en el análisis.
            Puedes agregar sus costos desde el <a href="/catalog" style={{ color: 'var(--info)', textDecoration: 'underline' }}>Catálogo</a>.
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card stat-gold">
            <div className="stat-label">Margen Promedio</div>
            <div className="stat-value">{pct(avgMargin)}</div>
            <div className="stat-sub">{filtered.length} productos con costo</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Mejor Margen</div>
            <div className="stat-value" style={{ color: 'var(--success)', fontSize: 24 }}>
              {best ? pct(calcMargin(best.avg_cost, best.sale_price)) : '—'}
            </div>
            <div className="stat-sub">{best?.name?.substring(0, 28) || '—'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Menor Margen</div>
            <div className="stat-value" style={{ color: 'var(--warning)', fontSize: 24 }}>
              {worst ? pct(calcMargin(worst.avg_cost, worst.sale_price)) : '—'}
            </div>
            <div className="stat-sub">{worst?.name?.substring(0, 28) || '—'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Sin Costo Cargado</div>
            <div className="stat-value" style={{ color: withoutCost.length > 0 ? 'var(--warning)' : 'var(--success)' }}>
              {withoutCost.length}
            </div>
            <div className="stat-sub">de {products.length} total</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <select className="form-select" style={{ width: 180 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="form-select" style={{ width: 180 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="margin_desc">Mayor margen primero</option>
            <option value="margin_asc">Menor margen primero</option>
            <option value="price_desc">Mayor precio primero</option>
            <option value="name">Nombre A–Z</option>
          </select>
          <span style={{ fontSize: 12, color: 'var(--white-3)' }}>{sorted.length} productos</span>
        </div>

        <div className="card">
          {loading ? (
            <p style={{ color: 'var(--white-3)', fontSize: 13 }}>Cargando...</p>
          ) : sorted.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">◎</div>
              <div className="empty-title">Sin datos de margen</div>
              <p>Agrega costos promedio a tus productos en el Catálogo para ver el análisis.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>#</th><th>Producto</th><th>Categoría</th><th>Costo</th><th>P. Venta</th><th>Ganancia/U</th><th>Margen %</th><th style={{ minWidth: 120 }}>Indicador</th></tr>
                </thead>
                <tbody>
                  {sorted.map((p, i) => {
                    const m = calcMargin(p.avg_cost, p.sale_price)
                    const fillPct = Math.min(Math.max(m, 0), 80)
                    const barColor = m >= 35 ? 'var(--success)' : m >= 20 ? 'var(--warning)' : 'var(--danger)'
                    return (
                      <tr key={p.id}>
                        <td className="td-muted" style={{ fontSize: 11 }}>{i + 1}</td>
                        <td className="td-bold">{p.name}</td>
                        <td><span className={`badge ${catColorMap[p.categories?.name] || 'badge-muted'}`}>{p.categories?.name || '—'}</span></td>
                        <td className="td-mono" style={{ color: 'var(--white-2)' }}>{fmt(p.avg_cost)}</td>
                        <td className="td-gold">{fmt(p.sale_price)}</td>
                        <td className="td-mono" style={{ color: 'var(--success)' }}>{fmt(p.sale_price - p.avg_cost)}</td>
                        <td>
                          <span className={marginClass(m)} style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600 }}>
                            {pct(m)}
                          </span>
                        </td>
                        <td>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: fillPct + '%', background: barColor }} />
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
    </>
  )
}
