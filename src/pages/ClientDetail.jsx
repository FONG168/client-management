import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle,
  Receipt, Plus, Loader2, TrendingUp, TrendingDown, Wallet,
  Calendar, Mail, Phone, FileText, AlertTriangle, X, Printer
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import TransactionModal, { formatAmount } from '../components/TransactionModal'
import UsdtIcon from '../components/UsdtIcon'

const CURRENCIES = ['USDT', 'IDR', 'VND', 'HKD']

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500',
]

function getAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function ConfirmDeleteModal({ clientName, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={22} className="text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Client?</h3>
        <p className="text-sm text-gray-500 mb-6">
          Are you sure you want to delete <span className="font-semibold text-gray-700">{clientName}</span>?
          This will permanently remove all their transactions as well.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

const CURRENCY_LIST = [
  { code: 'USDT', symbol: 'USDT' },
  { code: 'IDR',  symbol: 'Rp'   },
  { code: 'VND',  symbol: '₫'    },
  { code: 'HKD',  symbol: 'HK$'  },
]

function fmtInput(val, currency) {
  const isDecimal = currency === 'USDT' || currency === 'HKD'
  let raw = val.replace(/,/g, '').replace(/[^0-9.]/g, '')
  if (!isDecimal) raw = raw.replace(/\./g, '')
  const parts = raw.split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart
}

function EditTransactionModal({ txn, onClose, onSuccess }) {
  const [type, setType] = useState(txn.type)
  const [currency, setCurrency] = useState(txn.currency || 'USDT')
  const [amount, setAmount] = useState(fmtInput(String(txn.amount), txn.currency || 'USDT'))
  const [bankFeeType, setBankFeeType] = useState(txn.bank_fee_type || 'percent')
  const [bankFeeValue, setBankFeeValue] = useState(txn.bank_fee_value ? String(txn.bank_fee_value) : '')
  const [exchangeRate, setExchangeRate] = useState(txn.exchange_rate ? String(txn.exchange_rate) : '')
  const [loadingRate, setLoadingRate] = useState(false)
  const [notes, setNotes] = useState(txn.notes || '')
  const [date, setDate] = useState(() => {
    // datetime-local input requires "YYYY-MM-DDTHH:MM" in local time
    const d = new Date(txn.created_at)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    setAmount(prev => fmtInput(prev, currency))
    if (currency === 'USDT') { setBankFeeValue(''); setExchangeRate(''); return }
    if (currency === 'VND') { setExchangeRate(''); return }
    setLoadingRate(true)
    fetch(`https://api.frankfurter.app/latest?from=USD&to=${currency}`)
      .then(r => r.json())
      .then(d => { if (d?.rates?.[currency]) setExchangeRate(String(d.rates[currency].toFixed(2))) })
      .catch(() => {})
      .finally(() => setLoadingRate(false))
  }, [currency])

  const currencySymbol = CURRENCY_LIST.find(c => c.code === currency)?.symbol || '$'

  const parsedAmt = parseFloat(amount.replace(/,/g, '')) || 0
  const rateNum = parseFloat(exchangeRate) || 0
  const feeVal = parseFloat(bankFeeValue) || 0
  const bankFeeAmount = feeVal !== 0
    ? (bankFeeType === 'percent' ? parsedAmt * (feeVal / 100) : feeVal)
    : 0
  const netAmount = type === 'withdrawal'
    ? parsedAmt + bankFeeAmount
    : parsedAmt - bankFeeAmount
  const usdtEquiv = rateNum > 0 && parsedAmt > 0 ? netAmount / rateNum : null

  const handleSave = async (e) => {
    e.preventDefault()
    if (!amount || parsedAmt <= 0) {
      toast.error('Please enter a valid amount greater than 0')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          type, currency, amount: parsedAmt,
          exchange_rate: rateNum > 0 ? rateNum : null,
          bank_fee_type: bankFeeAmount > 0 ? bankFeeType : null,
          bank_fee_value: bankFeeAmount > 0 ? feeVal : null,
          bank_fee_amount: bankFeeAmount > 0 ? bankFeeAmount : null,
          notes: notes.trim() || null,
          created_at: new Date(date).toISOString()
        })
        .eq('id', txn.id)
      if (error) throw error
      toast.success('Transaction updated')
      onSuccess()
    } catch (err) {
      toast.error(err.message || 'Failed to update transaction')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', txn.id)
      if (error) throw error
      toast.success('Transaction deleted')
      onSuccess()
    } catch (err) {
      toast.error(err.message || 'Failed to delete transaction')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Edit Transaction</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
              <button type="button" onClick={() => setType('topup')}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${type === 'topup' ? 'bg-white text-green-600 shadow-sm ring-1 ring-green-200' : 'text-gray-500 hover:text-gray-700'}`}>
                Top-up
              </button>
              <button type="button" onClick={() => setType('withdrawal')}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${type === 'withdrawal' ? 'bg-white text-red-600 shadow-sm ring-1 ring-red-200' : 'text-gray-500 hover:text-gray-700'}`}>
                Withdrawal
              </button>
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
            <div className="grid grid-cols-4 gap-2">
              {CURRENCY_LIST.map((c) => (
                <button key={c.code} type="button" onClick={() => setCurrency(c.code)}
                  className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${currency === c.code ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-200 hover:bg-indigo-50/30'}`}>
                  {c.code === 'USDT'
                    ? <span className="flex items-center justify-center gap-1"><UsdtIcon size={13} /> USDT</span>
                    : c.code}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500 min-w-[2.5rem]">{currencySymbol}</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(fmtInput(e.target.value, currency))}
                required
                className="w-full pl-14 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Exchange Rate */}
          {currency !== 'USDT' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Exchange Rate</label>
                {loadingRate && <span className="text-[11px] text-indigo-500 font-semibold flex items-center gap-1"><span className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin inline-block" /> Fetching…</span>}
                {!loadingRate && currency !== 'VND' && exchangeRate && <span className="text-[11px] text-gray-400">Live rate · editable</span>}
                {!loadingRate && currency === 'VND' && <span className="text-[11px] text-amber-500 font-semibold">Enter rate manually</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 shrink-0 flex items-center gap-1">1 <UsdtIcon size={12} /> =</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={exchangeRate}
                  onChange={e => setExchangeRate(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="Enter rate…"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
                <span className="text-xs font-bold text-gray-500 shrink-0">{currency}</span>
              </div>
              {usdtEquiv !== null && (
                <div className="mt-2 flex items-center justify-between px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs">
                  <span className="text-indigo-600 font-semibold">{formatAmount(netAmount, currency)} ≈</span>
                  <span className="font-black text-indigo-700">${usdtEquiv.toFixed(2)} USDT</span>
                </div>
              )}
            </div>
          )}

          {/* Bank Fee */}
          {currency !== 'USDT' && <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank Fee <span className="text-gray-400 font-normal">(optional)</span></label>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 rounded-xl">
                <button type="button" onClick={() => setBankFeeType('percent')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${bankFeeType === 'percent' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  % Percentage
                </button>
                <button type="button" onClick={() => setBankFeeType('fixed')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${bankFeeType === 'fixed' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  $ Fixed Amount
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                  {bankFeeType === 'percent' ? '%' : currencySymbol}
                </span>
                <input
                  type="number"
                  step="any"
                  value={bankFeeValue}
                  onChange={(e) => setBankFeeValue(e.target.value)}
                  placeholder={bankFeeType === 'percent' ? 'e.g. 2.5 or -2.5' : '0'}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                />
              </div>
              {bankFeeAmount !== 0 && parsedAmt > 0 && (
                <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-xs">
                  {(() => {
                    const adds = type === 'withdrawal' ? bankFeeAmount > 0 : bankFeeAmount < 0
                    return (
                      <div className="flex items-center justify-between">
                        <span className="text-amber-700 font-semibold">{adds ? 'Fee added' : 'Fee deducted'}</span>
                        <span className="font-black text-rose-600">
                          {adds ? '+' : '−'}{formatAmount(Math.abs(bankFeeAmount), currency, true)}
                        </span>
                      </div>
                    )
                  })()}
                  <div className="flex items-center justify-between border-t border-amber-200 pt-1.5">
                    <span className="text-amber-700 font-semibold">Net amount</span>
                    <span className="font-bold text-gray-700">{formatAmount(netAmount, currency, true)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none"
            />
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-gray-400" />
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Delete confirmation inline */}
          {confirmDelete ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700 font-medium mb-3">Are you sure you want to delete this transaction?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-white transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button type="button" onClick={handleDelete} disabled={deleting}
                  className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50">
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setConfirmDelete(true)} disabled={saving}
                className="px-4 py-2.5 border border-red-200 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                <Trash2 size={14} />
                Delete
              </button>
              <button type="button" onClick={onClose} disabled={saving}
                className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${type === 'topup' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
                {saving ? <><Loader2 size={15} className="animate-spin" />Saving...</> : 'Save Changes'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

function StatementModal({ client, transactions, balanceByCurrency, onClose }) {
  const printRef = useRef(null)

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const txnWithBalance = [...transactions].reverse().reduce((acc, txn) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0
    const fee = Number(txn.bank_fee_amount || 0)
    const netDisplay = txn.type === 'topup' ? Number(txn.amount) - fee : Number(txn.amount) + fee
    const runningBalance = txn.type === 'topup' ? prev + netDisplay : prev - netDisplay
    return [...acc, { ...txn, runningBalance, netDisplay, fee }]
  }, []).reverse()

  // Per-transaction USDT breakdown for non-USDT currencies with stored rates
  const usdtBreakdown = {}
  const nonUsdtTxns = transactions.filter(t => t.currency && t.currency !== 'USDT' && Number(t.exchange_rate) > 0)
  for (const cur of [...new Set(nonUsdtTxns.map(t => t.currency))]) {
    const rows = transactions
      .filter(t => t.currency === cur && Number(t.exchange_rate) > 0)
      .map(t => {
        const fee = Number(t.bank_fee_amount || 0)
        const net = t.type === 'topup' ? Number(t.amount) - fee : -(Number(t.amount) + fee)
        return { type: t.type, net, rate: Number(t.exchange_rate), usdt: net / Number(t.exchange_rate) }
      })
    usdtBreakdown[cur] = { rows, totalUsdt: rows.reduce((s, r) => s + r.usdt, 0) }
  }
  const hasUsdtBreakdown = Object.keys(usdtBreakdown).length > 0
  const usdtDirect = (balanceByCurrency['USDT']?.balance) || 0
  const totalUsdtAll = hasUsdtBreakdown
    ? usdtDirect + Object.values(usdtBreakdown).reduce((s, { totalUsdt }) => s + totalUsdt, 0)
    : null

  const now = new Date()
  const generatedAt = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const oldest = transactions.length ? new Date(transactions[transactions.length - 1].created_at) : null
  const newest = transactions.length ? new Date(transactions[0].created_at) : null
  const fmtShort = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const periodStr = oldest ? `${fmtShort(oldest)} – ${fmtShort(newest)}` : '—'

  const handlePrint = () => {
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>Statement – ${client.full_name}</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#1a1a2e;background:#fff;padding:40px 48px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;margin-bottom:20px;border-bottom:3px solid #4f46e5}
      .brand{font-size:9px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#4f46e5;margin-bottom:5px}
      .doc-title{font-size:26px;font-weight:900;color:#1a1a2e;letter-spacing:-.03em;line-height:1}
      .meta{text-align:right;font-size:10px;color:#6b7280;line-height:1.9}
      .meta b{color:#1a1a2e;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:.1em}
      .client-row{display:flex;justify-content:space-between;align-items:center;background:#f8faff;border:1px solid #e0e7ff;border-radius:10px;padding:14px 18px;margin-bottom:22px}
      .client-name{font-size:15px;font-weight:800;color:#1a1a2e;margin-bottom:3px}
      .client-meta{font-size:10px;color:#6b7280}
      .client-id{font-size:11px;font-weight:700;color:#4f46e5;background:#eef2ff;padding:3px 10px;border-radius:20px}
      .sec-label{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.16em;color:#9ca3af;margin-bottom:8px}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      .sum-table th{background:#f8faff;padding:8px 12px;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;border-bottom:2px solid #e0e7ff;border-top:1px solid #e0e7ff}
      .sum-table td{padding:0;border-bottom:1px solid #f1f5f9;vertical-align:top}
      .sum-table .row-label{padding:10px 12px;font-size:10px;font-weight:700;color:#374151;white-space:nowrap}
      .sum-table .row-label small{display:block;font-size:8px;font-weight:600;color:#9ca3af;margin-top:1px}
      .sum-table .num{padding:10px 12px;text-align:right;font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}
      .sum-table .gross{color:#374151}.sum-table .fee-row{background:#fffbeb}.sum-table .fee-num{color:#d97706;font-size:10px}
      .sum-table .net-row{background:#f0fdf4}.sum-table .net-dep{color:#15803d}.sum-table .net-wdw{color:#dc2626}.sum-table .net-bal{color:#4338ca;font-weight:900}
      .txn-table th{background:#f8faff;padding:8px 12px;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;border-top:1px solid #e0e7ff;border-bottom:2px solid #e0e7ff}
      .txn-table th:not(:nth-child(1)):not(:nth-child(2)){text-align:right}
      .txn-table td{padding:9px 12px;border-bottom:1px solid #f1f5f9;font-size:10px;vertical-align:top}
      .txn-table td:not(:nth-child(1)):not(:nth-child(2)){text-align:right;font-variant-numeric:tabular-nums}
      .txn-table tbody tr:last-child td{border-bottom:none}
      .type-badge{display:inline-block;font-size:8px;font-weight:800;padding:2px 7px;border-radius:20px;text-transform:uppercase;letter-spacing:.06em}
      .badge-topup{background:#dcfce7;color:#15803d}.badge-wd{background:#fee2e2;color:#dc2626}
      .cur-badge{font-size:8px;font-weight:800;color:#4f46e5;background:#eef2ff;padding:1px 5px;border-radius:4px;margin-left:4px}
      .fee-note{font-size:9px;color:#d97706;margin-top:2px}
      .net-note{font-size:9px;font-weight:700;margin-top:1px}
      .notes-txt{font-size:9px;color:#9ca3af;margin-top:2px}
      .gross-amt{font-size:11px;font-weight:700;color:#374151}
      .fee-amt{font-size:9px;color:#d97706}
      .net-cr{font-size:11px;font-weight:800;color:#15803d}
      .net-dr{font-size:11px;font-weight:800;color:#dc2626}
      .bal-pos{font-size:11px;font-weight:900;color:#1e293b}.bal-neg{font-size:11px;font-weight:900;color:#ea580c}
      .tfoot-row{background:#1e293b}
      .tfoot-row td{padding:10px 12px;font-size:10px;font-weight:800;color:rgba(255,255,255,.7);border-top:2px solid #334155}
      .tfoot-row td:not(:nth-child(1)):not(:nth-child(2)){text-align:right;font-variant-numeric:tabular-nums}
      .tfoot-row .tfoot-bal{color:#fff;font-size:12px}
      .tfoot-row .tfoot-sub{font-size:8px;color:rgba(255,200,100,.8);margin-top:2px;font-weight:600}
      .footer{display:flex;justify-content:space-between;font-size:9px;color:#9ca3af;padding-top:12px;border-top:1px solid #e5e7eb;margin-top:20px}
      .conv-section{margin-bottom:20px}
      .conv-header{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.16em;color:#9ca3af;margin-bottom:8px}
      .conv-table{width:100%;border-collapse:collapse;border:1px solid #e0e7ff;border-radius:10px;overflow:hidden}
      .conv-table th{background:#eef2ff;padding:7px 12px;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#6366f1;border-bottom:2px solid #c7d2fe}
      .conv-table th:not(:first-child){text-align:right}
      .conv-table td{padding:8px 12px;font-size:10px;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums}
      .conv-table td:not(:first-child){text-align:right}
      .conv-table .topup-row td:first-child{color:#15803d;font-weight:700}
      .conv-table .wd-row td:first-child{color:#dc2626;font-weight:700}
      .conv-table .rate-cell{color:#6b7280;font-size:9px}
      .conv-table .usdt-pos{color:#15803d;font-weight:800}
      .conv-table .usdt-neg{color:#dc2626;font-weight:800}
      .conv-total td{background:#1e293b;color:#fff;font-weight:900;font-size:11px;border-top:2px solid #334155;border-bottom:none}
      .conv-total .total-usdt-pos{color:#6ee7b7;font-size:13px}
      .conv-total .total-usdt-neg{color:#fca5a5;font-size:13px}
      @media print{body{padding:20px 28px}@page{margin:.6cm}}
    </style></head><body>${content}</body></html>`)
    win.document.close(); win.focus(); win.print(); win.close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
              <FileText size={13} className="text-indigo-600" />
            </div>
            <span className="text-sm font-bold text-gray-800">Account Statement</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold tracking-wide transition-colors shadow-sm">
              <Printer size={12} /> Print / Export
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Document body */}
        <div className="overflow-y-auto flex-1 bg-gray-50/50" ref={printRef}>
          <div className="max-w-[680px] mx-auto px-5 sm:px-8 py-7 space-y-5">

            {/* Header */}
            <div className="header flex items-start justify-between pb-5 border-b-[3px] border-indigo-600">
              <div>
                <p className="brand text-[9px] font-black tracking-[.2em] uppercase text-indigo-600 mb-1">Management Hub</p>
                <h1 className="doc-title text-2xl font-black text-gray-900 tracking-tight">Account Statement</h1>
              </div>
              <div className="meta text-right text-[11px] text-gray-500 leading-relaxed space-y-1.5">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Period</p>
                  <p className="font-semibold text-gray-700">{periodStr}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Issued</p>
                  <p className="font-semibold text-gray-700">{generatedAt}</p>
                </div>
              </div>
            </div>

            {/* Client Info */}
            <div className="client-row flex items-center justify-between bg-indigo-50/60 border border-indigo-100 rounded-xl px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shrink-0">
                  {client.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-0.5">Account Holder</p>
                  <p className="client-name text-base font-black text-gray-900">{client.full_name}</p>
                  <div className="flex flex-wrap gap-x-3 mt-0.5">
                    {client.email && <p className="client-meta text-[10px] text-gray-500 flex items-center gap-1"><Mail size={9} />{client.email}</p>}
                    {client.phone && <p className="client-meta text-[10px] text-gray-500 flex items-center gap-1"><Phone size={9} />{client.phone}</p>}
                  </div>
                </div>
              </div>
              {client.user_id && (
                <span className="client-id text-xs font-black text-indigo-600 bg-indigo-100 px-3 py-1.5 rounded-full shrink-0">#{client.user_id}</span>
              )}
            </div>

            {/* Financial Summary */}
            {Object.entries(balanceByCurrency).length > 0 && (
              <div>
                <p className="sec-label text-[9px] font-black uppercase tracking-[.16em] text-gray-400 mb-2">Financial Summary</p>
                <div className="sum-table border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm overflow-x-auto">
                  <table className="w-full" style={{ minWidth: '360px' }}>
                    <thead>
                      <tr className="bg-gray-50 border-b-2 border-gray-200">
                        <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-[.12em] text-gray-400 w-28"> </th>
                        <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.12em] text-green-600">Deposits</th>
                        <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.12em] text-red-500">Withdrawals</th>
                        <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.12em] text-indigo-500">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(balanceByCurrency).map(([cur, { topups, withdrawals, topupFees, withdrawalFees, totalFees, netTopups, netWithdrawals, balance }]) => {
                        const grossBalance = topups - withdrawals
                        return (
                          <React.Fragment key={cur}>
                            {/* Gross row */}
                            <tr className="border-b border-gray-100">
                              <td className="row-label px-4 py-2.5">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">{cur}</span>
                                <small className="text-[9px] text-gray-400 block mt-0.5">Gross</small>
                              </td>
                              <td className="num gross px-4 py-2.5 text-right tabular-nums text-[11px] font-semibold text-gray-700 whitespace-nowrap">{formatAmount(topups, cur)}</td>
                              <td className="num gross px-4 py-2.5 text-right tabular-nums text-[11px] font-semibold text-gray-700 whitespace-nowrap">{formatAmount(withdrawals, cur)}</td>
                              <td className="num gross px-4 py-2.5 text-right tabular-nums text-[11px] font-semibold text-gray-600 whitespace-nowrap">{formatAmount(grossBalance, cur)}</td>
                            </tr>
                            {/* Fee row */}
                            {totalFees > 0 && (
                              <tr className="border-b border-amber-100 bg-amber-50/60">
                                <td className="row-label px-4 py-2">
                                  <small className="text-[9px] font-black text-amber-600 uppercase tracking-wider">Bank Fees</small>
                                </td>
                                <td className="fee-num px-4 py-2 text-right tabular-nums text-[10px] font-semibold text-amber-600 whitespace-nowrap">{topupFees > 0 ? `−${formatAmount(topupFees, cur)}` : '—'}</td>
                                <td className="fee-num px-4 py-2 text-right tabular-nums text-[10px] font-semibold text-amber-600 whitespace-nowrap">{withdrawalFees > 0 ? `+${formatAmount(withdrawalFees, cur)}` : '—'}</td>
                                <td className="fee-num px-4 py-2 text-right tabular-nums text-[10px] font-semibold text-amber-600 whitespace-nowrap">−{formatAmount(totalFees, cur)}</td>
                              </tr>
                            )}
                            {/* Net row */}
                            <tr className="bg-indigo-50/40 border-b-2 border-indigo-100">
                              <td className="row-label px-4 py-2.5">
                                <small className="text-[9px] font-black text-indigo-600 uppercase tracking-wider">Net</small>
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-[11px] font-black text-green-700 whitespace-nowrap">{formatAmount(netTopups, cur)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-[11px] font-black text-red-600 whitespace-nowrap">{formatAmount(netWithdrawals, cur)}</td>
                              <td className={`px-4 py-2.5 text-right tabular-nums text-[12px] font-black whitespace-nowrap ${balance >= 0 ? 'text-indigo-700' : 'text-orange-600'}`}>{formatAmount(balance, cur)}</td>
                            </tr>
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* USDT Conversion Breakdown */}
            {hasUsdtBreakdown && (
              <div className="conv-section">
                <p className="sec-label text-[9px] font-black uppercase tracking-[.16em] text-gray-400 mb-2">USDT Conversion Breakdown</p>
                {Object.entries(usdtBreakdown).map(([cur, { rows, totalUsdt }]) => (
                  <div key={cur} className="mb-3">
                    <div className="conv-table border border-indigo-200 rounded-xl overflow-hidden bg-white shadow-sm overflow-x-auto">
                      <table className="w-full" style={{ minWidth: '400px' }}>
                        <thead>
                          <tr className="bg-indigo-50">
                            <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-[.1em] text-indigo-500">Transaction</th>
                            <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.1em] text-indigo-500">Net {cur}</th>
                            <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.1em] text-indigo-500">÷ Stored Rate</th>
                            <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.1em] text-indigo-500">= USDT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr key={i} className={`border-b border-gray-100 ${row.type === 'topup' ? 'topup-row' : 'wd-row'}`}>
                              <td className={`px-4 py-2.5 text-[11px] font-bold ${row.type === 'topup' ? 'text-green-700' : 'text-red-600'}`}>
                                {row.type === 'topup' ? 'Top-up' : 'Withdrawal'}
                              </td>
                              <td className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-700 whitespace-nowrap">
                                {row.net >= 0 ? '' : '−'}{formatAmount(Math.abs(row.net), cur, true)}
                              </td>
                              <td className="rate-cell px-4 py-2.5 text-right text-[10px] text-gray-400 whitespace-nowrap">
                                ÷ {row.rate.toLocaleString('en-US')}
                              </td>
                              <td className={`px-4 py-2.5 text-right text-[11px] font-black whitespace-nowrap ${row.usdt >= 0 ? 'usdt-pos text-green-700' : 'usdt-neg text-red-600'}`}>
                                {row.usdt >= 0 ? '+' : ''}${row.usdt.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="conv-total bg-gray-900">
                            <td colSpan={3} className="px-4 py-3 text-[11px] font-black text-white">Total</td>
                            <td className={`px-4 py-3 text-right text-[13px] font-black whitespace-nowrap ${totalUsdt >= 0 ? 'total-usdt-pos text-emerald-300' : 'total-usdt-neg text-red-300'}`}>
                              {totalUsdt >= 0 ? '+' : ''}${totalUsdt.toFixed(2)} USDT {totalUsdt >= 0 ? '✓' : ''}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ))}
                {totalUsdtAll !== null && Object.keys(balanceByCurrency).length > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-indigo-700 rounded-xl text-white mt-1">
                    <span className="text-[10px] font-black uppercase tracking-wider opacity-80">Total Balance in USDT (all currencies)</span>
                    <span className={`text-base font-black ${totalUsdtAll >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {totalUsdtAll >= 0 ? '+' : ''}${totalUsdtAll.toFixed(2)} USDT
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Transaction Detail */}
            <div>
              <p className="sec-label text-[9px] font-black uppercase tracking-[.16em] text-gray-400 mb-2">Transaction Detail</p>
              {txnWithBalance.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400 border border-gray-200 rounded-xl bg-white">No transactions.</div>
              ) : (
                <div className="txn-table border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  {/* Horizontally scrollable on small screens */}
                  <div className="overflow-x-auto">
                    <table className="w-full" style={{ minWidth: '620px' }}>
                      <thead>
                        <tr className="bg-gray-50 border-b-2 border-gray-200">
                          <th className="px-3 py-3 text-left text-[9px] font-black uppercase tracking-[.12em] text-gray-400 whitespace-nowrap w-[100px]">Date</th>
                          <th className="px-3 py-3 text-left text-[9px] font-black uppercase tracking-[.12em] text-gray-400">Description</th>
                          <th className="px-3 py-3 text-right text-[9px] font-black uppercase tracking-[.12em] text-gray-500 whitespace-nowrap">Gross Amt</th>
                          <th className="px-3 py-3 text-right text-[9px] font-black uppercase tracking-[.12em] text-amber-500 whitespace-nowrap">Bank Fee</th>
                          <th className="px-3 py-3 text-right text-[9px] font-black uppercase tracking-[.12em] text-indigo-500 whitespace-nowrap">Net Amt</th>
                          <th className="px-3 py-3 text-right text-[9px] font-black uppercase tracking-[.12em] text-gray-400 whitespace-nowrap">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txnWithBalance.map((txn, i, arr) => {
                          const isTopup = txn.type === 'topup'
                          const cur = txn.currency || 'USDT'
                          const feeSign = isTopup ? '−' : '+'
                          return (
                            <tr key={txn.id} className={`hover:bg-gray-50/80 transition-colors ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}>
                              {/* Date */}
                              <td className="px-3 py-3 whitespace-nowrap align-top">
                                <p className="text-[11px] font-bold text-gray-900">
                                  {new Date(txn.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  {new Date(txn.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </td>
                              {/* Description */}
                              <td className="px-3 py-3 align-top">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${isTopup ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                    {isTopup ? 'Top-up' : 'Withdrawal'}
                                  </span>
                                  <span className="text-[9px] font-black text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">{cur}</span>
                                </div>
                                {txn.notes && <p className="text-[10px] text-gray-400 mt-1 max-w-[120px] truncate">{txn.notes}</p>}
                              </td>
                              {/* Gross */}
                              <td className="px-3 py-3 text-right align-top whitespace-nowrap">
                                <span className={`text-[11px] font-semibold tabular-nums ${isTopup ? 'text-green-700' : 'text-red-600'}`}>
                                  {isTopup ? '+' : '−'}{formatAmount(Number(txn.amount), cur)}
                                </span>
                              </td>
                              {/* Fee */}
                              <td className="px-3 py-3 text-right align-top whitespace-nowrap">
                                {txn.fee > 0 ? (
                                  <div>
                                    <span className="text-[11px] font-semibold text-amber-600 tabular-nums">
                                      {feeSign}{formatAmount(txn.fee, cur)}
                                    </span>
                                    {txn.bank_fee_type === 'percent' && (
                                      <p className="text-[9px] text-amber-400 mt-0.5">{txn.bank_fee_value}%</p>
                                    )}
                                  </div>
                                ) : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                              {/* Net */}
                              <td className="px-3 py-3 text-right align-top whitespace-nowrap">
                                <span className={`text-[11px] font-black tabular-nums ${isTopup ? 'text-green-700' : 'text-red-600'}`}>
                                  {isTopup ? '+' : '−'}{formatAmount(txn.netDisplay, cur)}
                                </span>
                              </td>
                              {/* Balance */}
                              <td className={`px-3 py-3 text-right align-top text-[11px] font-black tabular-nums whitespace-nowrap ${txn.runningBalance >= 0 ? 'text-gray-900' : 'text-orange-600'}`}>
                                {formatAmount(txn.runningBalance, cur)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      {/* Totals footer */}
                      {Object.entries(balanceByCurrency).map(([cur, { topups, withdrawals, topupFees, withdrawalFees, totalFees, netTopups, netWithdrawals, balance }]) => (
                        <tfoot key={cur}>
                          <tr style={{ background: '#0f172a' }}>
                            <td colSpan={6} className="px-4 py-4">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/40">Summary — {cur}</p>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {/* Gross Deposits */}
                                <div className="bg-white/5 rounded-lg px-3 py-2.5">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-green-400/70 mb-1">Gross Deposits</p>
                                  <p className="text-sm font-black text-green-300 tabular-nums whitespace-nowrap">{formatAmount(topups, cur)}</p>
                                </div>
                                {/* Gross Withdrawals */}
                                <div className="bg-white/5 rounded-lg px-3 py-2.5">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-red-400/70 mb-1">Gross Withdrawals</p>
                                  <p className="text-sm font-black text-red-300 tabular-nums whitespace-nowrap">{formatAmount(withdrawals, cur)}</p>
                                </div>
                                {/* Total Bank Fees */}
                                <div className="bg-white/5 rounded-lg px-3 py-2.5">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-amber-400/70 mb-1">Total Bank Fees</p>
                                  <p className="text-sm font-black text-amber-300 tabular-nums whitespace-nowrap">
                                    {totalFees > 0 ? `−${formatAmount(totalFees, cur)}` : '—'}
                                  </p>
                                </div>
                                {/* Net Balance */}
                                <div className={`rounded-lg px-3 py-2.5 ${balance >= 0 ? 'bg-indigo-500/20' : 'bg-orange-500/20'}`}>
                                  <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${balance >= 0 ? 'text-indigo-300/70' : 'text-orange-300/70'}`}>Net Balance</p>
                                  <p className={`text-sm font-black tabular-nums whitespace-nowrap ${balance >= 0 ? 'text-indigo-200' : 'text-orange-300'}`}>{formatAmount(balance, cur)}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </tfoot>
                      ))}
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="footer flex items-center justify-between pt-4 border-t border-gray-200 text-[10px] text-gray-400">
              <span>Generated {generatedAt}</span>
              <span>For informational purposes only.</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [client, setClient] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [showStatementModal, setShowStatementModal] = useState(false)
  const [editingTxn, setEditingTxn] = useState(null)
  const [conversionRates, setConversionRates] = useState({ IDR: '', VND: '', HKD: '' })
  const [ratesLoading, setRatesLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [clientRes, txnRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase.from('transactions').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      ])

      if (clientRes.error) throw clientRes.error
      if (txnRes.error) throw txnRes.error

      setClient(clientRes.data)
      setTransactions(txnRes.data || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load client data')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setRatesLoading(true)
    fetch('https://api.frankfurter.app/latest?from=USD&to=IDR,HKD')
      .then(r => r.json())
      .then(d => {
        setConversionRates(prev => ({
          ...prev,
          IDR: d?.rates?.IDR ? String(Math.round(d.rates.IDR)) : '',
          HKD: d?.rates?.HKD ? String(d.rates.HKD.toFixed(2)) : '',
        }))
      })
      .catch(() => {})
      .finally(() => setRatesLoading(false))
  }, [])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) throw error
      toast.success('Client deleted successfully')
      navigate('/')
    } catch (err) {
      toast.error(err.message || 'Failed to delete client')
    } finally {
      setDeleting(false)
    }
  }

  const handleTransactionSuccess = () => {
    setShowTransactionModal(false)
    fetchData()
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!client) return null

  const balanceByCurrency = CURRENCIES.reduce((acc, cur) => {
    const txns = transactions.filter((t) => (t.currency || 'USDT') === cur)
    if (txns.length === 0) return acc
    const topups = txns.filter((t) => t.type === 'topup').reduce((s, t) => s + Number(t.amount), 0)
    const withdrawals = txns.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0)
    const topupFees = txns.filter((t) => t.type === 'topup').reduce((s, t) => s + Number(t.bank_fee_amount || 0), 0)
    const withdrawalFees = txns.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + Number(t.bank_fee_amount || 0), 0)
    const totalFees = topupFees + withdrawalFees
    const netTopups = topups - topupFees         // top-up net: fee deducted
    const netWithdrawals = withdrawals + withdrawalFees  // withdrawal net: fee added
    const balance = netTopups - netWithdrawals
    acc[cur] = { topups, withdrawals, topupFees, withdrawalFees, totalFees, netTopups, netWithdrawals, balance }
    return acc
  }, {})

  // Per-transaction USDT: each transaction divided by its own stored exchange_rate
  const usdtByTxnRate = CURRENCIES.filter(c => c !== 'USDT').reduce((acc, cur) => {
    const txns = transactions.filter(t => (t.currency || 'USDT') === cur)
    if (txns.length === 0) return acc
    const allHaveRate = txns.every(t => Number(t.exchange_rate) > 0)
    if (!allHaveRate) { acc[cur] = null; return acc }
    acc[cur] = txns.reduce((sum, t) => {
      const fee = Number(t.bank_fee_amount || 0)
      const net = t.type === 'topup'
        ? Number(t.amount) - fee
        : -(Number(t.amount) + fee)
      return sum + net / Number(t.exchange_rate)
    }, 0)
    return acc
  }, {})

  const activeCurrencies = Object.keys(balanceByCurrency)
  const initial = client.full_name?.charAt(0).toUpperCase() || '?'
  const avatarColor = getAvatarColor(client.full_name || '')

  // Compute running balance per transaction (ordered oldest→newest, then reverse)
  const txnWithBalance = [...transactions].reverse().reduce((acc, txn) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0
    const fee = Number(txn.bank_fee_amount || 0)
    const netDisplay = txn.type === 'topup'
      ? Number(txn.amount) - fee     // top-up net: fee deducted
      : Number(txn.amount) + fee     // withdrawal net: fee added
    const runningBalance = txn.type === 'topup'
      ? prev + netDisplay
      : prev - netDisplay
    return [...acc, { ...txn, runningBalance, netDisplay }]
  }, []).reverse()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>

      {/* Client Header Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {/* Avatar */}
          <div className={`w-16 h-16 rounded-2xl shrink-0 overflow-hidden ${!client.profile_pic_url ? `${avatarColor} flex items-center justify-center` : ''}`}>
            {client.profile_pic_url ? (
              <img src={client.profile_pic_url} alt={client.full_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold text-2xl">{initial}</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">{client.full_name}</h1>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-gray-500">
              {client.email && (
                <span className="flex items-center gap-1.5">
                  <Mail size={14} className="text-gray-400" />
                  {client.email}
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone size={14} className="text-gray-400" />
                  {client.phone}
                </span>
              )}
              {client.user_id && (
                <span className="flex items-center gap-1.5">
                  <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md"># {client.user_id}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-400" />
                Added {formatDateShort(client.created_at)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {client.id_card_url && (
              <a
                href={client.id_card_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                title="View ID Card"
              >
                <FileText size={15} />
                <span className="hidden sm:inline">ID Card</span>
              </a>
            )}
            <Link
              to={`/clients/${id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Pencil size={15} />
              <span className="hidden sm:inline">Edit</span>
            </Link>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-200 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={15} />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>

        {/* ID Card thumbnail if image */}
        {client.id_card_url && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(client.id_card_url) && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">ID Card</p>
            <a href={client.id_card_url} target="_blank" rel="noopener noreferrer">
              <img
                src={client.id_card_url}
                alt="ID Card"
                className="h-24 w-auto rounded-xl border border-gray-200 object-cover hover:opacity-80 transition-opacity"
              />
            </a>
          </div>
        )}
      </div>

      {/* Balance Summary + USDT Conversion — unified card per currency */}
      {activeCurrencies.length === 0 ? null : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          {/* Header */}
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeCurrencies.map(cur => (
                cur === 'USDT'
                  ? <span key={cur} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full"><UsdtIcon size={11} /> USDT</span>
                  : <span key={cur} className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">{cur}</span>
              ))}
              <span className="text-xs text-gray-400">Balance Summary</span>
            </div>
            {activeCurrencies.some(c => c !== 'USDT') && (
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <UsdtIcon size={10} /> {ratesLoading ? 'Fetching rates…' : 'Live rate · editable'}
              </span>
            )}
          </div>

          {/* One row per currency */}
          {activeCurrencies.map((cur, idx) => {
            const { topups, withdrawals, topupFees, withdrawalFees, totalFees, netTopups, netWithdrawals, balance } = balanceByCurrency[cur]
            const grossBalance = topups - withdrawals
            const rate = parseFloat(conversionRates[cur]) || 0
            const autoUsdt = cur !== 'USDT' ? (usdtByTxnRate[cur] ?? null) : null
            const usdtVal = autoUsdt !== null ? autoUsdt : (cur !== 'USDT' && rate > 0 ? balance / rate : null)
            return (
              <div key={cur} className={idx > 0 ? 'border-t border-gray-100' : ''}>
                {/* Column headers */}
                <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50/60 border-b border-gray-100">
                  <div className="px-4 py-2 text-center">
                    <p className="text-[10px] text-green-600 font-bold flex items-center justify-center gap-1">
                      <TrendingUp size={10} /> Top-ups
                    </p>
                  </div>
                  <div className="px-4 py-2 text-center">
                    <p className="text-[10px] text-red-500 font-bold flex items-center justify-center gap-1">
                      <TrendingDown size={10} /> Withdrawals
                    </p>
                  </div>
                  <div className="px-4 py-2 text-center">
                    <p className={`text-[10px] font-bold flex items-center justify-center gap-1 ${balance >= 0 ? 'text-indigo-500' : 'text-orange-500'}`}>
                      <Wallet size={10} /> Balance
                    </p>
                  </div>
                </div>
                {/* Gross row */}
                <div className="grid grid-cols-3 divide-x divide-gray-100">
                  <div className="px-4 py-2 text-center">
                    <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Gross</p>
                    <p className="text-sm font-bold text-green-700">{formatAmount(topups, cur)}</p>
                  </div>
                  <div className="px-4 py-2 text-center">
                    <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Gross</p>
                    <p className="text-sm font-bold text-red-600">{formatAmount(withdrawals, cur)}</p>
                  </div>
                  <div className="px-4 py-2 text-center">
                    <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Gross</p>
                    <p className={`text-sm font-bold ${grossBalance >= 0 ? 'text-gray-600' : 'text-orange-500'}`}>{formatAmount(grossBalance, cur)}</p>
                  </div>
                </div>
                {/* Net row */}
                {totalFees > 0 && (
                  <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-dashed border-amber-200 bg-amber-50/30">
                    <div className="px-4 py-2 text-center">
                      <p className="text-[9px] text-amber-600 font-semibold uppercase tracking-wider mb-0.5">Net (−{formatAmount(topupFees, cur)} fee)</p>
                      <p className="text-sm font-black text-green-700">{formatAmount(netTopups, cur)}</p>
                    </div>
                    <div className="px-4 py-2 text-center">
                      <p className="text-[9px] text-amber-600 font-semibold uppercase tracking-wider mb-0.5">
                        Net {withdrawalFees > 0 ? `(+${formatAmount(withdrawalFees, cur)} fee)` : ''}
                      </p>
                      <p className="text-sm font-black text-red-600">{formatAmount(netWithdrawals, cur)}</p>
                    </div>
                    <div className="px-4 py-2 text-center">
                      <p className="text-[9px] text-amber-600 font-semibold uppercase tracking-wider mb-0.5">Net Balance</p>
                      <p className={`text-sm font-black ${balance >= 0 ? 'text-indigo-700' : 'text-orange-600'}`}>{formatAmount(balance, cur)}</p>
                    </div>
                  </div>
                )}

                {/* USDT conversion (non-USDT only) */}
                {cur !== 'USDT' && (
                  autoUsdt !== null ? (
                    <div className="px-5 py-3 bg-indigo-50/40 border-t border-indigo-100/60 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Per-transaction rate</span>
                      <span className={`text-sm font-black ${autoUsdt >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
                        ≈ ${autoUsdt.toFixed(2)} USDT
                      </span>
                    </div>
                  ) : (
                    <div className="px-5 py-3 bg-indigo-50/40 border-t border-indigo-100/60 flex items-center gap-3">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">1 USDT =</span>
                      <input
                        type="number"
                        value={conversionRates[cur]}
                        onChange={e => setConversionRates(prev => ({ ...prev, [cur]: e.target.value }))}
                        placeholder="Enter rate…"
                        min="0"
                        step="any"
                        className="w-32 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                      />
                      <span className="text-xs font-bold text-gray-400 shrink-0">{cur}</span>
                      <div className="flex-1 text-right">
                        {usdtVal !== null
                          ? <span className={`text-sm font-black ${usdtVal >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>≈ ${usdtVal.toFixed(2)} USDT</span>
                          : <span className="text-[11px] text-gray-300 italic">enter rate to convert</span>
                        }
                      </div>
                    </div>
                  )
                )}
              </div>
            )
          })}

          {/* Total USDT footer — only when all non-USDT rates are filled */}
          {activeCurrencies.some(c => c !== 'USDT') && (() => {
            const usdtDirect = balanceByCurrency['USDT']?.balance || 0
            const allFilled = activeCurrencies.filter(c => c !== 'USDT').every(c =>
              usdtByTxnRate[c] !== null && usdtByTxnRate[c] !== undefined ? true : parseFloat(conversionRates[c]) > 0
            )
            if (!allFilled) return null
            const total = usdtDirect + activeCurrencies.filter(c => c !== 'USDT').reduce((sum, c) => {
              const auto = usdtByTxnRate[c]
              if (auto !== null && auto !== undefined) return sum + auto
              return sum + balanceByCurrency[c].balance / parseFloat(conversionRates[c])
            }, 0)
            return (
              <div className="px-5 py-3 border-t-2 border-indigo-100 bg-indigo-50 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <UsdtIcon size={14} />
                  <span className="text-xs font-black text-indigo-800 uppercase tracking-wider">Total Balance in USDT</span>
                </div>
                <span className={`text-base font-black ${total >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>${total.toFixed(2)} USDT</span>
              </div>
            )
          })()}
        </div>
      )}

      {/* Transactions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Transaction History
            {transactions.length > 0 && (
              <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-normal">
                {transactions.length}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {transactions.length > 0 && (
              <button
                onClick={() => setShowStatementModal(true)}
                className="inline-flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                <FileText size={15} />
                View Statement
              </button>
            )}
            <button
              onClick={() => setShowTransactionModal(true)}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              <Plus size={15} />
              Add Transaction
            </button>
          </div>
        </div>

        {txnWithBalance.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
              <Receipt size={22} className="text-gray-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">No transactions yet</h3>
            <p className="text-xs text-gray-400 mb-4">Add a top-up or withdrawal to get started.</p>
            <button
              onClick={() => setShowTransactionModal(true)}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              <Plus size={14} />
              Add First Transaction
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {txnWithBalance.map((txn) => (
              <div key={txn.id} className="group flex items-start gap-3 p-4 hover:bg-gray-50/50 transition-colors">
                {/* Icon */}
                <div className={`mt-0.5 shrink-0 ${txn.type === 'topup' ? 'text-green-500' : 'text-red-500'}`}>
                  {txn.type === 'topup' ? <ArrowUpCircle size={22} /> : <ArrowDownCircle size={22} />}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${txn.type === 'topup' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {txn.type === 'topup' ? 'Top-up' : 'Withdrawal'}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      {txn.currency || 'USDT'}
                    </span>
                    {txn.receipt_url && (
                      <a href={txn.receipt_url} target="_blank" rel="noopener noreferrer"
                        className="text-indigo-500 hover:text-indigo-700 transition-colors" title="View Receipt">
                        <Receipt size={14} />
                      </a>
                    )}
                  </div>
                  {txn.notes && (
                    <p className="text-sm text-gray-600 truncate">{txn.notes}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(txn.created_at)}</p>
                </div>

                {/* Amounts + edit button */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setEditingTxn(txn)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                    title="Edit transaction"
                  >
                    <Pencil size={14} />
                  </button>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${txn.type === 'topup' ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.type === 'topup' ? '+' : '−'}{formatAmount(Number(txn.amount), txn.currency || 'USDT')}
                    </p>
                    {Number(txn.bank_fee_amount) !== 0 && (
                      <>
                        <p className="text-xs text-amber-600 mt-0.5">
                          Fee: {txn.type === 'withdrawal' ? '+' : '−'}{formatAmount(Math.abs(Number(txn.bank_fee_amount)), txn.currency || 'USDT')}
                        </p>
                        <p className={`text-xs font-semibold mt-0.5 ${txn.type === 'topup' ? 'text-green-700' : 'text-red-700'}`}>
                          Net: {txn.type === 'topup' ? '+' : '−'}{formatAmount(txn.netDisplay, txn.currency || 'USDT')}
                        </p>
                      </>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Bal: <span className={txn.runningBalance >= 0 ? 'text-gray-600' : 'text-orange-500'}>
                        {formatAmount(txn.runningBalance, txn.currency || 'USDT')}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <ConfirmDeleteModal
          clientName={client.full_name}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleting}
        />
      )}

      {/* Transaction Modal */}
      {showTransactionModal && (
        <TransactionModal
          clientId={id}
          onClose={() => setShowTransactionModal(false)}
          onSuccess={handleTransactionSuccess}
        />
      )}

      {/* Statement Modal */}
      {showStatementModal && (
        <StatementModal
          client={client}
          transactions={transactions}
          balanceByCurrency={balanceByCurrency}
          onClose={() => setShowStatementModal(false)}
        />
      )}

      {/* Edit Transaction Modal */}
      {editingTxn && (
        <EditTransactionModal
          txn={editingTxn}
          onClose={() => setEditingTxn(null)}
          onSuccess={() => { setEditingTxn(null); fetchData() }}
        />
      )}
    </div>
  )
}
