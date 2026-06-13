import { Link } from 'react-router-dom'
import SiteLayout from '../components/SiteLayout'

interface SecurityCardProps {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}

function SecurityCard({ icon, title, children }: SecurityCardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200 border-l-4 border-l-green-500">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600 shrink-0">
          {icon}
        </div>
        <h2 className="text-[17px] font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="text-[15px] text-gray-600 leading-relaxed space-y-3">
        {children}
      </div>
    </div>
  )
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg
        className="w-4 h-4 text-green-500 mt-0.5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      <span>{children}</span>
    </li>
  )
}

export default function SecurityPage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="bg-gradient-to-b from-green-50/60 to-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            Security & Compliance
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0d3d2a] leading-tight tracking-tight mb-6">
            Security & Compliance
          </h1>
          <p className="text-base sm:text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto">
            La sicurezza dei documenti, dei dati e delle transazioni digitali rappresenta una
            priorita fondamentale per DR7 Trust.
          </p>
        </div>
      </section>

      {/* Cards grid */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* 1 — Protezione dei dati */}
          <SecurityCard
            title="Protezione dei dati"
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            }
          >
            <p>
              Tutte le comunicazioni tra utenti e piattaforma avvengono tramite connessioni
              protette.
            </p>
            <ul className="space-y-2 mt-2">
              <CheckItem>Crittografia delle comunicazioni tramite protocolli sicuri</CheckItem>
              <CheckItem>Protezione delle sessioni utente</CheckItem>
              <CheckItem>Autenticazione sicura degli accessi</CheckItem>
              <CheckItem>Controllo degli accessi basato su account e permessi</CheckItem>
              <CheckItem>Monitoraggio degli eventi di sistema</CheckItem>
            </ul>
          </SecurityCard>

          {/* 2 — Sicurezza dei documenti */}
          <SecurityCard
            title="Sicurezza dei documenti"
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            }
          >
            <p>
              Ogni documento firmato tramite DR7 Trust e protetto da un sistema di tracciabilita
              completo e verificabile.
            </p>
            <ul className="space-y-2 mt-2">
              <CheckItem>Audit trail delle operazioni</CheckItem>
              <CheckItem>Registrazione temporale degli eventi</CheckItem>
              <CheckItem>Identificazione dei firmatari</CheckItem>
              <CheckItem>Registrazione delle azioni effettuate durante il processo di firma</CheckItem>
              <CheckItem>Identificativo univoco del documento</CheckItem>
              <CheckItem>Sistema di verifica tramite codice o QR</CheckItem>
            </ul>
          </SecurityCard>

          {/* 3 — Audit Trail */}
          <SecurityCard
            title="Audit Trail"
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            }
          >
            <p>
              Il log di audit registra ogni fase del ciclo di vita del documento, garantendo
              tracciabilita completa e non ripudiabilita.
            </p>
            <ul className="space-y-2 mt-2">
              <CheckItem>Creazione del documento</CheckItem>
              <CheckItem>Invio delle richieste di firma</CheckItem>
              <CheckItem>Visualizzazione del documento</CheckItem>
              <CheckItem>Apposizione delle firme</CheckItem>
              <CheckItem>Completamento del processo di firma</CheckItem>
            </ul>
          </SecurityCard>

          {/* 4 — Infrastruttura */}
          <SecurityCard
            title="Infrastruttura"
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
              </svg>
            }
          >
            <p>
              La piattaforma DR7 Trust e costruita su un'infrastruttura cloud ad alta affidabilita,
              progettata per garantire continuita operativa e protezione dei dati.
            </p>
            <ul className="space-y-2 mt-2">
              <CheckItem>Elevata disponibilita del servizio</CheckItem>
              <CheckItem>Protezione dei dati</CheckItem>
              <CheckItem>Monitoraggio tecnico dei sistemi</CheckItem>
              <CheckItem>Aggiornamenti e manutenzione regolare</CheckItem>
            </ul>
          </SecurityCard>

          {/* 5 — Sicurezza API */}
          <SecurityCard
            title="Sicurezza API"
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            }
          >
            <p>
              L'accesso alle API DR7 Trust e protetto tramite meccanismi di autenticazione standard.
              Gli sviluppatori sono responsabili della protezione delle proprie credenziali.
            </p>
            <ul className="space-y-2 mt-2">
              <CheckItem>API keys per l'identificazione delle applicazioni</CheckItem>
              <CheckItem>Token di autenticazione per le sessioni</CheckItem>
              <CheckItem>Endpoint protetti e accessibili solo tramite credenziali valide</CheckItem>
            </ul>
            <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-[13px] text-amber-800 leading-snug">
              Gli sviluppatori sono responsabili della protezione delle proprie credenziali API.
              Non condividere mai le chiavi di accesso.
            </div>
          </SecurityCard>

          {/* 6 — Protezione dell'account */}
          <SecurityCard
            title="Protezione dell'account"
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            }
          >
            <p>
              DR7 Trust adotta misure per proteggere gli account utente e segnalare comportamenti
              anomali.
            </p>
            <ul className="space-y-2 mt-2">
              <CheckItem>Sicurezza delle credenziali di accesso</CheckItem>
              <CheckItem>Monitoraggio delle attivita sospette</CheckItem>
            </ul>
            <p className="mt-3 text-[14px] text-gray-500">
              Ti consigliamo di utilizzare una password robusta e unica per il tuo account DR7 Trust
              e di non condividerla con nessuno.
            </p>
          </SecurityCard>

          {/* 7 — Compliance normativa */}
          <SecurityCard
            title="Compliance normativa"
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
              </svg>
            }
          >
            <p>
              DR7 Trust opera nel rispetto della normativa europea e nazionale in materia di
              protezione dei dati personali e firma digitale.
            </p>
            <ul className="space-y-2 mt-2">
              <CheckItem>Conformita al Regolamento (UE) 2016/679 (GDPR)</CheckItem>
              <CheckItem>Rispetto della normativa nazionale applicabile</CheckItem>
            </ul>
            <p className="mt-3 text-[14px] text-gray-500">
              Per maggiori informazioni sul trattamento dei dati personali, consulta la nostra{' '}
              <Link
                to="/privacy"
                className="text-green-600 hover:text-green-700 font-medium underline underline-offset-2 transition-colors"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </SecurityCard>

          {/* 8 — Monitoraggio e miglioramento continuo */}
          <SecurityCard
            title="Monitoraggio e miglioramento continuo"
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
          >
            <p>
              La sicurezza e un processo continuo. DR7 Trust monitora costantemente la piattaforma
              per identificare e affrontare nuove sfide.
            </p>
            <ul className="space-y-2 mt-2">
              <CheckItem>Monitoraggio continuo della sicurezza</CheckItem>
              <CheckItem>Verifica dell'affidabilita del servizio</CheckItem>
              <CheckItem>Ottimizzazione delle prestazioni</CheckItem>
              <CheckItem>Aggiornamento delle misure di protezione dei dati</CheckItem>
            </ul>
          </SecurityCard>

        </div>

        {/* Bottom CTA / trust note */}
        <div className="mt-14 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-2xl p-6 sm:p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Hai domande sulla sicurezza?
          </h3>
          <p className="text-[15px] text-gray-500 mb-6 max-w-md mx-auto leading-relaxed">
            Il nostro team e disponibile per rispondere a qualsiasi domanda relativa alla sicurezza
            e alla conformita della piattaforma DR7 Trust.
          </p>
          <a
            href="mailto:info@dr7trust.it"
            className="inline-flex w-full sm:w-auto justify-center items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-colors shadow-md shadow-green-600/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Contattaci
          </a>
        </div>
      </section>
    </SiteLayout>
  )
}
