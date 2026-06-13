import { Link } from 'react-router-dom'
import SiteLayout from '../components/SiteLayout'

const codeExample = `POST /api/v1/documents/sign
Authorization: Bearer your_api_key
Content-Type: application/json

{
  "document_id": "doc_abc123",
  "signer_email": "mario@example.com",
  "signer_name": "Mario Rossi"
}`

const integrationCapabilities = [
  'Creare richieste di firma',
  'Inviare documenti per la firma',
  'Monitorare lo stato dei documenti',
  'Ricevere notifiche sugli eventi',
  'Gestire template documentali',
  'Automatizzare flussi documentali',
]

const webhookEvents = [
  { event: 'document.sent', label: 'Documento inviato' },
  { event: 'document.viewed', label: 'Documento visualizzato' },
  { event: 'document.signed', label: 'Documento firmato' },
  { event: 'process.completed', label: 'Processo completato' },
]

const templateTypes = [
  'Contratti',
  'Accordi commerciali',
  'Documenti interni',
  'Moduli digitali',
]

const securityFeatures = [
  'Autenticazione tramite API key',
  'Token di accesso OAuth 2.0',
  'Endpoint HTTPS protetti',
  'Sistemi di monitoraggio delle richieste',
]

const sandboxCapabilities = [
  'Testare le API senza impatto sulla produzione',
  'Simulare flussi di firma completi',
  'Verificare l\'integrazione con le applicazioni',
  'Eseguire test automatizzati end-to-end',
]

const planFeatures = [
  'Accesso completo agli endpoint API',
  'Gestione richieste di firma',
  'Integrazione embedded nel tuo prodotto',
  'Notifiche webhook in tempo reale',
  'Dashboard di monitoraggio e analytics',
]

const docTopics = [
  'Riferimento endpoint API',
  'Parametri delle richieste e risposte',
  'Esempi di integrazione per linguaggio',
  'Gestione degli errori',
  'Configurazione dei webhook',
]

