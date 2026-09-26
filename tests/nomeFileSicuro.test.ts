// Guardia contro l'incidente del 26/09/2026: il documento "Contestazione
// Danni Lamborghini Huracán tecnica " non si poteva firmare perche' il nome,
// con accento e spazio, finiva nella chiave dello storage ("Invalid key").
// Eseguire con: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { nomeFileSicuro, percorsoStorage } from '../src/utils/nomeFileSicuro.ts'

const SICURO = /^[A-Za-z0-9._-]+$/

test('il nome del 26/09 diventa una chiave valida', () => {
  assert.equal(
    nomeFileSicuro('Contestazione Danni Lamborghini Huracán tecnica _firmato_1790437583996.pdf'),
    'Contestazione_Danni_Lamborghini_Huracan_tecnica_firmato_1790437583996.pdf',
  )
})

test('accenti, spazi, spazio finale, emoji, slash, virgolette', () => {
  assert.equal(nomeFileSicuro('Huracán'), 'Huracan')
  assert.equal(nomeFileSicuro('Perché è così'), 'Perche_e_cosi')
  assert.equal(nomeFileSicuro('tecnica '), 'tecnica')
  assert.equal(nomeFileSicuro('contratto 🚗 firmato.pdf'), 'contratto_firmato.pdf')
  assert.equal(nomeFileSicuro('a/b\\c'), 'a_b_c')
  assert.equal(nomeFileSicuro(`l'"auto".pdf`), 'l_auto.pdf')
  for (const n of ['Huracán tecnica ', '  ', '🚗🚗', '../../etc/passwd', 'ÀÉÎÕÜ ñ ç ß.pdf', '"quoted" name.PDF']) {
    assert.match(nomeFileSicuro(n), SICURO, n)
  }
})

test('vuoto o solo simboli: "file"', () => {
  assert.equal(nomeFileSicuro(''), 'file')
  assert.equal(nomeFileSicuro('   '), 'file')
  assert.equal(nomeFileSicuro('🚗'), 'file')
})

test('nomi lunghi: tagliati mantenendo l estensione', () => {
  const r = nomeFileSicuro(`${'Documento molto lungo '.repeat(20)}.pdf`, 80)
  assert.ok(r.length <= 80, `lunghezza ${r.length}`)
  assert.ok(r.endsWith('.pdf'))
  assert.match(r, SICURO)
})

test('idempotente e identico sui nomi gia sicuri', () => {
  for (const n of ['Huracán tecnica .pdf', 'x'.repeat(300) + '.pdf', ' a  b ', 'DR7_2026-001.pdf', '🚗 x']) {
    const una = nomeFileSicuro(n)
    assert.equal(nomeFileSicuro(una), una, n)
  }
  assert.equal(nomeFileSicuro('DR7_2026-001.pdf'), 'DR7_2026-001.pdf')
  assert.equal(nomeFileSicuro('1790437298510_contratto.pdf'), '1790437298510_contratto.pdf')
})

test('percorsoStorage: segmenti puliti, niente // ne / iniziale', () => {
  assert.equal(percorsoStorage('signed', 'Huracán tecnica _firmato_1.pdf'), 'signed/Huracan_tecnica_firmato_1.pdf')
  assert.equal(percorsoStorage('/documents/', '', 'a1b2-c3', ' x y.pdf'), 'documents/a1b2-c3/x_y.pdf')
  const uuid = '66d9bcbb-5d25-4c4f-8406-ac73ccaa866b'
  assert.equal(percorsoStorage('documents', uuid, '1_a.pdf'), `documents/${uuid}/1_a.pdf`)
})

// ── Guardia statica: ogni file che carica nello storage deve passare da qui ──
const RADICE = new URL('..', import.meta.url).pathname
const ESCLUSI = new Set(['node_modules', 'dist', '.git', '.netlify', 'tests', 'supabase'])

function sorgenti(dir: string): string[] {
  const out: string[] = []
  for (const nome of readdirSync(dir)) {
    if (ESCLUSI.has(nome)) continue
    const p = join(dir, nome)
    if (statSync(p).isDirectory()) out.push(...sorgenti(p))
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(nome) && !/\.test\./.test(nome)) out.push(p)
  }
  return out
}

test('ogni file con .upload( importa nomeFileSicuro/percorsoStorage', () => {
  const colpevoli = sorgenti(RADICE)
    .filter(f => !f.endsWith(join('src', 'utils', 'nomeFileSicuro.ts')))
    .filter(f => /\.upload\(/.test(readFileSync(f, 'utf8')))
    .filter(f => !/import\s*\{[^}]*\b(nomeFileSicuro|percorsoStorage)\b[^}]*\}\s*from\s*['"][^'"]*nomeFileSicuro['"]/.test(readFileSync(f, 'utf8')))
    .map(f => relative(RADICE, f))
  assert.deepEqual(
    colpevoli, [],
    `Questi file caricano nello storage senza ripulire il percorso: ${colpevoli.join(', ')}.\n` +
    'Costruisci la chiave con percorsoStorage() da src/utils/nomeFileSicuro.ts. ' +
    'Il 26/09/2026 un documento con "Huracán" nel nome non si e potuto firmare per questo.',
  )
})
