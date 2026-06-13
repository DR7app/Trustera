import { useState } from 'react'
import { Link } from 'react-router-dom'
import SiteLayout from '../components/SiteLayout'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const FREE_FEATURES = [
  'Documenti illimitati',
  'Firma OTP via WhatsApp/Email',
  'Audit Trail certificato',
  'Dashboard documenti',
]

const PREMIUM_FEATURES = [
  'Tutto del Free',
  'Nessuna promozione partner',
  'Branding personalizzato',
  'API access',
]

const MARKETING_BULLETS = [
  'Nessuna penale',
  'Nessun vincolo sul piano mensile',
  'Disdetta quando vuoi',
  'Prezzi chiari',
  'Piani standard mensili o annuali',
  'Piani API disponibili su base annuale',
]

const FAQS = [
  {
    question: 'Posso annullare in qualsiasi momento?',
    answer:
      'Si. Sul piano mensile non ci sono penali ne costi di uscita. Puoi disdire quando vuoi, senza dover fornire motivazioni.',
  },
  {
    question: 'I prezzi includono IVA?',
    answer:
      'No. Tutti i prezzi indicati sono al netto di IVA. L\'IVA applicabile sara aggiunta in fase di fatturazione secondo la normativa vigente.',
  },
  {
    question: "C'e un periodo di prova?",
    answer:
      'Si. Il piano Free e disponibile senza limiti di tempo. Quando il piano Premium sara disponibile, sara previsto un periodo di prova gratuita di 30 giorni, senza necessita di inserire una carta di credito.',
  },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CheckIcon() {
  return (
    <svg
      className="w-5 h-5 text-green-600 shrink-0"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  )
}

interface BillingToggleProps {
  annual: boolean
  onChange: (annual: boolean) => void
}

function BillingToggle({ annual, onChange }: BillingToggleProps) {
  return (
    <div className="flex items-center justify-center gap-3 text-sm font-medium">
      <button
        onClick={() => onChange(false)}
        className={`transition-colors ${
          !annual ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        Mensile
      </button>

      <button
        onClick={() => onChange(!annual)}
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
        style={{ backgroundColor: annual ? '#16a34a' : '#d1d5db' }}
        role="switch"
        aria-checked={annual}
        aria-label="Fatturazione annuale"
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            annual ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>

      <button
        onClick={() => onChange(true)}
        className={`flex items-center gap-1.5 transition-colors ${
          annual ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        Annuale
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
          -20%
        </span>
      </button>
    </div>
  )
}

interface FeatureListProps {
  features: string[]
}

function FeatureList({ features }: FeatureListProps) {
  return (
    <ul className="space-y-3">
      {features.map((feature) => (
        <li key={feature} className="flex items-start gap-3 text-sm text-gray-600">
          <CheckIcon />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  )
}

interface FaqItemProps {
  question: string
  answer: string
  defaultOpen?: boolean
}

function FaqItem({ question, answer, defaultOpen = false }: FaqItemProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-gray-900">{question}</span>
        <span
          className={`ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-transform ${
            open ? 'rotate-45' : ''
          }`}
          aria-hidden="true"
        >
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open && (
        <p className="pb-5 text-sm leading-relaxed text-gray-500">{answer}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)

  return (
    <SiteLayout>
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-green-600 mb-4">
          Pricing
        </p>
        <h1 className="text-3xl sm:text-5xl font-bold leading-[1.1] text-[#0d3d2a] mb-5">
          Prezzi trasparenti.
          <br />
          Nessun costo nascosto.
        </h1>
        <p className="text-base sm:text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto">
          Crediamo che la chiarezza sia un valore. Ogni piano indica esattamente
          cosa ottieni, quanto paghi e cosa non ti verra mai addebitato a
          sorpresa.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1 — Piani Piattaforma                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-12 sm:pb-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-[#0d3d2a] mb-3">
          Piani Piattaforma
        </h2>
        <p className="text-center text-gray-400 text-sm mb-8">
          Scegli la soluzione piu adatta alle tue esigenze.
        </p>

        {/* Billing toggle */}
        <div className="mb-10">
          <BillingToggle annual={annual} onChange={setAnnual} />
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-stretch">
          {/* Free card */}
          <div className="flex flex-col bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md hover:shadow-green-600/5 transition-shadow">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-1">Free</h3>
              <div className="flex items-end gap-1.5 mt-3">
                <span className="text-5xl font-bold text-gray-900 leading-none">
                  €0
                </span>
                <span className="text-gray-400 text-sm pb-1">
                  / per sempre
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              Piattaforma senza costo, sostenuta da iniziative promozionali e
              vantaggi commerciali per gli utenti che prestano consenso.
            </p>

            <div className="mb-8 flex-1">
              <FeatureList features={FREE_FEATURES} />
            </div>

            <Link
              to="/login"
              className="block text-center bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md shadow-green-600/20 text-sm"
            >
              Inizia Gratis
            </Link>
          </div>

          {/* Premium card */}
          <div className="flex flex-col bg-white border-2 border-green-500/30 rounded-2xl p-6 sm:p-8 relative shadow-sm hover:shadow-md hover:shadow-green-600/5 transition-shadow">
            {/* PRO badge */}
            <div className="absolute -top-3.5 right-6">
              <span className="inline-flex items-center rounded-full bg-green-600 px-3 py-1 text-xs font-bold text-white shadow-sm shadow-green-600/40">
                PRO
              </span>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-1">Premium</h3>
              <div className="flex items-end gap-1.5 mt-3">
                <span className="text-5xl font-bold text-gray-900 leading-none">
                  --
                </span>
                <span className="text-gray-400 text-sm pb-1">
                  / prossimamente
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              Esperienza dedicata, senza utilizzo dei contatti per finalita
              promozionali di terzi.
            </p>

            <div className="mb-8 flex-1">
              <FeatureList features={PREMIUM_FEATURES} />
            </div>

            <button
              disabled
              className="w-full text-center bg-gray-100 text-gray-400 font-bold py-3.5 rounded-xl cursor-not-allowed text-sm"
            >
              Prossimamente
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2 — Piani API                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-green-600 mb-3">
                Piani API
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0d3d2a] mb-3">
                Accesso API per sviluppatori
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                I piani API sono disponibili esclusivamente su base annuale.
                Contattaci per maggiori informazioni, per un preventivo
                personalizzato o per ricevere la documentazione tecnica.
              </p>
            </div>
            <a
              href="mailto:info@dr7trust.it"
              className="inline-flex w-full sm:w-auto justify-center shrink-0 items-center gap-2 rounded-xl border border-green-600 px-6 py-3.5 text-sm font-bold text-green-700 hover:bg-green-50 transition-colors"
            >
              Contattaci
              <svg
                className="h-4 w-4"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3 — Marketing block "30 giorni gratis"                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="bg-[#0d3d2a] rounded-3xl px-6 py-10 sm:px-8 sm:py-12 md:px-14 md:py-14 overflow-hidden relative">
          {/* Decorative circle */}
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #4ade80, transparent)' }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #4ade80, transparent)' }}
            aria-hidden="true"
          />

          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            {/* Left — headline */}
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white leading-snug mb-4">
                30 giorni gratis.
                <br />
                Nessun rischio.
              </h2>
              <p className="text-green-200 text-sm leading-relaxed">
                Prova DR7 Trust senza impegno. Inizia oggi, aggiorna o disdici
                quando vuoi.
              </p>
              <Link
                to="/login"
                className="mt-8 inline-block w-full sm:w-auto text-center bg-white text-green-700 font-bold px-7 py-3.5 rounded-xl text-sm hover:bg-green-50 transition-colors shadow-lg"
              >
                Inizia Gratis
              </Link>
            </div>

            {/* Right — bullet list */}
            <ul className="space-y-3.5">
              {MARKETING_BULLETS.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-green-100">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-600/40"
                    aria-hidden="true"
                  >
                    <svg className="h-3 w-3 text-green-300" viewBox="0 0 12 12" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10.28 2.28a.75.75 0 00-1.06 0L4.5 7 2.78 5.28a.75.75 0 00-1.06 1.06l2.5 2.5a.75.75 0 001.06 0l5.5-5.5a.75.75 0 000-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4 — FAQ                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-[#0d3d2a] mb-2">
          Domande frequenti
        </h2>
        <p className="text-center text-gray-400 text-sm mb-10 break-words">
          Non trovi la risposta? Scrivici a{' '}
          <a
            href="mailto:info@dr7trust.it"
            className="text-green-600 hover:underline break-all"
          >
            info@dr7trust.it
          </a>
        </p>

        <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white px-4 sm:px-6 shadow-sm">
          {FAQS.map((faq, index) => (
            <FaqItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom CTA                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0d3d2a] mb-3">
            Pronto a iniziare?
          </h2>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            Crea il tuo account gratuitamente. Nessuna carta di credito
            richiesta, nessun costo nascosto.
          </p>
          <Link
            to="/login"
            className="inline-block w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold px-10 py-4 rounded-xl text-sm transition-colors shadow-lg shadow-green-600/25"
          >
            Inizia Gratis
          </Link>
          <p className="mt-4 text-xs text-gray-400">
            Gia registrato?{' '}
            <Link to="/login" className="text-green-600 hover:underline font-medium">
              Accedi
            </Link>
          </p>
        </div>
      </section>
    </SiteLayout>
  )
}
