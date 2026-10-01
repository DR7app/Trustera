// 01/10/2026: firma bloccata dopo l'OTP (4 richieste "Contestazione Danni
// Lamborghini Huracan" del 26/09/2026 rimaste in otp_verified).
// Un codice verificato vale OTP_VERIFICATO_VALIDO_MINUTI per completare la
// firma; senza otp_verified_at o oltre la finestra serve un codice nuovo.
// Eseguire con: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { otpVerificatoAncoraValido, OTP_VERIFICATO_VALIDO_MINUTI } from '../netlify/functions/utils/verificaOtp.ts'

const adesso = new Date('2026-10-01T10:00:00Z')
const minutiFa = (m: number) => new Date(adesso.getTime() - m * 60_000).toISOString()

test('verifica recente: si completa la firma senza nuovo codice', () => {
  assert.equal(otpVerificatoAncoraValido({ status: 'otp_verified', otp_verified_at: minutiFa(1) }, adesso), true)
  assert.equal(otpVerificatoAncoraValido({ status: 'otp_verified', otp_verified_at: minutiFa(OTP_VERIFICATO_VALIDO_MINUTI) }, adesso), true)
})

test('verifica scaduta, senza data o data illeggibile: serve un codice nuovo', () => {
  assert.equal(otpVerificatoAncoraValido({ status: 'otp_verified', otp_verified_at: minutiFa(OTP_VERIFICATO_VALIDO_MINUTI + 1) }, adesso), false)
  assert.equal(otpVerificatoAncoraValido({ status: 'otp_verified', otp_verified_at: null }, adesso), false)
  assert.equal(otpVerificatoAncoraValido({ status: 'otp_verified' }, adesso), false)
  assert.equal(otpVerificatoAncoraValido({ status: 'otp_verified', otp_verified_at: 'non-una-data' }, adesso), false)
})

test('solo lo stato otp_verified conta', () => {
  for (const status of ['pending', 'otp_sent', 'signed', 'expired', 'cancelled', null]) {
    assert.equal(otpVerificatoAncoraValido({ status, otp_verified_at: minutiFa(1) }, adesso), false, String(status))
  }
})

test('i writer usano la regola: verify scrive otp_verified_at, send-otp non blocca piu', () => {
  const verify = readFileSync('netlify/functions/signature-verify-otp.ts', 'utf8')
  assert.match(verify, /otp_verified_at:/)
  const send = readFileSync('netlify/functions/signature-send-otp.ts', 'utf8')
  assert.doesNotMatch(send, /OTP gia verificato\. Procedi con la firma/)
  assert.match(send, /otpVerificatoAncoraValido\(sigRequest\)/)
  const complete = readFileSync('netlify/functions/signature-complete.ts', 'utf8')
  assert.match(complete, /otpVerificatoAncoraValido\(sigRequest\)/)
  const pagina = readFileSync('src/pages/FirmaPage.tsx', 'utf8')
  assert.match(pagina, /Completa la firma/)
})
