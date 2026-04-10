// src/App.jsx
import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Catalog from './pages/Catalog'
import Quotes from './pages/Quotes'
import NewQuote from './pages/NewQuote'
import Margins from './pages/Margins'
import Suppliers from './pages/Suppliers'
import Tasks from './pages/Tasks'
import Import from './pages/Import'

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={styles.loading}>Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="catalog" element={<Catalog />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="quotes/new" element={<NewQuote />} />
            <Route path="margins" element={<Margins />} />
            <Route path="import" element={<Import />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

const styles = {
  loading: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: '#0a1628', color: '#c9a84c',
    fontFamily: 'DM Sans, sans-serif', fontSize: 14,
  }
}
