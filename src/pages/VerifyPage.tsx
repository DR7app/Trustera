import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

interface SignerInfo {
  name: string
  email: string
  phone: string
  channel: string
  signed_at: string
  signing_ip: string
  user_agent: string
  marketing_consent: boolean
}

interface AuditEvent {
  action: string
  email: string
  ip: string
  userAgent: string
  timestamp: string
  metadata: Record<string, any>
}

interface VerificationData {
  documentName: string
  signedAt: string
  createdAt: string | null
  originalHash: string
  senderName: string
  senderEmail?: string
  signers: SignerInfo[]
  auditTrail: AuditEvent[]
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    otp_sent: 'OTP Inviato',
    otp_verified: 'OTP Verificato',
    otp_failed: 'OTP Non Valido',
    otp_expired: 'OTP Scaduto',
    document_opened: 'Documento Visualizzato',
    document_viewed: 'Documento Visualizzato',
    signature_applied: 'Firma Applicata',
    document_signed: 'Documento Firmato',
    signing_completed: 'Firma Completata',
    email_sent: 'Link Inviato',
    whatsapp_sent: 'Link Inviato',
    link_sent: 'Link di Firma Inviato',
    signed_pdf_sent: 'PDF Firmato Inviato',
    approval_requested: 'Approvazione Richiesta',
    approval_approved: 'Approvato',
    approval_rejected: 'Rifiutato',
    request_created: 'Richiesta di Firma Creata',
    request_cancelled: 'Richiesta Annullata',
    integrity_check_failed: 'Verifica Integrità Fallita',
  }
  return map[action] || action.replace(/_/g, ' ')
}

function formatDescription(evt: AuditEvent): string {
  const name = evt.metadata?.signer_name || evt.metadata?.approver_name || ''
  const channel = evt.metadata?.channel === 'whatsapp' ? 'WhatsApp' : evt.metadata?.channel === 'email' ? 'Email' : ''

  switch (evt.action) {
    case 'email_sent': return `Link di firma inviato via Email${name ? ` a ${name}` : ''}`
    case 'whatsapp_sent': return `Link di firma inviato via WhatsApp${name ? ` a ${name}` : ''}`
    case 'document_opened': return `Documento visualizzato da ${name || evt.email}`
    case 'otp_sent': return `Codice OTP inviato via ${channel}${name ? ` a ${name}` : ''}`
    case 'otp_verified': return `Codice OTP verificato con successo da ${evt.email || name}`
    case 'otp_failed': return 'Codice OTP non valido'
    case 'otp_expired': return 'Codice OTP scaduto'
    case 'signature_applied': return `Documento firmato da ${name}${evt.email ? ` (${evt.email})` : ''}`
    case 'signing_completed': return 'Processo di firma completato — PDF firmato generato'
    case 'signed_pdf_sent': return `PDF firmato consegnato via ${channel}${name ? ` a ${name}` : ''}`
    case 'approval_requested': return `Richiesta di approvazione inviata a ${name || evt.email}`
    case 'approval_approved': return `Documento approvato da ${name || evt.email}`
    case 'approval_rejected': return `Documento rifiutato da ${name || evt.email}${evt.metadata?.reason ? ` — ${evt.metadata.reason}` : ''}`
    case 'request_created': return `Richiesta di firma creata per ${name || evt.metadata?.signer_role || 'firmatario'}`
    case 'request_cancelled': return 'Richiesta precedente annullata'
    case 'link_sent': return `Link di firma inviato via WhatsApp${name ? ` a ${name}` : ''}`
    case 'document_signed': return `Documento firmato da ${name || evt.email}`
    case 'integrity_check_failed': return 'Verifica integrità del documento fallita'
    default: return formatAction(evt.action)
  }
}

const fmtDate = (d: string) => new Date(d).toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'long', timeStyle: 'short' })
const fmtDateShort = (d: string) => new Date(d).toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'medium' })

