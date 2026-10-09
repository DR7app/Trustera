import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type SigningStatus = 'loading' | 'viewing' | 'da_completare' | 'otp_sending' | 'otp_sent' | 'otp_verifying' | 'signing' | 'signed' | 'expired' | 'bloccato' | 'error'

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

const TESTO_TERMINI = 'Confermo che i dati inseriti sono corretti e accetto i termini e le condizioni del documento.'
const TESTO_MARKETING = 'Accetto vantaggi, offerte e sconti dedicati da DR7 Trust e partner.'

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
    // 09/10/2026: FIRMA (barra in basso) apre il "Riepilogo firma" con le due
    // caselle; la firma parte solo con "Accetta".
    const [riepilogoAperto, setRiepilogoAperto] = useState(false)
    const [otpChannel, setOtpChannel] = useState<'whatsapp' | 'email' | null>(null)
    // Centralina Pro > Firma del contratto: false = si firma con il pulsante,
    // senza codice.
    const [otpRequired, setOtpRequired] = useState(true)
    // Centralina Pro > Firma del contratto: posizione obbligatoria per firmare.
    const [gpsRequired, setGpsRequired] = useState(false)
    // 01/10/2026: codice gia' verificato ma firma non completata (errore dopo
    // l'OTP, pagina chiusa). Il server dice se la verifica vale ancora
    // (netlify/functions/utils/verificaOtp.ts).
    const [otpVerificatoValido, setOtpVerificatoValido] = useState(false)
    const otpRefs = useRef<(HTMLInputElement | null)[]>([])
    // 09/10/2026: il contratto si disegna pagina per pagina (react-pdf) a
    // tutta larghezza, senza i comandi del visualizzatore Google (freccia,
    // zoom) e senza spazio vuoto sotto. Se il PDF non si apre resta Google.
    const contenitorePdf = useRef<HTMLDivElement | null>(null)
    const [larghezzaPdf, setLarghezzaPdf] = useState(0)
    const [pagineContratto, setPagineContratto] = useState(0)
    const [pdfNonApribile, setPdfNonApribile] = useState(false)
    // 09/10/2026: scadenza del codice (dal server, expiresInMinutes) per il
    // conto alla rovescia del popup, come le firme delle finanziarie.
    const [scadenzaOtp, setScadenzaOtp] = useState<number | null>(null)
    const [durataOtpSecondi, setDurataOtpSecondi] = useState(120)
    const [ora, setOra] = useState(() => Date.now())

    useEffect(() => {
        if (token) loadSigningData()
    }, [token])

    useEffect(() => {
        const el = contenitorePdf.current
        if (!el) return
        const misura = () => setLarghezzaPdf(el.clientWidth)
        misura()
        const ro = new ResizeObserver(misura)
        ro.observe(el)
        return () => ro.disconnect()
    }, [contract?.pdfUrl, status])

    // Conto alla rovescia: un tick al secondo solo col popup del codice aperto.
    const popupCodiceAperto = status === 'otp_sending' || status === 'otp_sent' || status === 'otp_verifying'
    useEffect(() => {
        if (!popupCodiceAperto || scadenzaOtp === null) return
        setOra(Date.now())
        const t = setInterval(() => setOra(Date.now()), 1000)
        return () => clearInterval(t)
    }, [popupCodiceAperto, scadenzaOtp])
    const secondiRimasti = scadenzaOtp === null ? null : Math.max(0, Math.ceil((scadenzaOtp - ora) / 1000))
    const codiceScaduto = secondiRimasti === 0

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
            setOtpVerificatoValido(data.otpVerificatoValido === true)

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
            } else if (data.status === 'otp_verified' && data.otpVerificatoValido === true) {
                // 01/10/2026: codice gia' verificato, firma da completare.
                // Prima la pagina tornava a "Invia codice", il server
                // rispondeva "OTP gia verificato" e nessun bottone firmava.
                setStatus('da_completare')
                acquisisciPosizione('apertura')
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

    function apriRiepilogo() {
        setError('')
        setRiepilogoAperto(true)
    }

    // Accetta: codice gia' verificato = completa la firma; OTP spento = firma
    // col pulsante; altrimenti manda il codice (si apre il popup del codice).
    function accettaRiepilogo() {
        if (!consensiDati()) return
        setRiepilogoAperto(false)
        if (status === 'da_completare') handleCompletaFirma()
        else if (!otpRequired) handleFirmaConPulsante()
        else handleRequestOtp()
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
                // 01/10/2026: codice gia' verificato da poco: si completa la
                // firma invece di restare su "Invia codice".
                if (err.code === 'otp_gia_verificato') {
                    setOtpVerificatoValido(true)
                    setError('')
                    setStatus('da_completare')
                    return
                }
                setError(err.error || 'Impossibile inviare il codice. Riprova.')
                setStatus('viewing')
                return
            }

            const data = await res.json()
            if (data.channel) setOtpChannel(data.channel)
            const minuti = Number(data.expiresInMinutes) > 0 ? Number(data.expiresInMinutes) : 2
            setDurataOtpSecondi(minuti * 60)
            setScadenzaOtp(Date.now() + minuti * 60 * 1000)

            setStatus('otp_sent')
            setOtp(['', '', '', '', '', ''])
            setTimeout(() => otpRefs.current[0]?.focus(), 100)
        } catch {
            setError('Errore nell\'invio del codice OTP')
            setStatus('viewing')
        }
    }

    // Chiude il popup del codice e torna al primo passo: "Invia Codice di
    // Verifica" ne manda uno nuovo.
    function annullaOtp() {
        setOtp(['', '', '', '', '', ''])
        setError('')
        setScadenzaOtp(null)
        setStatus('viewing')
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
            setOtpVerificatoValido(true)
            setStatus('signing')
            await posizioneFirma
            await eseguiFirma()
        } catch {
            setError('Errore nella verifica del codice')
            setStatus('otp_sent')
        }
    }

    // 01/10/2026: completa una firma il cui codice e' gia' stato verificato
    // (anche dopo aver riaperto il link) o riprova dopo un errore. Il server
    // accetta solo se la verifica e' ancora valida, altrimenti chiede un
    // codice nuovo (code 'otp_scaduto').
    async function handleCompletaFirma() {
        if (!consensiDati()) return
        setError('')
        setStatus('signing')
        // Posizione il piu' vicino possibile alla firma (obbligatoria se
        // Centralina Pro lo chiede: il server la vuole degli ultimi 10 minuti).
        await acquisisciPosizione('firma')
        await eseguiFirma(!otpRequired)
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
                const err = await res.json().catch(() => ({}))
                if (err.code === 'altro_dispositivo') { setStatus('bloccato'); return }
                if (res.status === 410) { setStatus('expired'); return }
                // 01/10/2026: verifica del codice scaduta: si torna al primo
                // passo, "Invia Codice di Verifica" manda un codice nuovo.
                if (err.code === 'otp_scaduto') {
                    setOtpVerificatoValido(false)
                    setError(err.error || "Il codice di verifica e' scaduto. Richiedi un nuovo codice.")
                    setStatus('viewing')
                    return
                }
                // 01/10/2026: mai lasciare la schermata su "Firma in corso":
                // con un errore la scheda mostra il messaggio e "Riprova la firma".
                setError(err.error || 'Firma non completata. Riprova.')
                setStatus('signing')
                return
            }

            const data = await res.json()
            setSignedPdfUrl(data.signedPdfUrl)
            setSignedAt(data.signedAt)
            setStatus('signed')
        } catch {
            setError('Errore durante la firma del documento. Riprova.')
            setStatus('signing')
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
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Link personale</h1>
                    <p className="text-gray-600">
                        Questo link di firma e' gia' stato aperto su un altro dispositivo. Puo' essere usato
                        solo da chi lo ha ricevuto, sul dispositivo con cui lo ha aperto la prima volta.
                    </p>
                    <p className="text-gray-600 mt-3">Se sei tu il destinatario, contatta DR7 per ricevere un nuovo link.</p>
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

    // Termini + risposta marketing: nel primo passo e, dal 01/10/2026, anche
    // in "Completa la firma" (la risposta va col completamento e dopo una
    // riapertura del link non e' piu' in memoria).
    const bloccoConsensi = (
        <>
                <label className="flex items-start gap-3 mb-4 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={e => setAcceptedTerms(e.target.checked)}
                        className="mt-1 h-5 w-5 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                    />
                    <span className="text-sm text-gray-700">
                        {TESTO_TERMINI}
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
                                {TESTO_MARKETING}
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
        </>
    )

    return (
        <div className="min-h-screen bg-black">
            {/* Header: fondo nero, logo al centro (09/10/2026) */}
            <div className="pt-6 pb-5 px-4 flex items-center justify-center">
                {/* Logo ritagliato (l'icona quadrata aveva troppo nero intorno)
                    con alone verde fluo. */}
                <img
                    src="/dr7trust-logo.png"
                    alt="DR7 Trust"
                    className="h-14 sm:h-16 w-auto mx-auto [filter:drop-shadow(0_0_6px_#39ff14)_drop-shadow(0_0_14px_#39ff14)]"
                />
            </div>

            <div className="max-w-2xl mx-auto px-3 sm:px-6 pb-[calc(5rem+env(safe-area-inset-bottom))]">
                {/* PDF Viewer */}
                {contract?.pdfUrl && status !== 'signed' && (
                    <div ref={contenitorePdf} className="bg-white rounded-t-xl overflow-hidden">
                        {pdfNonApribile ? (
                            <iframe
                                src={`https://docs.google.com/gview?url=${encodeURIComponent(contract.pdfUrl)}&embedded=true`}
                                className="w-full border-0 h-[calc(100dvh-12rem)] min-h-[320px]"
                                title="Documento PDF"
                            />
                        ) : (
                            <Document
                                file={contract.pdfUrl}
                                onLoadSuccess={({ numPages }) => setPagineContratto(numPages)}
                                onLoadError={() => setPdfNonApribile(true)}
                                loading={
                                    <div className="flex items-center justify-center py-20">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
                                    </div>
                                }
                            >
                                {larghezzaPdf > 0 && Array.from({ length: pagineContratto }, (_, i) => (
                                    <Page
                                        key={i + 1}
                                        pageNumber={i + 1}
                                        width={larghezzaPdf}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                        className={i > 0 ? 'border-t border-gray-200' : ''}
                                    />
                                ))}
                            </Document>
                        )}
                    </div>
                )}

                {/* Error message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
                        {error}
                    </div>
                )}


                {/* Step 2: il codice OTP si inserisce in un popup (09/10/2026,
                    sul modello delle firme con OTP delle finanziarie). Annulla
                    torna al primo passo; inserire il codice firma il documento. */}
                {popupCodiceAperto && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div role="dialog" aria-modal="true" aria-labelledby="otp-titolo" className="bg-white rounded-xl max-w-md w-full overflow-hidden shadow-xl">
                            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
                                <h3 id="otp-titolo" className="text-lg font-bold text-gray-800">
                                    Firma con OTP WhatsApp o Email
                                </h3>
                                <button
                                    type="button"
                                    onClick={annullaOtp}
                                    disabled={status !== 'otp_sent'}
                                    aria-label="Chiudi"
                                    className="text-gray-500 hover:text-gray-800 disabled:opacity-40 transition-colors"
                                >
                                    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                                        <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                                    </svg>
                                </button>
                            </div>

                            <div className="px-5 py-6 text-center">
                                <p className="text-gray-700 mb-5">
                                    Inserisci il codice di conferma ricevuto via WhatsApp o email per confermare la firma e completare il processo.
                                </p>

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
                                    onKeyDown={e => { if (e.key === 'Enter' && otp.join('').length === 6 && !codiceScaduto) handleVerifyOtp() }}
                                    placeholder="Codice a 6 cifre"
                                    className="w-full max-w-xs h-14 text-center text-2xl font-bold tracking-[0.4em] bg-gray-50 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-100 focus:outline-none transition-colors placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-400"
                                    disabled={status !== 'otp_sent'}
                                    ref={el => { otpRefs.current[0] = el }}
                                />

                                <p className={`mt-4 font-medium ${codiceScaduto ? 'text-red-700' : 'text-gray-800'}`}>
                                    {status === 'otp_sending'
                                        ? 'Invio del codice in corso...'
                                        : codiceScaduto
                                            ? 'Codice scaduto: premi Invia di nuovo per riceverne uno nuovo.'
                                            : secondiRimasti !== null
                                                ? `Inserisci il codice entro ${secondiRimasti} secondi`
                                                : null}
                                </p>
                                {/* Barra dei secondi: si svuota fino alla scadenza del codice */}
                                {status !== 'otp_sending' && secondiRimasti !== null && (
                                    <div className="mt-3 h-2 w-full max-w-xs mx-auto rounded-full bg-gray-200 overflow-hidden" aria-hidden="true">
                                        <div
                                            className="h-full bg-red-600 transition-[width] duration-1000 ease-linear"
                                            style={{ width: `${Math.min(100, (secondiRimasti / durataOtpSecondi) * 100)}%` }}
                                        />
                                    </div>
                                )}

                                {error && (
                                    <p className="mt-4 text-sm text-red-700">{error}</p>
                                )}
                                {remainingAttempts < 5 && (
                                    <p className="mt-2 text-sm text-orange-600">
                                        Tentativi rimanenti: {remainingAttempts}
                                    </p>
                                )}

                                <button
                                    type="button"
                                    onClick={handleRequestOtp}
                                    disabled={status !== 'otp_sent'}
                                    className="mt-5 text-sm font-semibold italic underline text-gray-700 hover:text-gray-900 disabled:opacity-40 transition-colors"
                                >
                                    Invia di nuovo
                                </button>
                            </div>

                            <div className="flex gap-3 px-5 py-4 bg-gray-50 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={annullaOtp}
                                    disabled={status !== 'otp_sent'}
                                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold py-3 rounded-lg transition-colors"
                                >
                                    Annulla
                                </button>
                                <button
                                    type="button"
                                    onClick={handleVerifyOtp}
                                    disabled={otp.join('').length !== 6 || status !== 'otp_sent' || codiceScaduto}
                                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold py-3 rounded-lg transition-colors"
                                >
                                    {status === 'otp_verifying' ? 'Firma in corso...' : 'Conferma'}
                                </button>
                            </div>
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
                                    {otpRequired && otpVerificatoValido ? "Il codice e' stato verificato: riprova a completare la firma, non serve un nuovo codice." : 'Riprova a completare la firma.'}
                                </p>
                                <button
                                    onClick={handleCompletaFirma}
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

            {/* Footer: non con la barra FIRMA, il pulsante sta attaccato al contratto */}
            {status !== 'viewing' && status !== 'da_completare' && (
            <div className="text-center py-6 px-4 text-xs text-gray-400 leading-relaxed">
                <span className="block sm:inline">DR7 S.p.A.</span>
                <span className="hidden sm:inline"> &middot; </span>
                <span className="block sm:inline">Via del Fangario 25, 09122 Cagliari (CA)</span>
                <span className="hidden sm:inline"> &middot; </span>
                <span className="block sm:inline">P.IVA 04104640927</span>
            </div>
            )}

            {/* Barra fissa in basso col pulsante rosso FIRMA (09/10/2026, come
                le firme delle finanziarie): FIRMA apre il Riepilogo firma con
                la dichiarazione e le due caselle; Accetta manda il codice (o
                firma col pulsante se l'OTP e' spento in Centralina Pro). */}
            {(status === 'viewing' || status === 'da_completare') && (
                <div className="fixed bottom-0 inset-x-0 z-40 bg-black px-3 sm:px-6 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                    <div className="max-w-2xl mx-auto">
                        <button
                            onClick={apriRiepilogo}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg transition-colors text-lg tracking-wide"
                        >
                            FIRMA
                        </button>
                    </div>
                </div>
            )}

            {/* Riepilogo firma: le due caselle, poi "Accetta". */}
            {riepilogoAperto && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setRiepilogoAperto(false)}>
                    <div role="dialog" aria-modal="true" aria-labelledby="riepilogo-firma-titolo" className="bg-white rounded-t-2xl sm:rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
                            <h3 id="riepilogo-firma-titolo" className="text-lg font-bold text-gray-800">
                                Riepilogo firma
                            </h3>
                            <button
                                type="button"
                                onClick={() => setRiepilogoAperto(false)}
                                aria-label="Chiudi"
                                className="text-gray-500 hover:text-gray-800 transition-colors"
                            >
                                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                                    <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                                </svg>
                            </button>
                        </div>
                        <div className="px-5 pt-5">
                            {/* Dichiarazione: prima stava sotto il contratto (09/10/2026) */}
                            <div className="text-sm text-gray-700 mb-5">
                                {status === 'da_completare' && (
                                    <p className="mb-3 font-semibold text-gray-800">
                                        Il codice di verifica e' gia' stato confermato ma la firma non e' stata completata.
                                        Premi Accetta per completarla, non serve un nuovo codice.
                                    </p>
                                )}
                                <p className="mb-2">
                                    Io, <strong>{signerName}</strong>, dichiaro di aver preso visione del documento
                                    {contract?.contractNumber ? ` n. ${contract.contractNumber}` : ''} e di approvarne
                                    integralmente il contenuto.
                                </p>
                                <p className="mb-3">
                                    {otpRequired ? (
                                        <>
                                            Confermo che la firma viene apposta volontariamente tramite il codice di verifica
                                            {otpChannel === 'email' ? ` inviato a ${signerEmail}` : ' inviato via WhatsApp'}.
                                        </>
                                    ) : (
                                        <>Confermo che la firma viene apposta volontariamente premendo il pulsante "Firma".</>
                                    )}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {gpsRequired
                                        ? "Per la sicurezza della firma DR7 registra la posizione del dispositivo: autorizzala quando il browser la chiede, senza posizione il documento non puo' essere firmato."
                                        : "Per la sicurezza della firma DR7 registra la posizione del dispositivo, se la autorizzi quando il browser la chiede. Puoi firmare anche senza."}
                                </p>
                            </div>
                            {bloccoConsensi}
                        </div>
                        <div className="flex gap-3 px-5 py-4 bg-gray-50 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={() => setRiepilogoAperto(false)}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors"
                            >
                                Annulla
                            </button>
                            <button
                                type="button"
                                onClick={accettaRiepilogo}
                                disabled={!acceptedTerms || (existingMarketingConsent !== true && acceptedMarketing === null)}
                                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold py-3 rounded-lg transition-colors"
                            >
                                Accetta
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
