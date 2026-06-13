import { useState } from 'react'
import { Link } from 'react-router-dom'
import SiteLayout from '../components/SiteLayout'

type Tab = 'termini' | 'api'

function ArticleBadge({ number }: { number: number }) {
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-600 text-white text-xs font-bold shrink-0 mt-0.5">
      {number}
    </span>
  )
}

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <svg
        className="w-4 h-4 text-green-600 shrink-0 mt-0.5"
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
      <span>{children}</span>
    </li>
  )
}

function SectionNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 text-gray-700 text-[14px]">
      {children}
    </div>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-semibold text-[#0d3d2a] mt-4 mb-1">{children}</p>
  )
}

// ---------------------------------------------------------------------------
// TAB 1 — Termini di Servizio
// ---------------------------------------------------------------------------
function TerminiContent() {
  return (
    <div className="space-y-10">

      {/* Art. 1 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={1} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Oggetto del Servizio</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            DR7 Trust è una piattaforma digitale dedicata alla gestione documentale, alla raccolta di firme
            elettroniche, all'automazione dei flussi di approvazione e, ove previsto, all'integrazione di tali
            funzionalità all'interno di software di terze parti tramite interfacce applicative e API.
          </p>
          <p>La piattaforma può consentire, a seconda del piano sottoscritto:</p>
          <ul className="space-y-1.5">
            <BulletItem>caricamento e gestione di documenti</BulletItem>
            <BulletItem>invio di richieste di firma</BulletItem>
            <BulletItem>apposizione di firme elettroniche</BulletItem>
            <BulletItem>gestione di template e workflow documentali</BulletItem>
            <BulletItem>monitoraggio degli stati di avanzamento</BulletItem>
            <BulletItem>utilizzo di servizi embedded o integrazioni API</BulletItem>
            <BulletItem>verifica dell'integrità e delle evidenze del documento</BulletItem>
          </ul>
          <p>
            L'accesso ad alcune funzionalità può dipendere dal piano commerciale attivo, dai limiti quantitativi
            previsti e da eventuali moduli aggiuntivi acquistati.
          </p>
        </div>
      </div>

      {/* Art. 2 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={2} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Registrazione e Account</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            Per utilizzare i servizi DR7 Trust, l'utente deve creare un account fornendo dati completi, corretti,
            aggiornati e veritieri.
          </p>
          <p>L'utente è responsabile:</p>
          <ul className="space-y-1.5">
            <BulletItem>della custodia delle proprie credenziali di accesso</BulletItem>
            <BulletItem>di tutte le attività effettuate tramite il proprio account</BulletItem>
            <BulletItem>della correttezza delle informazioni inserite</BulletItem>
            <BulletItem>dell'uso conforme della piattaforma rispetto ai presenti Termini</BulletItem>
          </ul>
          <p>
            L'utente si impegna a informare tempestivamente DR7 Trust in caso di uso non autorizzato del proprio
            account, perdita delle credenziali o violazione della sicurezza.
          </p>
          <SectionNote>
            DR7 Trust si riserva il diritto di sospendere, limitare o chiudere account registrati con dati falsi,
            incompleti, ingannevoli o utilizzati in violazione dei presenti Termini.
          </SectionNote>
        </div>
      </div>

      {/* Art. 3 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={3} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Periodo di Prova Gratuito</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            DR7 Trust può mettere a disposizione dell'utente un periodo di prova gratuito della durata di 30
            giorni, finalizzato a consentire la valutazione delle funzionalità della piattaforma.
          </p>
          <p>
            Durante il periodo di prova, l'accesso può essere completo, limitato ad alcune funzioni,
            subordinato a soglie di utilizzo, numero di documenti, numero di richieste di firma o altri
            parametri tecnici/commerciali.
          </p>
          <p>
            Salvo diversa indicazione, al termine del periodo di prova l'utente può decidere liberamente se
            attivare un piano a pagamento o non proseguire con il servizio.
          </p>
          <SectionNote>
            In caso di mancata attivazione di un piano a pagamento, DR7 Trust può limitare l'accesso
            all'account, ridurre le funzionalità disponibili, sospendere o disattivare il servizio, conservare
            o eliminare i dati secondo quanto previsto nei presenti Termini e nella Privacy Policy.
          </SectionNote>
        </div>
      </div>

      {/* Art. 4 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={4} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Piani, Durata e Modalità di Fatturazione</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <SubHeading>4.1 Piani Standard</SubHeading>
          <p>
            I piani standard sono disponibili con fatturazione mensile o annuale. Il rinnovo avviene
            automaticamente alla scadenza del periodo sottoscritto, salvo disdetta comunicata nei termini
            indicati all'art. 6.
          </p>
          <SubHeading>4.2 Piani API</SubHeading>
          <p>
            I piani API sono sottoscritti su base annuale e includono volumi predefiniti di chiamate,
            documenti elaborati o altri parametri di utilizzo specificati al momento dell'acquisto. Il
            superamento dei limiti di volume può comportare la sospensione temporanea del servizio o
            l'applicazione di costi aggiuntivi.
          </p>
          <SubHeading>4.3 Prezzi</SubHeading>
          <p>
            Tutti i prezzi si intendono al netto dell'IVA applicabile. DR7 Trust si riserva il diritto di
            aggiornare i listini prezzi, comunicando le variazioni con congruo anticipo attraverso la
            piattaforma o via email. Le variazioni di prezzo non si applicano ai periodi già fatturati.
          </p>
        </div>
      </div>

      {/* Art. 5 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={5} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Pagamenti</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            L'utente si impegna a corrispondere i corrispettivi dovuti per il piano sottoscritto secondo
            le modalità e le scadenze indicate al momento dell'acquisto.
          </p>
          <p>In caso di mancato o ritardato pagamento, DR7 Trust si riserva il diritto di:</p>
          <ul className="space-y-1.5">
            <BulletItem>sospendere temporaneamente l'accesso al servizio</BulletItem>
            <BulletItem>limitare le funzionalità disponibili fino alla regolarizzazione</BulletItem>
            <BulletItem>inviare solleciti di pagamento tramite email o altri canali</BulletItem>
            <BulletItem>
              risolvere il contratto e chiudere l'account in caso di inadempimento prolungato
            </BulletItem>
          </ul>
          <p>
            I pagamenti effettuati non sono rimborsabili, salvo quanto espressamente previsto all'art. 6
            o dalla normativa applicabile.
          </p>
        </div>
      </div>

      {/* Art. 6 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={6} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Recesso, Disdetta e Cancellazione</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <SubHeading>6.1 Piani Mensili</SubHeading>
          <p>
            L'utente può disdire il piano mensile in qualsiasi momento dall'area di gestione dell'account.
            La disdetta impedisce il rinnovo automatico al ciclo successivo. Non è prevista nessuna penale,
            né è previsto il rimborso pro-rata del periodo già pagato.
          </p>
          <SubHeading>6.2 Piani Annuali Standard</SubHeading>
          <p>
            L'utente può disdire il piano annuale in qualsiasi momento. La disdetta impedisce il rinnovo
            automatico alla scadenza dell'anno in corso. Il servizio rimane attivo fino al termine del
            periodo annuale già pagato. Non è previsto rimborso per le mensilità residue.
          </p>
          <SubHeading>6.3 Piani API Annuali</SubHeading>
          <p>
            I piani API annuali sono vincolanti per l'intera durata contrattuale. Non è possibile recedere
            anticipatamente né ottenere rimborsi parziali per i volumi non utilizzati, salvo accordi
            specifici scritti con DR7 Trust.
          </p>
          <SectionNote>
            Per esercitare il recesso, l'utente può agire direttamente dall'area personale della
            piattaforma o contattare il supporto DR7 Trust prima della data di rinnovo.
          </SectionNote>
        </div>
      </div>

      {/* Art. 7 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={7} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Uso Consentito della Piattaforma</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            L'utente si impegna a utilizzare la piattaforma DR7 Trust nel pieno rispetto della normativa
            vigente, in conformità ai presenti Termini e secondo i principi di buona fede e correttezza.
          </p>
          <p>È espressamente vietato:</p>
          <ul className="space-y-1.5">
            <BulletItem>utilizzare la piattaforma per attività fraudolente, illecite o contrarie all'ordine pubblico</BulletItem>
            <BulletItem>caricare, trasmettere o gestire contenuti illegali, offensivi o in violazione di diritti di terzi</BulletItem>
            <BulletItem>
              violare diritti di proprietà intellettuale, marchi, brevetti o segreti commerciali di DR7 Trust
              o di terzi
            </BulletItem>
            <BulletItem>
              tentare di aggirare, disabilitare o interferire con i limiti tecnici, i meccanismi di sicurezza
              o i sistemi di controllo della piattaforma
            </BulletItem>
            <BulletItem>
              effettuare attività di reverse engineering, decompilazione o disassemblaggio del software
            </BulletItem>
            <BulletItem>
              rivendere, sublicenziare o trasferire a terzi l'accesso ai servizi senza previa autorizzazione
              scritta di DR7 Trust
            </BulletItem>
          </ul>
          <p>
            La violazione delle presenti disposizioni potrà comportare la sospensione immediata dell'account
            e, nei casi più gravi, azioni legali.
          </p>
        </div>
      </div>

      {/* Art. 8 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={8} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Disponibilità del Servizio e Manutenzione</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            DR7 Trust si impegna a rendere la piattaforma ragionevolmente disponibile e funzionante, adottando
            misure tecniche adeguate per garantire continuità e affidabilità del servizio.
          </p>
          <p>Il servizio può risultare temporaneamente non disponibile o limitato a causa di:</p>
          <ul className="space-y-1.5">
            <BulletItem>interventi di manutenzione ordinaria o straordinaria</BulletItem>
            <BulletItem>aggiornamenti, migrazioni o rilasci di nuove versioni della piattaforma</BulletItem>
            <BulletItem>guasti tecnici, malfunzionamenti hardware o software non imputabili a DR7 Trust</BulletItem>
            <BulletItem>eventi di forza maggiore o cause di terzi al di fuori del controllo di DR7 Trust</BulletItem>
            <BulletItem>attacchi informatici, intrusioni o altri eventi di sicurezza</BulletItem>
          </ul>
          <p>
            DR7 Trust non garantisce la disponibilità ininterrotta del servizio e non sarà responsabile per
            eventuali danni derivanti da interruzioni temporanee, salvo quanto previsto dalla normativa
            applicabile.
          </p>
        </div>
      </div>

      {/* Art. 9 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={9} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Proprietà Intellettuale</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            Tutti i diritti di proprietà intellettuale relativi alla piattaforma DR7 Trust, inclusi ma non
            limitati a software, codice sorgente, interfacce grafiche, loghi, marchi, denominazioni,
            documentazione, algoritmi e contenuti editoriali, sono e rimangono di esclusiva proprietà di
            DR7 Trust o dei rispettivi licenziatari.
          </p>
          <p>
            L'accettazione dei presenti Termini concede all'utente esclusivamente un diritto di utilizzo
            della piattaforma limitato, non esclusivo, non trasferibile e revocabile, strettamente
            circoscritto alle finalità previste dal piano sottoscritto.
          </p>
          <SectionNote>
            Nessuna disposizione dei presenti Termini trasferisce all'utente alcun diritto di proprietà
            intellettuale su DR7 Trust o sui suoi componenti.
          </SectionNote>
        </div>
      </div>

      {/* Art. 10 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={10} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Trattamento dei Dati Personali</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            Il trattamento dei dati personali degli utenti avviene nel rispetto del Regolamento (UE)
            2016/679 ("GDPR") e della normativa nazionale applicabile.
          </p>
          <ul className="space-y-1.5">
            <BulletItem>
              Le modalità di raccolta, trattamento e conservazione dei dati sono descritte nella{' '}
              <Link to="/privacy" className="text-green-600 hover:underline font-medium">
                Privacy Policy
              </Link>{' '}
              di DR7 Trust, che costituisce parte integrante dei presenti Termini.
            </BulletItem>
            <BulletItem>
              Per i clienti che trattano dati personali di terzi tramite la piattaforma (es. firmatari
              di documenti), DR7 Trust agisce in qualità di Responsabile del Trattamento e può essere
              stipulato un apposito Data Processing Agreement (DPA).
            </BulletItem>
            <BulletItem>
              L'utente è responsabile di acquisire, ove necessario, le autorizzazioni e i consensi
              previsti dalla normativa per il trattamento dei dati dei propri utenti finali.
            </BulletItem>
          </ul>
        </div>
      </div>

      {/* Art. 11 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={11} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Limitazione di Responsabilità</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            Nei limiti consentiti dalla normativa applicabile, DR7 Trust non sarà responsabile per danni
            indiretti, consequenziali, incidentali, punitivi o per perdita di profitti, dati, reputazione
            o opportunità commerciali derivanti dall'uso o dall'impossibilità di utilizzo della piattaforma.
          </p>
          <p>
            L'utente è l'unico responsabile dei contenuti caricati sulla piattaforma, dei documenti inviati
            per la firma, delle informazioni inserite e della loro conformità alla normativa vigente.
          </p>
          <p>
            La responsabilità complessiva di DR7 Trust verso l'utente, per qualsiasi causa, non potrà in
            alcun caso superare i corrispettivi effettivamente pagati dall'utente nei dodici mesi
            precedenti all'evento che ha dato origine alla pretesa risarcitoria.
          </p>
        </div>
      </div>

      {/* Art. 12 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={12} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Modifiche ai Termini o al Servizio</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            DR7 Trust si riserva il diritto di aggiornare, modificare o integrare i presenti Termini di
            Servizio in qualsiasi momento, anche al fine di adeguarsi a variazioni normative, tecnologiche
            o commerciali.
          </p>
          <p>
            Le modifiche verranno comunicate all'utente tramite notifica sulla piattaforma, via email
            all'indirizzo registrato, o mediante pubblicazione della versione aggiornata con indicazione
            della data di efficacia.
          </p>
          <SectionNote>
            Il proseguimento nell'utilizzo della piattaforma dopo la comunicazione delle modifiche
            costituisce accettazione dei Termini aggiornati. In caso di disaccordo, l'utente ha il
            diritto di recedere dal servizio prima della data di entrata in vigore delle modifiche.
          </SectionNote>
        </div>
      </div>

      {/* Art. 13 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={13} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Legge Applicabile e Foro Competente</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            I presenti Termini di Servizio sono disciplinati dalla legge italiana. Per qualsiasi
            controversia relativa all'interpretazione, all'esecuzione o alla risoluzione dei presenti
            Termini, le parti concordano sulla competenza esclusiva del Tribunale del luogo in cui
            DR7 Trust ha la propria sede legale.
          </p>
          <p>
            Per gli utenti che rivestono la qualità di consumatori ai sensi del Codice del Consumo (D.Lgs.
            206/2005), si applicano le norme inderogabili previste dalla legge italiana a tutela dei
            consumatori, ivi incluse quelle in materia di foro competente.
          </p>
        </div>
      </div>

    </div>
  )
}

// ---------------------------------------------------------------------------
// TAB 2 — Condizioni API
// ---------------------------------------------------------------------------
function ApiContent() {
  return (
    <div className="space-y-10">

      {/* Art. 1 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={1} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Oggetto</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            Le presenti Condizioni disciplinano l'accesso e l'utilizzo delle API (Application Programming
            Interface) di DR7 Trust, messe a disposizione degli utenti che hanno sottoscritto un piano API
            o che dispongono di accesso API nell'ambito del proprio piano commerciale.
          </p>
          <p>
            Le API consentono l'integrazione delle funzionalità DR7 Trust all'interno di applicazioni,
            piattaforme e sistemi di terze parti, permettendo operazioni quali la gestione documentale,
            l'invio di richieste di firma, il monitoraggio degli stati e l'acquisizione di evidenze
            di processo.
          </p>
          <p>
            Le presenti Condizioni si applicano congiuntamente ai Termini di Servizio generali di
            DR7 Trust, che restano integralmente vigenti. In caso di conflitto tra le due, prevalgono
            le presenti Condizioni API per le materie qui regolate.
          </p>
        </div>
      </div>

      {/* Art. 2 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={2} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Accesso — API Key e Token</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            L'accesso alle API DR7 Trust avviene tramite credenziali di autenticazione (API Key o token
            di accesso) generate dalla piattaforma. Tali credenziali sono strettamente personali e
            riservate al titolare dell'account.
          </p>
          <ul className="space-y-1.5">
            <BulletItem>
              L'utente è responsabile della custodia e della riservatezza delle proprie chiavi API.
            </BulletItem>
            <BulletItem>
              Le credenziali non devono essere condivise, pubblicate in repository pubblici o trasmesse
              a soggetti non autorizzati.
            </BulletItem>
            <BulletItem>
              In caso di compromissione sospetta di una chiave API, l'utente deve provvedere
              immediatamente alla sua revoca e al rinnovo tramite il pannello di controllo.
            </BulletItem>
            <BulletItem>
              DR7 Trust non sarà responsabile per utilizzi non autorizzati derivanti da negligenza
              nella custodia delle credenziali.
            </BulletItem>
          </ul>
        </div>
      </div>

      {/* Art. 3 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={3} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Ambiente Sandbox</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            DR7 Trust può mettere a disposizione degli sviluppatori un ambiente sandbox isolato, dedicato
            ai test di integrazione e allo sviluppo applicativo, senza impatto sull'ambiente di produzione
            e senza consumo dei volumi del piano sottoscritto.
          </p>
          <ul className="space-y-1.5">
            <BulletItem>
              L'ambiente sandbox simula il comportamento delle API di produzione ma non garantisce le
              stesse performance, disponibilità o integrità dei dati.
            </BulletItem>
            <BulletItem>
              I dati inseriti in sandbox sono fittizi e possono essere eliminati da DR7 Trust senza
              preavviso.
            </BulletItem>
            <BulletItem>
              È vietato utilizzare l'ambiente sandbox per operazioni su dati personali reali o per
              fini diversi dallo sviluppo e dal test.
            </BulletItem>
          </ul>
        </div>
      </div>

      {/* Art. 4 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={4} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Piani API e Durata</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            I piani API sono sottoscritti su base annuale e comprendono volumi predefiniti di utilizzo
            (chiamate API, documenti elaborati, firme richieste, webhook ricevuti o altri parametri
            definiti al momento dell'acquisto).
          </p>
          <ul className="space-y-1.5">
            <BulletItem>
              I volumi non utilizzati al termine del periodo contrattuale non vengono trasferiti al
              periodo successivo.
            </BulletItem>
            <BulletItem>
              Il superamento dei volumi inclusi nel piano può comportare la sospensione del servizio
              API o l'attivazione automatica di volumi aggiuntivi, secondo quanto indicato nel piano.
            </BulletItem>
            <BulletItem>
              È possibile aggiornare il piano o acquistare volumi aggiuntivi in qualsiasi momento
              tramite il pannello di gestione dell'account.
            </BulletItem>
          </ul>
        </div>
      </div>

      {/* Art. 5 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={5} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Limiti Tecnici e Rate Limiting</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            Per garantire la stabilità e l'equità del servizio a tutti gli utenti, DR7 Trust applica
            limiti tecnici al numero di richieste API effettuabili in un determinato intervallo di
            tempo (rate limiting).
          </p>
          <ul className="space-y-1.5">
            <BulletItem>
              I limiti di frequenza (richieste al secondo, al minuto o all'ora) sono specificati
              nella documentazione tecnica delle API.
            </BulletItem>
            <BulletItem>
              Il superamento dei limiti comporta la restituzione di risposte di errore standard
              (HTTP 429 Too Many Requests) fino al ripristino della finestra temporale.
            </BulletItem>
            <BulletItem>
              L'utente è responsabile dell'implementazione di logiche di retry e backoff esponenziale
              nella propria integrazione.
            </BulletItem>
            <BulletItem>
              DR7 Trust può aggiornare i limiti tecnici comunicandolo con adeguato preavviso tramite
              i canali ufficiali.
            </BulletItem>
          </ul>
        </div>
      </div>

      {/* Art. 6 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={6} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Uso Consentito</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            L'utilizzo delle API DR7 Trust è consentito esclusivamente per le finalità previste dal
            piano sottoscritto e nel rispetto della normativa vigente.
          </p>
          <p>È espressamente vietato:</p>
          <ul className="space-y-1.5">
            <BulletItem>
              utilizzare le API per automatizzare operazioni fraudolente, illecite o in violazione
              di diritti di terzi
            </BulletItem>
            <BulletItem>
              effettuare richieste massive o automatizzate finalizzate a sovraccaricare
              intenzionalmente i sistemi DR7 Trust (DoS/DDoS)
            </BulletItem>
            <BulletItem>
              tentare di accedere a endpoint non documentati o non autorizzati per il piano dell'utente
            </BulletItem>
            <BulletItem>
              rivendere o redistribuire l'accesso alle API a terzi senza accordo scritto con DR7 Trust
            </BulletItem>
            <BulletItem>
              utilizzare le API per raccogliere dati in modo non conforme al GDPR o ad altre normative
              applicabili sulla protezione dei dati
            </BulletItem>
          </ul>
        </div>
      </div>

      {/* Art. 7 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={7} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Integrazione e Responsabilità</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            L'utente che integra le API DR7 Trust all'interno di proprie applicazioni o piattaforme è
            responsabile della corretta implementazione dell'integrazione, del comportamento della
            propria applicazione verso gli utenti finali e della conformità normativa dell'intera
            soluzione sviluppata.
          </p>
          <ul className="space-y-1.5">
            <BulletItem>
              DR7 Trust non è responsabile per malfunzionamenti o errori derivanti da un'integrazione
              non corretta da parte dell'utente.
            </BulletItem>
            <BulletItem>
              L'utente si impegna a informare i propri utenti finali del trattamento dei loro dati
              personali effettuato tramite l'integrazione con DR7 Trust.
            </BulletItem>
            <BulletItem>
              L'utente è responsabile del rispetto delle obbligazioni di legge nei confronti dei
              propri utenti finali, incluse informative, consensi e diritti degli interessati.
            </BulletItem>
          </ul>
        </div>
      </div>

      {/* Art. 8 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={8} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Webhook</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            DR7 Trust può mettere a disposizione meccanismi di notifica asincrona tramite webhook,
            consentendo all'utente di ricevere aggiornamenti in tempo reale sugli eventi rilevanti
            della piattaforma (es. firma completata, documento rifiutato, scadenza imminente).
          </p>
          <ul className="space-y-1.5">
            <BulletItem>
              L'utente è responsabile della configurazione e della disponibilità dell'endpoint di
              ricezione dei webhook.
            </BulletItem>
            <BulletItem>
              DR7 Trust effettua tentativi di consegna multipli in caso di mancata risposta
              dell'endpoint, secondo logiche di retry definite nella documentazione tecnica.
            </BulletItem>
            <BulletItem>
              L'utente deve verificare l'autenticità dei webhook ricevuti tramite i meccanismi di
              firma e validazione messi a disposizione da DR7 Trust.
            </BulletItem>
            <BulletItem>
              DR7 Trust non garantisce la consegna in ordine cronologico degli eventi notificati
              tramite webhook.
            </BulletItem>
          </ul>
        </div>
      </div>

      {/* Art. 9 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={9} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Disponibilità e SLA</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            DR7 Trust si impegna a garantire la disponibilità delle API secondo livelli di servizio
            (SLA) eventualmente definiti nel piano API sottoscritto o nella documentazione commerciale.
          </p>
          <ul className="space-y-1.5">
            <BulletItem>
              In assenza di SLA specifici, DR7 Trust fornisce le API con ragionevole impegno di
              continuità, senza garantire la disponibilità al 100%.
            </BulletItem>
            <BulletItem>
              Le finestre di manutenzione programmata sono comunicate con preavviso tramite
              i canali ufficiali (status page, email, dashboard).
            </BulletItem>
            <BulletItem>
              I crediti di servizio eventualmente previsti in caso di mancato rispetto degli SLA
              sono descritti nella documentazione del piano e rappresentano il rimedio esclusivo
              disponibile per l'utente in tali circostanze.
            </BulletItem>
          </ul>
        </div>
      </div>

      {/* Art. 10 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={10} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Sicurezza</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            DR7 Trust adotta misure di sicurezza tecniche e organizzative adeguate a proteggere le
            API e i dati trattati attraverso esse. L'utente è parimenti tenuto ad adottare pratiche
            di sicurezza appropriate nella propria integrazione.
          </p>
          <ul className="space-y-1.5">
            <BulletItem>
              Tutte le comunicazioni verso le API avvengono tramite protocolli cifrati (HTTPS/TLS).
            </BulletItem>
            <BulletItem>
              L'utente è responsabile della sicurezza delle proprie applicazioni che consumano le API,
              inclusa la gestione sicura delle chiavi di autenticazione.
            </BulletItem>
            <BulletItem>
              L'utente è tenuto a segnalare tempestivamente a DR7 Trust qualsiasi vulnerabilità
              o incidente di sicurezza rilevato nell'ambito dell'integrazione.
            </BulletItem>
            <BulletItem>
              DR7 Trust si riserva il diritto di revocare immediatamente l'accesso in caso di
              attività sospette o potenzialmente lesive per la sicurezza della piattaforma.
            </BulletItem>
          </ul>
        </div>
      </div>

      {/* Art. 11 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={11} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Sospensione e Revoca dell'Accesso</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            DR7 Trust si riserva il diritto di sospendere o revocare l'accesso alle API in qualsiasi
            momento, con o senza preavviso, nei seguenti casi:
          </p>
          <ul className="space-y-1.5">
            <BulletItem>
              violazione delle presenti Condizioni API o dei Termini di Servizio generali
            </BulletItem>
            <BulletItem>
              mancato pagamento del piano API o di eventuali volumi aggiuntivi
            </BulletItem>
            <BulletItem>
              utilizzo delle API in modo tale da compromettere la sicurezza, la stabilità o
              le prestazioni della piattaforma
            </BulletItem>
            <BulletItem>
              richiesta dell'autorità giudiziaria o di un'autorità di regolamentazione competente
            </BulletItem>
            <BulletItem>
              superamento reiterato dei limiti tecnici o utilizzo anomalo che pregiudichi gli altri utenti
            </BulletItem>
          </ul>
          <SectionNote>
            In caso di sospensione, DR7 Trust fornirà all'utente le informazioni necessarie per
            regolarizzare la propria posizione, ove possibile e nei limiti della normativa applicabile.
          </SectionNote>
        </div>
      </div>

      {/* Art. 12 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={12} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Modifiche alle API</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            DR7 Trust si riserva il diritto di modificare, aggiornare, deprecare o interrompere
            funzionalità delle API, incluse versioni specifiche, endpoint, parametri o comportamenti.
          </p>
          <ul className="space-y-1.5">
            <BulletItem>
              Le modifiche non retrocompatibili (breaking changes) saranno comunicate con un
              preavviso minimo di 90 giorni, salvo urgenze legate a sicurezza o normativa.
            </BulletItem>
            <BulletItem>
              DR7 Trust si impegna a mantenere il versionamento delle API per consentire agli utenti
              un periodo di transizione adeguato.
            </BulletItem>
            <BulletItem>
              Le versioni deprecate possono essere mantenute attive per un periodo limitato,
              indicato nella documentazione tecnica, prima della definitiva dismissione.
            </BulletItem>
          </ul>
          <p>
            L'utente è responsabile di aggiornare la propria integrazione in risposta alle modifiche
            comunicate da DR7 Trust entro i termini indicati.
          </p>
        </div>
      </div>

      {/* Art. 13 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={13} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Proprietà Intellettuale</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            Le API DR7 Trust, la relativa documentazione tecnica, gli SDK, gli esempi di codice e
            qualsiasi altro materiale tecnico fornito da DR7 Trust sono protetti da diritti di
            proprietà intellettuale e rimangono di esclusiva proprietà di DR7 Trust o dei rispettivi
            licenziatari.
          </p>
          <ul className="space-y-1.5">
            <BulletItem>
              DR7 Trust concede all'utente una licenza limitata, non esclusiva, non trasferibile
              e revocabile per l'utilizzo delle API secondo quanto previsto dal piano sottoscritto.
            </BulletItem>
            <BulletItem>
              È consentita la realizzazione di integrazioni e applicazioni basate sulle API, nel
              rispetto delle presenti Condizioni.
            </BulletItem>
            <BulletItem>
              Non è consentito presentare la propria integrazione come se fosse un prodotto DR7 Trust,
              né utilizzare marchi, loghi o denominazioni di DR7 Trust senza autorizzazione scritta.
            </BulletItem>
          </ul>
        </div>
      </div>

      {/* Art. 14 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={14} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Responsabilità</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            DR7 Trust non sarà responsabile per danni diretti, indiretti, incidentali o consequenziali
            derivanti dall'uso delle API, da interruzioni del servizio, da errori nelle risposte o
            da modifiche apportate alle API stesse.
          </p>
          <ul className="space-y-1.5">
            <BulletItem>
              L'utente è responsabile di testare adeguatamente la propria integrazione prima
              del rilascio in produzione.
            </BulletItem>
            <BulletItem>
              DR7 Trust non garantisce che le API siano prive di errori o che il loro funzionamento
              sia ininterrotto in qualsiasi circostanza.
            </BulletItem>
            <BulletItem>
              La responsabilità massima di DR7 Trust nei confronti dell'utente per qualsiasi
              controversia relativa alle API non potrà superare i corrispettivi pagati negli
              ultimi 12 mesi per il piano API sottoscritto.
            </BulletItem>
          </ul>
        </div>
      </div>

      {/* Art. 15 */}
      <div>
        <div className="flex items-start gap-3 mb-3">
          <ArticleBadge number={15} />
          <h2 className="text-lg font-bold text-[#0d3d2a]">Legge Applicabile</h2>
        </div>
        <div className="pl-0 sm:pl-10 space-y-3 text-gray-600 text-[15px] leading-relaxed">
          <p>
            Le presenti Condizioni API sono disciplinate dalla legge italiana. Per qualsiasi
            controversia relativa all'interpretazione, all'applicazione o all'esecuzione delle
            presenti Condizioni, le parti concordano sulla competenza esclusiva del Tribunale
            del luogo in cui DR7 Trust ha la propria sede legale.
          </p>
          <p>
            Nella misura in cui le presenti Condizioni API integrano o modificano i Termini di
            Servizio generali, quest'ultimi restano applicabili per tutto quanto non espressamente
            regolato dalle presenti Condizioni.
          </p>
        </div>
      </div>

    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function TermsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('termini')

  return (
    <SiteLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* Page header */}
        <div className="mb-10">
          <p className="text-sm font-semibold text-green-600 uppercase tracking-wide mb-2">
            Documenti Legali
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0d3d2a] leading-snug">
            Termini e Condizioni
          </h1>
          <p className="text-gray-500 text-[15px] mt-2">
            Ultima revisione: Marzo 2025 — Versione 1.0
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-10 w-full sm:w-fit">
          <button
            onClick={() => setActiveTab('termini')}
            className={`flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'termini'
                ? 'bg-white text-[#0d3d2a] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Termini di Servizio
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'api'
                ? 'bg-white text-[#0d3d2a] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Condizioni API
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'termini' ? <TerminiContent /> : <ApiContent />}

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Link to="/" className="text-green-600 hover:underline text-sm font-medium">
            Torna alla home
          </Link>
          <span className="text-xs text-gray-400 break-words">DR7 Trust — Infrastructure for Digital Trust</span>
        </div>
      </div>
    </SiteLayout>
  )
}
