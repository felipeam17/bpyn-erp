// src/lib/utils.js

export const fmt = (n) =>
  '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const pct = (n, decimals = 1) =>
  parseFloat(n || 0).toFixed(decimals) + '%'

export const calcMargin = (cost, price) => {
  if (!price || price === 0) return 0
  return ((price - cost) / price) * 100
}

export const marginClass = (m) => {
  if (m >= 35) return 'm-good'
  if (m >= 20) return 'm-warn'
  return 'm-bad'
}

export const statusMap = {
  pendiente: { label: 'Pendiente', cls: 'badge-warning' },
  aceptada:  { label: 'Aceptada',  cls: 'badge-success' },
  rechazada: { label: 'Rechazada', cls: 'badge-danger'  },
  borrador:  { label: 'Borrador',  cls: 'badge-muted'   },
}

export const catColorMap = {
  'Alimentos':           'badge-success',
  'Bebidas':             'badge-info',
  'Limpieza':            'badge-warning',
  'Utensilios de Cocina':'badge-gold',
  'Equipos':             'badge-danger',
  'Higiene Personal':    'badge-info',
  'Mantenimiento':       'badge-muted',
  'Otros':               'badge-muted',
}

export const today = () => new Date().toISOString().split('T')[0]

export const formatDate = (d) => {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' })
}
