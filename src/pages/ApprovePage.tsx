import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

type PageStatus = 'loading' | 'ready' | 'submitting' | 'approved' | 'rejected' | 'already_acted' | 'error'

interface DocumentInfo {
  documentName: string
  senderName: string
  approverName: string
  signers: Array<{ name: string; email?: string }>
  createdAt: string
}

export default function ApprovePage() {
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()

  const [status, setStatus] = useState<PageStatus>('loading')
  const [docInfo, setDocInfo] = useState<DocumentInfo | null>(null)
  const [alreadyActedStatus, setAlreadyActedStatus] = useState<string>('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState('')

  // Pre-fill action from query param (email button links)
  const prefillAction = searchParams.get('action') as 'approve' | 'reject' | null

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('Token non valido')
      return
    }
    fetchDocumentInfo()
  }, [token])

  // If the email button prefills an action, auto-submit approve immediately
  useEffect(() => {
    if (status === 'ready' && prefillAction === 'approve') {
      handleApprove()
    } else if (status === 'ready' && prefillAction === 'reject') {
      setShowRejectForm(true)
    }
  }, [status, prefillAction])

  async function fetchDocumentInfo() {
    try {
      const res = await fetch(`/.netlify/functions/dr7trust-approve-get?token=${token}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Documento non trovato')
        setStatus('error')
        return
      }

      if (data.alreadyActed) {
        setAlreadyActedStatus(data.status)
        setDocInfo({ documentName: data.documentName, senderName: '', approverName: '', signers: [], createdAt: '' })
        setStatus('already_acted')
        return
      }

      setDocInfo({
        documentName: data.documentName,
        senderName: data.senderName,
        approverName: data.approverName,
        signers: data.signers || [],
        createdAt: data.createdAt,
      })
      setStatus('ready')
    } catch (err: any) {
      setError('Errore di connessione. Riprova.')
      setStatus('error')
    }
  }

  async function submitAction(action: 'approve' | 'reject', reason?: string) {
    setStatus('submitting')
    setError('')
    try {
      const res = await fetch('/.netlify/functions/dr7trust-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action, reason: reason || undefined })
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Errore durante l\'operazione')
        setStatus('ready')
        return
      }

      setStatus(action === 'approve' ? 'approved' : 'rejected')
    } catch (err: any) {
      setError('Errore di connessione. Riprova.')
      setStatus('ready')
    }
  }

  async function handleApprove() {
    await submitAction('approve')
  }

  async function handleReject() {
    await submitAction('reject', rejectReason.trim() || undefined)
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function renderLoading() {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
      </div>
    )
  }

  function renderError() {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6">
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-10 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#0d3d2a] mb-2">Link non valido</h2>
          <p className="text-gray-500 text-sm">{error || 'Il link di approvazione non è valido o è scaduto.'}</p>
        </div>
      </div>
    )
  }

  function renderAlreadyActed() {
    const wasApproved = alreadyActedStatus === 'approved'
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6">
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-10 max-w-md w-full text-center">
          <div className={`w-14 h-14 ${wasApproved ? 'bg-green-100' : 'bg-gray-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            {wasApproved ? (
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.75 12 6m0 0 3 3.75M12 6v12m-4.5 3.75h9" />
              </svg>
            )}
          </div>
          <h2 className="text-xl font-bold text-[#0d3d2a] mb-2 break-words">
            {wasApproved ? 'Hai gia approvato questo documento' : 'Hai gia risposto a questa richiesta'}
          </h2>
          <p className="text-gray-500 text-sm break-words">
            {docInfo?.documentName && <><strong>{docInfo.documentName}</strong> — </>}
            {wasApproved ? 'La tua approvazione è stata registrata.' : 'Hai già risposto a questa richiesta di approvazione.'}
          </p>
        </div>
      </div>
    )
  }

  function renderApproved() {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6">
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#0d3d2a] mb-3">Documento approvato</h2>
          <p className="text-gray-600 text-sm leading-relaxed break-words">
            Hai approvato l'invio di <strong>{docInfo?.documentName}</strong>.
            <br />
            Le richieste di firma sono state inviate ai firmatari.
            <br />
            Riceverai il PDF firmato al completamento.
          </p>
        </div>
      </div>
    )
  }

  function renderRejected() {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6">
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#0d3d2a] mb-3">Invio rifiutato</h2>
          <p className="text-gray-600 text-sm leading-relaxed break-words">
            Hai rifiutato l'invio di <strong>{docInfo?.documentName}</strong>.
            <br />
            Il mittente è stato notificato e il documento non è stato inviato ai firmatari.
          </p>
        </div>
      </div>
    )
  }

  function renderReady() {
    const isSubmitting = status === 'submitting'

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white rounded-2xl shadow-md w-full max-w-lg overflow-hidden">
          {/* Header */}
          <div className="bg-[#0d3d2a] px-6 sm:px-8 py-6 text-center">
            <img
              src="/dr7trust-logo.png"
              alt="DR7 Trust"
              className="h-10 w-auto mx-auto mb-3 rounded"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <p className="text-green-200 text-sm">Richiesta di Approvazione</p>
          </div>

          <div className="px-6 sm:px-8 py-6">
            {/* Greeting */}
            <p className="text-gray-700 text-sm mb-5 break-words">
              Ciao <strong>{docInfo?.approverName}</strong>, <strong>{docInfo?.senderName}</strong> richiede la tua approvazione prima di inviare il documento per la firma.
            </p>

            {/* Document name */}
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-5">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-0.5">Documento</p>
              <p className="text-[#0d3d2a] font-bold text-base break-words">{docInfo?.documentName}</p>
            </div>

            {/* Signers list */}
            {docInfo && docInfo.signers.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Firmatari previsti</p>
                <ul className="space-y-2">
                  {docInfo.signers.map((s, i) => (
                    <li key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                      <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-green-700 font-bold text-[10px]">{(s.name[0] || '?').toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                        {s.email && <p className="text-xs text-gray-400 truncate">{s.email}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Rejection form */}
            {showRejectForm && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo del rifiuto <span className="text-gray-400 font-normal">(opzionale)</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Descrivi il motivo del rifiuto..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none"
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* Action buttons */}
            {!showRejectForm ? (
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-md shadow-green-600/20 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  )}
                  Approva
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={isSubmitting}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                  Rifiuta
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowRejectForm(false); setRejectReason('') }}
                  disabled={isSubmitting}
                  className="px-4 py-3 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors font-medium text-sm disabled:opacity-60"
                >
                  Annulla
                </button>
                <button
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  )}
                  Conferma rifiuto
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 sm:px-8 pb-6 text-center">
            <p className="text-xs text-gray-300 break-words">DR7 Trust - Infrastructure for Digital Trust</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'loading' || (status === 'submitting' && !docInfo)) return renderLoading()
  if (status === 'error') return renderError()
  if (status === 'already_acted') return renderAlreadyActed()
  if (status === 'approved') return renderApproved()
  if (status === 'rejected') return renderRejected()
  return renderReady()
}