export default function VerifyPage() {
  const { hash } = useParams<{ hash: string }>()
  const [data, setData] = useState<VerificationData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hash) { setError('Hash mancante'); setLoading(false); return }
    fetch('/.netlify/functions/trustera-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash })
    })
      .then(async res => {
        if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
        return res.json()
      })
      .then(setData)
      .catch(err => setError(err.message || 'Documento non trovato'))
      .finally(() => setLoading(false))
  }, [hash])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Verifica non riuscita</h1>
          <p className="text-gray-500">{error || 'Documento non trovato'}</p>
        </div>
      </div>
    )
  }

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-2 mt-6 mb-3">
      <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{children}</h2>
    </div>
  )

  const InfoRow = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
    <div className="py-1 min-w-0">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-sm text-gray-800 break-words ${mono ? 'font-mono text-xs break-all' : ''}`}>{value || '—'}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 px-2 sm:px-4 py-4 sm:py-8">
      <div className="bg-white shadow-lg max-w-3xl mx-auto overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4">
          <div className="flex items-center gap-4 mb-2">
            <img src="/trustera-logo.png" alt="Trustera" className="h-10 sm:h-12" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Audit Trail - Firma Elettronica</h1>
          <p className="text-sm text-gray-500 mt-1 break-words">{data.documentName}{data.signers[0] ? ` - ${data.signers[0].name}` : ''}</p>
        </div>

        <div className="px-4 sm:px-8 pb-6 sm:pb-8">
          {/* ── INFORMAZIONI DOCUMENTO ── */}
          <SectionTitle>Informazioni Documento</SectionTitle>
          <div className="bg-gray-50 rounded-lg px-4 sm:px-5 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
            <InfoRow label="Documento" value={data.documentName} />
            <InfoRow label="Inviato da" value={data.senderName || '—'} />
            {data.senderEmail && <InfoRow label="Email mittente" value={data.senderEmail} />}
            {data.createdAt && <InfoRow label="Data creazione" value={fmtDate(data.createdAt)} />}
            <InfoRow label="Data firma" value={fmtDate(data.signedAt)} />
          </div>

          {/* ── INFORMAZIONI FIRMATARIO (one per signer) ── */}
          {data.signers.map((s, i) => (
            <div key={i}>
              <SectionTitle>Informazioni Firmatario {data.signers.length > 1 ? `(${i + 1}/${data.signers.length})` : ''}</SectionTitle>
              <div className="bg-gray-50 rounded-lg px-4 sm:px-5 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                <InfoRow label="Nome e Cognome" value={s.name} />
                <InfoRow label="Email" value={s.email} />
                {s.phone && <InfoRow label="Telefono" value={s.phone} />}
                <InfoRow label="Data firma" value={fmtDateShort(s.signed_at)} />
                <InfoRow label="Canale" value={s.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} />
                <InfoRow label="IP" value={s.signing_ip} mono />
                {s.user_agent && <div className="sm:col-span-2"><InfoRow label="User Agent" value={s.user_agent} /></div>}
              </div>
            </div>
          ))}

          {/* ── VERIFICA INTEGRITA ── */}
          <SectionTitle>Verifica Integrita</SectionTitle>
          <div className="space-y-2">
            <div className="border border-gray-200 rounded-lg px-3 sm:px-4 py-3">
              <p className="text-xs font-semibold text-gray-700 mb-1">Hash SHA-256 Documento Originale:</p>
              <p className="text-[10px] sm:text-xs text-gray-600 font-mono break-all">{data.originalHash}</p>
            </div>
          </div>

          {/* ── REGISTRO EVENTI ── */}
          <SectionTitle>Registro Eventi</SectionTitle>
          {data.auditTrail.length > 0 ? (
            <div className="space-y-0">
              {/* Desktop table — hidden on mobile */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase w-[140px]">Data/Ora</th>
                      <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase w-[140px]">Evento</th>
                      <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase">Descrizione</th>
                      <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase w-[130px]">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.auditTrail.map((evt, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-xs text-gray-600 align-top whitespace-nowrap">{fmtDateShort(evt.timestamp)}</td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-gray-800 align-top">{formatAction(evt.action)}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 align-top">{formatDescription(evt)}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 font-mono align-top">{evt.ip || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards — visible only on mobile */}
              <div className="sm:hidden space-y-2">
                {data.auditTrail.map((evt, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-800">{formatAction(evt.action)}</span>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{fmtDateShort(evt.timestamp)}</span>
                    </div>
                    <p className="text-xs text-gray-600 break-words">{formatDescription(evt)}</p>
                    {evt.ip && <p className="text-[10px] text-gray-400 font-mono mt-1">IP: {evt.ip}</p>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic py-3">Nessun evento registrato. Gli eventi verranno tracciati per i nuovi documenti.</p>
          )}

          {/* ── Footer ── */}
          <div className="mt-8 pt-4 border-t border-gray-200 text-center space-y-1">
            <p className="text-xs text-gray-400">
              Firma elettronica avanzata conforme al Regolamento eIDAS (UE) 910/2014
            </p>
            <p className="text-[10px] text-gray-400">
              Questo certificato attesta l'autenticita e l'integrita del documento firmato digitalmente tramite Trustera.
            </p>
            <p className="text-[10px] text-gray-400 mt-2">
              Documento generato il {new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'medium' })}
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <img src="/trustera-logo.png" alt="Trustera" className="h-6" />
              <span className="text-xs text-green-600 font-medium">
                <a href="https://dr7trust.com" target="_blank" rel="noreferrer">www.dr7trust.com</a>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
