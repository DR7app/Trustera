// 09/10/2026 — Link di firma vecchio dopo un "Rinvia contratto".
// Il rinvio mette le richieste precedenti in 'superseded', ma send-otp e
// verify-otp le accettavano ancora: chi apriva il VECCHIO link riceveva il
// codice e la riga tornava 'otp_sent' / 'otp_verified'. Quella riga zombie
// contava come "firmatario che deve ancora firmare", quindi all'ultima firma
// vera signature-complete non mandava il PDF firmato a NESSUNO
// (DR72141: 3 firme su 3, nessun invio).
// Una richiesta chiusa non si riapre mai: qui la regola, usata da tutte le
// funzioni della pagina di firma.
export const STATI_CHIUSI: string[] = ['superseded', 'cancelled', 'expired']

// Stati da cui si puo' ancora avanzare: ogni update di stato filtra su questi,
// cosi' un rinvio fatto mentre il cliente e' a meta' non viene sovrascritto.
export const STATI_APERTI: string[] = ['pending', 'otp_sent', 'otp_verified']

export function richiestaChiusa(status: string | null | undefined): boolean {
    return STATI_CHIUSI.includes(String(status || ''))
}

export function rispostaRichiestaChiusa(status: string | null | undefined) {
    const sostituita = status === 'superseded'
    return {
        statusCode: 410,
        body: JSON.stringify({
            error: sostituita
                ? "Questo link non e' piu' valido: ti abbiamo inviato un link nuovo. Apri l'ultimo messaggio ricevuto."
                : status === 'cancelled'
                    ? 'La richiesta di firma e stata annullata'
                    : 'Il link di firma e scaduto',
            status: sostituita ? 'superseded' : status === 'cancelled' ? 'cancelled' : 'expired',
            code: sostituita ? 'link_sostituito' : 'link_chiuso',
        }),
    }
}
