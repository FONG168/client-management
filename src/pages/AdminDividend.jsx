import { useState, useEffect, useMemo } from 'react'
import {
  ShieldCheck, TrendingUp, Users, Crown, Percent,
  ChevronDown, Filter, Search, CalendarDays, CheckCircle2, Clock
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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminDividend() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [employees, setEmployees] = useState([])

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [recRes, empRes] = await Promise.all([
        supabase
          .from('commission_records')
          .select('*, employees(name, commission_rate), clients(full_name, user_id)')
          .order('created_at', { ascending: false }),
        supabase.from('employees').select('*').order('name'),
      ])
      if (recRes.error) throw recRes.error
      if (empRes.error) throw empRes.error
      setRecords(recRes.data || [])
      setEmployees(empRes.data || [])
    } catch (err) {
      toast.error('Failed to load data: ' + (err.message || ''))
    } finally {
      setLoading(false)
    }
  }

  // ── Global totals ──
  const totalPool = records.reduce((s, r) => s + (Number(r.total_earning) || 0), 0)
  const adminTotal = totalPool * ADMIN_RATE
  const staffTotal = totalPool * STAFF_RATE

  // ── Per-employee dividend breakdown ──
  const perEmployee = useMemo(() => {
    const map = {}
    for (const r of records) {
      const empId = r.employee_id
      const name = r.employees?.name || 'Unknown'
      if (!map[empId]) map[empId] = { id: empId, name, earning: 0, adminDiv: 0, staffDiv: 0, count: 0 }
      const earning = Number(r.total_earning) || 0
      map[empId].earning += earning
      map[empId].adminDiv += earning * ADMIN_RATE
      map[empId].staffDiv += earning * STAFF_RATE
      map[empId].count += 1
    }
    return Object.values(map).sort((a, b) => b.earning - a.earning)
  }, [records])

  // ── Filtered records ──
  const filteredRecords = useMemo(() => {
    let list = records
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
  }, [records, statusFilter, employeeFilter, search])

  return (
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
        <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-100 rounded-xl">
          <ShieldCheck size={16} className="text-violet-500" />
          <span className="text-sm font-bold text-violet-700">Admin Only</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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

        {/* Admin (Owner) */}
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

        {/* Staff */}
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

      {/* Per-Employee Breakdown */}
      {!loading && perEmployee.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Percent size={14} className="text-gray-400" />
            <h2 className="text-sm font-bold text-gray-900">Per-Employee Dividend Breakdown</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {perEmployee.map(emp => {
              const staffPct = emp.earning > 0 ? ((emp.staffDiv / staffTotal) * 100) : 0
              return (
                <div key={emp.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                  <InitialAvatar name={emp.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">{emp.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{emp.count} record{emp.count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Total Earning</p>
                    <p className="text-sm font-bold text-gray-800">${fmt(emp.earning)}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-violet-500 uppercase font-semibold mb-0.5">Admin 60%</p>
                    <p className="text-sm font-black text-violet-700">${fmt(emp.adminDiv)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-emerald-500 uppercase font-semibold mb-0.5">Staff 40%</p>
                    <p className="text-sm font-black text-emerald-700">${fmt(emp.staffDiv)}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex flex-col items-center justify-center border border-gray-100 shrink-0">
                    <p className="text-[9px] text-gray-400 leading-none">share</p>
                    <p className="text-xs font-black text-gray-700">{staffPct.toFixed(1)}%</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Crown size={14} className="text-violet-400" />
            <h2 className="text-sm font-bold text-gray-900">Dividend Per Record</h2>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Search */}
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

            {/* Status */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
              {[{ key: 'all', label: 'All' }, { key: 'unpaid', label: 'Unpaid' }, { key: 'paid', label: 'Paid' }].map(({ key, label }) => (
                <button key={key} onClick={() => setStatusFilter(key)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${statusFilter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Employee filter */}
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
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
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
                    const earning = Number(rec.total_earning) || 0
                    const adminDiv = earning * ADMIN_RATE
                    const staffDiv = earning * STAFF_RATE
                    return (
                      <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
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
                          <span className="text-xs text-gray-500">{fmtDate(rec.payment_date)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Totals row */}
                {filteredRecords.length > 1 && (() => {
                  const filtTotal = filteredRecords.reduce((s, r) => s + (Number(r.total_earning) || 0), 0)
                  return (
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td colSpan={2} className="px-6 py-3 text-xs font-black text-gray-500 uppercase tracking-wider">Subtotal ({filteredRecords.length} records)</td>
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
  )
}
