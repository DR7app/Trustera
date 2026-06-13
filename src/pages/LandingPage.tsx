import { Link } from 'react-router-dom'
import SiteLayout from '../components/SiteLayout'

export default function LandingPage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-24 pb-12 sm:pb-20 text-center">
        <h1 className="text-3xl sm:text-5xl lg:text-[56px] font-bold leading-[1.1] mb-5 sm:mb-6 text-[#0d3d2a]">
          Ancora a stampare, firmare e scannerizzare documenti?
        </h1>
        <p className="text-lg sm:text-2xl text-gray-600 mb-4 leading-relaxed">
          Con <strong className="text-green-600">DR7 Trust</strong> firmi e invii tutto <strong className="text-gray-900">in meno di un minuto.</strong>
        </p>
        <p className="text-sm sm:text-lg text-gray-500 mb-8 sm:mb-10 leading-relaxed max-w-2xl mx-auto">
          Carica un PDF, scegli a chi inviarlo e il firmatario riceve il link via <strong className="text-gray-700">email e WhatsApp</strong>.
          <br className="hidden sm:block" />
          <span className="sm:hidden"> </span>
          Ogni documento ha <strong className="text-gray-700">Audit Trail certificato</strong> con data, ora e dispositivo.
        </p>
        <Link to="/login" className="inline-block w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 sm:px-10 rounded-xl text-lg transition-all shadow-lg shadow-green-600/25 active:scale-[0.98]">
          Inizia Gratis
        </Link>
      </section>

      {/* How it works */}
      <section className="py-12 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-[#0d3d2a] mb-4">Come funziona</h2>
          <p className="text-center text-sm sm:text-base text-gray-400 mb-10 sm:mb-12 max-w-xl mx-auto">Tre passaggi. Un minuto. Invia a chiunque.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-8">
            {[
              { step: '1', title: 'Carica il documento', desc: 'Trascina un PDF nella dashboard. Supporta qualsiasi tipo di documento.' },
              { step: '2', title: 'Aggiungi i firmatari', desc: 'Uno o piu firmatari per documento. Inserisci nome, email e WhatsApp. Clienti, fornitori, dipendenti — chiunque.' },
              { step: '3', title: 'Invia e monitora', desc: 'Ogni firmatario riceve il proprio link via email e WhatsApp. Firma con OTP. Monitora chi ha gia firmato.' },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-green-600 text-white text-xl font-bold flex items-center justify-center mx-auto mb-4">{s.step}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 mt-8">Ogni firmatario ha il proprio link e audit trail indipendente.</p>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-12 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { title: 'Multi-firmatario.', desc: 'Invia a piu persone. Ogni firmatario riceve il proprio link e firma in autonomia.' },
              { title: 'Tracciata.', desc: 'Audit trail completo: IP, data, ora, dispositivo per ogni firma.' },
              { title: 'Protetta.', desc: 'Hash SHA-256, documento non modificabile dopo la firma.' },
              { title: 'Gratuita.', desc: 'Piano Free senza limiti, sostenuto da offerte partner.' },
            ].map(f => (
              <div key={f.title} className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 shadow-sm hover:shadow-md hover:shadow-green-600/5 transition-shadow">
                <h3 className="text-base sm:text-lg font-bold text-green-600 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4 text-[#0d3d2a]">Scegli il tuo piano</h2>
        <p className="text-center text-sm sm:text-base text-gray-400 mb-10 sm:mb-12">
          <Link to="/pricing" className="hover:text-green-600 transition-colors underline underline-offset-4">Vedi tutti i dettagli</Link>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            <h3 className="text-2xl font-bold text-green-600 mb-1">Free</h3>
            <p className="text-4xl font-bold text-gray-900 mb-1">0</p>
            <p className="text-sm text-gray-400 mb-6">per sempre</p>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              Piattaforma senza costo, sostenuta da iniziative promozionali e vantaggi commerciali per gli utenti che prestano consenso.
            </p>
            <ul className="text-sm text-gray-600 space-y-3 mb-8">
              {['Documenti illimitati', 'Firma OTP via WhatsApp/Email', 'Audit Trail certificato', 'Dashboard documenti'].map(item => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-green-600 font-bold text-base">&#10003;</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/login" className="block text-center bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-lg transition-colors shadow-md shadow-green-600/20">
              Inizia Gratis
            </Link>
          </div>
          <div className="bg-white border-2 border-green-500/30 rounded-2xl p-6 sm:p-8 relative shadow-sm">
            <div className="absolute -top-3 right-6 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
              PRO
            </div>
            <h3 className="text-2xl font-bold text-green-600 mb-1">Premium</h3>
            <p className="text-4xl font-bold text-gray-900 mb-1">--</p>
            <p className="text-sm text-gray-400 mb-6">prossimamente</p>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              Esperienza dedicata, senza utilizzo dei contatti per finalita promozionali di terzi.
            </p>
            <ul className="text-sm text-gray-600 space-y-3 mb-8">
              {['Tutto del Free', 'Nessuna promozione partner', 'Branding personalizzato', 'API access'].map(item => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-green-600 font-bold text-base">&#10003;</span>
                  {item}
                </li>
              ))}
            </ul>
            <button disabled className="block w-full text-center bg-gray-100 text-gray-400 font-bold py-3.5 rounded-lg cursor-not-allowed">
              Prossimamente
            </button>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="bg-[#0d3d2a] py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-4">30 giorni gratis. Nessun rischio.</h2>
          <p className="text-green-200/70 text-base sm:text-lg mb-8 max-w-xl mx-auto leading-relaxed">Prova DR7 Trust gratuitamente e valuta la piattaforma in piena liberta. Nessuna penale, nessun vincolo.</p>
          <Link to="/login" className="inline-block w-full sm:w-auto bg-white text-[#0d3d2a] font-bold py-3.5 px-8 sm:px-10 rounded-xl text-lg transition-all hover:bg-green-50 active:scale-[0.98]">
            Inizia Gratis
          </Link>
        </div>
      </section>
    </SiteLayout>
  )
}
