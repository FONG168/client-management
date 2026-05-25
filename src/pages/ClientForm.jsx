import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  User, Mail, Phone, Hash, Upload, Loader2, ArrowLeft,
  Trash2, FileText, ClipboardPaste, ImagePlus, CreditCard, UserCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

function FormField({ label, required, icon: Icon, children, hint }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
        {label}
        {required && <span className="text-rose-400">*</span>}
      </label>
      <div className="relative group">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 group-focus-within:text-indigo-500 transition-colors">
            <Icon size={15} />
          </div>
        )}
        {children}
      </div>
      {hint && <p className="text-xs text-gray-400 pl-1">{hint}</p>}
    </div>
  )
}

const inputCls = "w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100 transition-all"

function UploadZone({ label, icon: Icon, file, preview, existingUrl, existingLabel, dragOver, onDragOver, onDragLeave, onDrop, onClick, onPaste, onRemove, fileInputRef, onInputChange, accept, pasteLabel }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
        <Icon size={12} />
        {label}
      </label>

      {existingUrl && !file && (
        <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
            <FileText size={17} className="text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-indigo-700">{existingLabel}</p>
            <a href={existingUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-600 hover:underline truncate block transition-colors">
              View current file →
            </a>
          </div>
        </div>
      )}

      {file ? (
        <div className="flex items-center gap-3 p-3 bg-white border-2 border-indigo-200 rounded-xl shadow-sm">
          {preview ? (
            <img src={preview} alt="Preview" className="w-14 h-14 object-cover rounded-lg shadow-sm" />
          ) : (
            <div className="w-14 h-14 bg-indigo-50 rounded-lg flex items-center justify-center">
              <FileText size={22} className="text-indigo-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-700 truncate">{file.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB · Ready to upload</p>
          </div>
          <button type="button" onClick={onRemove}
            className="p-2 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {/* Drag & drop */}
          <div
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={onClick}
            className={`flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all text-center ${
              dragOver ? 'border-indigo-400 bg-indigo-50 scale-[0.99]' : 'border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40'
            }`}
          >
            <div className="w-9 h-9 bg-white border border-gray-200 rounded-xl flex items-center justify-center shadow-sm">
              <Upload size={16} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600">Click or drag & drop</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{accept === 'image/*' ? 'Images only' : 'Image or PDF'}</p>
            </div>
          </div>

          {/* Paste */}
          <div
            onPaste={onPaste} tabIndex={0}
            className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-200 bg-gray-50 rounded-xl cursor-text transition-all text-center focus:outline-none focus:border-indigo-400 focus:bg-indigo-50/40 hover:border-indigo-300 hover:bg-indigo-50/30 group"
          >
            <div className="w-9 h-9 bg-white border border-gray-200 rounded-xl flex items-center justify-center shadow-sm group-focus:border-indigo-300">
              <ClipboardPaste size={16} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600">Click, then Ctrl+V</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Paste from clipboard</p>
            </div>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept={accept} onChange={onInputChange} className="hidden" />
    </div>
  )
}

export default function ClientForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [userId, setUserId] = useState('')

  const [idCardFile, setIdCardFile] = useState(null)
  const [idCardPreview, setIdCardPreview] = useState(null)
  const [existingIdCardUrl, setExistingIdCardUrl] = useState(null)
  const [idCardDragOver, setIdCardDragOver] = useState(false)
  const idCardInputRef = useRef(null)

  const [profileFile, setProfileFile] = useState(null)
  const [profilePreview, setProfilePreview] = useState(null)
  const [existingProfileUrl, setExistingProfileUrl] = useState(null)
  const [profileDragOver, setProfileDragOver] = useState(false)
  const profileInputRef = useRef(null)

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(isEdit)

  useEffect(() => { if (isEdit) fetchClient() }, [id])

  const fetchClient = async () => {
    setFetching(true)
    try {
      const { data, error } = await supabase.from('clients').select('*').eq('id', id).single()
      if (error) throw error
      setFullName(data.full_name || '')
      setEmail(data.email || '')
      setPhone(data.phone || '')
      setUserId(data.user_id || '')
      setExistingIdCardUrl(data.id_card_url || null)
      setExistingProfileUrl(data.profile_pic_url || null)
    } catch (err) {
      toast.error('Failed to load client data')
      navigate('/')
    } finally {
      setFetching(false)
    }
  }

  const applyFile = (file, setFile, setPreview) => {
    if (!file) return
    setFile(file)
    setPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
  }

  const makePasteHandler = (setFile, setPreview) => (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const raw = item.getAsFile()
        if (raw) applyFile(new File([raw], `pasted-image-${Date.now()}.png`, { type: raw.type }), setFile, setPreview)
        break
      }
    }
  }

  const makeDrop = (setDrag, setFile, setPreview) => (e) => {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) applyFile(file, setFile, setPreview)
  }

  const uploadFile = async (bucket, path, file) => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) throw error
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fullName.trim()) { toast.error('Full name is required'); return }
    setLoading(true)
    try {
      const baseData = {
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        user_id: userId.trim() || null,
      }
      let finalId = isEdit ? id : null

      if (isEdit) {
        if (idCardFile) baseData.id_card_url = await uploadFile('id-cards', `${id}/id-card-${Date.now()}.${idCardFile.name.split('.').pop()}`, idCardFile)
        if (profileFile) baseData.profile_pic_url = await uploadFile('profile-pics', `${id}/profile-${Date.now()}.${profileFile.name.split('.').pop()}`, profileFile)
        const { error } = await supabase.from('clients').update(baseData).eq('id', id)
        if (error) throw error
        toast.success('Client updated!')
      } else {
        const { data: newClient, error: insertError } = await supabase.from('clients').insert(baseData).select().single()
        if (insertError) throw insertError
        finalId = newClient.id
        const updates = {}
        if (idCardFile) updates.id_card_url = await uploadFile('id-cards', `${finalId}/id-card-${Date.now()}.${idCardFile.name.split('.').pop()}`, idCardFile)
        if (profileFile) updates.profile_pic_url = await uploadFile('profile-pics', `${finalId}/profile-${Date.now()}.${profileFile.name.split('.').pop()}`, profileFile)
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase.from('clients').update(updates).eq('id', finalId)
          if (updateError) throw updateError
        }
        toast.success('Client added!')
      }
      navigate(`/clients/${finalId}`)
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to save client')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-indigo-500" />
          <p className="text-sm text-gray-400">Loading client data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f6fa] py-8 px-4">
      <div className="max-w-lg mx-auto">

        {/* Back link */}
        <Link
          to={isEdit ? `/clients/${id}` : '/'}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors group"
        >
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          {isEdit ? 'Back to Client' : 'Back to Dashboard'}
        </Link>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Gradient header */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 px-8 py-7 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10" />
            <div className="absolute -right-2 -top-12 w-20 h-20 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <UserCircle2 size={24} className="text-white" />
              </div>
              <div>
                <p className="text-indigo-200 text-[11px] font-bold uppercase tracking-widest mb-0.5">
                  {isEdit ? 'Editing Record' : 'New Record'}
                </p>
                <h1 className="text-xl font-black text-white tracking-tight">
                  {isEdit ? 'Edit Client' : 'Add New Client'}
                </h1>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-7 space-y-7">

            {/* ── Basic Info Section ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Basic Information</p>
              </div>

              <FormField label="Full Name" required icon={User}>
                <input
                  type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="John Doe" required
                  className={inputCls}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Email Address" icon={Mail}>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className={inputCls}
                  />
                </FormField>
                <FormField label="Phone Number" icon={Phone}>
                  <input
                    type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="+1 555 0000"
                    className={inputCls}
                  />
                </FormField>
              </div>

              <FormField label="User ID" icon={Hash} hint="Platform username, account number, or any reference ID">
                <input
                  type="text" value={userId} onChange={e => setUserId(e.target.value)}
                  placeholder="e.g. USR-001 or platform username"
                  className={inputCls}
                />
              </FormField>
            </div>

            {/* divider */}
            <div className="border-t border-gray-100" />

            {/* ── Documents Section ── */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-violet-500 rounded-full" />
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Documents & Media</p>
              </div>

              <UploadZone
                label="Profile Picture"
                icon={ImagePlus}
                file={profileFile} preview={profilePreview}
                existingUrl={existingProfileUrl} existingLabel="Current Profile Picture"
                dragOver={profileDragOver}
                onDragOver={e => { e.preventDefault(); setProfileDragOver(true) }}
                onDragLeave={() => setProfileDragOver(false)}
                onDrop={makeDrop(setProfileDragOver, setProfileFile, setProfilePreview)}
                onClick={() => profileInputRef.current?.click()}
                onPaste={makePasteHandler(setProfileFile, setProfilePreview)}
                onRemove={() => { setProfileFile(null); setProfilePreview(null); if (profileInputRef.current) profileInputRef.current.value = '' }}
                fileInputRef={profileInputRef}
                onInputChange={e => applyFile(e.target.files[0], setProfileFile, setProfilePreview)}
                accept="image/*"
                pasteLabel="Paste a photo"
              />

              <UploadZone
                label="ID Card"
                icon={CreditCard}
                file={idCardFile} preview={idCardPreview}
                existingUrl={existingIdCardUrl} existingLabel="Current ID Card"
                dragOver={idCardDragOver}
                onDragOver={e => { e.preventDefault(); setIdCardDragOver(true) }}
                onDragLeave={() => setIdCardDragOver(false)}
                onDrop={makeDrop(setIdCardDragOver, setIdCardFile, setIdCardPreview)}
                onClick={() => idCardInputRef.current?.click()}
                onPaste={makePasteHandler(setIdCardFile, setIdCardPreview)}
                onRemove={() => { setIdCardFile(null); setIdCardPreview(null); if (idCardInputRef.current) idCardInputRef.current.value = '' }}
                fileInputRef={idCardInputRef}
                onInputChange={e => applyFile(e.target.files[0], setIdCardFile, setIdCardPreview)}
                accept="image/*,.pdf"
                pasteLabel="Paste an image"
              />
            </div>

            {/* ── Actions ── */}
            <div className="flex gap-3 pt-1">
              <Link
                to={isEdit ? `/clients/${id}` : '/'}
                className="flex-1 py-3 px-4 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors text-center"
              >
                Cancel
              </Link>
              <button
                type="submit" disabled={loading}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-px disabled:translate-y-0 disabled:shadow-none"
              >
                {loading
                  ? <><Loader2 size={15} className="animate-spin" />Saving...</>
                  : isEdit ? 'Save Changes' : 'Add Client'
                }
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  )
}
