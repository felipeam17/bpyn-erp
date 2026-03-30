// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getProducts, getQuotes } from '../lib/supabase'
import { fmt, pct, calcMargin, marginClass, statusMap } from '../lib/utils'

export default function Dashboard() {
  const [products, setProducts] = useState([])
  const [quotes, setQuotes]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getProducts(), getQuotes()]).then(([p, q]) => {
      setProducts(p.data || [])
      setQuotes(q.data || [])
      setLoading(false)
    })
  }, [])

  if (loading) return <Loader />

  const avgMargin = products.length
    ? products.reduce((a, p) => a + calcMargin(p.avg_cost, p.sale_price), 0) / products.length
    : 0

  const lowStock = products.filter(p => p.stock !== null && p.stock < 10)
  const pending  = quotes.filter(q => q.status === 'pendiente').length
  const topMargin = [...products]
    .sort((a, b) => calcMargin(b.avg_cost, b.sale_price) - calcMargin(a.avg_cost, a.sale_price))
    .slice(0, 6)
  const recentQuotes = quotes.slice(0, 5)

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Dashboard</div>
        <div className="topbar-actions">
          <Link to="/quotes/new" className="btn btn-primary">+ Nueva Cotización</Link>
        </div>
      </div>

      <div className="page">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Productos Activos</div>
            <div className="stat-value">{products.length}</div>
            <div className="stat-sub">en catálogo</div>
          </div>
          <div className="stat-card stat-gold">
            <div className="stat-label">Margen Promedio</div>
            <div className="stat-value">{pct(avgMargin)}</div>
            <div className="stat-sub">sobre precio de venta</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Stock Bajo</div>
            <div className="stat-value" style={{ color: lowStock.length ? 'var(--warning)' : 'var(--success)' }}>
              {lowStock.length}
            </div>
            <div className="stat-sub">{lowStock.length ? 'productos bajo 10 uds' : 'todo en orden'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Cotizaciones Pendientes</div>
            <div className="stat-value">{pending}</div>
            <div className="stat-sub">de {quotes.length} total</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Top Márgenes</div>
              <Link to="/margins" className="btn btn-ghost btn-sm">Ver todos →</Link>
            </div>
            {topMargin.length === 0 && <EmptyInCard text="Sin productos aún" />}
            {topMargin.map(p => {
              const m = calcMargin(p.avg_cost, p.sale_price)
              const hasCost = p.avg_cost > 0
              return (
                <div key={p.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name.length > 30 ? p.name.slice(0, 30) + '…' : p.name}
                    </span>
                    {hasCost
                      ? <span className={marginClass(m)} style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 500, marginLeft: 8 }}>{pct(m)}</span>
                      : <span style={{ fontSize: 11, color: 'var(--white-3)', marginLeft: 8 }}>sin costo</span>
                    }
                  </div>
                  {hasCost && (
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: Math.min(m, 80) + '%',
                        background: m >= 35 ? 'var(--success)' : m >= 20 ? 'var(--warning)' : 'var(--danger)'
                      }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Cotizaciones Recientes</div>
              <Link to="/quotes" className="btn btn-ghost btn-sm">Ver todas →</Link>
            </div>
            {recentQuotes.length === 0 && <EmptyInCard text="Sin cotizaciones aún" />}
            <div className="table-wrap">
              <table>
                <thead><tr><th>ID</th><th>Cliente</th><th>Total</th><th>Estado</th></tr></thead>
                <tbody>
                  {recentQuotes.map(q => {
                    const s = statusMap[q.status] || statusMap.pendiente
                    return (
                      <tr key={q.id}>
                        <td className="td-mono td-muted" style={{ fontSize: 11 }}>{q.quote_number}</td>
                        <td className="td-bold">{q.client}</td>
                        <td className="td-gold">{fmt(q.total)}</td>
                        <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {lowStock.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ color: 'var(--warning)' }}>⚠ Stock Bajo — Atención</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Producto</th><th>Categoría</th><th>Stock</th><th>Proveedor</th></tr></thead>
                <tbody>
                  {lowStock.map(p => (
                    <tr key={p.id}>
                      <td className="td-bold">{p.name}</td>
                      <td><span className="badge badge-muted">{p.categories?.name || '—'}</span></td>
                      <td><span className="badge badge-danger">{p.stock} uds</span></td>
                      <td className="td-muted" style={{ fontSize: 12 }}>{p.suppliers?.name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function Loader() {
  return (
    <>
      <div className="topbar"><div className="topbar-title">Dashboard</div></div>
      <div className="page" style={{ color: 'var(--white-3)', fontSize: 13 }}>Cargando...</div>
    </>
  )
}

function EmptyInCard({ text }) {
  return <p style={{ fontSize: 12, color: 'var(--white-3)', padding: '8px 0' }}>{text}</p>
}
