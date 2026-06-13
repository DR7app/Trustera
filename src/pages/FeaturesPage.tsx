import { Link } from 'react-router-dom'
import SiteLayout from '../components/SiteLayout'

const features = [
  {
    number: '01',
    title: 'Firma digitale dei documenti',
    description:
      "Carica qualsiasi documento PDF, definisci i firmatari e invia richieste di firma in pochi secondi. Il processo e completamente guidato e non richiede installazioni.",
    bullets: [
      'Carica documenti PDF in un clic',
      'Definisci uno o piu firmatari',
      'Invia richieste di firma via email o WhatsApp',
      'Monitora lo stato del documento in tempo reale',
    ],
    accent: 'bg-green-50 text-green-700',
    ring: 'ring-green-200',
  },
  {
    number: '02',
    title: 'Gestione delle richieste di firma',
    description:
      'Tieni tutto sotto controllo dalla dashboard. Ogni richiesta di firma ha uno stato aggiornato in tempo reale: inviata, visualizzata, firmata o scaduta.',
    bullets: [
      'Visualizza lo stato di ogni richiesta',
      'Ricevi notifiche sugli eventi principali',
      'Verifica quando il documento viene aperto',
      'Conferma automatica alla firma completata',
    ],
    accent: 'bg-emerald-50 text-emerald-700',
    ring: 'ring-emerald-200',
  },
  {
    number: '03',
    title: 'Template documentali',
    description:
      'Crea modelli riutilizzabili per i tuoi contratti ricorrenti. Definisci una volta i campi di firma e velocizza ogni invio successivo.',
    bullets: [
      'Prepara modelli di contratto standard',
      'Definisci posizione e tipo dei campi di firma',
      'Riutilizza i template con un clic',
      'Velocizza l\'invio dei documenti ricorrenti',
    ],
    accent: 'bg-teal-50 text-teal-700',
    ring: 'ring-teal-200',
  },
  {
    number: '04',
    title: 'Audit trail certificato',
    description:
      'Ogni documento genera un registro immutabile di tutte le azioni compiute. Il trail e prova legale del processo di firma dall\'inizio alla fine.',
    bullets: [
      'Timestamp di creazione del documento',
      'Registrazione dell\'invio della richiesta',
      'Log della prima visualizzazione',
      'Conferma e ora esatta della firma',
    ],
    accent: 'bg-green-50 text-green-700',
    ring: 'ring-green-200',
  },
  {
    number: '05',
    title: 'Verifica dei documenti',
    description:
      'Chiunque puo verificare in modo indipendente l\'autenticita e l\'integrita di un documento firmato tramite DR7 Trust, senza necessita di account.',
    bullets: [
      'Verifica l\'integrita tramite hash SHA-256',
      'Controlla la validita del processo di firma',
      'Identificativi univoci per ogni documento',
      'Pagina di verifica pubblica e accessibile',
    ],
    accent: 'bg-emerald-50 text-emerald-700',
    ring: 'ring-emerald-200',
  },
  {
    number: '06',
    title: 'Integrazione tramite API',
    description:
      'Connetti DR7 Trust ai tuoi sistemi esistenti. Le API REST permettono di automatizzare ogni aspetto del ciclo di vita di un documento.',
    bullets: [
      'Crea documenti programmaticamente',
      'Invia richieste di firma via API',
      'Ricevi notifiche in tempo reale via webhook',
      'Incorpora flussi di firma nelle tue applicazioni',
    ],
    accent: 'bg-teal-50 text-teal-700',
    ring: 'ring-teal-200',
  },
  {
    number: '07',
    title: 'Firma integrata (Embedded signing)',
    description:
      'Offri ai tuoi clienti un\'esperienza di firma nativa, direttamente all\'interno della tua applicazione o piattaforma, senza redirect esterni.',
    bullets: [
      'Widget di firma integrabile via iframe',
      'Personalizzazione grafica del modulo',
      'Esperienza utente fluida e coerente',
      'Compatibile con web e mobile',
    ],
    accent: 'bg-green-50 text-green-700',
    ring: 'ring-green-200',
  },
  {
    number: '08',
    title: 'Automazioni e webhook',
    description:
      'Collega DR7 Trust ai tuoi strumenti e avvia automaticamente azioni in risposta agli eventi del ciclo di vita dei documenti.',
    bullets: [
      'Aggiorna sistemi esterni alla firma',
      'Attiva workflow automatici su ogni evento',
      'Sincronizza informazioni con CRM e ERP',
      'Configura regole personalizzate per ogni documento',
    ],
    accent: 'bg-emerald-50 text-emerald-700',
    ring: 'ring-emerald-200',
  },
  {
    number: '09',
    title: 'Dashboard di monitoraggio',
    description:
      'Una vista centralizzata su tutti i tuoi documenti e le operazioni. Tieni traccia di ogni documento dal primo invio al completamento.',
    bullets: [
      'Documenti inviati e in attesa',
      'Documenti firmati e completati',
      'Storico completo delle operazioni',
      'Filtri per data, firmatario e stato',
    ],
    accent: 'bg-teal-50 text-teal-700',
    ring: 'ring-teal-200',
  },
  {
    number: '10',
    title: 'Archiviazione documenti',
    description:
      'Tutti i documenti firmati vengono archiviati in modo sicuro e sono sempre recuperabili. Ogni documento e accompagnato dal suo audit trail completo.',
    bullets: [
      'Archiviazione sicura dei documenti firmati',
      'Storico completo delle operazioni',
      'Download del documento e del trail in qualsiasi momento',
      'Conservazione a lungo termine garantita',
    ],
    accent: 'bg-green-50 text-green-700',
    ring: 'ring-green-200',
  },
  {
    number: '11',
    title: 'Sicurezza della piattaforma',
    description:
      'DR7 Trust e progettata con la sicurezza al centro. Ogni connessione, ogni accesso e ogni documento sono protetti da standard enterprise.',
    bullets: [
      'Connessioni cifrate TLS end-to-end',
      'Autenticazione sicura con OTP',
      'Monitoraggio continuo degli accessi',
      'Protezione contro accessi non autorizzati',
    ],
    accent: 'bg-emerald-50 text-emerald-700',
    ring: 'ring-emerald-200',
  },
]

