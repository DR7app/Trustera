import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'

type SigningStatus = 'loading' | 'viewing' | 'otp_sending' | 'otp_sent' | 'otp_verifying' | 'signing' | 'signed' | 'expired' | 'bloccato' | 'error'

interface ContractInfo {
    contractNumber: string
    pdfUrl: string
    customerName: string
    vehicleName: string
    rentalStartDate: string
    rentalEndDate: string
}

// 25/09/2026: il link di firma e' personale. Questo identificativo casuale
// resta nel browser e va con ogni chiamata: il server lega il link al primo
// dispositivo che lo apre e respinge gli altri (netlify/functions/utils/dispositivo.ts).
// Senza memoria del browser vale finche' la pagina resta aperta.
const CHIAVE_DISPOSITIVO = 'dr7trust_dispositivo'
let dispositivoInMemoria = ''
function idDispositivo(): string {
    try {
        const salvato = localStorage.getItem(CHIAVE_DISPOSITIVO)
        if (salvato) return salvato
    } catch { /* memoria del browser non disponibile */ }
    if (!dispositivoInMemoria) {
        dispositivoInMemoria = typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    }
    try { localStorage.setItem(CHIAVE_DISPOSITIVO, dispositivoInMemoria) } catch { /* idem */ }
    return dispositivoInMemoria
}

// 25/09/2026: posizione del dispositivo (Geolocation API del browser), chiesta
// all'apertura e subito prima della firma. Il server la registra cosi' com'e'
// (netlify/functions/signature-posizione.ts). Rifiutarla non blocca la firma,
// salvo che Centralina Pro la renda obbligatoria.
type FasePosizione = 'apertura' | 'firma'

function leggiPosizione(): Promise<Record<string, unknown>> {
    return new Promise(resolve => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            resolve({ esito: 'non_supportata' })
            return
        }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({
                esito: 'concessa',
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                timestamp: pos.timestamp,
            }),
            err => resolve({
                esito: err.code === err.PERMISSION_DENIED ? 'negata' : err.code === err.TIMEOUT ? 'timeout' : 'non_disponibile',
                errore: err.message,
            }),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        )
    })
}

async function statoPermessoPosizione(): Promise<string | null> {
    try {
        const p = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
        return p?.state || null
    } catch {
        return null
    }
}

