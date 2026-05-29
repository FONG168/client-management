import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Users, DollarSign, Plus, Search, Percent, CheckCircle2, Clock,
  Trash2, X, ChevronDown, CalendarDays, TrendingUp, Banknote,
  UserCheck, Filter, Edit2, Save, AlertCircle, Receipt, Upload,
  FileText, Eye, ImageIcon, Printer
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import UsdtIcon from '../components/UsdtIcon'

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

function fmtCurr(amount, currency) {
  const n = Number(amount) || 0
  switch (currency) {
    case 'IDR': return `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(n))}`
    case 'VND': return `₫${new Intl.NumberFormat('vi-VN').format(Math.round(n))}`
    case 'HKD': return `HK$${n.toFixed(2)}`
    default:    return `$${n.toFixed(2)}`
  }
}

const CURRENCY_COLORS = {
  USDT: { bg: 'bg-blue-50',    label: 'text-blue-400',    value: 'text-blue-700'    },
  IDR:  { bg: 'bg-orange-50',  label: 'text-orange-400',  value: 'text-orange-700'  },
  VND:  { bg: 'bg-violet-50',  label: 'text-violet-400',  value: 'text-violet-700'  },
  HKD:  { bg: 'bg-teal-50',    label: 'text-teal-400',    value: 'text-teal-700'    },
}

const inputCls = "w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
const inputClsNoIcon = "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"

// ─── Add Employee Modal ──────────────────────────────────────────────────────

