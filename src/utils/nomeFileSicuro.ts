// Nomi sicuri per le chiavi dello storage Supabase.
//
// 26/09/2026 — INCIDENTE: il documento "Contestazione Danni Lamborghini
// Huracán tecnica " non si poteva firmare. Il nome, con accento e spazio
// finale, finiva tale e quale nel percorso del PDF firmato: lo storage
// rifiutava la chiave ("Invalid key") e la firma falliva subito dopo l'OTP.
//
// REGOLA: ogni percorso passato a `.upload(` si costruisce con queste due
// funzioni. Il nome mostrato alle persone (document_name, didascalie) resta
// quello originale: si ripulisce solo la chiave dello storage.
// Usato sia dal sito (src/) sia dalle Netlify functions (import relativo,
// esbuild lo include nel bundle). Nessuna dipendenza: deve restare cosi'.
// Un test statico (tests/nomeFileSicuro.test.ts) fa fallire il build se un
// file con `.upload(` non importa questo modulo.

const CARATTERI_NON_AMMESSI = /[^A-Za-z0-9._-]+/g
const SEGNI_DIACRITICI = /[̀-ͯ]/g

/**
 * Nome utilizzabile come segmento di una chiave dello storage: solo lettere
 * ASCII, cifre, '.', '_' e '-'. "Huracán tecnica .pdf" -> "Huracan_tecnica.pdf".
 * Idempotente, e un nome gia' sicuro resta identico.
 */
export function nomeFileSicuro(nome: string, max = 80): string {
  const pulito = String(nome ?? '')
    .normalize('NFD')
    .replace(SEGNI_DIACRITICI, '')
    .replace(CARATTERI_NON_AMMESSI, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '')
    .replace(/_+\./g, '.')

  if (!pulito) return 'file'
  if (pulito.length <= max) return pulito

  // Troppo lungo: si taglia il nome ma si conserva l'estensione (".pdf").
  const punto = pulito.lastIndexOf('.')
  const estensione = punto > 0 && pulito.length - punto <= 10 ? pulito.slice(punto) : ''
  const base = pulito.slice(0, max - estensione.length).replace(/[_.]+$/g, '')
  return (base || 'file') + estensione
}

/**
 * Chiave completa dello storage: ogni segmento passa da nomeFileSicuro, mai
 * '//' ne' '/' iniziale. percorsoStorage('signed', 'Huracán 1.pdf') ->
 * 'signed/Huracan_1.pdf'. Gli id (uuid) non vengono accorciati.
 */
export function percorsoStorage(...parti: string[]): string {
  return parti
    .flatMap(p => String(p ?? '').split('/'))
    .filter(p => p.trim() !== '')
    .map(p => nomeFileSicuro(p, 200))
    .join('/')
}
