import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import type { DocumentField, FieldType } from '../types/fields'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type SigningStatus = 'loading' | 'viewing' | 'otp_sending' | 'otp_sent' | 'otp_verifying' | 'signing' | 'signed' | 'expired' | 'error'

const FIELD_LABELS: Record<FieldType, string> = {
  signature: 'Firma',
  date: 'Data della firma',
  name: 'Nome del firmatario',
  email: 'Email del firmatario',
  text: 'Testo',
  label: 'Dicitura',
  checkbox: '',
  radio: '',
  initials: 'Iniziali',
  readonly: 'Testo sola lettura',
}

export default function SignPage() {
  const { token } = useParams<{ token: string }>()
  const [status, setStatus] = useState<SigningStatus>('loading')
  const [signerName, setSignerName] = useState('')
  const [documentName, setDocumentName] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null)
  const [signedAt, setSignedAt] = useState<string | null>(null)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [marketingConsent, setMarketingConsent] = useState<boolean | null>(true)
  const [otpChannel, setOtpChannel] = useState<'whatsapp' | 'email' | null>(null)
  const [requireOtp, setRequireOtp] = useState(true)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Fields
  const [fields, setFields] = useState<DocumentField[]>([])
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({})
  const [numPages, setNumPages] = useState(0)
  const [pdfReady, setPdfReady] = useState(false)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const pdfContainerRef = useRef<HTMLDivElement | null>(null)
  const [pdfWidth, setPdfWidth] = useState(() => Math.min(650, (typeof window !== 'undefined' ? window.innerWidth : 650) - 32))

  const hasFields = fields.length > 0

  // Track container width so the PDF re-renders on rotate / window resize
  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => {
      const containerW = pdfContainerRef.current?.clientWidth ?? (window.innerWidth - 32)
      setPdfWidth(Math.min(650, Math.max(280, containerW)))
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [pdfReady, numPages])

  // Fetch PDF as blob to avoid CORS issues with Supabase signed URLs
  useEffect(() => {
    if (!pdfUrl) return
    let cancelled = false
    async function loadPdf() {
      try {
        const res = await fetch(pdfUrl)
        if (!res.ok) throw new Error(`PDF fetch failed: ${res.status}`)
        const blob = await res.blob()
        if (!cancelled) setPdfBlobUrl(URL.createObjectURL(blob))
      } catch (err: any) {
        console.error('[SignPage] PDF blob load error:', err)
        // Fallback: use URL directly
        if (!cancelled) setPdfBlobUrl(pdfUrl)
      }
    }
    loadPdf()
    return () => { cancelled = true }
  }, [pdfUrl])

  useEffect(() => {
    if (token) loadData()
  }, [token])

  async function loadData() {
    try {
      const res = await fetch('/.netlify/functions/trustera-sign-get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      if (res.status === 410) { setStatus('expired'); return }
      if (!res.ok) { const err = await res.json(); setError(err.error); setStatus('error'); return }
      const data = await res.json()
      setSignerName(data.signerName)
      setDocumentName(data.documentName)
      setPdfUrl(data.pdfUrl)
      if (data.requireOtp === false) setRequireOtp(false)

      // Set fields and auto-fill values
      if (data.fields && data.fields.length > 0) {
        setFields(data.fields)
        const initialValues: Record<string, string | boolean> = {}
        for (const f of data.fields) {
          switch (f.field_type) {
            case 'name':
              initialValues[f.id] = data.signerName || ''
              break
            case 'email':
              initialValues[f.id] = data.signerEmail || ''
              break
            case 'date':
              initialValues[f.id] = new Date().toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' })
              break
            case 'signature':
              initialValues[f.id] = data.signerName || ''
              break
            case 'initials':
              initialValues[f.id] = (data.signerName || '').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 3)
              break
            case 'checkbox':
              initialValues[f.id] = false
              break
            case 'text':
              initialValues[f.id] = f.default_value || ''
              break
            case 'label':
              initialValues[f.id] = f.default_value || f.label || ''
              break
            default:
              initialValues[f.id] = ''
          }
        }
        setFieldValues(initialValues)
      }

      if (data.status === 'signed') {
        setSignedPdfUrl(data.signedPdfUrl)
        setSignedAt(data.signedAt)
        setStatus('signed')
      } else {
        setStatus('viewing')
      }
    } catch {
      setError('Impossibile caricare i dati')
      setStatus('error')
    }
  }

  function validateRequiredFields(): boolean {
    if (hasFields) {
      for (const f of fields) {
        if (!f.required) continue
        const val = fieldValues[f.id]
        if (f.field_type === 'checkbox') continue
        if (f.field_type === 'label') continue
        if (f.field_type === 'signature') continue
        if (!val || (typeof val === 'string' && !val.trim())) {
          setError(`Compila il campo "${f.label || FIELD_LABELS[f.field_type]}" prima di procedere`)
          return false
        }
      }
    }
    return true
  }

  function handleProceedWithoutOtp() {
    if (!validateRequiredFields()) return
    setStatus('signing')
  }

  async function handleRequestOtp() {
    if (!validateRequiredFields()) return

    setStatus('otp_sending')
    setError('')
    try {
      const res = await fetch('/.netlify/functions/trustera-sign-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      if (!res.ok) { const err = await res.json(); setError(err.error); setStatus('viewing'); return }
      const data = await res.json()
      if (data.channel) setOtpChannel(data.channel)
      setStatus('otp_sent')
      setOtp(['', '', '', '', '', ''])
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch {
      setError("Errore nell'invio del codice")
      setStatus('viewing')
    }
  }

  async function handleVerifyOtp() {
    const otpCode = otp.join('')
    if (otpCode.length !== 6) { setError('Inserisci il codice completo'); return }
    setStatus('otp_verifying')
    setError('')
    try {
      const res = await fetch('/.netlify/functions/trustera-sign-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, otp: otpCode })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.debug ? `${data.error} (${data.debug})` : data.error); setStatus('otp_sent'); return }
      setStatus('signing')
    } catch {
      setError('Errore nella verifica')
      setStatus('otp_sent')
    }
  }

  async function handleSign() {
    setError('')
    try {
      const res = await fetch('/.netlify/functions/trustera-sign-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          marketingConsent,
          fieldValues: hasFields ? fieldValues : undefined,
        })
      })
      if (!res.ok) { const err = await res.json(); setError(err.error); return }
      const data = await res.json()
      setSignedPdfUrl(data.signedPdfUrl)
      setSignedAt(data.signedAt)
      setStatus('signed')
    } catch {
      setError('Errore durante la firma')
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus()
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newOtp = [...otp]
    for (let i = 0; i < pasted.length; i++) newOtp[i] = pasted[i]
    setOtp(newOtp)
    otpRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  function updateFieldValue(fieldId: string, value: string | boolean) {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }))
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function renderFieldInput(field: DocumentField) {
    const val = fieldValues[field.id]

    switch (field.field_type) {
      case 'signature':
        return (
          <div className="w-full h-full flex items-center justify-center bg-green-50/60 border border-dashed border-green-400 rounded text-green-700 font-medium cursor-default"
            style={{ fontFamily: "'Caveat', 'Dancing Script', cursive", fontSize: '14px' }}>
            {val as string || signerName || 'Firma'}
          </div>
        )
      case 'initials':
        return (
          <div className="w-full h-full flex items-center justify-center bg-green-50/60 border border-dashed border-green-400 rounded text-green-700 font-bold cursor-default"
            style={{ fontFamily: "'Caveat', 'Dancing Script', cursive", fontSize: '13px', fontStyle: 'italic' }}>
            {val as string}
          </div>
        )
      case 'date':
        return (
          <div className="w-full h-full flex items-center px-1 text-xs text-gray-700 bg-white rounded truncate">
            {val as string}
          </div>
        )
      case 'name':
        return (
          <div className="w-full h-full flex items-center px-1 text-xs text-gray-700 bg-white rounded truncate">
            {val as string}
          </div>
        )
      case 'email':
        return (
          <div className="w-full h-full flex items-center px-1 text-xs text-gray-700 bg-white rounded truncate">
            {val as string}
          </div>
        )
      case 'text':
        return (
          <input
            type="text"
            value={(val as string) || ''}
            onChange={e => updateFieldValue(field.id, e.target.value)}
            placeholder={field.placeholder || field.label || 'Inserisci testo'}
            className="w-full h-full px-1 text-xs border border-dashed border-gray-300 rounded bg-white focus:border-green-500 focus:border-solid focus:outline-none"
          />
        )
      case 'checkbox':
        return (
          <div className="w-full h-full flex items-center justify-center">
            <input
              type="checkbox"
              checked={!!val}
              onChange={e => updateFieldValue(field.id, e.target.checked)}
              className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
          </div>
        )
      case 'radio':
        return (
          <div className="w-full h-full flex items-center justify-center">
            <input
              type="radio"
              name={field.radio_group || field.id}
              checked={!!val}
              onChange={() => {
                // Uncheck all radios in same group, check this one
                if (field.radio_group) {
                  const groupFields = fields.filter(f => f.radio_group === field.radio_group)
                  const updates: Record<string, boolean> = {}
                  groupFields.forEach(f => { updates[f.id] = f.id === field.id })
                  setFieldValues(prev => ({ ...prev, ...updates }))
                } else {
                  updateFieldValue(field.id, true)
                }
              }}
              className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
            />
          </div>
        )
      case 'label':
        return (
          <div className="w-full h-full flex items-center px-1 text-xs text-gray-600 truncate">
            {field.label || field.default_value || ''}
          </div>
        )
    }
  }

  // ── Loading / Error / Expired states ────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Link Scaduto</h1>
          <p className="text-gray-600">Il link di firma e scaduto. Contatta il mittente per un nuovo link.</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Errore</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-3 px-4 sm:py-4 sm:px-6 flex items-center justify-between gap-3">
        <img src="/trustera-logo.jpeg" alt="Trustera" className="h-9 sm:h-12 w-auto" />
        <span className="text-xs sm:text-sm text-gray-400 whitespace-nowrap">Firma Elettronica</span>
      </div>

      <div className="max-w-2xl mx-auto p-3 sm:p-6">
        {/* Document info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-xl font-bold text-gray-800 mb-1 break-words">{documentName || 'Documento'}</h1>
          <p className="text-sm text-gray-500 break-words">Firmatario: {signerName}</p>
        </div>

        {/* PDF viewer — react-pdf with field overlays */}
        {pdfUrl && status !== 'signed' && (
          <div ref={pdfContainerRef} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4 sm:mb-6">
            <Document
              file={pdfBlobUrl || pdfUrl}
              onLoadSuccess={({ numPages: n }) => { setNumPages(n); setPdfReady(true) }}
              loading={
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
                </div>
              }
              className="flex flex-col items-center"
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
                <div key={pageNum} className="relative w-full">
                  <Page
                    pageNumber={pageNum}
                    width={pdfWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />

                  {/* Field overlays for this page */}
                  {pdfReady && hasFields && fields
                    .filter(f => f.page_number === pageNum)
                    .map(field => (
                      <div
                        key={field.id}
                        className="absolute"
                        style={{
                          left: `${field.x_percent}%`,
                          top: `${field.y_percent}%`,
                          width: `${field.width_percent}%`,
                          height: `${field.height_percent}%`,
                        }}
                      >
                        {renderFieldInput(field)}
                      </div>
                    ))
                  }
                </div>
              ))}
            </Document>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Request OTP or proceed directly */}
        {status === 'viewing' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Firma il Documento</h2>
            {requireOtp ? (
              <>
                <p className="text-gray-600 text-sm mb-6">
                  {hasFields
                    ? 'Compila i campi sopra, poi clicca per ricevere il codice di verifica.'
                    : 'Invieremo un codice di verifica via WhatsApp o email.'}
                </p>
                <button
                  onClick={handleRequestOtp}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg"
                >
                  Invia Codice di Verifica
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-600 text-sm mb-6">
                  {hasFields
                    ? 'Compila i campi sopra, poi clicca per procedere alla firma.'
                    : 'Clicca per procedere alla firma del documento.'}
                </p>
                <button
                  onClick={handleProceedWithoutOtp}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg"
                >
                  Procedi alla Firma
                </button>
              </>
            )}
          </div>
        )}

        {status === 'otp_sending' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4" />
            <p className="text-gray-600">Invio codice di verifica...</p>
          </div>
        )}

        {/* Step 2: Enter OTP */}
        {(status === 'otp_sent' || status === 'otp_verifying') && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">Inserisci Codice OTP</h2>
            <p className="text-gray-600 text-sm mb-6 text-center">
              {otpChannel === 'whatsapp' ? 'Codice inviato via WhatsApp.' : 'Codice inviato via email.'}
            </p>
            <div className="flex justify-center gap-1.5 sm:gap-2 mb-6" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { otpRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                  disabled={status === 'otp_verifying'}
                />
              ))}
            </div>
            <div className="flex flex-col gap-3 items-center">
              <button
                onClick={handleVerifyOtp}
                disabled={otp.join('').length !== 6 || status === 'otp_verifying'}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-3 px-8 rounded-lg transition-colors w-full max-w-xs"
              >
                {status === 'otp_verifying' ? 'Verifica...' : 'Verifica Codice'}
              </button>
              <button onClick={handleRequestOtp} className="text-sm text-gray-500 hover:text-gray-700">
                Invia di nuovo
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm + marketing consent */}
        {status === 'signing' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">Conferma Firma</h2>
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6 text-sm text-green-700 text-center">
              Identita verificata con successo
            </div>

            {/* Marketing consent */}
            <label className="flex items-start gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingConsent === true}
                onChange={e => setMarketingConsent(e.target.checked)}
                className="mt-0.5 h-[18px] w-[18px] rounded-md border-gray-300 text-green-600 focus:ring-green-500 flex-shrink-0"
              />
              <span className="text-[13px] text-gray-600 leading-snug">
                Desidero ricevere aggiornamenti via email, inclusi suggerimenti, consigli e le ultime novità di Trustera.
              </span>
            </label>

            {/* Terms acceptance text */}
            <p className="text-[13px] text-gray-500 leading-snug mb-6">
              Continuando, accetti i{' '}
              <a href="/terms" target="_blank" rel="noreferrer" className="text-green-600 underline hover:text-green-700">Termini e Condizioni</a>
              {' '}e l&apos;
              <a href="/privacy" target="_blank" rel="noreferrer" className="text-green-600 underline hover:text-green-700">Informativa sulla privacy</a>
              {' '}di Trustera.
            </p>

            <button
              onClick={() => { handleSign() }}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition-colors text-lg"
            >
              Firma il Documento
            </button>
          </div>
        )}

        {/* Step 4: Signed */}
        {status === 'signed' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-green-700 mb-2">Documento Firmato</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-6">
              {signedAt
                ? `Firmato il ${new Date(signedAt).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}`
                : 'Firma completata.'
              }
            </p>
            {signedPdfUrl && (
              <a
                href={signedPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="block sm:inline-block w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 sm:px-8 rounded-lg transition-colors"
              >
                Scarica Documento Firmato
              </a>
            )}
            <p className="text-xs text-gray-400 mt-6 leading-relaxed">
              Firma gratuita in pochi secondi su{' '}
              <a href="https://dr7trust.com" className="text-green-600 hover:underline break-all">
                dr7trust.com
              </a>
            </p>
          </div>
        )}
      </div>

      <div className="text-center py-6 px-4 text-xs text-gray-400">
        Trustera - Infrastructure for Digital Trust
      </div>
    </div>
  )
}
