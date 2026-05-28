import { useState, useRef, useEffect } from 'react'
import { X, Upload, Loader2, Image, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import UsdtIcon from './UsdtIcon'

const CURRENCIES = [
  { code: 'USDT', symbol: 'USDT', label: 'USDT' },
  { code: 'IDR',  symbol: 'Rp',   label: 'IDR'  },
  { code: 'VND',  symbol: '₫',    label: 'VND'  },
  { code: 'HKD',  symbol: 'HK$',  label: 'HKD'  },
]

function fmtInput(val, currency) {
  const isDecimal = currency === 'USDT' || currency === 'HKD'
  let raw = val.replace(/,/g, '').replace(/[^0-9.]/g, '')
  if (!isDecimal) raw = raw.replace(/\./g, '')
  const parts = raw.split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart
}

export function formatAmount(amount, currency) {
  const num = Number(amount)
  switch (currency) {
    case 'IDR': return `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(num))}`
    case 'VND': return `₫${new Intl.NumberFormat('vi-VN').format(Math.round(num))}`
    case 'HKD': return `HK$${num.toFixed(2)}`
    case 'USDT':
    default:    return `$${num.toFixed(2)}`
  }
}

export default function TransactionModal({ clientId, onClose, onSuccess }) {
  const [type, setType] = useState('topup')
  const [currency, setCurrency] = useState('USDT')
  const [amount, setAmount] = useState('')
  const [bankFeeType, setBankFeeType] = useState('percent')
  const [bankFeeValue, setBankFeeValue] = useState('')
  const [notes, setNotes] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [exchangeRate, setExchangeRate] = useState('')
  const [loadingRate, setLoadingRate] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef(null)
  const backdropRef = useRef(null)

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            setReceiptFile(file)
            setReceiptPreview(URL.createObjectURL(file))
          }
          break
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  const handleReceiptChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setReceiptFile(file)
    setReceiptPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
  }

  const removeReceipt = () => {
    setReceiptFile(null)
    setReceiptPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) onClose()
  }

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

  const currencySymbol = CURRENCIES.find(c => c.code === currency)?.symbol || '$'

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || parsedAmt <= 0) {
      toast.error('Please enter a valid amount greater than 0')
      return
    }

    setLoading(true)
    try {
      const { data: txn, error: txnError } = await supabase
        .from('transactions')
        .insert({
          client_id: clientId,
          type,
          currency,
          amount: parsedAmt,
          exchange_rate: rateNum > 0 ? rateNum : null,
          bank_fee_type: bankFeeAmount > 0 ? bankFeeType : null,
          bank_fee_value: bankFeeAmount > 0 ? feeVal : null,
          bank_fee_amount: bankFeeAmount > 0 ? bankFeeAmount : null,
          notes: notes.trim() || null,
        })
        .select()
        .single()

      if (txnError) throw txnError

      if (receiptFile) {
        const ext = receiptFile.name.split('.').pop()
        const path = `${clientId}/${txn.id}-receipt.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(path, receiptFile, { upsert: true })
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ receipt_url: urlData.publicUrl })
          .eq('id', txn.id)
        if (updateError) throw updateError
      }

      toast.success(`${type === 'topup' ? 'Top-up' : 'Withdrawal'} recorded successfully!`)
      onSuccess()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to save transaction')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Add Transaction</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Type Toggle */}
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

          {/* Currency Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
            <div className="grid grid-cols-4 gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCurrency(c.code)}
                  className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                    currency === c.code
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-500 hover:border-indigo-200 hover:bg-indigo-50/30'
                  }`}
                >
                  {c.code === 'USDT'
                    ? <span className="flex items-center justify-center gap-1"><UsdtIcon size={14} /> USDT</span>
                    : c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500 min-w-[2.5rem]">
                {currencySymbol}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(fmtInput(e.target.value, currency))}
                placeholder="0"
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
              {/* Type toggle */}
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
              {/* Fee input */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                  {bankFeeType === 'percent' ? '%' : currencySymbol}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={bankFeeValue}
                  onChange={(e) => setBankFeeValue(e.target.value)}
                  placeholder={bankFeeType === 'percent' ? 'e.g. 2.5' : '0'}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                />
              </div>
              {/* Fee summary */}
              {bankFeeAmount > 0 && parsedAmt > 0 && (
                <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-700 font-semibold">
                      {type === 'withdrawal' ? 'Fee added' : 'Fee deducted'}
                    </span>
                    <span className={`font-black ${type === 'withdrawal' ? 'text-rose-600' : 'text-rose-600'}`}>
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

          {/* Receipt Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Receipt Photo</label>
            {receiptFile ? (
              <div className="border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                {receiptPreview ? (
                  <img src={receiptPreview} alt="Receipt" className="w-12 h-12 object-cover rounded-lg" />
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Image size={20} className="text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 font-medium truncate">{receiptFile.name}</p>
                  <p className="text-xs text-gray-400">{(receiptFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button type="button" onClick={removeReceipt}
                  className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
                <Upload size={20} className="text-gray-400" />
                <span className="text-sm text-gray-500">Click to upload or paste (Ctrl+V)</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleReceiptChange} className="hidden" />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                type === 'topup' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
              }`}>
              {loading ? <><Loader2 size={16} className="animate-spin" />Saving...</> : `Record ${type === 'topup' ? 'Top-up' : 'Withdrawal'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
