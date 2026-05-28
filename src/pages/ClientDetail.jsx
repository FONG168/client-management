import { useState, useEffect, useCallback, useRef } from 'react'
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
  const usdtEquiv = rateNum > 0 && parsedAmt > 0 ? parsedAmt / rateNum : null
  const feeVal = parseFloat(bankFeeValue.replace(/,/g, '')) || 0
  const bankFeeAmount = feeVal > 0
    ? (bankFeeType === 'percent' ? parsedAmt * (feeVal / 100) : feeVal)
    : 0
  const netAmount = type === 'withdrawal'
    ? parsedAmt + bankFeeAmount
    : Math.max(0, parsedAmt - bankFeeAmount)

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
                  <span className="text-indigo-600 font-semibold">{formatAmount(parsedAmt, currency)} ≈</span>
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
                  type="text"
                  inputMode="decimal"
                  value={bankFeeValue}
                  onChange={(e) => setBankFeeValue(bankFeeType === 'percent' ? e.target.value.replace(/[^0-9.]/g, '') : fmtInput(e.target.value, currency))}
                  placeholder={bankFeeType === 'percent' ? 'e.g. 2.5' : '0'}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                />
              </div>
              {bankFeeAmount > 0 && parsedAmt > 0 && (
                <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-700 font-semibold">
                      {type === 'withdrawal' ? 'Fee added' : 'Fee deducted'}
                    </span>
                    <span className="font-black text-rose-600">
                      {type === 'withdrawal' ? '+' : '−'}{formatAmount(bankFeeAmount, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-amber-200 pt-1.5">
                    <span className="text-amber-700 font-semibold">Net amount</span>
                    <div className="text-right">
                      <span className="font-bold text-gray-700">{formatAmount(netAmount, currency)}</span>
                      {rateNum > 0 && (
                        <span className="font-black text-indigo-600 ml-2">≈ ${(netAmount / rateNum).toFixed(2)} USDT</span>
                      )}
                    </div>
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
    const runningBalance = txn.type === 'topup'
      ? prev + Number(txn.amount) - fee
      : prev - Number(txn.amount) - fee
    return [...acc, { ...txn, runningBalance }]
  }, []).reverse()

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
      body{font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#111;background:#fff;padding:48px 56px}
      .doc-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #111}
      .org{font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#4f46e5;margin-bottom:6px}
      .title{font-size:24px;font-weight:900;color:#111;letter-spacing:-.02em}
      .meta-right{text-align:right;font-size:11px;color:#555;line-height:1.8}
      .meta-right strong{color:#111;font-weight:700}
      .client-block{display:flex;justify-content:space-between;align-items:flex-start;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin-bottom:28px}
      .client-block .label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:#9ca3af;margin-bottom:6px}
      .client-block .name{font-size:16px;font-weight:800;color:#111;margin-bottom:4px}
      .client-block .detail{font-size:11px;color:#555;margin-bottom:2px}
      .section-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:#9ca3af;margin-bottom:8px}
      table{width:100%;border-collapse:collapse}
      .summary-table{margin-bottom:28px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden}
      .summary-table th{background:#f9fafb;padding:9px 14px;text-align:left;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;border-bottom:1px solid #e5e7eb}
      .summary-table th:not(:first-child){text-align:right}
      .summary-table td{padding:11px 14px;border-bottom:1px solid #f3f4f6;font-size:12px;vertical-align:middle}
      .summary-table td:not(:first-child){text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
      .summary-table tr:last-child td{border-bottom:none}
      .txn-table{border:1px solid #e5e7eb;border-radius:10px;overflow:hidden}
      .txn-table th{background:#f9fafb;padding:9px 14px;text-align:left;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;border-bottom:1px solid #e5e7eb}
      .txn-table th:nth-child(3),.txn-table th:nth-child(4),.txn-table th:nth-child(5){text-align:right}
      .txn-table th:nth-child(3){color:#dc2626}.txn-table th:nth-child(4){color:#16a34a}
      .txn-table td{padding:10px 14px;border-bottom:1px solid #f3f4f6;font-size:11px;vertical-align:top}
      .txn-table td:nth-child(3),.txn-table td:nth-child(4),.txn-table td:nth-child(5){text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
      .txn-table tfoot td{background:#f9fafb;padding:9px 14px;font-size:11px;font-weight:800;border-top:2px solid #e5e7eb}
      .txn-table tfoot td:nth-child(3),.txn-table tfoot td:nth-child(4),.txn-table tfoot td:nth-child(5){text-align:right;font-variant-numeric:tabular-nums}
      .desc-main{font-weight:700;color:#111;font-size:12px}
      .desc-cur{font-size:9px;font-weight:800;color:#4f46e5;background:#eef2ff;padding:1px 5px;border-radius:4px;margin-left:4px}
      .desc-notes{font-size:10px;color:#9ca3af;margin-top:2px}
      .date-primary{font-weight:700;color:#111;font-size:12px}
      .date-secondary{color:#9ca3af;font-size:10px;margin-top:1px}
      .footer{margin-top:32px;padding-top:14px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af}
      @media print{body{padding:24px 32px}@page{margin:.8cm}}
    </style></head><body>${content}</body></html>`)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2 text-gray-500">
            <FileText size={14} />
            <span className="text-sm font-semibold text-gray-700">Account Statement</span>
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

            {/* Document header */}
            <div className="doc-header flex items-start justify-between pb-5 mb-6 border-b-2 border-gray-900">
              <div>
                <p className="org text-[10px] font-black tracking-[.16em] uppercase text-indigo-600 mb-1.5">Management Hub</p>
                <h1 className="title text-[22px] font-black text-gray-900 leading-none tracking-tight">Account Statement</h1>
              </div>
              <div className="meta-right text-right text-[11px] text-gray-500 leading-relaxed">
                <div><span className="font-bold text-gray-800 text-[10px] uppercase tracking-wider">Period</span><br />{periodStr}</div>
                <div className="mt-2"><span className="font-bold text-gray-800 text-[10px] uppercase tracking-wider">Issued</span><br />{generatedAt}</div>
              </div>
            </div>

            {/* Client block */}
            <div className="client-block mb-6">
              <div className="section-label text-[9px] font-black uppercase tracking-[.14em] text-gray-400 mb-2">Account Holder</div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-base shrink-0">
                  {client.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="name text-base font-black text-gray-900">{client.full_name}</p>
                  <div className="flex flex-wrap gap-x-4 mt-0.5">
                    {client.email && <p className="detail text-xs text-gray-500 flex items-center gap-1"><Mail size={10} />{client.email}</p>}
                    {client.phone && <p className="detail text-xs text-gray-500 flex items-center gap-1"><Phone size={10} />{client.phone}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Financial summary table */}
            {Object.entries(balanceByCurrency).length > 0 && (
              <div className="mb-6">
                <p className="section-label text-[9px] font-black uppercase tracking-[.14em] text-gray-400 mb-2">Financial Summary</p>
                <div className="summary-table border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-[.12em] text-gray-400">Currency</th>
                        <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.12em] text-green-500">Top-ups</th>
                        <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.12em] text-red-400">Withdrawals</th>
                        <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.12em] text-gray-400">Net Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(balanceByCurrency).map(([cur, { topups, withdrawals, topupFees, withdrawalFees, totalFees, balance }], i, arr) => (
                        <tr key={cur} className={i < arr.length - 1 ? 'border-b border-gray-100' : ''}>
                          <td className="px-4 py-3 font-black text-gray-900 text-sm">
                            {cur}
                            {topupFees > 0 && (
                              <p className="text-[10px] font-semibold text-amber-600 mt-0.5">−{formatAmount(topupFees, cur)} top-up fee</p>
                            )}
                            {withdrawalFees > 0 && (
                              <p className="text-[10px] font-semibold text-amber-600 mt-0.5">+{formatAmount(withdrawalFees, cur)} withdrawal fee</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-600 tabular-nums text-sm">{formatAmount(topups, cur)}</td>
                          <td className="px-4 py-3 text-right font-bold text-red-600 tabular-nums text-sm">{formatAmount(withdrawals, cur)}</td>
                          <td className={`px-4 py-3 text-right font-black tabular-nums text-sm ${balance >= 0 ? 'text-gray-900' : 'text-orange-600'}`}>{formatAmount(balance, cur)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Transaction detail */}
            <div>
              <p className="section-label text-[9px] font-black uppercase tracking-[.14em] text-gray-400 mb-2">Transaction Detail</p>
              {txnWithBalance.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400 border border-gray-200 rounded-xl">No transactions.</div>
              ) : (
                <div className="txn-table border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-[.12em] text-gray-400 w-28">Date</th>
                        <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-[.12em] text-gray-400">Description</th>
                        <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.12em] text-red-400">Debit (−)</th>
                        <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.12em] text-green-500">Credit (+)</th>
                        <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[.12em] text-gray-400">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txnWithBalance.map((txn, i, arr) => (
                        <tr key={txn.id} className={i < arr.length - 1 ? 'border-b border-gray-100' : ''}>
                          {/* Date */}
                          <td className="px-4 py-3.5 whitespace-nowrap align-top">
                            <p className="date-primary text-xs font-bold text-gray-900">
                              {new Date(txn.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            <p className="date-secondary text-[11px] text-gray-400 mt-0.5">
                              {new Date(txn.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </td>
                          {/* Description */}
                          <td className="px-4 py-3 align-middle">
                            <p className="text-sm font-semibold text-gray-800">
                              {txn.type === 'topup' ? 'Top-up' : 'Withdrawal'}
                              {(txn.currency || 'USDT') === 'USDT'
                                ? <span className="inline-flex items-center gap-0.5 ml-1.5 text-[10px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded"><UsdtIcon size={10} /> USDT</span>
                                : <span className="ml-1.5 text-[10px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">{txn.currency}</span>
                              }
                            </p>
                            {Number(txn.bank_fee_amount) > 0 && (
                              <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                                Fee {txn.bank_fee_type === 'percent' ? `${txn.bank_fee_value}%` : 'fixed'}: {txn.type === 'withdrawal' ? '+' : '−'}{formatAmount(Number(txn.bank_fee_amount), txn.currency || 'USDT')}
                              </p>
                            )}
                            {txn.notes && <p className="text-[10px] text-gray-400 mt-0.5">{txn.notes}</p>}
                          </td>
                          {/* Debit */}
                          <td className="px-4 py-3 text-right align-middle tabular-nums">
                            {txn.type === 'withdrawal'
                              ? <span className="text-sm font-bold text-red-600">{formatAmount(Number(txn.amount), txn.currency || 'USDT')}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          {/* Credit */}
                          <td className="px-4 py-3 text-right align-middle tabular-nums">
                            {txn.type === 'topup'
                              ? <span className="text-sm font-bold text-green-600">{formatAmount(Number(txn.amount), txn.currency || 'USDT')}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          {/* Balance */}
                          <td className={`px-4 py-3 text-right align-middle text-sm font-bold tabular-nums ${txn.runningBalance >= 0 ? 'text-gray-800' : 'text-orange-600'}`}>
                            {formatAmount(txn.runningBalance, txn.currency || 'USDT')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Totals row */}
                    {Object.entries(balanceByCurrency).map(([cur, { topups, withdrawals, topupFees, withdrawalFees, totalFees, balance }]) => (
                      <tfoot key={cur}>
                        <tr style={{ background: '#1e293b' }}>
                          <td className="px-4 py-3 align-middle" colSpan={2}>
                            <p className="text-[10px] font-black uppercase tracking-wider text-white/60">Total ({cur})</p>
                            {topupFees > 0 && (
                              <p className="text-[10px] text-amber-300/80 font-medium mt-0.5">−{formatAmount(topupFees, cur)} top-up fee</p>
                            )}
                            {withdrawalFees > 0 && (
                              <p className="text-[10px] text-amber-300/80 font-medium mt-0.5">+{formatAmount(withdrawalFees, cur)} withdrawal fee</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-black text-white/70 tabular-nums align-middle">{formatAmount(withdrawals, cur)}</td>
                          <td className="px-4 py-3 text-right text-sm font-black text-white/70 tabular-nums align-middle">{formatAmount(topups, cur)}</td>
                          <td className="px-4 py-3 text-right text-sm font-black text-white tabular-nums align-middle">{formatAmount(balance, cur)}</td>
                        </tr>
                      </tfoot>
                    ))}
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="footer mt-8 pt-4 border-t border-gray-200 flex justify-between text-[10px] text-gray-400">
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
    // balance = (topups - topupFees) - (withdrawals + withdrawalFees)
    acc[cur] = { topups, withdrawals, topupFees, withdrawalFees, totalFees, balance: topups - withdrawals - totalFees }
    return acc
  }, {})
  const activeCurrencies = Object.keys(balanceByCurrency)
  const initial = client.full_name?.charAt(0).toUpperCase() || '?'
  const avatarColor = getAvatarColor(client.full_name || '')

  // Compute running balance per transaction (ordered oldest→newest, then reverse)
  const txnWithBalance = [...transactions].reverse().reduce((acc, txn) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0
    const fee = Number(txn.bank_fee_amount || 0)
    const runningBalance = txn.type === 'topup'
      ? prev + Number(txn.amount) - fee
      : prev - Number(txn.amount) - fee
    return [...acc, { ...txn, runningBalance }]
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

      {/* Balance Summary — per currency */}
      {activeCurrencies.length === 0 ? null : (
        <div className="space-y-3 mb-6">
          {activeCurrencies.map((cur) => {
            const { topups, withdrawals, topupFees, withdrawalFees, totalFees, balance } = balanceByCurrency[cur]
            return (
              <div key={cur} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  {cur === 'USDT'
                    ? <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full"><UsdtIcon size={12} /> USDT</span>
                    : <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">{cur}</span>
                  }
                  <span className="text-xs text-gray-400">Balance Summary</span>
                </div>
                <div className="grid grid-cols-3 divide-x divide-gray-100">
                  <div className="p-4 text-center">
                    <p className="text-xs text-green-600 font-medium mb-1 flex items-center justify-center gap-1">
                      <TrendingUp size={12} /> Top-ups
                    </p>
                    <p className="text-base font-bold text-green-700">{formatAmount(topups, cur)}</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-xs text-red-600 font-medium mb-1 flex items-center justify-center gap-1">
                      <TrendingDown size={12} /> Withdrawals
                    </p>
                    <p className="text-base font-bold text-red-700">{formatAmount(withdrawals, cur)}</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className={`text-xs font-medium mb-1 flex items-center justify-center gap-1 ${balance >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>
                      <Wallet size={12} /> Balance
                    </p>
                    <p className={`text-base font-bold ${balance >= 0 ? 'text-indigo-700' : 'text-orange-700'}`}>
                      {formatAmount(balance, cur)}
                    </p>
                  </div>
                </div>
                {totalFees > 0 && (
                  <div className="px-5 py-2.5 border-t border-amber-100 bg-amber-50 space-y-1">
                    {topupFees > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          Top-up Fee Deducted
                        </span>
                        <span className="text-xs font-black text-rose-600">−{formatAmount(topupFees, cur)}</span>
                      </div>
                    )}
                    {withdrawalFees > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          Withdrawal Fee Added
                        </span>
                        <span className="text-xs font-black text-rose-600">+{formatAmount(withdrawalFees, cur)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* USDT Conversion Box — shown when client has non-USDT currencies */}
      {activeCurrencies.some(c => c !== 'USDT') && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <UsdtIcon size={14} />
            <span className="text-xs font-bold text-indigo-600">USDT Conversion</span>
            {ratesLoading && <span className="text-[10px] text-indigo-400 font-semibold">Fetching live rates…</span>}
            {!ratesLoading && <span className="text-[10px] text-gray-400">Live rate · editable</span>}
          </div>
          <div className="p-5 space-y-3">
            {activeCurrencies.filter(c => c !== 'USDT').map(cur => {
              const { balance } = balanceByCurrency[cur]
              const rate = parseFloat(conversionRates[cur]) || 0
              const usdtVal = rate > 0 ? balance / rate : null
              return (
                <div key={cur} className="flex items-center gap-3">
                  <span className="text-xs font-black text-gray-500 w-10 shrink-0">{cur}</span>
                  <div className="flex items-center gap-1.5 shrink-0 text-xs text-gray-400 font-semibold">
                    <span>1</span>
                    <UsdtIcon size={11} />
                    <span>=</span>
                  </div>
                  <input
                    type="number"
                    value={conversionRates[cur]}
                    onChange={e => setConversionRates(prev => ({ ...prev, [cur]: e.target.value }))}
                    placeholder="Enter rate…"
                    min="0"
                    step="any"
                    className="w-36 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                  />
                  <span className="text-xs font-bold text-gray-400 shrink-0">{cur}</span>
                  <div className="flex-1 text-right">
                    {usdtVal !== null
                      ? <span className={`text-sm font-black ${usdtVal >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>≈ ${usdtVal.toFixed(2)} USDT</span>
                      : <span className="text-xs text-gray-300 italic">— enter rate</span>
                    }
                  </div>
                </div>
              )
            })}
            {/* Total USDT row when multiple non-USDT currencies */}
            {(() => {
              const usdtDirect = balanceByCurrency['USDT']?.balance || 0
              const converted = activeCurrencies.filter(c => c !== 'USDT').reduce((sum, cur) => {
                const rate = parseFloat(conversionRates[cur]) || 0
                return rate > 0 ? sum + balanceByCurrency[cur].balance / rate : sum
              }, 0)
              const allRatesFilled = activeCurrencies.filter(c => c !== 'USDT').every(c => parseFloat(conversionRates[c]) > 0)
              if (!allRatesFilled) return null
              const total = usdtDirect + converted
              return (
                <div className="mt-1 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Balance in USDT</span>
                  <span className={`text-base font-black ${total >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>${total.toFixed(2)} USDT</span>
                </div>
              )
            })()}
          </div>
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
                      {txn.type === 'topup' ? '+' : '-'}{formatAmount(Number(txn.amount), txn.currency || 'USDT')}
                    </p>
                    {Number(txn.bank_fee_amount) > 0 && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Fee: {txn.type === 'withdrawal' ? '+' : '−'}{formatAmount(Number(txn.bank_fee_amount), txn.currency || 'USDT')}
                      </p>
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
