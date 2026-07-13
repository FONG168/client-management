import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, AlertTriangle, ChevronRight, ChevronLeft, ChevronDown, Scale, CheckCircle2, Inbox,
  Clock, FileText, Printer, X, Filter
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import UsdtIcon from '../components/UsdtIcon'

const CURRENCIES = ['USDT', 'IDR', 'VND', 'HKD']
const FALLBACK_RATES = { IDR: 16300, VND: 25400, HKD: 7.83 }
const EPSILON = 0.01

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500',
]

function getAvatarColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function Avatar({ client, size = 'md' }) {
  const initial = client.full_name?.charAt(0).toUpperCase() || '?'
  const color = getAvatarColor(client.full_name || '')
  const cls = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-9 h-9 text-sm'
  return (
    <div className={`${cls} rounded-full shrink-0 overflow-hidden ${!client.profile_pic_url ? `${color} flex items-center justify-center` : ''}`}>
      {client.profile_pic_url
        ? <img src={client.profile_pic_url} alt={client.full_name} className="w-full h-full object-cover" />
        : <span className="text-white font-bold">{initial}</span>}
    </div>
  )
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

function fmtUSD(n) {
  return `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0)
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtDateTime(date) {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  return {
    date: d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  }
}

function CurrencyChips({ values, tone }) {
  const active = CURRENCIES.filter(cur => Math.abs(values[cur] || 0) > EPSILON)
  if (active.length === 0) return <span className="text-xs text-gray-300">—</span>
  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {active.map(cur => (
        <span key={cur} className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg tabular-nums ${
          values[cur] >= 0 ? tone : 'bg-rose-50 text-rose-600'
        }`}>
          {cur === 'USDT' && <UsdtIcon size={11} />}
          {fmtAmount(values[cur], cur)}
        </span>
      ))}
    </div>
  )
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

// ─── Client Closing Statement Modal ──────────────────────────────────────────

