import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, TrendingUp, Users, Crown, Percent,
  ChevronDown, Filter, Search, CalendarDays, CheckCircle2, Clock,
  Plus, X, Trash2, Pencil, Receipt, Wallet, Minus, ExternalLink, ArrowRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

// ─── helpers ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500',
]

function getAvatarColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function InitialAvatar({ name = '', size = 'sm' }) {
  const initial = name.charAt(0).toUpperCase() || '?'
  const color = getAvatarColor(name)
  const cls = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base'
  return (
    <div className={`${cls} ${color} rounded-full flex items-center justify-center shrink-0`}>
      <span className="text-white font-bold">{initial}</span>
    </div>
  )
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0)
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const ADMIN_RATE = 0.60
const STAFF_RATE = 0.40

const CAT_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-amber-100 text-amber-700',
  'bg-slate-100 text-slate-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
]

function getCatColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return CAT_COLORS[Math.abs(hash) % CAT_COLORS.length]
}

// ─── Dividend bar ────────────────────────────────────────────────────────────

function DividendBar({ adminAmt, staffAmt }) {
  const total = adminAmt + staffAmt
  if (total === 0) return null
  const adminPct = (adminAmt / total) * 100
  return (
    <div className="w-full h-3 rounded-full overflow-hidden bg-gray-100 flex">
      <div
        className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
        style={{ width: `${adminPct}%` }}
      />
      <div className="h-full flex-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
    </div>
  )
}

// ─── Category Picker ─────────────────────────────────────────────────────────

function CategoryPicker({ value, onChange }) {
  const [open,      setOpen]    = useState(false)
  const [cats,      setCats]    = useState([])
  const [loading,   setLoading] = useState(true)
  const [newName,   setNewName] = useState('')
  const [adding,    setAdding]  = useState(false)
  const [editId,    setEditId]  = useState(null)
  const [editVal,   setEditVal] = useState('')
  const ref = useRef(null)

  useEffect(() => { loadCats() }, [])

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setEditId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function loadCats() {
    const { data } = await supabase.from('expense_categories').select('*').order('name')
    setCats(data || [])
    setLoading(false)
  }

  async function addCat() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    const { data, error } = await supabase.from('expense_categories').insert({ name }).select().single()
    if (!error && data) {
      setCats(c => [...c, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
    } else {
      toast.error(error?.message || 'Failed to add category')
    }
    setAdding(false)
  }

  async function saveCat(id) {
    const name = editVal.trim()
    if (!name) return
    const old = cats.find(c => c.id === id)
    const { data, error } = await supabase.from('expense_categories').update({ name }).eq('id', id).select().single()
    if (!error && data) {
      setCats(c => c.map(x => x.id === id ? data : x).sort((a, b) => a.name.localeCompare(b.name)))
      if (old && value === old.name) onChange(data.name)
    } else {
      toast.error(error?.message || 'Failed to update')
    }
    setEditId(null)
  }

  async function deleteCat(id) {
    const cat = cats.find(c => c.id === id)
    const { error } = await supabase.from('expense_categories').delete().eq('id', id)
    if (!error) {
      setCats(c => c.filter(x => x.id !== id))
      if (cat && value === cat.name) onChange('')
    } else {
      toast.error(error?.message || 'Failed to delete')
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-left focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 flex items-center justify-between transition-all"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>{value || 'Select category'}</span>
        <ChevronDown size={13} className="text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-4 text-center text-xs text-gray-400">Loading…</p>
            ) : cats.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-gray-400">No categories yet — add one below</p>
            ) : cats.map(cat => (
              <div key={cat.id} className={`flex items-center gap-1 px-2 py-1.5 group ${value === cat.name ? 'bg-rose-50' : 'hover:bg-gray-50'}`}>
                {editId === cat.id ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      autoFocus
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveCat(cat.id); if (e.key === 'Escape') setEditId(null) }}
                      className="flex-1 px-2 py-0.5 text-sm border border-rose-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-300"
                    />
                    <button onClick={() => saveCat(cat.id)} className="text-[11px] font-bold text-rose-500 px-1.5 py-0.5 hover:bg-rose-50 rounded">Save</button>
                    <button onClick={() => setEditId(null)} className="text-[11px] text-gray-400 hover:text-gray-600 px-1">✕</button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => { onChange(cat.name); setOpen(false) }}
                      className="flex-1 text-left text-sm text-gray-800 py-0.5 truncate"
                    >
                      {cat.name}
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setEditId(cat.id); setEditVal(cat.name) }}
                        className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteCat(cat.id) }}
                        className="p-1 hover:bg-rose-100 rounded text-gray-400 hover:text-rose-600"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new */}
          <div className="border-t border-gray-100 px-2 py-2 flex items-center gap-1.5">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCat() }}
              placeholder="New category…"
              className="flex-1 px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-rose-400 placeholder-gray-400"
            />
            <button
              onClick={addCat}
              disabled={adding || !newName.trim()}
              className="p-1.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:opacity-40 transition-colors"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Expense Modal ────────────────────────────────────────────────────────────

