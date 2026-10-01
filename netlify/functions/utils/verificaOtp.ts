// 01/10/2026: quanto vale un codice OTP gia' verificato.
// Il codice e' la firma: dopo la verifica il cliente deve completare la firma
// entro questa finestra. Se la firma fallisce dopo un codice valido (rete,
// storage, PDF) il cliente puo' riprovare SENZA rifare l'OTP finche' la
// finestra e' aperta; dopo serve un codice nuovo. Una verifica senza data
// (righe scritte prima del 01/10/2026) non vale: si chiede un codice nuovo.
// Nessuna dipendenza: la usano signature-get, signature-send-otp,
// signature-complete e i test.
export const OTP_VERIFICATO_VALIDO_MINUTI = 30

export function otpVerificatoAncoraValido(
    richiesta: { status?: string | null; otp_verified_at?: string | null },
    adesso: Date = new Date(),
): boolean {
    if (richiesta.status !== 'otp_verified') return false
    if (!richiesta.otp_verified_at) return false
    const verificato = new Date(richiesta.otp_verified_at).getTime()
    if (Number.isNaN(verificato)) return false
    const eta = adesso.getTime() - verificato
    return eta >= -60_000 && eta <= OTP_VERIFICATO_VALIDO_MINUTI * 60 * 1000
}