function ClientClosingModal({ row, records, onClose }) {
  const printRef = useRef(null)

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const sorted = [...records].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const generatedAt = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const outstandingCurrencies = CURRENCIES.filter(cur => Math.abs(row.outstanding[cur]) > EPSILON)

  function handlePrint() {
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>Closing Statement</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#111;background:#fff;padding:48px 56px}
      .doc-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;margin-bottom:24px;border-bottom:2px solid #111}
      .org{font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#059669;margin-bottom:6px}
      .title{font-size:24px;font-weight:900;color:#111;letter-spacing:-.02em}
      .meta-right{text-align:right;font-size:11px;color:#555;line-height:1.9}
      .meta-right strong{color:#111;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.1em}
      .info-block{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;margin-bottom:20px}
      .info-block .val-name{font-size:15px;font-weight:800;color:#111;margin-bottom:3px}
      .summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
      .summary-card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px}
      .summary-card .label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:4px}
      .summary-card .value{font-size:16px;font-weight:900;color:#111}
      .section-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:#9ca3af;margin-bottom:8px}
      .calc-table{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:20px}
      .calc-table th{background:#f9fafb;padding:9px 16px;text-align:left;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;border-bottom:1px solid #e5e7eb}
      .calc-table th:not(:first-child):not(:nth-child(2)){text-align:right}
      .calc-table td{padding:11px 16px;border-bottom:1px solid #f3f4f6;font-size:12px}
      .calc-table tr:last-child td{border-bottom:none}
      .total-row td{background:#eef2ff;font-size:13px;font-weight:900;color:#3730a3}
      .status-paid{display:inline-flex;align-items:center;gap:4px;background:#d1fae5;color:#065f46;font-weight:800;padding:3px 10px;border-radius:20px;font-size:11px}
      .status-unpaid{display:inline-flex;align-items:center;gap:4px;background:#fef3c7;color:#92400e;font-weight:800;padding:3px 10px;border-radius:20px;font-size:11px}
      @media print{body{padding:24px 32px}@page{margin:.8cm}}
    </style></head><body>${content}</body></html>`)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Closing Statement</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-xs font-bold tracking-wide transition-colors">
              <Printer size={12} /> Print / Export
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Document */}
        <div className="overflow-y-auto flex-1 bg-white" ref={printRef}>
          <div className="max-w-[680px] mx-auto px-8 py-8">

            {/* Header */}
            <div className="doc-header flex items-start justify-between pb-5 mb-6 border-b-2 border-gray-900">
              <div>
                <p className="org text-[10px] font-black tracking-[.16em] uppercase text-emerald-600 mb-1.5">Management Hub</p>
                <h1 className="title text-[22px] font-black text-gray-900 leading-none tracking-tight">Closing Statement</h1>
              </div>
              <div className="meta-right text-right text-[11px] text-gray-500 leading-relaxed">
                <div><strong className="text-gray-800 text-[10px] uppercase tracking-wider font-bold">Issued</strong><br />{generatedAt}</div>
              </div>
            </div>

            {/* Client info */}
            <div className="info-block bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 flex items-center gap-3">
              <Avatar client={row} />
              <div>
                <p className="val-name text-sm font-black text-gray-900">{row.full_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {row.user_id && <span className="text-xs font-mono font-bold text-indigo-500">{row.user_id}</span>}
                  {row.email && <span className="text-xs text-gray-500">{row.email}</span>}
                </div>
              </div>
              <div className="ml-auto">
                {row.isClosed ? (
                  <span className="status-paid inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-full">
                    <CheckCircle2 size={12} /> Closed
                  </span>
                ) : (
                  <span className="status-unpaid inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full">
                    <Clock size={12} /> Remaining
                  </span>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="summary-grid grid grid-cols-3 gap-3 mb-6">
              <div className="summary-card bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="label text-[9px] font-black uppercase tracking-[.14em] text-gray-400 mb-1">Total Earning</p>
                <p className="value text-lg font-black text-gray-900">${fmt(row.totalEarning)}</p>
              </div>
              <div className="summary-card bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="label text-[9px] font-black uppercase tracking-[.14em] text-gray-400 mb-1">Commission</p>
                <p className="value text-lg font-black text-emerald-700">${fmt(row.commissionAmount)}</p>
              </div>
              <div className="summary-card bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="label text-[9px] font-black uppercase tracking-[.14em] text-gray-400 mb-1">Remaining Balance</p>
                {outstandingCurrencies.length === 0 ? (
                  <p className="value text-lg font-black text-gray-300">$0.00</p>
                ) : (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {outstandingCurrencies.map(cur => (
                      <span key={cur} className={`text-xs font-bold px-2 py-0.5 rounded-lg ${row.outstanding[cur] >= 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600'}`}>
                        {fmtAmount(row.outstanding[cur], cur)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Records table */}
            <div className="mb-2">
              <p className="section-label text-[9px] font-black uppercase tracking-[.14em] text-gray-400 mb-2">Commission Records ({sorted.length})</p>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="calc-table w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-[.12em] text-gray-400">Date</th>
                      <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-[.12em] text-gray-400">Employee</th>
                      <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.12em] text-gray-400">Earning</th>
                      <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.12em] text-gray-400">Rate</th>
                      <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.12em] text-gray-400">Commission</th>
                      <th className="px-4 py-2.5 text-center text-[9px] font-black uppercase tracking-[.12em] text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(r => (
                      <tr key={r.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3 text-xs text-gray-600">{fmtDate(r.created_at)}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-gray-800">{r.employees?.name || '—'}</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-700 tabular-nums">${fmt(r.total_earning)}</td>
                        <td className="px-4 py-3 text-right text-xs text-indigo-600 font-bold tabular-nums">{r.commission_rate}%</td>
                        <td className="px-4 py-3 text-right text-xs font-black text-emerald-700 tabular-nums">${fmt(r.commission_amount)}</td>
                        <td className="px-4 py-3 text-center">
                          {r.status === 'paid'
                            ? <span className="status-paid inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"><CheckCircle2 size={9} />Paid</span>
                            : <span className="status-unpaid inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full"><Clock size={9} />Unpaid</span>}
                        </td>
                      </tr>
                    ))}
                    <tr className="total-row bg-indigo-50">
                      <td colSpan={2} className="px-4 py-2.5 text-xs font-black text-indigo-800">Total</td>
                      <td className="px-4 py-2.5 text-right text-sm font-black text-indigo-700 tabular-nums">${fmt(row.totalEarning)}</td>
                      <td></td>
                      <td className="px-4 py-2.5 text-right text-sm font-black text-indigo-700 tabular-nums">${fmt(row.commissionAmount)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AgingSummary() {
  const [tab, setTab] = useState('outstanding') // 'outstanding' | 'closing'
  const [clients, setClients] = useState([])
  const [commissionRecords, setCommissionRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [exchangeRates, setExchangeRates] = useState(FALLBACK_RATES)
  const [page, setPage] = useState(1)

  const [closingSearch, setClosingSearch] = useState('')
  const [closingStatusFilter, setClosingStatusFilter] = useState('all') // 'all' | 'closed' | 'remaining'
  const [closingMonthFilter, setClosingMonthFilter] = useState('all') // 'all' | 'YYYY-M'
  const [closingPage, setClosingPage] = useState(1)
  const [closingDetailRow, setClosingDetailRow] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [clientRes, commRes, ratesRes] = await Promise.all([
        supabase.from('clients').select('*, transactions(*)').order('full_name'),
        supabase.from('commission_records').select('id, client_id, total_earning, commission_amount, commission_rate, currency_breakdown, status, created_at, employees(name)'),
        fetch('https://api.frankfurter.app/latest?from=USD&to=IDR,HKD').then(r => r.json()).catch(() => null),
      ])
      if (clientRes.error) throw clientRes.error
      if (commRes.error) throw commRes.error
      setClients(clientRes.data || [])
      setCommissionRecords(commRes.data || [])
      setExchangeRates({ ...FALLBACK_RATES, ...(ratesRes?.rates || {}) })
    } catch (err) {
      toast.error('Failed to load aging summary')
    } finally {
      setLoading(false)
    }
  }

  // ── Payment already shared/paid so far, by client + currency ──
  const paymentByClient = useMemo(() => {
    const map = {}
    for (const r of commissionRecords) {
      if (!map[r.client_id]) map[r.client_id] = {}
      if (r.currency_breakdown) {
        for (const [cur, vals] of Object.entries(r.currency_breakdown)) {
          map[r.client_id][cur] = (map[r.client_id][cur] || 0) + Number(vals?.net || 0)
        }
      } else {
        // legacy record with no per-currency breakdown: treat as USDT
        map[r.client_id].USDT = (map[r.client_id].USDT || 0) + Number(r.total_earning || 0)
      }
    }
    return map
  }, [commissionRecords])

  const toUSD = (amount, cur) => {
    if (cur === 'USDT') return amount
    const r = exchangeRates?.[cur]
    return r ? amount / r : 0
  }

  const totalBalanceByCurrency = (client) => {
    const allTxns = client.transactions || []
    const totalBalance = {}
    for (const cur of CURRENCIES) {
      const ct = allTxns.filter(t => (t.currency || 'USDT') === cur)
      const topups = ct.filter(t => t.type === 'topup').reduce((s, t) => s + Number(t.amount), 0)
      const withdrawals = ct.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0)
      const fees = ct.reduce((s, t) => s + Number(t.bank_fee_amount || 0), 0)
      totalBalance[cur] = topups - withdrawals - fees
    }
    return totalBalance
  }

  // ── Total Balance - Payment = Outstanding Balance, per client ──
  const outstandingClients = useMemo(() => {
    return clients.map(c => {
      const totalBalance = totalBalanceByCurrency(c)
      const payment = paymentByClient[c.id] || {}
      const outstanding = {}
      for (const cur of CURRENCIES) outstanding[cur] = totalBalance[cur] - (payment[cur] || 0)

      const hasOutstanding = CURRENCIES.some(cur => Math.abs(outstanding[cur]) > EPSILON)
      if (!hasOutstanding) return null

      const toUSDSum = (obj) => CURRENCIES.reduce((s, cur) => s + toUSD(obj[cur] || 0, cur), 0)

      return {
        ...c,
        totalBalance,
        payment,
        outstanding,
        balanceUSD: toUSDSum(totalBalance),
        paymentUSD: toUSDSum(payment),
        outstandingUSD: toUSDSum(outstanding),
      }
    }).filter(Boolean)
  }, [clients, paymentByClient, exchangeRates])

  const totalPaidUSDAllClients = useMemo(() => {
    let sum = 0
    for (const c of clients) {
      const payment = paymentByClient[c.id] || {}
      for (const cur of CURRENCIES) sum += toUSD(payment[cur] || 0, cur)
    }
    return sum
  }, [clients, paymentByClient, exchangeRates])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const base = !q ? outstandingClients : outstandingClients.filter(c =>
      c.full_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.user_id?.toLowerCase().includes(q)
    )
    return [...base].sort((a, b) => Math.abs(b.outstandingUSD) - Math.abs(a.outstandingUSD))
  }, [outstandingClients, search])

  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(() =>
    filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  )

  useEffect(() => { setPage(1) }, [search])

  const totalOutstandingUSD = outstandingClients.reduce((s, c) => s + c.outstandingUSD, 0)

  // ── Closing Report: per-client rollup of commission records ──
  const closingAggregates = useMemo(() => {
    const map = {}
    for (const r of commissionRecords) {
      if (!r.client_id) continue
      if (!map[r.client_id]) map[r.client_id] = { totalEarning: 0, commissionAmount: 0, lastActivity: null }
      map[r.client_id].totalEarning += Number(r.total_earning || 0)
      map[r.client_id].commissionAmount += Number(r.commission_amount || 0)
      if (r.created_at) {
        const d = new Date(r.created_at)
        if (!map[r.client_id].lastActivity || d > map[r.client_id].lastActivity) {
          map[r.client_id].lastActivity = d
        }
      }
    }
    return map
  }, [commissionRecords])

  const closingRows = useMemo(() => {
    return Object.entries(closingAggregates).map(([clientId, agg]) => {
      const client = clients.find(c => c.id === clientId)
      if (!client) return null
      const totalBalance = totalBalanceByCurrency(client)
      const payment = paymentByClient[clientId] || {}
      const outstanding = {}
      for (const cur of CURRENCIES) outstanding[cur] = totalBalance[cur] - (payment[cur] || 0)
      const isClosed = CURRENCIES.every(cur => Math.abs(outstanding[cur]) <= EPSILON)

      return {
        id: clientId,
        full_name: client.full_name,
        user_id: client.user_id,
        email: client.email,
        profile_pic_url: client.profile_pic_url,
        totalEarning: agg.totalEarning,
        commissionAmount: agg.commissionAmount,
        lastActivity: agg.lastActivity,
        outstanding,
        isClosed,
      }
    }).filter(Boolean)
  }, [closingAggregates, clients, paymentByClient])

  // ── Months that actually have closing activity, newest first ──
  const closingMonthOptions = useMemo(() => {
    const seen = new Map()
    for (const row of closingRows) {
      if (!row.lastActivity) continue
      const key = `${row.lastActivity.getFullYear()}-${row.lastActivity.getMonth()}`
      if (!seen.has(key)) {
        seen.set(key, {
          key,
          label: row.lastActivity.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          year: row.lastActivity.getFullYear(),
          month: row.lastActivity.getMonth(),
        })
      }
    }
    return Array.from(seen.values()).sort((a, b) => (b.year - a.year) || (b.month - a.month))
  }, [closingRows])

  const filteredClosingRows = useMemo(() => {
    let list = closingRows
    if (closingStatusFilter === 'closed') list = list.filter(c => c.isClosed)
    if (closingStatusFilter === 'remaining') list = list.filter(c => !c.isClosed)
    if (closingMonthFilter !== 'all') {
      const [y, m] = closingMonthFilter.split('-').map(Number)
      list = list.filter(c => c.lastActivity && c.lastActivity.getFullYear() === y && c.lastActivity.getMonth() === m)
    }
    if (closingSearch.trim()) {
      const q = closingSearch.toLowerCase()
      list = list.filter(c =>
        c.full_name?.toLowerCase().includes(q) ||
        c.user_id?.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => (b.lastActivity?.getTime() || 0) - (a.lastActivity?.getTime() || 0))
  }, [closingRows, closingStatusFilter, closingMonthFilter, closingSearch])

  const CLOSING_PAGE_SIZE = 10
  const closingTotalPages = Math.max(1, Math.ceil(filteredClosingRows.length / CLOSING_PAGE_SIZE))
  const closingCurrentPage = Math.min(closingPage, closingTotalPages)
  const paginatedClosingRows = useMemo(() =>
    filteredClosingRows.slice((closingCurrentPage - 1) * CLOSING_PAGE_SIZE, closingCurrentPage * CLOSING_PAGE_SIZE),
    [filteredClosingRows, closingCurrentPage]
  )

  useEffect(() => { setClosingPage(1) }, [closingStatusFilter, closingMonthFilter, closingSearch])

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Aging Summary</h1>
          <p className="text-sm text-gray-400 mt-0.5">Total balance minus commission already shared = outstanding balance</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
          <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-rose-500 to-rose-700 shadow-sm">
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute -right-1 -top-8 w-16 h-16 rounded-full bg-white/10" />
            <div className="relative w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center mb-5">
              <AlertTriangle size={20} className="text-white" />
            </div>
            <p className="relative text-[11px] font-semibold text-white/70 uppercase tracking-widest mb-1">Clients Outstanding</p>
            <p className="relative text-2xl font-black text-white">{loading ? '—' : outstandingClients.length}</p>
          </div>

          <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute -right-1 -top-8 w-16 h-16 rounded-full bg-white/10" />
            <div className="relative w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center mb-5">
              <Scale size={20} className="text-white" />
            </div>
            <p className="relative text-[11px] font-semibold text-white/70 uppercase tracking-widest mb-1">Outstanding Amount</p>
            <p className="relative text-2xl font-black text-white">{loading ? '—' : fmtUSD(totalOutstandingUSD)}</p>
          </div>

          <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute -right-1 -top-8 w-16 h-16 rounded-full bg-white/10" />
            <div className="relative w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center mb-5">
              <CheckCircle2 size={20} className="text-white" />
            </div>
            <p className="relative text-[11px] font-semibold text-white/70 uppercase tracking-widest mb-1">Already Shared</p>
            <p className="relative text-2xl font-black text-white">{loading ? '—' : fmtUSD(totalPaidUSDAllClients)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
          {[
            { key: 'outstanding', label: 'Outstanding Balance', icon: AlertTriangle },
            { key: 'closing', label: 'Closing Report', icon: CheckCircle2 },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ── Outstanding Balance Tab ── */}
        {tab === 'outstanding' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-bold text-gray-900">Outstanding Balances</h2>
                {!loading && (
                  <span className="text-xs bg-rose-50 text-rose-600 font-bold px-2 py-0.5 rounded-full">
                    {filtered.length}
                  </span>
                )}
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, email, ID..."
                  className="pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-64 transition-all"
                />
              </div>
            </div>

            {loading ? (
              <div className="divide-y divide-gray-50">{[...Array(6)].map((_, i) => <RowSkeleton key={i} />)}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
                  <Inbox size={28} className="text-emerald-300" />
                </div>
                <h3 className="text-sm font-bold text-gray-700 mb-1">
                  {outstandingClients.length === 0 ? 'All caught up' : 'No results'}
                </h3>
                <p className="text-xs text-gray-400">
                  {outstandingClients.length === 0 ? 'Every client\'s balance has been fully covered by shared commission.' : `No clients match "${search}"`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Client</th>
                      <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hidden sm:table-cell">Contact</th>
                      <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hidden md:table-cell">User ID</th>
                      <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Total Balance</th>
                      <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Payment</th>
                      <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Outstanding Balance</th>
                      <th className="px-4 py-3 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((client, i) => (
                      <tr key={client.id}
                        className={`border-b border-gray-50 hover:bg-indigo-50/30 transition-colors group ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                        <td className="px-6 py-4">
                          <Link to={`/clients/${client.id}`} className="flex items-center gap-3">
                            <Avatar client={client} />
                            <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{client.full_name}</p>
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
                        <td className="px-4 py-4">
                          <CurrencyChips values={client.totalBalance} tone="bg-gray-100 text-gray-700" />
                        </td>
                        <td className="px-4 py-4">
                          <CurrencyChips values={client.payment} tone="bg-blue-50 text-blue-700" />
                        </td>
                        <td className="px-4 py-4">
                          <CurrencyChips values={client.outstanding} tone="bg-emerald-50 text-emerald-700" />
                          <p className={`text-xs font-black text-right mt-1 tabular-nums ${client.outstandingUSD >= 0 ? 'text-gray-900' : 'text-rose-500'}`}>
                            ≈ {fmtUSD(client.outstandingUSD)}
                          </p>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Link to="/commission"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors">
                            Share <ChevronRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && filtered.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Showing <span className="font-semibold text-gray-600">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)}</span> of <span className="font-semibold text-gray-600">{filtered.length}</span>
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold transition-colors ${
                        n === currentPage ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Closing Report Tab ── */}
        {tab === 'closing' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-48">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={14} /></div>
                <input
                  type="text"
                  value={closingSearch}
                  onChange={e => setClosingSearch(e.target.value)}
                  placeholder="Search client…"
                  className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'closed', label: 'Closed' },
                  { key: 'remaining', label: 'Remaining' },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setClosingStatusFilter(key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      closingStatusFilter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"><Filter size={12} /></div>
                <select
                  value={closingMonthFilter}
                  onChange={e => setClosingMonthFilter(e.target.value)}
                  className="pl-7 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:outline-none focus:border-indigo-400 appearance-none cursor-pointer">
                  <option value="all">All Months</option>
                  {closingMonthOptions.map(m => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><ChevronDown size={12} /></div>
              </div>
              <p className="text-xs text-gray-400 ml-auto">{filteredClosingRows.length} client{filteredClosingRows.length !== 1 ? 's' : ''}</p>
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
                  </div>
                ))}
              </div>
            ) : filteredClosingRows.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={22} className="text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-500">
                  {closingRows.length === 0 ? 'No commission records yet' : 'No clients match your filters'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Client</th>
                      <th className="px-6 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Earning</th>
                      <th className="px-6 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Commission</th>
                      <th className="px-6 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Remaining Balance</th>
                      <th className="px-6 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Last Activity</th>
                      <th className="px-6 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginatedClosingRows.map(row => (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <button onClick={() => setClosingDetailRow(row)} className="flex items-center gap-2.5 group">
                            <Avatar client={row} size="sm" />
                            <div className="text-left">
                              <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{row.full_name}</p>
                              {row.user_id && <p className="text-xs text-gray-400 font-mono">{row.user_id}</p>}
                            </div>
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-semibold text-gray-900">${fmt(row.totalEarning)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-black text-emerald-700">${fmt(row.commissionAmount)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => setClosingDetailRow(row)} className="w-full">
                            {CURRENCIES.filter(cur => Math.abs(row.outstanding[cur]) > EPSILON).length === 0 ? (
                              <span className="text-xs text-gray-300 hover:text-indigo-500 transition-colors">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1 justify-end">
                                {CURRENCIES.filter(cur => Math.abs(row.outstanding[cur]) > EPSILON).map(cur => (
                                  <span key={cur} className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg tabular-nums hover:ring-2 hover:ring-indigo-200 transition-all ${
                                    row.outstanding[cur] >= 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600'
                                  }`}>
                                    {cur === 'USDT' && <UsdtIcon size={11} />}
                                    {fmtAmount(row.outstanding[cur], cur)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {(() => {
                            const dt = fmtDateTime(row.lastActivity)
                            return dt === '—' ? (
                              <span className="text-xs text-gray-300">—</span>
                            ) : (
                              <>
                                <p className="text-xs font-semibold text-gray-700">{dt.date}</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">{dt.time}</p>
                              </>
                            )
                          })()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {row.isClosed ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                              <CheckCircle2 size={11} /> Closed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                              <Clock size={11} /> Remaining
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && filteredClosingRows.length > 0 && closingTotalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Showing <span className="font-semibold text-gray-600">{(closingCurrentPage - 1) * CLOSING_PAGE_SIZE + 1}–{Math.min(closingCurrentPage * CLOSING_PAGE_SIZE, filteredClosingRows.length)}</span> of <span className="font-semibold text-gray-600">{filteredClosingRows.length}</span>
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setClosingPage(p => Math.max(1, p - 1))}
                    disabled={closingCurrentPage === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: closingTotalPages }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => setClosingPage(n)}
                      className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold transition-colors ${
                        n === closingCurrentPage ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setClosingPage(p => Math.min(closingTotalPages, p + 1))}
                    disabled={closingCurrentPage === closingTotalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {closingDetailRow && (
        <ClientClosingModal
          row={closingDetailRow}
          records={commissionRecords.filter(r => r.client_id === closingDetailRow.id)}
          onClose={() => setClosingDetailRow(null)}
        />
      )}
    </div>
  )
}
