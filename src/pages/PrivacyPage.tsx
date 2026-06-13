import SiteLayout from '../components/SiteLayout'

export default function PrivacyPage() {
  return (
    <SiteLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Header */}
        <div className="mb-12">
          <p className="text-sm font-semibold text-green-600 uppercase tracking-wide mb-2">Legale</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0d3d2a] leading-tight break-words">
            Privacy Policy
          </h1>
          <p className="text-gray-400 text-sm mt-3">Ultimo aggiornamento: Marzo 2026</p>
        </div>

        {/* Privacy Policy */}
        <section className="space-y-8 text-gray-600 leading-relaxed text-[15px] break-words">

          <div>
            <h2 className="text-xl font-bold text-[#0d3d2a] mb-4">Privacy e protezione dei dati</h2>
            <p>DR7 Trust tratta i dati personali nel rispetto della normativa vigente in materia di protezione dei dati, incluso il Regolamento (UE) 2016/679.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Dati raccolti</h3>
            <p className="mb-3">I dati raccolti possono includere, a seconda dei servizi utilizzati:</p>
            <ul className="space-y-2">
              {[
                'dati anagrafici e di contatto',
                'credenziali e dati di accesso',
                'dati tecnici e log di utilizzo',
                'dati relativi ai documenti caricati, inviati o firmati',
                'dati necessari alla tracciabilita delle operazioni e alla sicurezza del servizio',
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="text-green-600 mt-1 shrink-0">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Finalita del trattamento</h3>
            <p className="mb-3">I dati sono trattati per finalita connesse a:</p>
            <ul className="space-y-2">
              {[
                'erogazione dei servizi DR7 Trust',
                'autenticazione e gestione account',
                'sicurezza, audit e tracciabilita',
                'supporto tecnico e assistenza',
                'adempimenti legali, fiscali e normativi',
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="text-green-600 mt-1 shrink-0">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Marketing consent section */}
          <div className="border-t border-gray-200 pt-8">
            <h2 className="text-xl font-bold text-[#0d3d2a] mb-4">Trattamento per finalita di marketing</h2>

            <p className="mb-4">Ai sensi del Regolamento (UE) 2016/679 ("GDPR"), previo consenso dell'utente, DR7 Trust potra trattare i dati personali forniti durante l'utilizzo della piattaforma (quali ad esempio dati identificativi e di contatto) per finalita di marketing e comunicazioni commerciali.</p>

            <p className="mb-4">I dati potranno essere utilizzati per l'invio di vantaggi, offerte, promozioni e sconti dedicati relativi a prodotti o servizi che potrebbero essere di interesse per l'utente.</p>

            <p className="mb-4">Le comunicazioni potranno essere effettuate tramite diversi canali di contatto, tra cui, a titolo esemplificativo: email, SMS, telefono, notifiche push, applicazioni di messaggistica (come ad esempio WhatsApp) e altri strumenti di comunicazione elettronica o digitale.</p>

            <div className="border-l-4 border-green-600 pl-4 sm:pl-5 py-1 mb-4">
              <p>Previo consenso dell'utente, i dati potranno essere trattati da DR7 Trust, partner selezionati, e resi disponibili anche attraverso <strong className="text-gray-800">DR7 Platform</strong>, una piattaforma digitale utilizzata per la gestione e la distribuzione di opportunita commerciali e offerte da parte di aziende e partner aderenti.</p>
            </div>

            <p className="mb-4">Attraverso DR7 Platform, i dati potranno essere utilizzati da partner commerciali selezionati presenti sulla piattaforma, al fine di proporre comunicazioni commerciali, offerte, promozioni, vantaggi e sconti dedicati.</p>

            <p className="mb-4">Tali partner possono appartenere a diverse categorie merceologiche e settori economici, inclusi, a titolo esemplificativo ma non esaustivo, aziende operanti nei settori retail e beni di consumo, moda e abbigliamento, e-commerce, servizi digitali e tecnologici, telecomunicazioni, mobilita, turismo, energia, assicurazioni, servizi finanziari, servizi professionali, casa, benessere, tempo libero e altri prodotti o servizi potenzialmente di interesse per l'utente.</p>

            <div className="bg-gray-50 rounded-xl p-4 sm:p-5 border border-gray-100 mb-4">
              <p className="text-gray-700 font-medium">Il consenso al trattamento dei dati per finalita di marketing e facoltativo e non e necessario per l'utilizzo delle funzionalita principali della piattaforma.</p>
            </div>

            <p className="mb-4">L'utente puo revocare in qualsiasi momento il consenso prestato tramite i link di disiscrizione presenti nelle comunicazioni ricevute oppure attraverso i canali indicati nella privacy policy generale.</p>

            <p className="mb-4">DR7 Trust conserva evidenza del consenso prestato, inclusi data, ora e log tecnici associati alla manifestazione di volonta dell'utente, al fine di dimostrare la liceita del trattamento.</p>

            <p>L'utente puo esercitare in qualsiasi momento i diritti previsti dagli articoli 15-22 del GDPR, tra cui accesso ai dati personali, rettifica, cancellazione, limitazione del trattamento, opposizione e portabilita dei dati.</p>
          </div>

          {/* Cookie Policy */}
          <div className="border-t border-gray-200 pt-8">
            <h2 className="text-xl font-bold text-[#0d3d2a] mb-4">Cookie Policy</h2>

            <h3 className="text-lg font-semibold text-gray-800 mb-3">Cookie e tecnologie simili</h3>

            <p className="mb-4">DR7 Trust utilizza cookie tecnici e strumenti equivalenti necessari al funzionamento della piattaforma, alla sicurezza delle sessioni, all'autenticazione degli utenti e al miglioramento delle prestazioni del servizio.</p>

            <p className="mb-4">Ove applicabile, potranno essere utilizzati anche strumenti di analisi, misurazione o tecnologie ulteriori secondo quanto indicato nelle preferenze di consenso eventualmente rese disponibili all'utente.</p>

            <div className="bg-gray-50 rounded-xl p-4 sm:p-5 border border-gray-100">
              <h4 className="font-semibold text-gray-800 mb-2">Tipologie di cookie utilizzati</h4>
              <ul className="space-y-2">
                {[
                  { name: 'Cookie tecnici', desc: 'necessari al funzionamento della piattaforma e alla gestione delle sessioni utente' },
                  { name: 'Cookie di autenticazione', desc: 'utilizzati per mantenere l\'accesso sicuro all\'account' },
                  { name: 'Cookie di preferenza', desc: 'utilizzati per memorizzare le preferenze dell\'utente' },
                ].map(item => (
                  <li key={item.name} className="flex items-start gap-2.5">
                    <span className="text-green-600 mt-1 shrink-0">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </span>
                    <span><strong className="text-gray-800">{item.name}</strong> — {item.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Diritti dell'utente */}
          <div className="border-t border-gray-200 pt-8">
            <h2 className="text-xl font-bold text-[#0d3d2a] mb-4">Diritti dell'utente</h2>

            <p className="mb-4">L'utente puo esercitare in qualsiasi momento i seguenti diritti previsti dal GDPR:</p>

            <ul className="space-y-2 mb-4">
              {[
                'Diritto di accesso ai dati personali (art. 15)',
                'Diritto di rettifica (art. 16)',
                'Diritto alla cancellazione (art. 17)',
                'Diritto di limitazione del trattamento (art. 18)',
                'Diritto alla portabilita dei dati (art. 20)',
                'Diritto di opposizione (art. 21)',
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="text-green-600 mt-1 shrink-0">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <p>Per esercitare i propri diritti, l'utente puo contattare DR7 Trust tramite i canali indicati sulla piattaforma.</p>
          </div>
        </section>
      </div>
    </SiteLayout>
  )
}