export default function FeaturesPage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 ring-1 ring-green-200">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          Piattaforma completa
        </div>
        <h1 className="text-3xl sm:text-5xl lg:text-[52px] font-bold leading-[1.1] mb-6 text-[#0d3d2a] tracking-tight">
          Funzionalita
        </h1>
        <p className="text-base sm:text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto">
          DR7 Trust e una piattaforma progettata per semplificare la gestione dei documenti e dei processi di firma digitale.
        </p>
      </section>

      {/* Features grid */}
      <section className="bg-gray-50 py-12 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature) => (
              <div
                key={feature.number}
                className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-sm hover:shadow-md hover:shadow-green-600/5 hover:border-green-200 transition-all duration-200 flex flex-col gap-5"
              >
                {/* Card header */}
                <div className="flex items-start gap-4">
                  <div
                    className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold ring-1 ${feature.accent} ${feature.ring}`}
                  >
                    {feature.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[17px] font-bold text-[#0d3d2a] leading-snug mb-1.5">
                      {feature.title}
                    </h2>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Bullet list */}
                <ul className="flex flex-col gap-2.5">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2.5">
                      <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 12 12"
                          fill="none"
                          className="w-2.5 h-2.5"
                          aria-hidden="true"
                        >
                          <path
                            d="M2 6l2.5 2.5L10 3.5"
                            stroke="#16a34a"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span className="text-sm text-gray-600 leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases section */}
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 ring-1 ring-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Soluzioni per ogni settore
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0d3d2a] mb-4 tracking-tight">Casi d'uso</h2>
            <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto">
              DR7 Trust consente di digitalizzare i processi documentali e automatizzare la gestione delle firme all'interno delle aziende.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Contratti commerciali',
                tagline: 'Ridurre i tempi di conclusione degli accordi.',
                bullets: ['Invia contratti ai clienti per la firma', 'Monitora lo stato in tempo reale', 'Notifiche alla firma', 'Archiviazione automatica'],
                color: 'bg-green-600',
              },
              {
                title: 'Gestione delle vendite',
                tagline: 'Processo di vendita rapido ed efficiente.',
                bullets: ['Invia documenti da qualsiasi dispositivo', 'Monitora tutti i documenti inviati', 'Accelera la chiusura delle trattative'],
                color: 'bg-blue-600',
              },
              {
                title: 'Risorse umane',
                tagline: 'Ridurre l\'uso della carta.',
                bullets: ['Contratti di lavoro', 'Accordi di riservatezza', 'Documenti interni', 'Modulistica aziendale'],
                color: 'bg-violet-600',
              },
              {
                title: 'Noleggio e mobilita',
                tagline: 'Processi operativi semplificati.',
                bullets: ['Contratti di noleggio digitali', 'Documentazione clienti centralizzata', 'Archiviazione con audit trail', 'Integrazione API con gestionali'],
                color: 'bg-orange-500',
              },
              {
                title: 'Software e SaaS',
                tagline: 'Firma digitale integrata nei tuoi prodotti.',
                bullets: ['API per software gestionali e CRM', 'Embedding per piattaforme SaaS', 'Connettori per ERP', 'Webhook in tempo reale'],
                color: 'bg-cyan-600',
              },
              {
                title: 'Gestione documentale',
                tagline: 'Organizzazione e tracciabilita.',
                bullets: ['Archiviazione documenti firmati', 'Dashboard in tempo reale', 'Storico completo attivita', 'Template riutilizzabili'],
                color: 'bg-teal-600',
              },
            ].map(uc => (
              <div key={uc.title} className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 hover:border-green-200 hover:shadow-lg hover:shadow-green-600/5 transition-all">
                <div className={`w-10 h-10 rounded-xl ${uc.color} flex items-center justify-center mb-4`}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{uc.title}</h3>
                <p className="text-sm text-green-700 font-medium italic mb-4">{uc.tagline}</p>
                <ul className="space-y-2">
                  {uc.bullets.map(b => (
                    <li key={b} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-600 mt-0.5 shrink-0">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0d3d2a] py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Pronto a iniziare?
          </h2>
          <p className="text-green-200 text-base sm:text-lg mb-8 leading-relaxed">
            Crea il tuo account gratuito e inizia a firmare documenti in meno di un minuto.
          </p>
          <Link
            to="/login"
            className="inline-block w-full sm:w-auto bg-white text-[#0d3d2a] font-bold py-4 px-10 rounded-xl text-base transition-all hover:bg-green-50 active:scale-[0.98]"
          >
            Inizia Gratis
          </Link>
        </div>
      </section>
    </SiteLayout>
  )
}
