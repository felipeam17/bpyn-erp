// src/pages/Login.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) {
      setError('Credenciales inválidas. Verifica tu email y contraseña.')
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--navy)', letterSpacing: 5, marginBottom: 6 }}>BYN</div>
          <div style={{ fontSize: 11, color: 'var(--white-3)', letterSpacing: 2, textTransform: 'uppercase' }}>Marine Supply ERP</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{error}</div>}

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p style={{ fontSize: 11, color: 'var(--white-3)', textAlign: 'center', marginTop: 20 }}>
          Acceso restringido a personal BYN
        </p>
      </div>
    </div>
  )
}
