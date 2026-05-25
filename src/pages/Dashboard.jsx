import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  UserPlus, Search, Users, TrendingUp, TrendingDown, Wallet,
  ArrowUpCircle, ArrowDownCircle, ArrowUpRight, ArrowDownRight,
  CalendarDays, Receipt, ChevronRight, Pencil
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import UsdtIcon from '../components/UsdtIcon'

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500',
]

function getAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function formatUSD(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function fmtAmount(amount, currency) {
  const n = Number(amount)
  switch (currency) {
    case 'IDR': return `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(n))}`
    case 'VND': return `₫${new Intl.NumberFormat('vi-VN').format(Math.round(n))}`
    case 'HKD': return `HK$${n.toFixed(2)}`
    default:    return `$${n.toFixed(2)}`
  }
}

function Avatar({ client, size = 'sm' }) {
  const initial = client.full_name?.charAt(0).toUpperCase() || '?'
  const color = getAvatarColor(client.full_name || '')
  const cls = size === 'sm' ? 'w-8 h-8 text-sm' : size === 'md' ? 'w-9 h-9 text-sm' : 'w-10 h-10 text-base'
  return (
    <div className={`${cls} rounded-full shrink-0 overflow-hidden ${!client.profile_pic_url ? `${color} flex items-center justify-center` : ''}`}>
      {client.profile_pic_url
        ? <img src={client.profile_pic_url} alt={client.full_name} className="w-full h-full object-cover" />
        : <span className="text-white font-bold">{initial}</span>}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, gradient, iconColor, valueColor, accentColor, trend, loading }) {
  return (
    <div className={`relative rounded-2xl p-5 overflow-hidden ${gradient} shadow-sm`}>
      {/* decorative circle */}
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -right-1 -top-8 w-16 h-16 rounded-full bg-white/10" />

      <div className="relative flex items-start justify-between mb-5">
        <div className={`w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center`}>
          <Icon size={20} className={iconColor} />
        </div>
        {trend && (
          <span className={`text-[11px] font-bold flex items-center gap-0.5 px-2 py-1 rounded-full bg-white/20 ${trend === 'up' ? 'text-white' : 'text-white'}`}>
            {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend === 'up' ? 'Up' : 'Down'}
          </span>
        )}
      </div>
      <p className="relative text-[11px] font-semibold text-white/70 uppercase tracking-widest mb-1">{label}</p>
      <p className={`relative text-2xl font-black tracking-tight text-white`}>
        {loading ? <span className="opacity-30">—</span> : value}
      </p>
    </div>
  )
}

function SectionHeader({ title, subtitle, children }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
      <div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function Pill({ children, color = 'gray' }) {
  const cls = {
    gray: 'bg-gray-100 text-gray-500',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-600',
    indigo: 'bg-indigo-100 text-indigo-600',
  }[color]
  return <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${cls}`}>{children}</span>
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-6 py-4">
      <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-100 rounded-full w-32 animate-pulse" />
        <div className="h-2.5 bg-gray-100 rounded-full w-20 animate-pulse" />
      </div>
      <div className="h-3 bg-gray-100 rounded-full w-16 animate-pulse" />
    </div>
  )
}

const CUR_STYLE = {
  USDT: { badge: 'bg-blue-100 text-blue-700',   row: 'bg-white/10', dot: 'bg-blue-400'   },
  IDR:  { badge: 'bg-orange-100 text-orange-700', row: 'bg-white/8',  dot: 'bg-orange-400' },
  VND:  { badge: 'bg-violet-100 text-violet-700', row: 'bg-white/8',  dot: 'bg-violet-400' },
  HKD:  { badge: 'bg-teal-100 text-teal-700',    row: 'bg-white/8',  dot: 'bg-teal-400'   },
}

function MultiCurrencySummaryCard({ totals, rates, loading, onRateChange }) {
  const [editingCur, setEditingCur] = useState(null)
  const [draftRate, setDraftRate] = useState('')

  function startEdit(cur) {
    setEditingCur(cur)
    setDraftRate(String(rates?.[cur] ?? ''))
  }

  function commitRate(cur) {
    const val = parseFloat(draftRate)
    if (val > 0) onRateChange(cur, val)
    setEditingCur(null)
    setDraftRate('')
  }

  function handleKeyDown(e, cur) {
    if (e.key === 'Enter') { e.preventDefault(); commitRate(cur) }
    if (e.key === 'Escape') { setEditingCur(null); setDraftRate('') }
  }

  const toUSD = (amount, cur) => {
    if (cur === 'USDT') return amount
    const r = rates?.[cur]
    return r ? amount / r : 0
  }

  const totalUSD = ['USDT', 'IDR', 'VND', 'HKD'].reduce((sum, cur) => {
    const d = totals[cur] || { balance: 0 }
    return sum + toUSD(d.balance, cur)
  }, 0)

  const totalTopUSD = ['USDT', 'IDR', 'VND', 'HKD'].reduce((sum, cur) => {
    const d = totals[cur] || { topups: 0 }
    return sum + toUSD(d.topups, cur)
  }, 0)

  const totalWdUSD = ['USDT', 'IDR', 'VND', 'HKD'].reduce((sum, cur) => {
    const d = totals[cur] || { withdrawals: 0 }
    return sum + toUSD(d.withdrawals, cur)
  }, 0)

  return (
    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900 shadow-sm col-span-1 sm:col-span-3">
      <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/5" />
      <div className="absolute right-10 -bottom-10 w-32 h-32 rounded-full bg-white/5" />
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Wallet size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Financial Summary</p>
              <p className="text-xs text-white/30 mt-0.5">Separated by currency</p>
            </div>
          </div>
          {!loading && (
            <div className="text-right">
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mb-0.5">Total in USD</p>
              <p className={`text-xl font-black tabular-nums ${totalUSD >= 0 ? 'text-white' : 'text-rose-400'}`}>
                ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalUSD)}
              </p>
            </div>
          )}
        </div>
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-9 bg-white/10 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* header */}
            <div className="grid grid-cols-5 gap-2 px-3 pb-2 border-b border-white/10 mb-1">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Currency</span>
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider text-right">Top-ups</span>
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider text-right">Withdrawals</span>
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider text-right">Net Balance</span>
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider text-right">≈ USD</span>
            </div>
            {['USDT', 'IDR', 'VND', 'HKD'].map(cur => {
              const d = totals[cur] || { topups: 0, withdrawals: 0, balance: 0 }
              const active = d.topups > 0 || d.withdrawals > 0
              const s = CUR_STYLE[cur]
              const balUSD = toUSD(d.balance, cur)
              return (
                <div key={cur} className={`grid grid-cols-5 gap-2 px-3 py-2.5 rounded-xl mb-1 transition-opacity ${active ? 'opacity-100' : 'opacity-35'}`}
                  style={{ background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)' }}>
                  <div>
                    {cur === 'USDT' ? (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md w-fit ${s.badge}`}>
                        <UsdtIcon size={13} /> USDT
                      </span>
                    ) : (
                      <span className={`text-[11px] font-black px-2 py-0.5 rounded-md w-fit ${s.badge}`}>{cur}</span>
                    )}
                    {cur !== 'USDT' && (
                      editingCur === cur ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] text-white/30 shrink-0">1 USD =</span>
                          <input
                            autoFocus
                            type="number"
                            value={draftRate}
                            onChange={e => setDraftRate(e.target.value)}
                            onBlur={() => commitRate(cur)}
                            onKeyDown={e => handleKeyDown(e, cur)}
                            className="w-20 text-[9px] bg-white/10 border border-white/30 rounded px-1.5 py-0.5 text-white focus:outline-none focus:border-white/60"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(cur)}
                          className="flex items-center gap-1 mt-0.5 pl-0.5 group"
                        >
                          <span className="text-[9px] text-white/20 group-hover:text-white/50 transition-colors">
                            1 USD = {rates?.[cur]
                              ? (rates[cur] >= 100
                                  ? new Intl.NumberFormat().format(Math.round(rates[cur]))
                                  : rates[cur].toFixed(4))
                              : '—'}
                            {cur === 'VND' && ' *'}
                          </span>
                          <Pencil size={8} className="text-white/0 group-hover:text-white/40 transition-colors" />
                        </button>
                      )
                    )}
                  </div>
                  <span className="text-xs font-semibold text-emerald-300 text-right tabular-nums">{fmtAmount(d.topups, cur)}</span>
                  <span className="text-xs font-semibold text-rose-300 text-right tabular-nums">{fmtAmount(d.withdrawals, cur)}</span>
                  <span className={`text-xs font-black text-right tabular-nums ${d.balance >= 0 ? 'text-white' : 'text-rose-400'}`}>
                    {fmtAmount(d.balance, cur)}
                  </span>
                  <span className={`text-xs font-bold text-right tabular-nums ${balUSD >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                    ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(balUSD)}
                  </span>
                </div>
              )
            })}
            {/* Total row */}
            <div className="grid grid-cols-5 gap-2 px-3 py-2.5 rounded-xl mt-1 border border-white/15"
              style={{ background: 'rgba(255,255,255,0.06)' }}>
              <span className="text-[11px] font-black text-white/60 uppercase tracking-wider col-span-1">Total</span>
              <span className="text-xs font-bold text-emerald-300 text-right tabular-nums">
                ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalTopUSD)}
              </span>
              <span className="text-xs font-bold text-rose-300 text-right tabular-nums">
                ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalWdUSD)}
              </span>
              <span className="text-xs text-white/20 text-right tabular-nums">—</span>
              <span className={`text-sm font-black text-right tabular-nums ${totalUSD >= 0 ? 'text-white' : 'text-rose-400'}`}>
                ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalUSD)}
              </span>
            </div>
            <p className="text-[9px] text-white/20 mt-2 px-1">* VND rate estimated · IDR &amp; HKD live from Frankfurter API</p>
          </>
        )}
      </div>
    </div>
  )
}

const FALLBACK_RATES = { IDR: 16300, VND: 25400, HKD: 7.83 }

export default function Dashboard() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [exchangeRates, setExchangeRates] = useState(FALLBACK_RATES)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [clientRes, ratesRes] = await Promise.all([
        supabase.from('clients').select('*, transactions(*)').order('created_at', { ascending: false }),
        fetch('https://api.frankfurter.app/latest?from=USD&to=IDR,HKD').then(r => r.json()).catch(() => null)
      ])
      if (clientRes.error) throw clientRes.error
      setClients(clientRes.data || [])
      setExchangeRates({
        ...FALLBACK_RATES,
        ...(ratesRes?.rates || {}),
      })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load clients')
    } finally {
      setLoading(false)
    }
  }

  const CURRENCIES = ['USDT', 'IDR', 'VND', 'HKD']

  const clientsEnriched = useMemo(() => clients.map(c => {
    const txns = c.transactions || []
    const byCurrency = {}
    for (const cur of CURRENCIES) {
      const ct = txns.filter(t => (t.currency || 'USDT') === cur)
      const topups = ct.filter(t => t.type === 'topup').reduce((s, t) => s + Number(t.amount), 0)
      const withdrawals = ct.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0)
      const totalFees = ct.reduce((s, t) => s + Number(t.bank_fee_amount || 0), 0)
      byCurrency[cur] = { topups, withdrawals, totalFees, balance: topups - withdrawals - totalFees }
    }
    return { ...c, byCurrency, balance: byCurrency.USDT.balance }
  }), [clients])

  const totalsByCurrency = useMemo(() => {
    const res = {}
    for (const cur of CURRENCIES) {
      const topups = clientsEnriched.reduce((s, c) => s + c.byCurrency[cur].topups, 0)
      const withdrawals = clientsEnriched.reduce((s, c) => s + c.byCurrency[cur].withdrawals, 0)
      const totalFees = clientsEnriched.reduce((s, c) => s + c.byCurrency[cur].totalFees, 0)
      res[cur] = { topups, withdrawals, totalFees, balance: topups - withdrawals - totalFees }
    }
    return res
  }, [clientsEnriched])

  const recentTransactions = useMemo(() => {
    const all = []
    clients.forEach(c => (c.transactions || []).forEach(t => all.push({ ...t, client: c })))
    return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8)
  }, [clients])

  const topClients = useMemo(() => {
    const sorted = [...clientsEnriched].sort((a, b) => b.balance - a.balance).slice(0, 6)
    const maxBalance = sorted.length ? Math.max(...sorted.map(c => Math.abs(c.balance)), 1) : 1
    return sorted.map(c => ({ ...c, pct: Math.round((Math.abs(c.balance) / maxBalance) * 100) }))
  }, [clientsEnriched])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return clientsEnriched
    return clientsEnriched.filter(c =>
      c.full_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.user_id?.toLowerCase().includes(q)
    )
  }, [clientsEnriched, search])

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">Overview of your clients and transactions</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-sm text-gray-500 shadow-sm">
              <CalendarDays size={14} className="text-indigo-400" />
              <span className="font-medium">{today}</span>
            </div>
            <Link
              to="/clients/new"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-px"
            >
              <UserPlus size={15} />
              Add Client
            </Link>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-7">
          <StatCard label="Total Clients" value={clients.length.toString()}
            gradient="bg-gradient-to-br from-indigo-500 to-indigo-700"
            iconColor="text-white" trend={null} loading={loading} icon={Users} />
          <MultiCurrencySummaryCard
            totals={totalsByCurrency}
            rates={exchangeRates}
            loading={loading}
            onRateChange={(cur, val) => setExchangeRates(prev => ({ ...prev, [cur]: val }))}
          />
        </div>

        {/* ── Middle Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

          {/* Recent Transactions */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <SectionHeader title="Recent Transactions" subtitle="Latest activity across all clients">
              {!loading && <Pill color="gray">{recentTransactions.length} entries</Pill>}
            </SectionHeader>

            {loading ? (
              <div className="divide-y divide-gray-50">{[...Array(5)].map((_, i) => <RowSkeleton key={i} />)}</div>
            ) : recentTransactions.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                  <Receipt size={22} className="text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">No transactions yet</p>
              </div>
            ) : (
              <div className="overflow-auto max-h-[380px]">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm">
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Client</th>
                      <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Type</th>
                      <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Amount</th>
                      <th className="text-right px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map((txn, i) => (
                      <tr key={txn.id}
                        className={`border-b border-gray-50 hover:bg-indigo-50/30 transition-colors ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                        {/* left accent bar */}
                        <td className="px-6 py-3.5">
                          <Link to={`/clients/${txn.client.id}`} className="flex items-center gap-2.5 group">
                            <div className="relative">
                              <Avatar client={txn.client} />
                              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${txn.type === 'topup' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            </div>
                            <span className="text-sm font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors truncate max-w-[120px]">
                              {txn.client.full_name}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ${txn.type === 'topup' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {txn.type === 'topup' ? <ArrowUpCircle size={11} /> : <ArrowDownCircle size={11} />}
                            {txn.type === 'topup' ? 'Top-up' : 'Withdrawal'}
                          </span>
                        </td>
                        <td className={`px-4 py-3.5 text-right text-sm font-black tabular-nums ${txn.type === 'topup' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {txn.type === 'topup' ? '+' : '−'}{fmtAmount(txn.amount, txn.currency || 'USDT')}
                        </td>
                        <td className="px-6 py-3.5 text-right whitespace-nowrap">
                          <p className="text-xs font-semibold text-gray-700">
                            {new Date(txn.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {new Date(txn.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top Clients */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <SectionHeader title="Top Clients" subtitle="Ranked by net balance" />

            {loading ? (
              <div className="divide-y divide-gray-50 flex-1">
                {[...Array(5)].map((_, i) => <RowSkeleton key={i} />)}
              </div>
            ) : topClients.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <p className="text-sm text-gray-400">No clients yet</p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[380px] divide-y divide-gray-50">
                {topClients.map((client, i) => (
                  <Link key={client.id} to={`/clients/${client.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-indigo-50/30 transition-colors group">
                    <span className={`text-xs font-black w-5 shrink-0 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-gray-300'}`}>
                      #{i + 1}
                    </span>
                    <Avatar client={client} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors truncate">{client.full_name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${client.balance >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                            style={{ width: `${client.pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {['USDT', 'IDR', 'VND', 'HKD']
                        .filter(cur => client.byCurrency[cur].topups > 0 || client.byCurrency[cur].balance !== 0)
                        .map(cur => (
                          <p key={cur} className={`text-xs font-black tabular-nums ${client.byCurrency[cur].balance >= 0 ? 'text-gray-900' : 'text-rose-500'}`}>
                            {fmtAmount(client.byCurrency[cur].balance, cur)}
                          </p>
                        ))
                      }
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── All Clients Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Users size={14} className="text-indigo-600" />
              </div>
              <h2 className="text-sm font-bold text-gray-900">All Clients</h2>
              {!loading && (
                <span className="text-xs bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full">
                  {clients.length}
                </span>
              )}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, phone, ID..."
                className="pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-64 transition-all"
              />
            </div>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50">{[...Array(6)].map((_, i) => <RowSkeleton key={i} />)}</div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                <Users size={28} className="text-indigo-300" />
              </div>
              <h3 className="text-sm font-bold text-gray-700 mb-1">No clients yet</h3>
              <p className="text-xs text-gray-400 mb-5">Add your first client to get started.</p>
              <Link to="/clients/new"
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-md shadow-indigo-200">
                <UserPlus size={15} /> Add First Client
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Search size={28} className="text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">No results for <span className="font-semibold text-gray-700">"{search}"</span></p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Client</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hidden sm:table-cell">Contact</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hidden md:table-cell">User ID</th>
                    <th className="text-right px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Balance by Currency</th>
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((client, i) => (
                    <tr key={client.id}
                      className={`border-b border-gray-50 hover:bg-indigo-50/30 transition-colors group ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <Link to={`/clients/${client.id}`} className="flex items-center gap-3">
                          <Avatar client={client} size="md" />
                          <div>
                            <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{client.full_name}</p>
                            <p className="text-xs text-gray-400">{client.transactions?.length || 0} transactions</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell">
                        <p className="text-xs text-gray-600 truncate max-w-[180px]">{client.email || '—'}</p>
                        <p className="text-xs text-gray-400">{client.phone || ''}</p>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        {client.user_id
                          ? <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">{client.user_id}</span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 justify-end">
                          {['USDT', 'IDR', 'VND', 'HKD'].filter(cur =>
                            client.byCurrency[cur].balance !== 0 ||
                            client.byCurrency[cur].topups > 0
                          ).length === 0
                            ? <span className="text-xs text-gray-300">No transactions</span>
                            : ['USDT', 'IDR', 'VND', 'HKD']
                                .filter(cur => client.byCurrency[cur].topups > 0 || client.byCurrency[cur].balance !== 0)
                                .map(cur => (
                                  <span key={cur} className={`text-xs font-bold px-2 py-0.5 rounded-lg tabular-nums ${
                                    client.byCurrency[cur].balance >= 0
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-rose-50 text-rose-600'
                                  }`}>
                                    {fmtAmount(client.byCurrency[cur].balance, cur)}
                                  </span>
                                ))
                          }
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Link to={`/clients/${client.id}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                          <ChevronRight size={14} className="text-indigo-500" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
