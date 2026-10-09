// 09/10/2026: DR72141 firmato da 3 persone su 3, PDF finale mai partito.
// Mara aveva aperto il link VECCHIO (prima del rinvio): l'OTP riportava la
// richiesta 'superseded' a 'otp_verified' e l'ultima firma vedeva ancora un
// firmatario in attesa. Una richiesta chiusa non si riapre mai.
// Eseguire con: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { richiestaChiusa, rispostaRichiestaChiusa, STATI_APERTI } from '../netlify/functions/utils/richiestaChiusa.ts'

test('superseded, cancelled ed expired sono chiusi', () => {
    for (const s of ['superseded', 'cancelled', 'expired']) assert.equal(richiestaChiusa(s), true, s)
    for (const s of ['pending', 'otp_sent', 'otp_verified', 'signed', null, undefined]) assert.equal(richiestaChiusa(s as any), false, String(s))
})

test('un link sostituito risponde 410 con il codice link_sostituito', () => {
    const r = rispostaRichiestaChiusa('superseded')
    assert.equal(r.statusCode, 410)
    assert.equal(JSON.parse(r.body).code, 'link_sostituito')
})

test('dagli stati aperti non si esce verso signed o superseded', () => {
    assert.deepEqual(STATI_APERTI, ['pending', 'otp_sent', 'otp_verified'])
})

test('ogni funzione della pagina di firma respinge le richieste chiuse prima di tutto', () => {
    for (const f of ['signature-get', 'signature-send-otp', 'signature-verify-otp', 'signature-complete', 'signature-posizione']) {
        const src = readFileSync(new URL(`../netlify/functions/${f}.ts`, import.meta.url), 'utf8')
        const chiusa = src.indexOf('if (richiestaChiusa(sigRequest.status))')
        assert.ok(chiusa > 0, `${f}: manca il controllo richiestaChiusa`)
        assert.ok(chiusa < src.indexOf('controllaDispositivo(supabase'), `${f}: il controllo deve venire prima del dispositivo`)
    }
})

test('gli update di stato filtrano sugli stati aperti', () => {
    for (const f of ['signature-send-otp', 'signature-verify-otp', 'signature-complete']) {
        const src = readFileSync(new URL(`../netlify/functions/${f}.ts`, import.meta.url), 'utf8')
        assert.ok(src.includes(".in('status', STATI_APERTI)"), `${f}: update senza filtro sugli stati aperti`)
    }
})