function CheckIcon() {
  return (
    <svg
      className="w-5 h-5 text-green-500 shrink-0 mt-0.5"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold text-green-600 uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-3xl sm:text-4xl font-bold text-[#0d3d2a] leading-snug">
      {children}
    </h2>
  )
}

function SectionDescription({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-base sm:text-lg text-gray-500 leading-relaxed max-w-2xl">
      {children}
    </p>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  )
}

export default function ApiPage() {
  return (
    <SiteLayout>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#0d3d2a] text-white">
        {/* subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
          aria-hidden="true"
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-32">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 bg-green-600/20 border border-green-500/30 text-green-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 tracking-wider uppercase">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              DR7 Trust API
            </span>

            <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight tracking-tight mb-6">
              DR7 Trust API
            </h1>

            <p className="text-lg sm:text-xl text-green-100/80 leading-relaxed mb-10 max-w-2xl">
              Le API DR7 Trust consentono di integrare facilmente la firma
              digitale e la gestione dei documenti all&apos;interno di software,
              applicazioni e piattaforme aziendali.
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap gap-4">
              <Link
                to="/login"
                className="w-full sm:w-auto text-center bg-green-500 hover:bg-green-400 text-white font-bold px-7 py-3.5 rounded-xl transition-colors shadow-lg shadow-green-900/30 text-sm"
              >
                Inizia Gratis
              </Link>
              <Link
                to="/terms"
                className="w-full sm:w-auto text-center bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-7 py-3.5 rounded-xl transition-colors text-sm"
              >
                Leggi la documentazione
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Code snippet ── */}
      <section className="bg-gray-950 py-10 sm:py-12 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-3 text-xs text-gray-400 font-mono truncate">
              POST /api/v1/documents/sign
            </span>
          </div>
          <pre className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6 overflow-x-auto text-[12px] sm:text-[13px] leading-relaxed font-mono text-gray-100 shadow-2xl">
            <code>
              {codeExample.split('\n').map((line, i) => {
                if (line.startsWith('POST')) {
                  return (
                    <span key={i} className="block">
                      <span className="text-green-400 font-bold">POST</span>
                      <span className="text-gray-100">
                        {line.slice(4)}
                      </span>
                      {'\n'}
                    </span>
                  )
                }
                if (line.startsWith('Authorization:')) {
                  const [key, ...rest] = line.split(': ')
                  return (
                    <span key={i} className="block">
                      <span className="text-sky-400">{key}</span>
                      <span className="text-gray-400">: </span>
                      <span className="text-amber-300">{rest.join(': ')}</span>
                      {'\n'}
                    </span>
                  )
                }
                if (line.startsWith('Content-Type:')) {
                  const [key, ...rest] = line.split(': ')
                  return (
                    <span key={i} className="block">
                      <span className="text-sky-400">{key}</span>
                      <span className="text-gray-400">: </span>
                      <span className="text-amber-300">{rest.join(': ')}</span>
                      {'\n'}
                    </span>
                  )
                }
                if (line.includes('"') && line.includes(':')) {
                  const match = line.match(/^(\s*)("[\w_]+")(: )(.+)$/)
                  if (match) {
                    return (
                      <span key={i} className="block">
                        {match[1]}
                        <span className="text-sky-300">{match[2]}</span>
                        <span className="text-gray-400">{match[3]}</span>
                        <span className="text-green-300">
                          {match[4].replace(/,$/, '')}
                        </span>
                        {match[4].endsWith(',') ? (
                          <span className="text-gray-400">,</span>
                        ) : null}
                        {'\n'}
                      </span>
                    )
                  }
                }
                return (
                  <span key={i} className="block text-gray-400">
                    {line || '\u00a0'}
                    {'\n'}
                  </span>
                )
              })}
            </code>
          </pre>
          <p className="mt-4 text-center text-xs text-gray-500">
            REST API &middot; JSON &middot; Autenticazione Bearer Token
          </p>
        </div>
      </section>

      {/* ── 1. Integrazione semplice ── */}
      <section className="py-12 sm:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <SectionLabel>Integrazione semplice</SectionLabel>
              <SectionHeading>
                Tutto quello che ti serve, in un&apos;unica API
              </SectionHeading>
              <SectionDescription>
                L&apos;integrazione puo essere effettuata tramite chiamate API
                REST e autenticazione tramite API key o token. Un&apos;unica
                integrazione per gestire l&apos;intero ciclo di vita dei
                documenti.
              </SectionDescription>
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {integrationCapabilities.map((cap) => (
                <li
                  key={cap}
                  className="flex items-start gap-3 bg-gray-50 rounded-xl px-5 py-4 border border-gray-100"
                >
                  <CheckIcon />
                  <span className="text-sm font-medium text-gray-700">
                    {cap}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 2. Embedded signing ── */}
      <section className="py-12 sm:py-24 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* visual placeholder */}
            <div className="order-2 lg:order-1 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span className="text-xs text-gray-400 font-mono break-all">
                  embedded-signing-iframe
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 h-48 flex flex-col items-center justify-center gap-3">
                <svg
                  className="w-10 h-10 text-green-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487 18.549 2.8a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
                  />
                </svg>
                <p className="text-sm text-gray-400 text-center px-4">
                  Firma integrata nella tua piattaforma
                </p>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-gray-400 break-all">
                  mario@example.com
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Firma in corso
                </span>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <SectionLabel>Embedded signing</SectionLabel>
              <SectionHeading>
                La firma dove serve, senza uscire dalla tua app
              </SectionHeading>
              <SectionDescription>
                Integra il processo di firma direttamente all&apos;interno delle
                tue applicazioni tramite iframe o SDK. L&apos;esperienza di
                firma rimane integrata nella piattaforma del cliente, senza
                redirect o interruzioni del flusso.
              </SectionDescription>

              <ul className="mt-8 space-y-3">
                {[
                  'Zero redirect — la firma avviene nel tuo prodotto',
                  'Personalizzazione completa del layout',
                  'Compatibile con web, mobile e desktop',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckIcon />
                    <span className="text-sm text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Webhook e automazioni ── */}
      <section className="py-12 sm:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <SectionLabel>Webhook e automazioni</SectionLabel>
            <SectionHeading>
              Reagisci agli eventi in tempo reale
            </SectionHeading>
            <div className="flex justify-center">
              <SectionDescription>
                Automatizza processi aziendali e aggiorna sistemi esterni in
                tempo reale non appena accade qualcosa di rilevante sui tuoi
                documenti.
              </SectionDescription>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {webhookEvents.map(({ event, label }) => (
              <div
                key={event}
                className="bg-gray-950 border border-gray-800 rounded-2xl p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[11px] font-mono text-green-400 font-semibold tracking-wide">
                    webhook
                  </span>
                </div>
                <p className="font-mono text-sm text-sky-300 mb-1 break-all">{event}</p>
                <p className="text-sm text-gray-400">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 bg-gray-50 border border-gray-100 rounded-2xl p-6 max-w-xl mx-auto text-center">
            <p className="text-sm text-gray-500 leading-relaxed">
              Configura un endpoint HTTPS e DR7 Trust inviera un payload JSON
              firmato ogni volta che un evento viene generato. Nessun polling,
              nessun ritardo.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. Template e gestione documenti ── */}
      <section className="py-12 sm:py-24 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <SectionLabel>Template e gestione documenti</SectionLabel>
              <SectionHeading>
                Documenti standardizzati, zero errori
              </SectionHeading>
              <SectionDescription>
                Riduci errori e velocizza i processi con template riutilizzabili
                per ogni tipo di documento. Definisci i campi, le posizioni di
                firma e le variabili una volta sola.
              </SectionDescription>

              <ul className="mt-8 space-y-3">
                {templateTypes.map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <CheckIcon />
                    <span className="text-sm text-gray-600">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  label: 'Contratto NDA',
                  fields: '3 campi firma',
                  color: 'bg-green-50 border-green-100',
                  textColor: 'text-green-700',
                },
                {
                  label: 'Accordo commerciale',
                  fields: '5 campi firma',
                  color: 'bg-sky-50 border-sky-100',
                  textColor: 'text-sky-700',
                },
                {
                  label: 'Modulo interno',
                  fields: '2 campi firma',
                  color: 'bg-violet-50 border-violet-100',
                  textColor: 'text-violet-700',
                },
                {
                  label: 'Documento custom',
                  fields: 'Variabile',
                  color: 'bg-amber-50 border-amber-100',
                  textColor: 'text-amber-700',
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className={`${card.color} border rounded-xl p-5`}
                >
                  <div
                    className={`${card.textColor} text-xs font-bold uppercase tracking-wider mb-2`}
                  >
                    Template
                  </div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">
                    {card.label}
                  </p>
                  <p className="text-xs text-gray-500">{card.fields}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 5 & 6. Sicurezza + Sandbox ── */}
      <section className="py-12 sm:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Sicurezza */}
            <div className="bg-gray-950 rounded-2xl p-6 sm:p-8 text-white">
              <div className="w-10 h-10 bg-green-600/20 border border-green-500/30 rounded-xl flex items-center justify-center mb-6">
                <svg
                  className="w-5 h-5 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                  />
                </svg>
              </div>
              <p className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-3">
                Sicurezza delle API
              </p>
              <h3 className="text-2xl font-bold text-white mb-3">
                Progettata per la produzione
              </h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                Ogni chiamata API e autenticata e registrata. I tuoi documenti
                viaggiano sempre su canali cifrati.
              </p>
              <ul className="space-y-3">
                {securityFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <svg
                      className="w-4 h-4 text-green-400 shrink-0 mt-0.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm text-gray-300">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sandbox */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="w-10 h-10 bg-green-50 border border-green-100 rounded-xl flex items-center justify-center mb-6">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 7.5 3 12l3.75 4.5m10.5 0L21 12l-3.75-4.5M10.5 19.5 13.5 4.5"
                  />
                </svg>
              </div>
              <p className="text-xs font-semibold text-green-600 uppercase tracking-widest mb-3">
                Ambiente Sandbox
              </p>
              <h3 className="text-2xl font-bold text-[#0d3d2a] mb-3">
                Sviluppa senza rischi
              </h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Ogni account include un ambiente sandbox dedicato. Sviluppa,
                testa e itera senza toccare dati reali o documenti di
                produzione.
              </p>
              <ul className="space-y-3">
                {sandboxCapabilities.map((c) => (
                  <li key={c} className="flex items-start gap-3">
                    <CheckIcon />
                    <span className="text-sm text-gray-600">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Piani API ── */}
      <section className="py-12 sm:py-24 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <SectionLabel>Piani API</SectionLabel>
          <SectionHeading>Accesso API su misura</SectionHeading>
          <div className="flex justify-center">
            <SectionDescription>
              I piani API sono disponibili su base annuale e includono tutto il
              necessario per un&apos;integrazione completa e scalabile.
            </SectionDescription>
          </div>

          <div className="mt-12 bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="bg-[#0d3d2a] px-6 sm:px-8 py-8 sm:py-10 text-white text-left">
              <p className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-2">
                Piano API
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold mb-1">
                Tutto incluso
              </h3>
              <p className="text-green-100/70 text-sm">
                Un piano che cresce con il tuo volume di documenti
              </p>
            </div>

            <ul className="px-6 sm:px-8 py-6 sm:py-8 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4 text-left">
              {planFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <CheckIcon />
                  <span className="text-sm text-gray-700">{f}</span>
                </li>
              ))}
            </ul>

            <div className="px-6 sm:px-8 pb-6 sm:pb-8 flex flex-col sm:flex-row gap-4">
              <Link
                to="/login"
                className="flex-1 text-center bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition-colors text-sm shadow-md shadow-green-600/20"
              >
                Inizia Gratis
              </Link>
              <Link
                to="/terms"
                className="flex-1 text-center bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-semibold py-3.5 rounded-xl transition-colors text-sm"
              >
                Leggi la documentazione
              </Link>
            </div>
          </div>

          <p className="mt-6 text-xs text-gray-400 break-words">
            Hai esigenze di volume elevate?{' '}
            <a
              href="mailto:info@dr7trust.it"
              className="text-green-600 hover:underline font-medium break-all"
            >
              Contattaci per un piano custom
            </a>
          </p>
        </div>
      </section>

      {/* ── 8. Documentazione ── */}
      <section className="py-12 sm:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <SectionLabel>Documentazione</SectionLabel>
              <SectionHeading>
                Tutto per iniziare in pochi minuti
              </SectionHeading>
              <SectionDescription>
                Documentazione progettata per un&apos;integrazione rapida e
                semplice. Esempi di codice, guide step-by-step e riferimenti
                completi agli endpoint.
              </SectionDescription>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/terms"
                  className="inline-flex w-full sm:w-auto justify-center items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm shadow-md shadow-green-600/20"
                >
                  Leggi la documentazione
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                    />
                  </svg>
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              {docTopics.map((topic, i) => (
                <div
                  key={topic}
                  className="flex items-center gap-4 bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 hover:border-green-200 hover:bg-green-50/40 transition-colors cursor-pointer group"
                >
                  <span className="w-7 h-7 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-xs font-bold text-gray-400 shrink-0 group-hover:border-green-200 group-hover:text-green-600 transition-colors">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                    {topic}
                  </span>
                  <svg
                    className="w-4 h-4 text-gray-300 ml-auto shrink-0 group-hover:text-green-500 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m8.25 4.5 7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature cards row ── */}
      <section className="py-10 sm:py-16 px-4 sm:px-6 bg-gray-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 13.5 10.5 6.75 14.25 10.5 20.25 4.5M3.75 19.5h16.5"
                  />
                </svg>
              }
              title="Scalabile"
              description="L'infrastruttura DR7 Trust gestisce da poche firme al giorno a milioni di documenti mensili senza modifiche al tuo codice."
            />
            <FeatureCard
              icon={
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              }
              title="Alta disponibilita"
              description="SLA al 99.9% con ridondanza multi-zona. I tuoi flussi documentali non si fermano mai."
            />
            <FeatureCard
              icon={
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"
                  />
                </svg>
              }
              title="Audit trail completo"
              description="Ogni azione sui documenti e registrata con timestamp, IP e firma crittografica. Sempre pronto per audit e compliance."
            />
          </div>
        </div>
      </section>

      {/* ── CTA finale ── */}
      <section className="py-12 sm:py-24 px-4 sm:px-6 bg-[#0d3d2a] text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold mb-5 leading-tight">
            Pronto a integrare?
          </h2>
          <p className="text-green-100/70 text-base sm:text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Crea un account gratuito, ottieni la tua API key e invia il primo
            documento in firma in meno di dieci minuti.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/login"
              className="w-full sm:w-auto text-center bg-green-500 hover:bg-green-400 text-white font-bold px-8 py-4 rounded-xl transition-colors shadow-lg shadow-green-900/30 text-sm"
            >
              Inizia Gratis
            </Link>
            <Link
              to="/terms"
              className="w-full sm:w-auto text-center bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-8 py-4 rounded-xl transition-colors text-sm"
            >
              Leggi la documentazione
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