function AddEmployeeModal({ onClose, onSaved, editEmployee }) {
  const [name, setName] = useState(editEmployee?.name || '')
  const [rate, setRate] = useState(editEmployee?.commission_rate != null ? String(editEmployee.commission_rate) : '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Name is required')
    const r = parseFloat(rate)
    if (isNaN(r) || r < 0 || r > 100) return toast.error('Commission rate must be 0 – 100')

    setSaving(true)
    try {
      if (editEmployee) {
        const { error } = await supabase
          .from('employees')
          .update({ name: name.trim(), commission_rate: r })
          .eq('id', editEmployee.id)
        if (error) throw error
        toast.success('Employee updated')
      } else {
        const { error } = await supabase
          .from('employees')
          .insert({ name: name.trim(), commission_rate: r })
        if (error) throw error
        toast.success('Employee added')
      }
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Failed to save employee')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <UserCheck size={18} className="text-indigo-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900">
              {editEmployee ? 'Edit Employee' : 'Add New Employee'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Employee Name <span className="text-rose-400">*</span></label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><Users size={15} /></div>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Full name"
                className={inputCls}
                autoFocus
              />
            </div>
          </div>

          {/* Commission Rate */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Commission Rate (%) <span className="text-rose-400">*</span></label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><Percent size={15} /></div>
              <input
                type="number"
                value={rate}
                onChange={e => setRate(e.target.value)}
                placeholder="e.g. 10"
                min="0"
                max="100"
                step="0.01"
                className={inputCls}
              />
            </div>
            <p className="text-xs text-gray-400 pl-1">Enter a value between 0 and 100</p>
          </div>

          {/* Preview */}
          {name && rate && !isNaN(parseFloat(rate)) && (
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3">
              <InitialAvatar name={name} />
              <div>
                <p className="text-sm font-bold text-gray-900">{name}</p>
                <p className="text-xs text-indigo-600 font-semibold">{parseFloat(rate)}% commission</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {saving ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</> : <><Save size={15} />{editEmployee ? 'Save Changes' : 'Add Employee'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Add Commission Modal ────────────────────────────────────────────────────

function AddCommissionModal({ onClose, onSaved, employees, clients }) {
  const [employeeId, setEmployeeId] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [totalEarning, setTotalEarning] = useState('')
  const [status, setStatus] = useState('unpaid')
  const [paymentDate, setPaymentDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingEarning, setLoadingEarning] = useState(false)
  const [clientUsdtBreakdown, setClientUsdtBreakdown] = useState(null)
  const [manualRates, setManualRates] = useState({ IDR: '', VND: '', HKD: '' })
  const [autoUsdtByTxnRate, setAutoUsdtByTxnRate] = useState({})
  const [bankFeeType, setBankFeeType] = useState('percent')
  const [bankFeeValue, setBankFeeValue] = useState('')

  const empRef = useRef(null)
  const cliRef = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (empRef.current && !empRef.current.contains(e.target)) setShowEmployeeDropdown(false)
      if (cliRef.current && !cliRef.current.contains(e.target)) setShowClientDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Fetch client transactions + pre-fill rate inputs from API as editable defaults
  useEffect(() => {
    if (!clientId) {
      setTotalEarning('')
      setClientUsdtBreakdown(null)
      setManualRates({ IDR: '', VND: '', HKD: '' })
      setAutoUsdtByTxnRate({})
      return
    }
    async function fetchClientData() {
      setLoadingEarning(true)
      try {
        const [txnRes, ratesData] = await Promise.all([
          supabase.from('transactions').select('type, currency, amount, bank_fee_amount, exchange_rate').eq('client_id', clientId),
          fetch('https://api.frankfurter.app/latest?from=USD&to=IDR,HKD')
            .then(r => r.json()).catch(() => null)
        ])
        if (txnRes.error) throw txnRes.error

        const txns = txnRes.data || []

        // Build breakdown (gross amounts + fees per currency)
        const byCurrency = {}
        for (const t of txns) {
          if (!byCurrency[t.currency]) byCurrency[t.currency] = { topups: 0, withdrawals: 0, totalFees: 0 }
          if (t.type === 'topup') byCurrency[t.currency].topups += Number(t.amount)
          else byCurrency[t.currency].withdrawals += Number(t.amount)
          byCurrency[t.currency].totalFees += Number(t.bank_fee_amount || 0)
        }
        for (const cur of Object.keys(byCurrency)) {
          byCurrency[cur].net = byCurrency[cur].topups - byCurrency[cur].withdrawals - byCurrency[cur].totalFees
        }
        setClientUsdtBreakdown(Object.keys(byCurrency).length > 0 ? byCurrency : null)

        // Per-transaction USDT: each transaction uses its own stored exchange_rate
        const autoUsdt = {}
        for (const cur of Object.keys(byCurrency)) {
          const curTxns = txns.filter(t => t.currency === cur)
          if (cur === 'USDT') {
            autoUsdt[cur] = byCurrency[cur].net
          } else {
            const allHaveRate = curTxns.every(t => Number(t.exchange_rate) > 0)
            if (allHaveRate) {
              autoUsdt[cur] = curTxns.reduce((sum, t) => {
                const fee = Number(t.bank_fee_amount || 0)
                const net = t.type === 'topup'
                  ? Number(t.amount) - fee
                  : -(Number(t.amount) + fee)
                return sum + net / Number(t.exchange_rate)
              }, 0)
            } else {
              autoUsdt[cur] = null
            }
          }
        }
        setAutoUsdtByTxnRate(autoUsdt)

        // Pre-fill rate inputs from API only for currencies without stored rates
        setManualRates({
          IDR: ratesData?.rates?.IDR ? String(ratesData.rates.IDR.toFixed(2)) : '',
          VND: '',
          HKD: ratesData?.rates?.HKD ? String(ratesData.rates.HKD.toFixed(2)) : '',
        })
      } catch (err) {
        toast.error('Could not load client data')
      } finally {
        setLoadingEarning(false)
      }
    }
    fetchClientData()
  }, [clientId])

  // Reactively recalculate USDT total whenever rates or breakdown changes
  useEffect(() => {
    if (!clientUsdtBreakdown) return
    let total = 0
    for (const [cur, vals] of Object.entries(clientUsdtBreakdown)) {
      const auto = autoUsdtByTxnRate[cur]
      if (auto !== null && auto !== undefined) {
        total += auto
      } else if (cur === 'USDT') {
        total += vals.net
      } else {
        const r = parseFloat(manualRates[cur])
        if (r > 0) total += vals.net / r
      }
    }
    setTotalEarning(total > 0 ? String(total.toFixed(2)) : '')
  }, [clientUsdtBreakdown, manualRates, autoUsdtByTxnRate])

  const selectedEmployee = employees.find(e => e.id === employeeId)
  const selectedClient = clients.find(c => c.id === clientId)

  const earning = parseFloat(totalEarning) || 0
  const rate = selectedEmployee?.commission_rate || 0
  const hasForeignCurrency = clientUsdtBreakdown &&
    Object.keys(clientUsdtBreakdown).some(cur => cur !== 'USDT')

  const feeVal = parseFloat(bankFeeValue) || 0
  const bankFeeAmount = feeVal > 0
    ? (bankFeeType === 'percent' ? earning * (feeVal / 100) : feeVal)
    : 0
  const earningAfterFee = Math.max(0, earning - bankFeeAmount)
  const commissionAmount = earningAfterFee * (rate / 100)

  const filteredEmployees = useMemo(() =>
    employees.filter(e => e.name.toLowerCase().includes(employeeSearch.toLowerCase())),
    [employees, employeeSearch])

  const filteredClients = useMemo(() =>
    clients.filter(c =>
      c.full_name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.user_id?.toLowerCase().includes(clientSearch.toLowerCase())
    ),
    [clients, clientSearch])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!employeeId) return toast.error('Select an employee')
    if (!clientId) return toast.error('Select a client (earn from)')
    if (!earning || earning <= 0) return toast.error('Enter a valid total earning')
    if (status === 'paid' && !paymentDate) return toast.error('Select a payment date for paid commission')

    const currencyBreakdown = clientUsdtBreakdown
      ? Object.fromEntries(
          Object.entries(clientUsdtBreakdown).map(([cur, vals]) => {
            const auto = autoUsdtByTxnRate[cur]
            const usdt = auto !== null && auto !== undefined
              ? auto
              : (cur === 'USDT' ? vals.net : (parseFloat(manualRates[cur]) > 0 ? vals.net / parseFloat(manualRates[cur]) : 0))
            const r = cur === 'USDT' ? null : (parseFloat(manualRates[cur]) || null)
            return [cur, { net: vals.net, rate: r, usdt: parseFloat(usdt.toFixed(4)) }]
          })
        )
      : null

    setSaving(true)
    try {
      const { error } = await supabase.from('commission_records').insert({
        employee_id: employeeId,
        client_id: clientId,
        total_earning: earning,
        bank_fee_type: bankFeeAmount > 0 ? bankFeeType : null,
        bank_fee_value: bankFeeAmount > 0 ? feeVal : null,
        bank_fee_amount: bankFeeAmount > 0 ? bankFeeAmount : null,
        commission_rate: rate,
        commission_amount: commissionAmount,
        status,
        payment_date: paymentDate || null,
        notes: notes.trim() || null,
        currency_breakdown: currencyBreakdown,
      })
      if (error) throw error
      toast.success('Commission record saved')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Failed to save commission')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <DollarSign size={18} className="text-emerald-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Share Commission</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Select Employee */}
          <div className="space-y-1.5" ref={empRef}>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Employee <span className="text-rose-400">*</span></label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 z-10"><UserCheck size={15} /></div>
              <input
                type="text"
                value={selectedEmployee ? selectedEmployee.name : employeeSearch}
                onChange={e => { setEmployeeSearch(e.target.value); setEmployeeId(''); setShowEmployeeDropdown(true) }}
                onFocus={() => setShowEmployeeDropdown(true)}
                placeholder="Search by name or ID…"
                className={inputCls}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"><ChevronDown size={15} /></div>
              {showEmployeeDropdown && filteredEmployees.length > 0 && (
                <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredEmployees.map(emp => (
                    <button key={emp.id} type="button"
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left"
                      onClick={() => { setEmployeeId(emp.id); setEmployeeSearch(''); setShowEmployeeDropdown(false) }}>
                      <InitialAvatar name={emp.name} size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{emp.name}</p>
                        <p className="text-xs text-indigo-600 font-medium">{emp.commission_rate}% commission</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showEmployeeDropdown && filteredEmployees.length === 0 && (
                <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-center text-sm text-gray-400">
                  No employees found
                </div>
              )}
            </div>
            {selectedEmployee && (
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg">
                <InitialAvatar name={selectedEmployee.name} size="sm" />
                <span className="text-sm font-semibold text-gray-800">{selectedEmployee.name}</span>
                <span className="ml-auto text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">{selectedEmployee.commission_rate}%</span>
                <button type="button" onClick={() => { setEmployeeId(''); setEmployeeSearch('') }} className="text-gray-400 hover:text-gray-600 ml-1"><X size={13} /></button>
              </div>
            )}
          </div>

          {/* Earn From (Client) */}
          <div className="space-y-1.5" ref={cliRef}>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Earn From (Client) <span className="text-rose-400">*</span></label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 z-10"><Users size={15} /></div>
              <input
                type="text"
                value={selectedClient ? `${selectedClient.full_name}${selectedClient.user_id ? ` · ${selectedClient.user_id}` : ''}` : clientSearch}
                onChange={e => { setClientSearch(e.target.value); setClientId(''); setShowClientDropdown(true) }}
                onFocus={() => setShowClientDropdown(true)}
                placeholder="Search by name or user ID…"
                className={inputCls}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"><ChevronDown size={15} /></div>
              {showClientDropdown && filteredClients.length > 0 && (
                <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredClients.map(cl => (
                    <button key={cl.id} type="button"
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left"
                      onClick={() => { setClientId(cl.id); setClientSearch(''); setShowClientDropdown(false) }}>
                      <div className={`w-8 h-8 rounded-full shrink-0 overflow-hidden ${!cl.profile_pic_url ? `${getAvatarColor(cl.full_name || '')} flex items-center justify-center` : ''}`}>
                        {cl.profile_pic_url
                          ? <img src={cl.profile_pic_url} alt="" className="w-full h-full object-cover" />
                          : <span className="text-white font-bold text-sm">{cl.full_name?.charAt(0).toUpperCase()}</span>}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{cl.full_name}</p>
                        {cl.user_id && <p className="text-xs text-gray-400 font-mono">{cl.user_id}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showClientDropdown && filteredClients.length === 0 && (
                <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-center text-sm text-gray-400">
                  No clients found
                </div>
              )}
            </div>
            {selectedClient && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <div className={`w-7 h-7 rounded-full shrink-0 overflow-hidden ${!selectedClient.profile_pic_url ? `${getAvatarColor(selectedClient.full_name || '')} flex items-center justify-center` : ''}`}>
                  {selectedClient.profile_pic_url
                    ? <img src={selectedClient.profile_pic_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-white font-bold text-xs">{selectedClient.full_name?.charAt(0).toUpperCase()}</span>}
                </div>
                <span className="text-sm font-semibold text-gray-800">{selectedClient.full_name}</span>
                {selectedClient.user_id && <span className="text-xs text-gray-400 font-mono">{selectedClient.user_id}</span>}
                <button type="button" onClick={() => { setClientId(''); setClientSearch(''); setTotalEarning(''); setClientUsdtBreakdown(null); setManualRates({ IDR: '', VND: '', HKD: '' }) }} className="text-gray-400 hover:text-gray-600 ml-auto"><X size={13} /></button>
              </div>
            )}
          </div>

          {/* Total Earning */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Earning (USDT) <span className="text-rose-400">*</span></label>
              {loadingEarning && (
                <span className="flex items-center gap-1 text-[11px] text-indigo-500 font-semibold">
                  <div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                  Loading from client…
                </span>
              )}
              {!loadingEarning && clientUsdtBreakdown && (
                <span className="text-[11px] text-indigo-500 font-semibold">Auto-calculated · rates editable below</span>
              )}
            </div>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><DollarSign size={15} /></div>
              <input
                type="number"
                value={totalEarning}
                onChange={e => setTotalEarning(e.target.value)}
                placeholder={loadingEarning ? 'Loading…' : '0.00'}
                disabled={loadingEarning}
                min="0"
                step="0.01"
                className={`${inputCls} ${loadingEarning ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
            {!loadingEarning && clientUsdtBreakdown && (
              <div className="space-y-2 px-1">
                {Object.entries(clientUsdtBreakdown).map(([cur, vals]) => {
                  const c = CURRENCY_COLORS[cur] || { bg: 'bg-gray-50', label: 'text-gray-400', value: 'text-gray-700' }
                  const auto = autoUsdtByTxnRate[cur]
                  const manualRate = parseFloat(manualRates[cur])
                  const netUsdt = auto !== null && auto !== undefined
                    ? auto
                    : (cur === 'USDT' ? vals.net : (manualRate > 0 ? vals.net / manualRate : null))
                  return (
                    <div key={cur} className={`p-3 ${c.bg} rounded-xl space-y-2`}>
                      {/* Row 1: currency + top-ups / withdrawals / net */}
                      <div className="grid grid-cols-4 gap-1 items-center">
                        {cur === 'USDT'
                          ? <span className={`inline-flex items-center gap-1 text-xs font-black ${c.value}`}><UsdtIcon size={14} /> USDT</span>
                          : <span className={`text-xs font-black ${c.value}`}>{cur}</span>
                        }
                        <div className="text-center">
                          <p className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Top-ups</p>
                          <p className={`text-xs font-semibold ${c.value}`}>{fmtCurr(vals.topups, cur)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Withdrawals</p>
                          <p className="text-xs font-semibold text-rose-600">{fmtCurr(vals.withdrawals, cur)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Net</p>
                          <p className={`text-xs font-bold ${vals.net >= 0 ? 'text-gray-800' : 'text-rose-700'}`}>{fmtCurr(vals.net, cur)}</p>
                        </div>
                      </div>
                      {/* Row 2: per-transaction rate or manual fallback (non-USDT only) */}
                      {cur !== 'USDT' && (
                        auto !== null && auto !== undefined ? (
                          <div className="flex items-center justify-between pt-1 border-t border-black/5">
                            <span className="text-[10px] text-gray-400 font-semibold">Per-transaction rate</span>
                            <span className={`text-xs font-black ${auto >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>≈ ${fmt(auto)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 pt-1 border-t border-black/5">
                            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 font-semibold shrink-0">1 <UsdtIcon size={12} /> =</span>
                            <input
                              type="number"
                              value={manualRates[cur]}
                              onChange={e => setManualRates(prev => ({ ...prev, [cur]: e.target.value }))}
                              placeholder="Enter rate…"
                              min="0"
                              step="any"
                              className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 placeholder-gray-300 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                            />
                            <span className="text-[11px] text-gray-500 font-semibold shrink-0">{cur}</span>
                            <div className="text-right shrink-0 min-w-[70px]">
                              {netUsdt != null
                                ? <span className={`text-xs font-black ${netUsdt >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>≈ ${fmt(netUsdt)}</span>
                                : <span className="text-xs text-gray-300 italic">—</span>
                              }
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )
                })}
                {/* Total row */}
                <div className="flex items-center justify-between px-3 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <p className="text-xs font-bold text-indigo-800">Total converted to USDT</p>
                  <span className="text-base font-black text-indigo-700">${fmt(parseFloat(totalEarning) || 0)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Bank Fee Deduction */}
          {earning > 0 && hasForeignCurrency && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Bank Fee Deduction</p>
                <span className="text-[10px] text-amber-500 font-semibold">IDR / VND / HKD conversion fee</span>
              </div>
              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-amber-100/60 rounded-xl">
                <button type="button" onClick={() => setBankFeeType('percent')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${bankFeeType === 'percent' ? 'bg-white text-amber-700 shadow-sm' : 'text-amber-600 hover:text-amber-800'}`}>
                  % Percentage
                </button>
                <button type="button" onClick={() => setBankFeeType('fixed')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${bankFeeType === 'fixed' ? 'bg-white text-amber-700 shadow-sm' : 'text-amber-600 hover:text-amber-800'}`}>
                  $ Fixed (USDT)
                </button>
              </div>
              {/* Fee input */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-500">
                    {bankFeeType === 'percent' ? '%' : '$'}
                  </span>
                  <input
                    type="number"
                    value={bankFeeValue}
                    onChange={e => setBankFeeValue(e.target.value)}
                    placeholder={bankFeeType === 'percent' ? 'e.g. 2.5' : 'e.g. 10.00'}
                    min="0"
                    step="any"
                    className="w-full pl-7 pr-4 py-2.5 bg-white border border-amber-200 rounded-xl text-sm font-semibold text-gray-800 placeholder-gray-300 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                  />
                </div>
                {bankFeeAmount > 0 && (
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-amber-500 font-bold uppercase">Fee</p>
                    <p className="text-sm font-black text-rose-600">−${fmt(bankFeeAmount)}</p>
                  </div>
                )}
              </div>
              {/* Net after fee */}
              {bankFeeAmount > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-white border border-amber-200 rounded-xl">
                  <p className="text-xs font-bold text-amber-800">Net after bank fee</p>
                  <span className="text-sm font-black text-amber-700">${fmt(earningAfterFee)}</span>
                </div>
              )}
            </div>
          )}

          {/* Commission Calculation */}
          {earning > 0 && selectedEmployee && (
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl space-y-2">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Commission Calculation</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Total Earning</span>
                  <span className="font-semibold">${fmt(earning)}</span>
                </div>
                {bankFeeAmount > 0 && (
                  <>
                    <div className="flex justify-between text-rose-500">
                      <span>Bank Fee {bankFeeType === 'percent' ? `(${feeVal}%)` : '(Fixed)'}</span>
                      <span className="font-semibold">−${fmt(bankFeeAmount)}</span>
                    </div>
                    <div className="flex justify-between text-gray-700 font-semibold border-t border-emerald-100 pt-1.5">
                      <span>Net After Fee</span>
                      <span>${fmt(earningAfterFee)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Commission Rate ({selectedEmployee.name})</span>
                  <span className="font-semibold">{rate}%</span>
                </div>
                <div className="border-t border-emerald-200 pt-1.5 flex justify-between">
                  <span className="font-bold text-emerald-800">Commission Earned</span>
                  <span className="font-black text-emerald-700 text-base">${fmt(commissionAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Payment Status <span className="text-rose-400">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button"
                onClick={() => setStatus('unpaid')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                  status === 'unpaid'
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                }`}>
                <Clock size={15} /> Unpaid
              </button>
              <button type="button"
                onClick={() => setStatus('paid')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                  status === 'paid'
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                }`}>
                <CheckCircle2 size={15} /> Paid
              </button>
            </div>
          </div>

          {/* Payment Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Payment Date {status === 'paid' && <span className="text-rose-400">*</span>}
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><CalendarDays size={15} /></div>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional notes…"
              rows={2}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {saving ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</> : <><Save size={15} />Save Commission</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Commission Statement Modal ──────────────────────────────────────────────

function CommissionStatementModal({ record, onClose }) {
  const printRef = useRef(null)

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const now = new Date()
  const generatedAt = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const createdDate = record.created_at
    ? new Date(record.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  function handlePrint() {
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>Commission Statement</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#111;background:#fff;padding:48px 56px}
      .doc-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;margin-bottom:24px;border-bottom:2px solid #111}
      .org{font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#059669;margin-bottom:6px}
      .title{font-size:24px;font-weight:900;color:#111;letter-spacing:-.02em}
      .meta-right{text-align:right;font-size:11px;color:#555;line-height:1.9}
      .meta-right strong{color:#111;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.1em}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
      .info-block{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px}
      .info-block .block-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:#9ca3af;margin-bottom:8px}
      .info-block .val-name{font-size:15px;font-weight:800;color:#111;margin-bottom:3px}
      .info-block .val-sub{font-size:11px;color:#555;margin-bottom:2px}
      .section-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:#9ca3af;margin-bottom:8px}
      .calc-table{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:20px}
      .calc-table th{background:#f9fafb;padding:9px 16px;text-align:left;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;border-bottom:1px solid #e5e7eb}
      .calc-table th:last-child{text-align:right}
      .calc-table td{padding:11px 16px;border-bottom:1px solid #f3f4f6;font-size:12px}
      .calc-table td:last-child{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
      .calc-table tr:last-child td{border-bottom:none}
      .total-row td{background:#f0fdf4;font-size:14px;font-weight:900;color:#065f46;border-top:2px solid #d1fae5 !important}
      .status-paid{display:inline-flex;align-items:center;gap:4px;background:#d1fae5;color:#065f46;font-weight:800;padding:3px 10px;border-radius:20px;font-size:11px}
      .status-unpaid{display:inline-flex;align-items:center;gap:4px;background:#fef3c7;color:#92400e;font-weight:800;padding:3px 10px;border-radius:20px;font-size:11px}
      .payment-block{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;margin-bottom:20px}
      .payment-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:12px}
      .payment-row:last-child{margin-bottom:0}
      .payment-row .plabel{color:#6b7280;font-weight:600}
      .notes-block{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:11px;color:#78350f}
      .footer{margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af}
      .currency-total-row td{background:#eef2ff;font-weight:900;color:#3730a3}
      @media print{body{padding:24px 32px}@page{margin:.8cm}}
    </style></head><body>${content}</body></html>`)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  const emp = record.employees || {}
  const client = record.clients || {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Commission Statement</span>
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
          <div className="max-w-[620px] mx-auto px-8 py-8">

            {/* Header */}
            <div className="doc-header flex items-start justify-between pb-5 mb-6 border-b-2 border-gray-900">
              <div>
                <p className="org text-[10px] font-black tracking-[.16em] uppercase text-emerald-600 mb-1.5">Management Hub</p>
                <h1 className="title text-[22px] font-black text-gray-900 leading-none tracking-tight">Commission Statement</h1>
              </div>
              <div className="meta-right text-right text-[11px] text-gray-500 leading-relaxed">
                <div><strong className="text-gray-800 text-[10px] uppercase tracking-wider font-bold">Date</strong><br />{createdDate}</div>
                <div className="mt-2"><strong className="text-gray-800 text-[10px] uppercase tracking-wider font-bold">Issued</strong><br />{generatedAt}</div>
              </div>
            </div>

            {/* Employee + Client info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-[9px] font-black uppercase tracking-[.14em] text-gray-400 mb-2">Employee</p>
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 ${['bg-indigo-500','bg-violet-500','bg-emerald-500'][emp.name?.charCodeAt(0) % 3 || 0]}`}>
                    {emp.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900">{emp.name || '—'}</p>
                    <p className="text-xs text-emerald-600 font-bold mt-0.5">{record.commission_rate}% commission rate</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-[9px] font-black uppercase tracking-[.14em] text-gray-400 mb-2">Earn From (Client)</p>
                <p className="text-sm font-black text-gray-900">{client.full_name || '—'}</p>
                {client.user_id && <p className="text-xs font-mono font-bold text-indigo-500 mt-0.5">{client.user_id}</p>}
              </div>
            </div>

            {/* Currency Breakdown (multi-currency only) */}
            {record.currency_breakdown && Object.keys(record.currency_breakdown).length > 1 && (
              <div className="mb-5">
                <p className="text-[9px] font-black uppercase tracking-[.14em] text-gray-400 mb-2">Currency Breakdown</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-[.12em] text-gray-400">Currency</th>
                        <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.12em] text-gray-400">Net Amount</th>
                        <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.12em] text-gray-400">Exchange Rate</th>
                        <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.12em] text-gray-400">≈ USDT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(record.currency_breakdown).map(([cur, vals]) => (
                        <tr key={cur} className="border-b border-gray-100 last:border-0">
                          <td className="px-4 py-3 text-sm font-bold text-gray-700">{cur}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700 tabular-nums">{fmtCurr(vals.net, cur)}</td>
                          <td className="px-4 py-3 text-right text-xs text-gray-500 tabular-nums">
                            {cur === 'USDT' ? '—' : vals.rate ? `1 USDT = ${new Intl.NumberFormat('en-US').format(vals.rate)} ${cur}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 tabular-nums">${fmt(vals.usdt)}</td>
                        </tr>
                      ))}
                      <tr className="bg-indigo-50">
                        <td colSpan={3} className="px-4 py-2.5 text-xs font-black text-indigo-800">Total Earning (USDT)</td>
                        <td className="px-4 py-2.5 text-right text-sm font-black text-indigo-700 tabular-nums">${fmt(record.total_earning)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Commission Calculation */}
            <div className="mb-5">
              <p className="text-[9px] font-black uppercase tracking-[.14em] text-gray-400 mb-2">Commission Breakdown</p>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-[.12em] text-gray-400">Description</th>
                      <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.12em] text-gray-400">Amount (USDT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-3 text-sm text-gray-700">Total Earning</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 tabular-nums">${fmt(record.total_earning)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-3 text-sm text-gray-700">
                        Commission Rate
                        <span className="ml-2 text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{record.commission_rate}%</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-indigo-600 tabular-nums">× {record.commission_rate / 100}</td>
                    </tr>
                    <tr className="bg-emerald-50">
                      <td className="px-4 py-3.5 text-sm font-black text-emerald-800">Commission Earned</td>
                      <td className="px-4 py-3.5 text-right text-base font-black text-emerald-700 tabular-nums">${fmt(record.commission_amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Info */}
            <div className="mb-5">
              <p className="text-[9px] font-black uppercase tracking-[.14em] text-gray-400 mb-2">Payment Information</p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-semibold">Status</span>
                  {record.status === 'paid'
                    ? <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full"><CheckCircle2 size={11} /> Paid</span>
                    : <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full"><Clock size={11} /> Unpaid</span>
                  }
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                  <span className="text-xs text-gray-500 font-semibold">Payment Date</span>
                  <span className="text-xs font-bold text-gray-900">{fmtDate(record.payment_date)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {record.notes && (
              <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-[9px] font-black uppercase tracking-[.14em] text-amber-600 mb-1.5">Notes</p>
                <p className="text-xs text-amber-900">{record.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between text-[10px] text-gray-400">
              <span>Generated {generatedAt}</span>
              <span>For informational purposes only.</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Receipt Modal ───────────────────────────────────────────────────────────

function ReceiptModal({ record, onClose, onSaved }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const existingUrl = record.receipt_url
  const isImage = existingUrl && /\.(png|jpg|jpeg|gif|webp)/i.test(existingUrl)

  useEffect(() => {
    function handlePaste(e) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile()
          if (f) { setFile(f); setPreview(URL.createObjectURL(f)) }
          break
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (!f) return
    setFile(f)
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `commission/${record.id}-receipt.${ext}`
      const { error: upErr } = await supabase.storage
        .from('receipts').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
      const { error: updErr } = await supabase
        .from('commission_records').update({ receipt_url: urlData.publicUrl }).eq('id', record.id)
      if (updErr) throw updErr
      toast.success('Receipt uploaded')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally { setUploading(false) }
  }

  async function handleRemove() {
    setUploading(true)
    try {
      const { error } = await supabase
        .from('commission_records').update({ receipt_url: null }).eq('id', record.id)
      if (error) throw error
      toast.success('Receipt removed')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message || 'Failed to remove')
    } finally { setUploading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <Receipt size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Payment Receipt</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {record.employees?.name} · <span className="font-semibold text-emerald-600">${fmt(record.commission_amount)}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Existing receipt view */}
          {existingUrl && !file && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Current Receipt</p>
              {isImage ? (
                <a href={existingUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <img src={existingUrl} alt="Receipt" className="w-full max-h-72 object-contain rounded-xl border border-gray-100 shadow-sm" />
                </a>
              ) : (
                <a href={existingUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors">
                  <FileText size={20} className="text-blue-500 shrink-0" />
                  <span className="text-sm font-semibold text-blue-700">View Receipt PDF →</span>
                </a>
              )}
              <div className="flex gap-2">
                <button onClick={handleRemove} disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors disabled:opacity-50">
                  <Trash2 size={12} /> Remove
                </button>
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">
                  <Upload size={12} /> Replace
                </button>
              </div>
            </div>
          )}

          {/* Staged new file preview */}
          {file && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">New Receipt</p>
              {preview
                ? <img src={preview} alt="Preview" className="w-full max-h-64 object-contain rounded-xl border border-gray-100 shadow-sm" />
                : (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <FileText size={20} className="text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-700 font-medium truncate">{file.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                )
              }
              <button onClick={() => { setFile(null); setPreview(null) }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors">
                <X size={12} /> Clear
              </button>
            </div>
          )}

          {/* Upload drop zone (no existing, no staged) */}
          {!existingUrl && !file && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed rounded-xl cursor-pointer transition-all text-center ${
                dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/40'
              }`}>
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
                <ImageIcon size={22} className="text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Click to upload or drag &amp; drop</p>
                <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, PDF · or paste Ctrl+V</p>
              </div>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
              {file ? 'Cancel' : 'Close'}
            </button>
            {file && (
              <button onClick={handleUpload} disabled={uploading}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {uploading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Upload size={15} />}
                Upload Receipt
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Mark Paid Modal ─────────────────────────────────────────────────────────

function MarkPaidModal({ record, onClose, onSaved }) {
  const [paymentDate, setPaymentDate] = useState(record.payment_date?.slice(0, 10) || new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  async function handleConfirm() {
    if (!paymentDate) return toast.error('Select a payment date')
    setSaving(true)
    try {
      const { error } = await supabase
        .from('commission_records')
        .update({ status: 'paid', payment_date: paymentDate })
        .eq('id', record.id)
      if (error) throw error
      toast.success('Marked as paid')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-6 space-y-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 size={22} className="text-emerald-600" />
          </div>
          <div className="text-center">
            <h3 className="text-base font-bold text-gray-900">Mark as Paid</h3>
            <p className="text-sm text-gray-500 mt-1">Commission of <span className="font-bold text-emerald-600">${fmt(record.commission_amount)}</span> for <span className="font-semibold">{record.employees?.name}</span></p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Payment Date <span className="text-rose-400">*</span></label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><CalendarDays size={15} /></div>
              <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
            <button onClick={handleConfirm} disabled={saving}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={15} />}
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Commission Modal ───────────────────────────────────────────────────

function EditCommissionModal({ record, onClose, onSaved }) {
  const [status, setStatus] = useState(record.status || 'unpaid')
  const [paymentDate, setPaymentDate] = useState(record.payment_date?.slice(0, 10) || '')
  const [notes, setNotes] = useState(record.notes || '')
  const [commissionAmount, setCommissionAmount] = useState(String(record.commission_amount || ''))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  async function handleSave(e) {
    e.preventDefault()
    const amount = parseFloat(commissionAmount)
    if (isNaN(amount) || amount < 0) return toast.error('Enter a valid commission amount')
    if (status === 'paid' && !paymentDate) return toast.error('Select a payment date for paid status')
    setSaving(true)
    try {
      const { error } = await supabase
        .from('commission_records')
        .update({
          status,
          payment_date: paymentDate || null,
          notes: notes.trim() || null,
          commission_amount: amount,
        })
        .eq('id', record.id)
      if (error) throw error
      toast.success('Commission record updated')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const emp = record.employees || {}
  const client = record.clients || {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Edit2 size={16} className="text-indigo-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Edit Commission Record</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Read-only info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Employee</p>
              <p className="text-sm font-bold text-gray-900">{emp.name || '—'}</p>
              <p className="text-xs text-indigo-600 font-semibold">{record.commission_rate}% rate</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Client</p>
              <p className="text-sm font-bold text-gray-900">{client.full_name || '—'}</p>
              {client.user_id && <p className="text-xs text-gray-400 font-mono">{client.user_id}</p>}
            </div>
          </div>

          {/* Commission Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Commission Amount (USDT)</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><DollarSign size={15} /></div>
              <input
                type="number"
                value={commissionAmount}
                onChange={e => setCommissionAmount(e.target.value)}
                min="0"
                step="0.01"
                className={inputCls}
              />
            </div>
            <p className="text-[11px] text-gray-400 pl-1">Based on ${fmt(record.total_earning)} total earning × {record.commission_rate}%</p>
          </div>

          {/* Payment Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Payment Status</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setStatus('unpaid')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                  status === 'unpaid' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                }`}>
                <Clock size={15} /> Unpaid
              </button>
              <button type="button" onClick={() => setStatus('paid')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                  status === 'paid' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                }`}>
                <CheckCircle2 size={15} /> Paid
              </button>
            </div>
          </div>

          {/* Payment Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Payment Date {status === 'paid' && <span className="text-rose-400">*</span>}
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><CalendarDays size={15} /></div>
              <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional notes…"
              rows={2}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {saving ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</> : <><Save size={15} /> Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirm Modal ────────────────────────────────────────────────────

function DeleteModal({ title, message, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-6 space-y-4">
          <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle size={22} className="text-rose-600" />
          </div>
          <div className="text-center">
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
            <button onClick={onConfirm} disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Trash2 size={15} />}
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Commission() {
  const [tab, setTab] = useState('records') // 'employees' | 'records'
  const [employees, setEmployees] = useState([])
  const [records, setRecords] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [editEmployee, setEditEmployee] = useState(null)
  const [deleteEmployee, setDeleteEmployee] = useState(null)
  const [deletingEmployee, setDeletingEmployee] = useState(false)

  const [showAddCommission, setShowAddCommission] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [markPaidRecord, setMarkPaidRecord] = useState(null)
  const [statementRecord, setStatementRecord] = useState(null)
  const [receiptRecord, setReceiptRecord] = useState(null)
  const [deleteRecord, setDeleteRecord] = useState(null)
  const [deletingRecord, setDeletingRecord] = useState(false)

  const [recordSearch, setRecordSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'paid' | 'unpaid'
  const [employeeFilter, setEmployeeFilter] = useState('all')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [empRes, recRes, cliRes] = await Promise.all([
        supabase.from('employees').select('*').order('name'),
        supabase.from('commission_records').select('*, employees(name, commission_rate), clients(full_name, user_id, profile_pic_url)').order('created_at', { ascending: false }),
        supabase.from('clients').select('id, full_name, user_id, profile_pic_url').order('full_name'),
      ])
      if (empRes.error) throw empRes.error
      if (recRes.error) throw recRes.error
      if (cliRes.error) throw cliRes.error
      setEmployees(empRes.data || [])
      setRecords(recRes.data || [])
      setClients(cliRes.data || [])
    } catch (err) {
      toast.error('Failed to load data: ' + (err.message || ''))
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteEmployee() {
    setDeletingEmployee(true)
    try {
      const { error } = await supabase.from('employees').delete().eq('id', deleteEmployee.id)
      if (error) throw error
      toast.success('Employee deleted')
      setDeleteEmployee(null)
      fetchAll()
    } catch (err) {
      toast.error(err.message || 'Failed to delete')
    } finally {
      setDeletingEmployee(false)
    }
  }

  async function handleDeleteRecord() {
    setDeletingRecord(true)
    try {
      const { error } = await supabase.from('commission_records').delete().eq('id', deleteRecord.id)
      if (error) throw error
      toast.success('Record deleted')
      setDeleteRecord(null)
      fetchAll()
    } catch (err) {
      toast.error(err.message || 'Failed to delete')
    } finally {
      setDeletingRecord(false)
    }
  }

  // ── Stats ──
  const totalCommission = records.reduce((s, r) => s + (r.commission_amount || 0), 0)
  const unpaidCommission = records.filter(r => r.status === 'unpaid').reduce((s, r) => s + (r.commission_amount || 0), 0)
  const paidCommission = records.filter(r => r.status === 'paid').reduce((s, r) => s + (r.commission_amount || 0), 0)

  // ── Filtered records ──
  const filteredRecords = useMemo(() => {
    let list = records
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter)
    if (employeeFilter !== 'all') list = list.filter(r => r.employee_id === employeeFilter)
    if (recordSearch.trim()) {
      const q = recordSearch.toLowerCase()
      list = list.filter(r =>
        r.employees?.name?.toLowerCase().includes(q) ||
        r.clients?.full_name?.toLowerCase().includes(q) ||
        r.clients?.user_id?.toLowerCase().includes(q)
      )
    }
    return list
  }, [records, statusFilter, employeeFilter, recordSearch])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Commission</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage employee commissions and payment records</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowAddEmployee(true); setTab('employees') }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors border border-indigo-100">
            <Users size={15} /> Add Employee
          </button>
          <button
            onClick={() => setShowAddCommission(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus size={15} /> Share Commission
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-sm">
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute -right-1 -top-8 w-16 h-16 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between mb-5">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <TrendingUp size={20} className="text-white" />
            </div>
          </div>
          <p className="relative text-[11px] font-semibold text-white/70 uppercase tracking-widest mb-1">Total Commission</p>
          <p className="relative text-2xl font-black text-white">{loading ? '—' : `$${fmt(totalCommission)}`}</p>
        </div>

        <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute -right-1 -top-8 w-16 h-16 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between mb-5">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <Clock size={20} className="text-white" />
            </div>
          </div>
          <p className="relative text-[11px] font-semibold text-white/70 uppercase tracking-widest mb-1">Unpaid</p>
          <p className="relative text-2xl font-black text-white">{loading ? '—' : `$${fmt(unpaidCommission)}`}</p>
        </div>

        <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute -right-1 -top-8 w-16 h-16 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between mb-5">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <CheckCircle2 size={20} className="text-white" />
            </div>
          </div>
          <p className="relative text-[11px] font-semibold text-white/70 uppercase tracking-widest mb-1">Paid Out</p>
          <p className="relative text-2xl font-black text-white">{loading ? '—' : `$${fmt(paidCommission)}`}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        {[
          { key: 'records', label: 'Commission Records', icon: Banknote },
          { key: 'employees', label: 'Employees', icon: Users },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Employees Tab ── */}
      {tab === 'employees' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Employees</h2>
              <p className="text-xs text-gray-400 mt-0.5">{employees.length} employee{employees.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => { setEditEmployee(null); setShowAddEmployee(true) }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors">
              <Plus size={13} /> Add Employee
            </button>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-100 rounded w-32" />
                    <div className="h-2.5 bg-gray-100 rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : employees.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Users size={22} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-500">No employees yet</p>
              <p className="text-xs text-gray-400 mt-1">Add your first employee to get started</p>
              <button onClick={() => setShowAddEmployee(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
                <Plus size={14} /> Add Employee
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {employees.map(emp => {
                const empRecords = records.filter(r => r.employee_id === emp.id)
                const empTotal = empRecords.reduce((s, r) => s + (r.commission_amount || 0), 0)
                const empUnpaid = empRecords.filter(r => r.status === 'unpaid').reduce((s, r) => s + (r.commission_amount || 0), 0)
                return (
                  <div key={emp.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                    <InitialAvatar name={emp.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{emp.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{empRecords.length} record{empRecords.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-400">Total earned</p>
                      <p className="text-sm font-bold text-gray-900">${fmt(empTotal)}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-400">Unpaid</p>
                      <p className={`text-sm font-bold ${empUnpaid > 0 ? 'text-amber-600' : 'text-gray-400'}`}>${fmt(empUnpaid)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2.5 py-1 rounded-full">{emp.commission_rate}%</span>
                      <button onClick={() => { setEditEmployee(emp); setShowAddEmployee(true) }}
                        className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeleteEmployee(emp)}
                        className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Records Tab ── */}
      {tab === 'records' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Filters */}
          <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={14} /></div>
              <input
                type="text"
                value={recordSearch}
                onChange={e => setRecordSearch(e.target.value)}
                placeholder="Search employee or client…"
                className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
              {[
                { key: 'all', label: 'All' },
                { key: 'unpaid', label: 'Unpaid' },
                { key: 'paid', label: 'Paid' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setStatusFilter(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    statusFilter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Employee filter */}
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"><Filter size={12} /></div>
              <select
                value={employeeFilter}
                onChange={e => setEmployeeFilter(e.target.value)}
                className="pl-7 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:outline-none focus:border-indigo-400 appearance-none cursor-pointer">
                <option value="all">All Employees</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><ChevronDown size={12} /></div>
            </div>

            <p className="text-xs text-gray-400 ml-auto">{filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Table */}
          {loading ? (
            <div className="divide-y divide-gray-50">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-4 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-28" />
                    <div className="h-2.5 bg-gray-100 rounded w-20" />
                  </div>
                  <div className="h-5 bg-gray-100 rounded w-16" />
                  <div className="h-5 bg-gray-100 rounded w-20" />
                </div>
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Banknote size={22} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-500">
                {records.length === 0 ? 'No commission records yet' : 'No records match your filters'}
              </p>
              {records.length === 0 && (
                <button onClick={() => setShowAddCommission(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
                  <Plus size={14} /> Share Commission
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Earn From</th>
                      <th className="px-6 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Earning</th>
                      <th className="px-6 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Rate</th>
                      <th className="px-6 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Commission</th>
                      <th className="px-6 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Payment Date</th>
                      <th className="px-6 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Receipt</th>
                      <th className="px-6 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredRecords.map(rec => (
                      <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <InitialAvatar name={rec.employees?.name || '?'} size="sm" />
                            <span className="text-sm font-semibold text-gray-900">{rec.employees?.name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{rec.clients?.full_name || '—'}</p>
                            {rec.clients?.user_id && <p className="text-xs text-gray-400 font-mono">{rec.clients.user_id}</p>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-semibold text-gray-900">${fmt(rec.total_earning)}</span>
                          {rec.currency_breakdown && Object.keys(rec.currency_breakdown).length > 1 && (
                            <div className="flex flex-wrap gap-1 mt-1 justify-end">
                              {Object.entries(rec.currency_breakdown).map(([cur, vals]) => {
                                const c = CURRENCY_COLORS[cur] || { bg: 'bg-gray-100', value: 'text-gray-600' }
                                return (
                                  <span key={cur} title={cur !== 'USDT' && vals.rate ? `1 USDT = ${new Intl.NumberFormat().format(vals.rate)} ${cur}` : undefined}
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.bg} ${c.value}`}>
                                    {fmtCurr(vals.net, cur)}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{rec.commission_rate}%</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-black text-emerald-700">${fmt(rec.commission_amount)}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {rec.status === 'paid' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                              <CheckCircle2 size={11} /> Paid
                            </span>
                          ) : (
                            <button onClick={() => setMarkPaidRecord(rec)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-full transition-colors cursor-pointer">
                              <Clock size={11} /> Unpaid
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-xs text-gray-500">{fmtDate(rec.payment_date)}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => setReceiptRecord(rec)}
                            title={rec.receipt_url ? 'View receipt' : 'Upload receipt'}
                            className={`p-2 rounded-lg transition-colors ${
                              rec.receipt_url
                                ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
                                : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                            }`}>
                            {rec.receipt_url ? <Eye size={14} /> : <Upload size={14} />}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setEditRecord(rec)} title="Edit record"
                              className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => setStatementRecord(rec)} title="View statement"
                              className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                              <FileText size={14} />
                            </button>
                            <button onClick={() => setDeleteRecord(rec)}
                              className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-50">
                {filteredRecords.map(rec => (
                  <div key={rec.id} className="px-4 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <InitialAvatar name={rec.employees?.name || '?'} size="sm" />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{rec.employees?.name || '—'}</p>
                          <p className="text-xs text-gray-400">from {rec.clients?.full_name || '—'}</p>
                        </div>
                      </div>
                      {rec.status === 'paid' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                          <CheckCircle2 size={11} /> Paid
                        </span>
                      ) : (
                        <button onClick={() => setMarkPaidRecord(rec)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-full transition-colors">
                          <Clock size={11} /> Unpaid
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400 font-semibold uppercase">Earning</p>
                        <p className="text-sm font-bold text-gray-900">${fmt(rec.total_earning)}</p>
                        {rec.currency_breakdown && Object.keys(rec.currency_breakdown).length > 1 && (
                          <div className="flex flex-wrap gap-0.5 mt-1 justify-center">
                            {Object.entries(rec.currency_breakdown).map(([cur, vals]) => {
                              const c = CURRENCY_COLORS[cur] || { bg: 'bg-gray-100', value: 'text-gray-600' }
                              return (
                                <span key={cur} className={`text-[9px] font-bold px-1 py-0.5 rounded ${c.bg} ${c.value}`}>
                                  {fmtCurr(vals.net, cur)}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400 font-semibold uppercase">Rate</p>
                        <p className="text-sm font-bold text-indigo-600">{rec.commission_rate}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400 font-semibold uppercase">Commission</p>
                        <p className="text-sm font-black text-emerald-700">${fmt(rec.commission_amount)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400">{fmtDate(rec.payment_date)}</p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditRecord(rec)} title="Edit record"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => setStatementRecord(rec)} title="View statement"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                          <FileText size={13} />
                        </button>
                        <button onClick={() => setReceiptRecord(rec)}
                          title={rec.receipt_url ? 'View receipt' : 'Upload receipt'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            rec.receipt_url
                              ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
                              : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                          }`}>
                          {rec.receipt_url ? <Eye size={13} /> : <Upload size={13} />}
                        </button>
                        <button onClick={() => setDeleteRecord(rec)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddEmployee && (
        <AddEmployeeModal
          onClose={() => { setShowAddEmployee(false); setEditEmployee(null) }}
          onSaved={fetchAll}
          editEmployee={editEmployee}
        />
      )}
      {showAddCommission && (
        <AddCommissionModal
          onClose={() => setShowAddCommission(false)}
          onSaved={fetchAll}
          employees={employees}
          clients={clients}
        />
      )}
      {editRecord && (
        <EditCommissionModal
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onSaved={fetchAll}
        />
      )}
      {statementRecord && (
        <CommissionStatementModal
          record={statementRecord}
          onClose={() => setStatementRecord(null)}
        />
      )}
      {receiptRecord && (
        <ReceiptModal
          record={receiptRecord}
          onClose={() => setReceiptRecord(null)}
          onSaved={fetchAll}
        />
      )}
      {markPaidRecord && (
        <MarkPaidModal
          record={markPaidRecord}
          onClose={() => setMarkPaidRecord(null)}
          onSaved={fetchAll}
        />
      )}
      {deleteEmployee && (
        <DeleteModal
          title="Delete Employee"
          message={`Remove "${deleteEmployee.name}" and all their commission records?`}
          onClose={() => setDeleteEmployee(null)}
          onConfirm={handleDeleteEmployee}
          loading={deletingEmployee}
        />
      )}
      {deleteRecord && (
        <DeleteModal
          title="Delete Record"
          message="This commission record will be permanently removed."
          onClose={() => setDeleteRecord(null)}
          onConfirm={handleDeleteRecord}
          loading={deletingRecord}
        />
      )}
    </div>
  )
}
