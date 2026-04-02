// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Auth helpers ──────────────────────────────────────────────────
export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signOut = () => supabase.auth.signOut()

export const getUser = () => supabase.auth.getUser()

// ── Products ──────────────────────────────────────────────────────
export const getProducts = async (includeInactive = false) => {
  let q = supabase
    .from('products')
    .select(`*, categories(name), suppliers(name)`)
    .order('name')
  if (!includeInactive) q = q.eq('active', true)
  return q
}

export const createProduct = (data) =>
  supabase.from('products').insert(data).select().single()

export const updateProduct = (id, data) =>
  supabase.from('products').update(data).eq('id', id).select().single()

export const archiveProduct = (id) =>
  supabase.from('products').update({ active: false }).eq('id', id)

// ── Price history ─────────────────────────────────────────────────
export const logPriceChange = (productId, field, oldVal, newVal, userEmail) =>
  supabase.from('price_history').insert({
    product_id: productId,
    field,
    old_value: oldVal,
    new_value: newVal,
    changed_by: userEmail,
  })

export const getPriceHistory = (productId) =>
  supabase
    .from('price_history')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(20)

// ── Categories ────────────────────────────────────────────────────
export const getCategories = () =>
  supabase.from('categories').select('*').order('name')

export const createCategory = (name) =>
  supabase.from('categories').insert({ name }).select().single()

// ── Suppliers ─────────────────────────────────────────────────────
export const getSuppliers = () =>
  supabase.from('suppliers').select('*').eq('active', true).order('name')

export const createSupplier = (data) =>
  supabase.from('suppliers').insert(data).select().single()

export const updateSupplier = (id, data) =>
  supabase.from('suppliers').update(data).eq('id', id).select().single()

// ── Quotes ────────────────────────────────────────────────────────
export const getQuotes = () =>
  supabase
    .from('quotes')
    .select('*, quote_items(*)')
    .order('created_at', { ascending: false })

export const getQuoteById = (id) =>
  supabase
    .from('quotes')
    .select('*, quote_items(*)')
    .eq('id', id)
    .single()

export const createQuote = async (quoteData, items) => {
  // Get next quote number
  const { data: numData } = await supabase.rpc('next_quote_number')
  const quoteNumber = numData

  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({ ...quoteData, quote_number: quoteNumber })
    .select()
    .single()

  if (error) return { error }

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from('quote_items')
      .insert(items.map(i => ({ ...i, quote_id: quote.id })))
    if (itemsError) return { error: itemsError }
  }

  return { data: quote }
}

export const updateQuoteStatus = (id, status, quoteNumber) => {
  const updates = { status }
  if (status === 'aceptada' && quoteNumber) {
    updates.invoice_number = quoteNumber.replace('COT-', 'INV-')
    updates.invoiced_at = new Date().toISOString()
  }
  return supabase.from('quotes').update(updates).eq('id', id)
}