function ExpenseModal({ expense, onClose, onSave, onDelete }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    description:  expense?.description  || '',
    amount:       expense?.amount       || '',
    category:     expense?.category     || 'Other',
    expense_date: expense?.expense_date || today,
    notes:        expense?.notes        || '',
  })
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    if (!form.description.trim()) return toast.error('Description is required')
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than 0')
    if (!form.expense_date) return toast.error('Date is required')
    setSaving(true)
    try { await onSave({ ...form, amount: Number(form.amount) }) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this expense?')) return
    setDeleting(true)
    try { await onDelete(expense.id) }
    finally { setDeleting(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-rose-100 rounded-lg flex items-center justify-center">
              <Receipt size={14} className="text-rose-600" />
            </div>
            <h2 className="text-sm font-black text-gray-900">{expense ? 'Edit Expense' : 'Add Expense'}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Date</label>
              <input
                type="date"
                value={form.expense_date}
                onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
              <CategoryPicker
                value={form.category}
                onChange={cat => setForm(f => ({ ...f, category: cat }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
            <input
              type="text"
              placeholder="What was this expense for?"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Amount (USDT)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Notes <span className="normal-case font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              placeholder="Any additional details…"
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 resize-none transition-all"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-2">
          {expense && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors disabled:opacity-50"
            >
              <Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-500 rounded-xl hover:bg-rose-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : expense ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Record Confirm Modal ─────────────────────────────────────────────────────

function RecordConfirmModal({ record, onClose, onConfirm }) {
  const earning   = Number(record.total_earning) || 0
  const adminDiv  = earning * ADMIN_RATE
  const staffDiv  = earning * STAFF_RATE

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
              <ExternalLink size={14} className="text-violet-600" />
            </div>
            <h3 className="text-sm font-black text-gray-900">View Original Transaction</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
            <X size={14} className="text-gray-400" />
          </button>
        </div>

        {/* Record summary */}
        <div className="px-6 py-5">
          <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Client</span>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">{record.clients?.full_name || '—'}</p>
                {record.clients?.user_id && (
                  <p className="text-[11px] text-gray-400 font-mono">{record.clients.user_id}</p>
                )}
              </div>
            </div>
            <div className="h-px bg-gray-200" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Employee</span>
              <div className="flex items-center gap-2">
                <InitialAvatar name={record.employees?.name || '?'} size="sm" />
                <span className="text-sm font-bold text-gray-900">{record.employees?.name || '—'}</span>
              </div>
            </div>
            <div className="h-px bg-gray-200" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Total Earning</span>
              <span className="text-sm font-bold text-gray-900">${fmt(earning)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-violet-500 font-medium">Admin 60%</span>
              <span className="text-sm font-black text-violet-700">${fmt(adminDiv)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-500 font-medium">Staff 40%</span>
              <span className="text-sm font-black text-emerald-700">${fmt(staffDiv)}</span>
            </div>
            {record.payment_date && (
              <>
                <div className="h-px bg-gray-200" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-medium">Payment Date</span>
                  <span className="text-xs text-gray-600">{fmtDate(record.payment_date)}</span>
                </div>
              </>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center mb-5">
            You'll be taken to this client's page to view the full transaction history.
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition-colors flex items-center justify-center gap-1.5"
            >
              View Transaction <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminDividend() {
  const navigate = useNavigate()

  const [records,        setRecords]        = useState([])
  const [employees,      setEmployees]      = useState([])
  const [expenses,       setExpenses]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [statusFilter,   setStatusFilter]   = useState('all')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [search,         setSearch]         = useState('')
  const [monthFilter,    setMonthFilter]    = useState('all')
  const [showExpModal,   setShowExpModal]   = useState(false)
  const [editingExp,     setEditingExp]     = useState(null)
  const [confirmRecord,  setConfirmRecord]  = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [recRes, empRes, expRes] = await Promise.all([
        supabase
          .from('commission_records')
          .select('*, employees(name, commission_rate), clients(full_name, user_id)')
          .order('created_at', { ascending: false }),
        supabase.from('employees').select('*').order('name'),
        supabase.from('admin_expenses').select('*').order('expense_date', { ascending: false }),
      ])
      if (recRes.error) throw recRes.error
      if (empRes.error) throw empRes.error
      if (expRes.error) throw expRes.error
      setRecords(recRes.data || [])
      setEmployees(empRes.data || [])
      setExpenses(expRes.data || [])
    } catch (err) {
      toast.error('Failed to load data: ' + (err.message || ''))
    } finally {
      setLoading(false)
    }
  }

  async function saveExpense(form) {
    try {
      if (editingExp) {
        const { error } = await supabase.from('admin_expenses').update(form).eq('id', editingExp.id)
        if (error) throw error
        toast.success('Expense updated')
      } else {
        const { error } = await supabase.from('admin_expenses').insert(form)
        if (error) throw error
        toast.success('Expense added')
      }
      setShowExpModal(false)
      setEditingExp(null)
      fetchAll()
    } catch (err) {
      toast.error(err.message || 'Failed to save expense')
      throw err
    }
  }

  async function deleteExpense(id) {
    try {
      const { error } = await supabase.from('admin_expenses').delete().eq('id', id)
      if (error) throw error
      toast.success('Expense deleted')
      setShowExpModal(false)
      setEditingExp(null)
      fetchAll()
    } catch (err) {
      toast.error(err.message || 'Failed to delete expense')
      throw err
    }
  }

  // ── Available months (from both records and expenses) ──
  const availableMonths = useMemo(() => {
    const years = new Set()
    for (const r of records) {
      const d = r.payment_date || r.created_at
      if (d) years.add(new Date(d).getFullYear())
    }
    for (const e of expenses) {
      if (e.expense_date) years.add(new Date(e.expense_date).getFullYear())
    }
    const months = []
    for (const year of Array.from(years).sort().reverse()) {
      for (let m = 12; m >= 1; m--) {
        months.push(`${year}-${String(m).padStart(2, '0')}`)
      }
    }
    return months
  }, [records, expenses])

  function toYM(dateStr) {
    if (!dateStr) return null
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  // ── Base records filtered by month ──
  const baseRecords = useMemo(() => {
    if (monthFilter === 'all') return records
    return records.filter(r => toYM(r.payment_date || r.created_at) === monthFilter)
  }, [records, monthFilter])

  // ── Base expenses filtered by month ──
  const baseExpenses = useMemo(() => {
    if (monthFilter === 'all') return expenses
    return expenses.filter(e => toYM(e.expense_date) === monthFilter)
  }, [expenses, monthFilter])

  // ── Totals ──
  const totalPool     = baseRecords.reduce((s, r) => s + (Number(r.total_earning) || 0), 0)
  const adminTotal    = totalPool * ADMIN_RATE
  const staffTotal    = totalPool * STAFF_RATE
  const totalExpenses = baseExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const netAdmin      = adminTotal - totalExpenses

  // ── Per-employee breakdown ──
  const perEmployee = useMemo(() => {
    const map = {}
    for (const r of baseRecords) {
      const empId = r.employee_id
      const name  = r.employees?.name || 'Unknown'
      if (!map[empId]) map[empId] = { id: empId, name, earning: 0, adminDiv: 0, staffDiv: 0, count: 0 }
      const earning = Number(r.total_earning) || 0
      map[empId].earning   += earning
      map[empId].adminDiv  += earning * ADMIN_RATE
      map[empId].staffDiv  += earning * STAFF_RATE
      map[empId].count     += 1
    }
    return Object.values(map).sort((a, b) => b.earning - a.earning)
  }, [baseRecords])

  // ── Expenses by category ──
  const expByCategory = useMemo(() => {
    const map = {}
    for (const e of baseExpenses) {
      const cat = e.category || 'Other'
      map[cat] = (map[cat] || 0) + (Number(e.amount) || 0)
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [baseExpenses])

  // ── Filtered dividend records ──
  const filteredRecords = useMemo(() => {
    let list = baseRecords
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter)
    if (employeeFilter !== 'all') list = list.filter(r => r.employee_id === employeeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.employees?.name?.toLowerCase().includes(q) ||
        r.clients?.full_name?.toLowerCase().includes(q) ||
        r.clients?.user_id?.toLowerCase().includes(q)
      )
    }
    return list
  }, [baseRecords, statusFilter, employeeFilter, search])

  return (
    <>
      {(showExpModal || editingExp) && (
        <ExpenseModal
          expense={editingExp}
          onClose={() => { setShowExpModal(false); setEditingExp(null) }}
          onSave={saveExpense}
          onDelete={deleteExpense}
        />
      )}

      {confirmRecord && (
        <RecordConfirmModal
          record={confirmRecord}
          onClose={() => setConfirmRecord(null)}
          onConfirm={() => {
            setConfirmRecord(null)
            navigate(`/clients/${confirmRecord.client_id}`)
          }}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                <Crown size={16} className="text-violet-600" />
              </div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Admin Dividend</h1>
            </div>
            <p className="text-sm text-gray-400 ml-10">Owner's view — 60% admin · 40% staff split on all earnings</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Month filter */}
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-violet-400 pointer-events-none">
                <CalendarDays size={14} />
              </div>
              <select
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
                className="pl-8 pr-7 py-2 bg-white border border-violet-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 appearance-none cursor-pointer shadow-sm transition-all"
              >
                <option value="all">All Time</option>
                {availableMonths.map(ym => {
                  const [year, month] = ym.split('-')
                  const label = new Date(Number(year), Number(month) - 1, 1)
                    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  return <option key={ym} value={ym}>{label}</option>
                })}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <ChevronDown size={12} />
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-100 rounded-xl">
              <ShieldCheck size={16} className="text-violet-500" />
              <span className="text-sm font-bold text-violet-700">Admin Only</span>
            </div>
          </div>
        </div>

        {/* KPI Row 1: Earnings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* Total Pool */}
          <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900 shadow-sm">
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute -right-1 -top-8 w-16 h-16 rounded-full bg-white/10" />
            <div className="relative flex items-start justify-between mb-5">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                <TrendingUp size={20} className="text-white" />
              </div>
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Total Earnings</span>
            </div>
            <p className="relative text-[11px] font-semibold text-white/60 uppercase tracking-widest mb-1">Total Pool</p>
            <p className="relative text-2xl font-black text-white">{loading ? '—' : `$${fmt(totalPool)}`}</p>
            {!loading && <DividendBar adminAmt={adminTotal} staffAmt={staffTotal} />}
            {!loading && totalPool > 0 && (
              <div className="relative flex justify-between mt-1.5">
                <span className="text-[10px] text-violet-300 font-bold">Admin 60%</span>
                <span className="text-[10px] text-emerald-300 font-bold">Staff 40%</span>
              </div>
            )}
          </div>

          {/* Admin Dividend */}
          <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-violet-500 to-purple-700 shadow-sm">
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute -right-1 -top-8 w-16 h-16 rounded-full bg-white/10" />
            <div className="relative flex items-start justify-between mb-5">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                <Crown size={20} className="text-white" />
              </div>
              <span className="text-[10px] font-bold text-white/50 bg-white/10 px-2 py-0.5 rounded-full uppercase tracking-widest">60%</span>
            </div>
            <p className="relative text-[11px] font-semibold text-white/70 uppercase tracking-widest mb-1">Admin Dividend</p>
            <p className="relative text-2xl font-black text-white">{loading ? '—' : `$${fmt(adminTotal)}`}</p>
          </div>

          {/* Staff Dividend */}
          <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute -right-1 -top-8 w-16 h-16 rounded-full bg-white/10" />
            <div className="relative flex items-start justify-between mb-5">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                <Users size={20} className="text-white" />
              </div>
              <span className="text-[10px] font-bold text-white/50 bg-white/10 px-2 py-0.5 rounded-full uppercase tracking-widest">40%</span>
            </div>
            <p className="relative text-[11px] font-semibold text-white/70 uppercase tracking-widest mb-1">Staff Dividend</p>
            <p className="relative text-2xl font-black text-white">{loading ? '—' : `$${fmt(staffTotal)}`}</p>
          </div>
        </div>

        {/* Net Summary Strip */}
        {!loading && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              {/* Admin Dividend */}
              <div className="px-6 py-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-violet-100 rounded-md flex items-center justify-center">
                    <Crown size={12} className="text-violet-600" />
                  </div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Admin Dividend</span>
                </div>
                <p className="text-2xl font-black text-violet-700">${fmt(adminTotal)}</p>
                <p className="text-xs text-gray-400 mt-1">60% of ${fmt(totalPool)} total pool</p>
              </div>

              {/* Expenses */}
              <div className="px-6 py-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-rose-100 rounded-md flex items-center justify-center">
                    <Receipt size={12} className="text-rose-600" />
                  </div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Expenses</span>
                </div>
                <p className="text-2xl font-black text-rose-600">
                  {totalExpenses > 0 ? `− $${fmt(totalExpenses)}` : '$0.00'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {baseExpenses.length > 0
                    ? `${baseExpenses.length} item${baseExpenses.length !== 1 ? 's' : ''}`
                    : 'No expenses recorded'}
                </p>
              </div>

              {/* Net */}
              <div className={`px-6 py-5 ${netAdmin >= 0 ? 'bg-indigo-50/40' : 'bg-orange-50/40'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center ${netAdmin >= 0 ? 'bg-indigo-100' : 'bg-orange-100'}`}>
                    <Wallet size={12} className={netAdmin >= 0 ? 'text-indigo-600' : 'text-orange-600'} />
                  </div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Net Admin Earning</span>
                </div>
                <p className={`text-2xl font-black ${netAdmin >= 0 ? 'text-indigo-700' : 'text-orange-600'}`}>${fmt(netAdmin)}</p>
                <p className="text-xs text-gray-400 mt-1">After deducting expenses</p>
              </div>
            </div>
          </div>
        )}

        {/* Per-Employee Breakdown */}
        {!loading && perEmployee.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
                  <Percent size={13} className="text-violet-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Employee Dividend Breakdown</h2>
                  <p className="text-xs text-gray-400">{perEmployee.length} employee{perEmployee.length !== 1 ? 's' : ''} · {baseRecords.length} records</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <colgroup>
                  <col />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '200px' }} />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-100">
                    <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Earning</th>
                    <th className="px-6 py-3 text-right text-[11px] font-bold text-violet-400 uppercase tracking-wider">Admin 60%</th>
                    <th className="px-6 py-3 text-right text-[11px] font-bold text-emerald-500 uppercase tracking-wider">Staff 40%</th>
                    <th className="px-6 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {perEmployee.map(emp => {
                    const share = totalPool > 0 ? (emp.earning / totalPool) * 100 : 0
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <InitialAvatar name={emp.name} size="md" />
                            <div>
                              <p className="text-sm font-bold text-gray-900">{emp.name}</p>
                              <p className="text-xs text-gray-400">{emp.count} record{emp.count !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-semibold text-gray-800">${fmt(emp.earning)}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-black text-violet-700">${fmt(emp.adminDiv)}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-black text-emerald-700">${fmt(emp.staffDiv)}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-violet-400 to-emerald-400 rounded-full"
                                style={{ width: `${share}%` }}
                              />
                            </div>
                            <span className="text-sm font-black text-gray-700 w-12 text-right">{share.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/70 border-t-2 border-gray-200">
                    <td className="px-6 py-3 text-xs font-black text-gray-500 uppercase tracking-wider">
                      Total ({perEmployee.length} employee{perEmployee.length !== 1 ? 's' : ''})
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-black text-gray-900">${fmt(totalPool)}</td>
                    <td className="px-6 py-3 text-right text-sm font-black text-violet-700">${fmt(adminTotal)}</td>
                    <td className="px-6 py-3 text-right text-sm font-black text-emerald-700">${fmt(staffTotal)}</td>
                    <td className="px-6 py-3 text-right text-sm font-black text-gray-500">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── Expenses Section ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          {/* Section header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-rose-50 rounded-lg flex items-center justify-center">
                <Receipt size={13} className="text-rose-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Expenses</h2>
                <p className="text-xs text-gray-400">
                  {baseExpenses.length > 0
                    ? `${baseExpenses.length} item${baseExpenses.length !== 1 ? 's' : ''} · $${fmt(totalExpenses)} deducted from admin dividend`
                    : 'Record spending that reduces admin earnings'}
                </p>
              </div>
            </div>
            <button
              onClick={() => { setEditingExp(null); setShowExpModal(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 text-white text-xs font-bold rounded-xl hover:bg-rose-600 active:scale-95 transition-all shadow-sm shrink-0"
            >
              <Plus size={13} /> Add Expense
            </button>
          </div>

          {loading ? (
            <div className="px-6 py-4 space-y-3 animate-pulse">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-2">
                  <div className="h-3 bg-gray-100 rounded w-24 shrink-0" />
                  <div className="h-5 bg-gray-100 rounded w-24 shrink-0" />
                  <div className="h-3 bg-gray-100 rounded flex-1" />
                  <div className="h-3 bg-gray-100 rounded w-20 shrink-0" />
                </div>
              ))}
            </div>
          ) : baseExpenses.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Receipt size={20} className="text-rose-300" />
              </div>
              <p className="text-sm font-semibold text-gray-500">No expenses recorded</p>
              <p className="text-xs text-gray-400 mt-1">Add an expense to see it deducted from your admin dividend</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '160px' }} />
                    <col />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '48px' }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50/70 border-b border-gray-100">
                      <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-right text-[11px] font-bold text-rose-400 uppercase tracking-wider">Amount</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {baseExpenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-gray-50/70 transition-colors group">
                        <td className="px-6 py-3.5 text-xs text-gray-500 font-medium whitespace-nowrap">{fmtDate(exp.expense_date)}</td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center whitespace-nowrap text-[11px] font-bold px-2.5 py-1 rounded-full ${getCatColor(exp.category)}`}>
                            {exp.category}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <p className="text-sm font-medium text-gray-900 truncate">{exp.description}</p>
                          {exp.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{exp.notes}</p>}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <span className="text-sm font-black text-rose-600">${fmt(exp.amount)}</span>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <button
                            onClick={() => { setEditingExp(exp); setShowExpModal(true) }}
                            className="w-7 h-7 inline-flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all"
                          >
                            <Pencil size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-rose-100 bg-rose-50/50">
                      <td colSpan={3} className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-rose-500 uppercase tracking-wider">Total Expenses</span>
                          <span className="text-xs text-rose-400">({baseExpenses.length} item{baseExpenses.length !== 1 ? 's' : ''})</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-base font-black text-rose-600">${fmt(totalExpenses)}</span>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-50">
                {baseExpenses.map(exp => (
                  <div key={exp.id} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{exp.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{fmtDate(exp.expense_date)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-black text-rose-600">${fmt(exp.amount)}</span>
                        <button
                          onClick={() => { setEditingExp(exp); setShowExpModal(true) }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${getCatColor(exp.category)}`}>
                        {exp.category}
                      </span>
                      {exp.notes && <span className="text-xs text-gray-400 truncate">{exp.notes}</span>}
                    </div>
                  </div>
                ))}
                <div className="px-4 py-3.5 bg-rose-50/60 border-t-2 border-rose-100 flex justify-between items-center">
                  <span className="text-xs font-black text-rose-500 uppercase tracking-wider">Total Expenses</span>
                  <span className="text-base font-black text-rose-600">${fmt(totalExpenses)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Dividend Per Record Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
                <Crown size={13} className="text-violet-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Dividend Per Record</h2>
                <p className="text-xs text-gray-400">Individual commission records & dividend split</p>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="relative min-w-40">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={13} /></div>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                {[{ key: 'all', label: 'All' }, { key: 'unpaid', label: 'Unpaid' }, { key: 'paid', label: 'Paid' }].map(({ key, label }) => (
                  <button key={key} onClick={() => setStatusFilter(key)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${statusFilter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"><Filter size={11} /></div>
                <select
                  value={employeeFilter}
                  onChange={e => setEmployeeFilter(e.target.value)}
                  className="pl-7 pr-7 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:outline-none focus:border-indigo-400 appearance-none cursor-pointer">
                  <option value="all">All Employees</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><ChevronDown size={11} /></div>
              </div>

              <span className="text-xs text-gray-400">{filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-4 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-28" />
                    <div className="h-2.5 bg-gray-100 rounded w-20" />
                  </div>
                  <div className="h-5 bg-gray-100 rounded w-20" />
                  <div className="h-5 bg-gray-100 rounded w-20" />
                  <div className="h-5 bg-gray-100 rounded w-20" />
                </div>
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Crown size={22} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-500">No records found</p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '180px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '130px' }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50/70 border-b border-gray-100">
                      <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Client</th>
                      <th className="px-6 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Earning</th>
                      <th className="px-6 py-3 text-right text-[11px] font-bold text-violet-400 uppercase tracking-wider">Admin 60%</th>
                      <th className="px-6 py-3 text-right text-[11px] font-bold text-emerald-500 uppercase tracking-wider">Staff 40%</th>
                      <th className="px-6 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredRecords.map(rec => {
                      const earning  = Number(rec.total_earning) || 0
                      const adminDiv = earning * ADMIN_RATE
                      const staffDiv = earning * STAFF_RATE
                      return (
                        <tr
                          key={rec.id}
                          onClick={() => setConfirmRecord(rec)}
                          className="hover:bg-violet-50/30 transition-colors cursor-pointer group"
                          title="Click to view original transaction"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <InitialAvatar name={rec.employees?.name || '?'} size="sm" />
                              <span className="text-sm font-semibold text-gray-900">{rec.employees?.name || '—'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-gray-900">{rec.clients?.full_name || '—'}</p>
                            {rec.clients?.user_id && <p className="text-xs text-gray-400 font-mono">{rec.clients.user_id}</p>}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-semibold text-gray-900">${fmt(earning)}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-black text-violet-700">${fmt(adminDiv)}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-black text-emerald-700">${fmt(staffDiv)}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {rec.status === 'paid' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                                <CheckCircle2 size={11} /> Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                                <Clock size={11} /> Unpaid
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-xs text-gray-500">{fmtDate(rec.payment_date)}</span>
                              <ExternalLink size={11} className="text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {filteredRecords.length > 1 && (() => {
                    const filtTotal = filteredRecords.reduce((s, r) => s + (Number(r.total_earning) || 0), 0)
                    return (
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2 border-gray-200">
                          <td colSpan={2} className="px-6 py-3 text-xs font-black text-gray-500 uppercase tracking-wider">
                            Subtotal ({filteredRecords.length} records)
                          </td>
                          <td className="px-6 py-3 text-right text-sm font-black text-gray-900">${fmt(filtTotal)}</td>
                          <td className="px-6 py-3 text-right text-sm font-black text-violet-700">${fmt(filtTotal * ADMIN_RATE)}</td>
                          <td className="px-6 py-3 text-right text-sm font-black text-emerald-700">${fmt(filtTotal * STAFF_RATE)}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    )
                  })()}
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-50">
                {filteredRecords.map(rec => {
                  const earning = Number(rec.total_earning) || 0
                  return (
                    <div key={rec.id} className="px-4 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <InitialAvatar name={rec.employees?.name || '?'} size="sm" />
                          <div>
                            <p className="text-sm font-bold text-gray-900">{rec.employees?.name || '—'}</p>
                            <p className="text-xs text-gray-400">from {rec.clients?.full_name || '—'}</p>
                          </div>
                        </div>
                        {rec.status === 'paid'
                          ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full"><CheckCircle2 size={11} /> Paid</span>
                          : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full"><Clock size={11} /> Unpaid</span>
                        }
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
                          <p className="text-[10px] text-gray-400 font-semibold uppercase mb-0.5">Total</p>
                          <p className="text-sm font-bold text-gray-900">${fmt(earning)}</p>
                        </div>
                        <div className="bg-violet-50 rounded-xl px-3 py-2.5 text-center">
                          <p className="text-[10px] text-violet-400 font-semibold uppercase mb-0.5">Admin 60%</p>
                          <p className="text-sm font-black text-violet-700">${fmt(earning * ADMIN_RATE)}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl px-3 py-2.5 text-center">
                          <p className="text-[10px] text-emerald-500 font-semibold uppercase mb-0.5">Staff 40%</p>
                          <p className="text-sm font-black text-emerald-700">${fmt(earning * STAFF_RATE)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

      </div>
    </>
  )
}