export default function FirmaPage() {
    const { token } = useParams<{ token: string }>()
    const [status, setStatus] = useState<SigningStatus>('loading')
    const [signerName, setSignerName] = useState('')
    const [signerEmail, setSignerEmail] = useState('')
    const [contract, setContract] = useState<ContractInfo | null>(null)
    const [, setSignedPdfUrl] = useState<string | null>(null)
    const [signedAt, setSignedAt] = useState<string | null>(null)
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [error, setError] = useState('')
    const [remainingAttempts, setRemainingAttempts] = useState(5)
    const [acceptedTerms, setAcceptedTerms] = useState(true)
    const [acceptedMarketing, setAcceptedMarketing] = useState<boolean | null>(true)
    const [existingMarketingConsent, setExistingMarketingConsent] = useState<boolean | null>(null)
    const [showMarketingInfo, setShowMarketingInfo] = useState(false)
    const [otpChannel, setOtpChannel] = useState<'whatsapp' | 'email' | null>(null)
    // Centralina Pro > Firma del contratto: false = si firma con il pulsante,
    // senza codice.
    const [otpRequired, setOtpRequired] = useState(true)
    // Centralina Pro > Firma del contratto: posizione obbligatoria per firmare.
    const [gpsRequired, setGpsRequired] = useState(false)
    const otpRefs = useRef<(HTMLInputElement | null)[]>([])

    useEffect(() => {
        if (token) loadSigningData()
    }, [token])

    async function loadSigningData() {
        try {
            const res = await fetch('/.netlify/functions/signature-get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, deviceId: idDispositivo() })
            })

            if (res.status === 410) {
                setStatus('expired')
                return
            }

            if (!res.ok) {
                const err = await res.json()
                if (err.code === 'altro_dispositivo') { setStatus('bloccato'); return }
                setError(err.error || 'Errore nel caricamento')
                setStatus('error')
                return
            }

            const data = await res.json()
            setSignerName(data.signerName)
            setSignerEmail(data.signerEmail)
            setContract(data.contract)
            if (data.otpChannel) setOtpChannel(data.otpChannel)
            setOtpRequired(data.otpRequired !== false)
            setGpsRequired(data.gpsRequired === true)

            // If customer already consented to marketing, pre-fill and skip the question
            if (data.existingMarketingConsent === true) {
                setExistingMarketingConsent(true)
                setAcceptedMarketing(true)
            } else {
                setExistingMarketingConsent(data.existingMarketingConsent ?? null)
            }

            if (data.status === 'signed') {
                setSignedPdfUrl(data.signedPdfUrl)
                setSignedAt(data.signedAt)
                setStatus('signed')
            } else {
                setStatus('viewing')
                // Prima acquisizione della posizione (apertura del documento).
                acquisisciPosizione('apertura')
            }
        } catch {
            setError('Impossibile caricare i dati del documento')
            setStatus('error')
        }
    }

    // Chiede la posizione al browser e la manda al server. Non lancia mai
    // errori: una posizione mancante non deve rompere la firma.
    async function acquisisciPosizione(fase: FasePosizione): Promise<string> {
        const [posizione, permessoStato] = await Promise.all([leggiPosizione(), statoPermessoPosizione()])
        try {
            await fetch('/.netlify/functions/signature-posizione', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, deviceId: idDispositivo(), fase, permessoStato, ...posizione })
            })
        } catch { /* la firma va avanti lo stesso */ }
        return String(posizione.esito || '')
    }

    function consensiDati(): boolean {
        if (!acceptedTerms) {
            setError('Devi accettare i termini per procedere')
            return false
        }
        if (acceptedMarketing === null && existingMarketingConsent === null) {
            setError('Seleziona Si o No per le offerte DR7 Trust')
            return false
        }
        return true
    }

    // OTP spento in Centralina Pro: il pulsante "Firma il Contratto" e' l'atto
    // di firma. Il server ricontrolla la config prima di accettarlo.
    async function handleFirmaConPulsante() {
        if (!consensiDati()) return
        setStatus('signing')
        // Posizione il piu' vicino possibile alla firma.
        await acquisisciPosizione('firma')
        await eseguiFirma(true)
    }

    async function handleRequestOtp() {
        // Le condizioni si accettano PRIMA di ricevere il codice: da qui in
        // poi il codice e' la firma e non ci sono altri passaggi.
        if (!consensiDati()) return
        setStatus('otp_sending')
        setError('')
        try {
            const res = await fetch('/.netlify/functions/signature-send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, deviceId: idDispositivo() })
            })

            if (!res.ok) {
                const err = await res.json()
                if (err.code === 'altro_dispositivo') { setStatus('bloccato'); return }
                // La config e' cambiata dopo l'apertura della pagina: si passa
                // al pulsante invece di lasciare il cliente bloccato.
                if (err.otpRequired === false) setOtpRequired(false)
                setError(err.error)
                setStatus('viewing')
                return
            }

            const data = await res.json()
            if (data.channel) setOtpChannel(data.channel)

            setStatus('otp_sent')
            setOtp(['', '', '', '', '', ''])
            setTimeout(() => otpRefs.current[0]?.focus(), 100)
        } catch {
            setError('Errore nell\'invio del codice OTP')
            setStatus('viewing')
        }
    }

    async function handleVerifyOtp() {
        const otpCode = otp.join('')
        if (otpCode.length !== 6) {
            setError('Inserisci il codice completo a 6 cifre')
            return
        }

        setStatus('otp_verifying')
        setError('')
        // Posizione per la firma: parte insieme alla verifica del codice, cosi'
        // e' presa pochi secondi prima della firma senza farla aspettare.
        const posizioneFirma = acquisisciPosizione('firma')
        try {
            const res = await fetch('/.netlify/functions/signature-verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, otp: otpCode, deviceId: idDispositivo() })
            })

            const data = await res.json()

            if (!res.ok) {
                if (data.code === 'altro_dispositivo') { setStatus('bloccato'); return }
                setError(data.error)
                if (data.remainingAttempts !== undefined) {
                    setRemainingAttempts(data.remainingAttempts)
                }
                setStatus('otp_sent')
                return
            }

            // 14/09/2026 — il codice OTP FIRMA. Niente schermata di conferma
            // dopo: il cliente ha gia' accettato i termini prima di chiedere
            // il codice, e inserirlo e' l'atto di firma. Con la conferma in
            // fondo molti si fermavano li' e il contratto restava non firmato.
            setStatus('signing')
            await posizioneFirma
            await eseguiFirma()
        } catch {
            setError('Errore nella verifica del codice')
            setStatus('otp_sent')
        }
    }

    // Firma vera e propria. La chiama la verifica OTP appena il codice e'
    // valido: le condizioni (termini + risposta marketing) sono gia' state
    // date nel primo passo, qui non si chiede piu' niente.
    async function eseguiFirma(conPulsante = false) {
        setError('')
        try {
            const res = await fetch('/.netlify/functions/signature-complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, marketingConsent: acceptedMarketing, confermaFirma: conPulsante, deviceId: idDispositivo() })
            })

            if (!res.ok) {
                const err = await res.json()
                if (err.code === 'altro_dispositivo') { setStatus('bloccato'); return }
                setError(err.error)
                return
            }

            const data = await res.json()
            setSignedPdfUrl(data.signedPdfUrl)
            setSignedAt(data.signedAt)
            setStatus('signed')
        } catch {
            setError('Errore durante la firma del documento')
        }
    }


    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Caricamento documento...</p>
                </div>
            </div>
        )
    }

    if (status === 'expired') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
                    <div className="text-5xl mb-4">&#8987;</div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Link Scaduto</h1>
                    <p className="text-gray-600">Il link di firma e scaduto. Contatta il mittente per ricevere un nuovo link.</p>
                </div>
            </div>
        )
    }

    if (status === 'bloccato') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
                    <svg viewBox="0 0 24 24" className="h-12 w-12 mx-auto mb-4 text-yellow-600" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                        <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
                    </svg>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">NUOVO DISPOSITIVO RILEVATO</h1>
                    <p className="text-gray-600">
                        Questo contratto e' gia' associato a un altro dispositivo.
                    </p>
                    <p className="text-gray-600 mt-3">
                        Per motivi di sicurezza e' necessaria una nuova verifica prima di procedere con la firma:
                        contatta DR7 per ricevere un nuovo link.
                    </p>
                </div>
            </div>
        )
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
                    <div className="text-5xl mb-4">&#9888;&#65039;</div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Errore</h1>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white py-3 px-4 sm:py-4 sm:px-6 flex items-center justify-between gap-3 shadow-sm border-b border-gray-200">
                <img src="/dr7trust-icon.png" alt="DR7 Trust" className="h-8 sm:h-10" />
                <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">Firma Elettronica</span>
            </div>

            <div className="max-w-2xl mx-auto p-3 sm:p-6">
                {/* Contract Info Card */}
                {contract && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
                        <h1 className="text-lg sm:text-xl font-bold text-gray-800 mb-1 break-words">
                            {contract.vehicleName ? `Contratto ${contract.contractNumber}` : contract.contractNumber || 'Documento'}
                        </h1>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4 text-sm">
                            <div>
                                <span className="text-gray-500 block">Cliente</span>
                                <span className="font-semibold break-words">{signerName}</span>
                            </div>
                            {contract.vehicleName && (
                                <div>
                                    <span className="text-gray-500 block">Veicolo</span>
                                    <span className="font-semibold break-words">{contract.vehicleName}</span>
                                </div>
                            )}
                            {contract.rentalStartDate && (
                                <div>
                                    <span className="text-gray-500 block">Ritiro</span>
                                    <span className="font-semibold">
                                        {new Date(contract.rentalStartDate).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' })}
                                    </span>
                                </div>
                            )}
                            {contract.rentalEndDate && (
                                <div>
                                    <span className="text-gray-500 block">Riconsegna</span>
                                    <span className="font-semibold">
                                        {new Date(contract.rentalEndDate).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' })}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* PDF Viewer */}
                {contract?.pdfUrl && status !== 'signed' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4 sm:mb-6">
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                            <span className="text-sm text-gray-600 font-medium">Documento</span>
                        </div>
                        <iframe
                            src={`https://docs.google.com/gview?url=${encodeURIComponent(contract.pdfUrl)}&embedded=true`}
                            className="w-full border-0 h-[60vh] sm:h-[70vh] min-h-[320px] sm:min-h-[500px]"
                            title="Documento PDF"
                        />
                    </div>
                )}

                {/* Error message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
                        {error}
                    </div>
                )}

                {/* Step 1: dichiarazione, consensi e richiesta OTP.
                    14/09/2026 — tutto quello che il cliente deve accettare sta
                    QUI, prima del codice: il codice OTP e' l'ultimo gesto e
                    firma da solo. */}
                {status === 'viewing' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">Firma il Documento</h2>

                        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-gray-700">
                            <p className="mb-2">
                                Io, <strong>{signerName}</strong>, dichiaro di aver preso visione del documento
                                {contract?.contractNumber ? ` n. ${contract.contractNumber}` : ''} e di approvarne
                                integralmente il contenuto.
                            </p>
                            <p>
                                {otpRequired ? (
                                    <>
                                        Confermo che la firma viene apposta volontariamente tramite il codice di verifica
                                        {otpChannel === 'email' ? ` inviato a ${signerEmail}` : ' inviato via WhatsApp'}.
                                    </>
                                ) : (
                                    <>Confermo che la firma viene apposta volontariamente premendo il pulsante "Firma il Contratto".</>
                                )}
                            </p>
                        </div>

                        <p className="text-xs text-gray-500 mb-4">
                            {gpsRequired
                                ? "Per la sicurezza della firma DR7 registra la posizione del dispositivo: autorizzala quando il browser la chiede, senza posizione il documento non puo' essere firmato."
                                : "Per la sicurezza della firma DR7 registra la posizione del dispositivo, se la autorizzi quando il browser la chiede. Puoi firmare anche senza."}
                        </p>

                        <label className="flex items-start gap-3 mb-4 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={acceptedTerms}
                                onChange={e => setAcceptedTerms(e.target.checked)}
                                className="mt-1 h-5 w-5 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                            />
                            <span className="text-sm text-gray-700">
                                Confermo che i dati inseriti sono corretti e accetto i termini e le condizioni del documento.
                            </span>
                        </label>

                        {existingMarketingConsent !== true && (
                            <div className="mb-6">
                                <p className="text-sm text-gray-700 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowMarketingInfo(true)}
                                        className="underline text-yellow-700 hover:text-yellow-800 transition-colors"
                                    >
                                        Accetto vantaggi, offerte e sconti dedicati da DR7 Trust e partner.
                                    </button>
                                </p>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="marketing"
                                            checked={acceptedMarketing === true}
                                            onChange={() => setAcceptedMarketing(true)}
                                            className="h-5 w-5 text-yellow-600 focus:ring-yellow-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Si</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="marketing"
                                            checked={acceptedMarketing === false}
                                            onChange={() => setAcceptedMarketing(false)}
                                            className="h-5 w-5 text-yellow-600 focus:ring-yellow-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">No</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {otpRequired ? (
                            <>
                                <p className="text-gray-600 text-sm mb-4 text-center">
                                    {otpChannel === 'email'
                                        ? `Riceverai un codice a 6 cifre via email a ${signerEmail}: inserendolo il documento risulta firmato.`
                                        : 'Riceverai un codice a 6 cifre via WhatsApp: inserendolo il documento risulta firmato.'}
                                </p>
                                <button
                                    onClick={handleRequestOtp}
                                    disabled={!acceptedTerms || (existingMarketingConsent !== true && acceptedMarketing === null)}
                                    className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-lg transition-colors text-lg"
                                >
                                    Invia Codice di Verifica
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="text-gray-600 text-sm mb-4 text-center">
                                    Premendo il pulsante il documento risulta firmato.
                                </p>
                                <button
                                    onClick={handleFirmaConPulsante}
                                    disabled={!acceptedTerms || (existingMarketingConsent !== true && acceptedMarketing === null)}
                                    className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-lg transition-colors text-lg"
                                >
                                    Firma il Contratto
                                </button>
                            </>
                        )}
                    </div>
                )}

                {status === 'otp_sending' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Invio codice di verifica...</p>
                    </div>
                )}

                {/* Step 2: Enter OTP */}
                {(status === 'otp_sent' || status === 'otp_verifying') && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">Inserisci Codice OTP</h2>
                        <p className="text-gray-600 text-sm mb-6 text-center">
                            {otpChannel === 'whatsapp'
                                ? 'Abbiamo inviato un codice a 6 cifre via WhatsApp.'
                                : `Abbiamo inviato un codice a 6 cifre a ${signerEmail}`}
                            <br />
                            <span className="text-gray-500">Inserendolo firmi il documento.</span>
                        </p>

                        <div className="flex justify-center mb-6">
                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                value={otp.join('')}
                                onChange={e => {
                                    const digits = e.target.value.replace(/\D/g, '').slice(0, 6).split('')
                                    setOtp(['', '', '', '', '', ''].map((_, i) => digits[i] || ''))
                                }}
                                placeholder="Inserisci il codice a 6 cifre"
                                className="w-full max-w-xs h-14 text-center text-2xl font-bold tracking-[0.4em] border-2 border-gray-300 rounded-lg focus:border-yellow-500 focus:outline-none transition-colors placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-400"
                                disabled={status === 'otp_verifying'}
                                autoFocus
                            />
                        </div>

                        {remainingAttempts < 5 && (
                            <p className="text-center text-sm text-orange-600 mb-4">
                                Tentativi rimanenti: {remainingAttempts}
                            </p>
                        )}

                        <div className="flex flex-col gap-3 items-center">
                            <button
                                onClick={handleVerifyOtp}
                                disabled={otp.join('').length !== 6 || status === 'otp_verifying'}
                                className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-300 text-white font-bold py-3 px-8 rounded-lg transition-colors w-full max-w-xs"
                            >
                                {status === 'otp_verifying' ? 'Firma in corso...' : 'Firma il Documento'}
                            </button>
                            <button
                                onClick={handleRequestOtp}
                                disabled={status === 'otp_verifying'}
                                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                Non hai ricevuto il codice? Invia di nuovo
                            </button>
                        </div>
                    </div>
                )}

                {/* Firma in corso. Il passaggio di conferma che stava qui e'
                    stato tolto il 14/09/2026: i termini si accettano prima del
                    codice e l'OTP firma da solo. Resta l'attesa e, se qualcosa
                    va storto dopo un codice valido, un solo bottone per
                    riprovare senza rifare l'OTP. */}
                {status === 'signing' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                        {error ? (
                            <>
                                <h2 className="text-lg font-bold text-gray-800 mb-2">Firma non completata</h2>
                                <p className="text-gray-600 text-sm mb-6">
                                    {otpRequired ? "Il codice e' stato verificato. Riprova a completare la firma." : 'Riprova a completare la firma.'}
                                </p>
                                <button
                                    onClick={() => eseguiFirma(!otpRequired)}
                                    className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
                                >
                                    Riprova la firma
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-4"></div>
                                <p className="text-gray-600">Firma del documento in corso...</p>
                            </>
                        )}
                    </div>
                )}

                {/* Step 4: Signed */}
                {status === 'signed' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 text-center">
                        <div className="text-5xl mb-4">&#9989;</div>
                        <h2 className="text-xl sm:text-2xl font-bold text-green-700 mb-2">Documento Firmato</h2>
                        <p className="text-sm sm:text-base text-gray-600 mb-2 leading-relaxed">
                            Il documento e stato firmato con successo
                            {signedAt && !isNaN(new Date(signedAt).getTime()) ? ` il ${new Date(signedAt).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}` : ''}.
                        </p>
                        <p className="text-gray-500 text-sm mb-2 leading-relaxed">
                            Riceverai una copia del documento firmato via WhatsApp.
                        </p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="text-center py-6 px-4 text-xs text-gray-400 leading-relaxed">
                <span className="block sm:inline">DR7 S.p.A.</span>
                <span className="hidden sm:inline"> &middot; </span>
                <span className="block sm:inline">Via del Fangario 25, 09122 Cagliari (CA)</span>
                <span className="hidden sm:inline"> &middot; </span>
                <span className="block sm:inline">P.IVA 04104640927</span>
            </div>

            {/* Marketing Info Modal */}
            {showMarketingInfo && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowMarketingInfo(false)}>
                    <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-lg w-full max-h-[90vh] sm:max-h-[80vh] overflow-y-auto p-4 sm:p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">
                            INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI PER FINALITA DI MARKETING
                        </h3>
                        <div className="text-sm text-gray-700 space-y-3">
                            <p>Ai sensi del Regolamento (UE) 2016/679 ("GDPR"), previo consenso dell'utente, DR7 Trust potra trattare i dati personali forniti durante l'utilizzo della piattaforma (quali ad esempio dati identificativi e di contatto) per finalita di marketing e comunicazioni commerciali.</p>
                            <p>I dati potranno essere utilizzati per l'invio di vantaggi, offerte, promozioni e sconti dedicati relativi a prodotti o servizi che potrebbero essere di interesse per l'utente.</p>
                            <p>Le comunicazioni potranno essere effettuate tramite diversi canali di contatto, tra cui, a titolo esemplificativo: email, SMS, telefono, notifiche push, applicazioni di messaggistica (come ad esempio WhatsApp) e altri strumenti di comunicazione elettronica o digitale.</p>
                            <p>Previo consenso dell'utente, i dati potranno essere trattati da DR7 Trust, partner selezionati, e resi disponibili anche attraverso DR7 Platform, una piattaforma digitale utilizzata per la gestione e la distribuzione di opportunita commerciali e offerte da parte di aziende e partner aderenti.</p>
                            <p>Attraverso DR7 Platform, i dati potranno essere utilizzati da partner commerciali selezionati presenti sulla piattaforma, al fine di proporre comunicazioni commerciali, offerte, promozioni, vantaggi e sconti dedicati.</p>
                            <p>Tali partner possono appartenere a diverse categorie merceologiche e settori economici, inclusi, a titolo esemplificativo ma non esaustivo, aziende operanti nei settori retail e beni di consumo, moda e abbigliamento, e-commerce, servizi digitali e tecnologici, telecomunicazioni, mobilita, turismo, energia, assicurazioni, servizi finanziari, servizi professionali, casa, benessere, tempo libero e altri prodotti o servizi potenzialmente di interesse per l'utente.</p>
                            <p>Il consenso al trattamento dei dati per finalita di marketing e facoltativo e non e necessario per l'utilizzo delle funzionalita principali della piattaforma.</p>
                            <p>L'utente puo revocare in qualsiasi momento il consenso prestato tramite i link di disiscrizione presenti nelle comunicazioni ricevute oppure attraverso i canali indicati nella privacy policy generale.</p>
                            <p>DR7 Trust conserva evidenza del consenso prestato, inclusi data, ora e log tecnici associati alla manifestazione di volonta dell'utente, al fine di dimostrare la liceita del trattamento.</p>
                            <p>L'utente puo esercitare in qualsiasi momento i diritti previsti dagli articoli 15-22 del GDPR, tra cui accesso ai dati personali, rettifica, cancellazione, limitazione del trattamento, opposizione e portabilita dei dati.</p>
                        </div>
                        <button
                            onClick={() => setShowMarketingInfo(false)}
                            className="mt-6 w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 rounded-lg transition-colors"
                        >
                            Chiudi
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
