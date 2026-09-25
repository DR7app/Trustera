import type { HandlerEvent } from '@netlify/functions'
import type { SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import type { Rete } from './rete'
import { registraEvento } from './audit'

/**
 * 25/09/2026 (direzione): il link di firma e' personale. Il cliente non deve
 * poterlo inoltrare, ne' passare il codice OTP a qualcun altro che firmi al
 * suo posto.
 *
 * Un messaggio WhatsApp non si puo' impedire di inoltrarlo, quindi il link
 * appartiene al PRIMO dispositivo che lo apre. Da li' ogni altro dispositivo
 * viene respinto su tutto (contratto, OTP, verifica, firma, posizione).
 * Cosi' anche un codice OTP passato a un altro non serve: sul suo telefono il
 * link non si apre.
 *
 * Come si riconosce il dispositivo (dalla seconda versione, stesso giorno):
 * - un cookie HttpOnly + Secure `dr7trust_dev`, casuale (32 byte), che la
 *   pagina non puo' leggere ne' copiare. Nel database va solo il suo SHA-256
 *   (device_session_hash) e un'etichetta leggibile DR7-DVC-XXXXXXXX.
 * - l'identificativo in localStorage della prima versione (device_id) resta
 *   valido: un link legato prima di questa versione continua a funzionare
 *   sullo stesso telefono.
 *
 * Nessuna eccezione nel codice (scelta della direzione, confermata il
 * 25/09/2026): per firmare da un altro dispositivo lo staff rimanda il link
 * dal gestionale (signature-init crea un token nuovo e annulla il vecchio).
 *
 * Cosa NON e': non e' l'IMEI, non e' il numero di serie, non identifica la
 * persona. Dice solo che le chiamate arrivano dallo stesso browser.
 */

const FORMATO_LEGACY = /^[A-Za-z0-9-]{20,64}$/
const FORMATO_COOKIE = /^[A-Za-z0-9_-]{40,64}$/
const COOKIE = 'dr7trust_dev'
const DURATA_COOKIE_S = 60 * 60 * 24 * 30

export const MESSAGGIO_ALTRO_DISPOSITIVO =
    'Questo contratto e\' gia\' associato a un altro dispositivo. ' +
    'Per motivi di sicurezza e\' necessaria una nuova verifica prima di procedere con la firma: contatta DR7 per ricevere un nuovo link.'

type Risposta = { statusCode: number; headers?: Record<string, string>; body: string }

export type EsitoDispositivo = {
    /** Risposta da restituire cosi' com'e' (dispositivo respinto). */
    blocco: Risposta | null
    /** Header Set-Cookie da aggiungere alla risposta, se il cookie e' nuovo. */
    setCookie: string | null
    /** DR7-DVC-XXXXXXXX della sessione che sta chiamando. */
    deviceLabel: string | null
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex')
export const etichettaDispositivo = (hash: string) => `DR7-DVC-${hash.slice(0, 8).toUpperCase()}`

function leggiCookie(event: HandlerEvent): string | null {
    const raw = event.headers['cookie'] || event.headers['Cookie'] || ''
    for (const parte of raw.split(';')) {
        const [k, ...v] = parte.trim().split('=')
        if (k === COOKIE) {
            const val = v.join('=')
            return FORMATO_COOKIE.test(val) ? val : null
        }
    }
    return null
}

function cookieHeader(valore: string): string {
    return `${COOKIE}=${valore}; Path=/; Max-Age=${DURATA_COOKIE_S}; HttpOnly; Secure; SameSite=Lax`
}

/** Aggiunge il Set-Cookie (se c'e') a una risposta della funzione. */
export function conCookie<T extends { statusCode: number; body: string; headers?: Record<string, string> }>(risposta: T, esito: EsitoDispositivo | null): T {
    if (!esito?.setCookie) return risposta
    return { ...risposta, headers: { ...(risposta.headers || {}), 'Set-Cookie': esito.setCookie } }
}

/**
 * `creaCookie`: solo la prima chiamata della pagina (signature-get) crea il
 * cookie se manca. `sigRequest` deve avere id, device_id,
 * device_session_hash, device_label, first_opened_at.
 */
export async function controllaDispositivo(
    supabase: SupabaseClient,
    sigRequest: {
        id: string
        device_id?: string | null
        device_session_hash?: string | null
        device_label?: string | null
        first_opened_at?: string | null
        signer_name?: string | null
        status?: string | null
    },
    deviceId: unknown,
    event: HandlerEvent,
    rete: Rete,
    opzioni: { creaCookie?: boolean } = {},
): Promise<EsitoDispositivo> {
    let cookie = leggiCookie(event)
    let setCookie: string | null = null
    if (!cookie && opzioni.creaCookie) {
        cookie = crypto.randomBytes(32).toString('base64url')
        setCookie = cookieHeader(cookie)
    }
    const legacy = typeof deviceId === 'string' && FORMATO_LEGACY.test(deviceId) ? deviceId : null

    if (!cookie && !legacy) {
        // Pagina vecchia rimasta in cache o browser senza memoria: si ricarica.
        return {
            blocco: {
                statusCode: 400,
                body: JSON.stringify({ error: 'Ricarica la pagina per continuare.', code: 'dispositivo_mancante' }),
            },
            setCookie: null,
            deviceLabel: null,
        }
    }

    const cookieHash = cookie ? sha256(cookie) : null
    const questaEtichetta = etichettaDispositivo(cookieHash || sha256(legacy as string))

    let legatoHash = sigRequest.device_session_hash || null
    let legatoId = sigRequest.device_id || null
    let legatoEtichetta = sigRequest.device_label || null

    if (!legatoHash && !legatoId && sigRequest.status === 'signed') {
        // Link gia' firmato e mai legato (firme di prima del 25/09/2026): si
        // mostra il documento firmato senza legarlo a chi lo riapre adesso,
        // altrimenti l'audit trail indicherebbe come dispositivo della firma
        // un dispositivo arrivato dopo.
        return { blocco: null, setCookie, deviceLabel: questaEtichetta }
    }

    if (!legatoHash && !legatoId) {
        // Primo accesso: il link si lega a questo dispositivo. La condizione
        // "entrambi vuoti" fa vincere uno solo se due aprono insieme.
        const ora = new Date().toISOString()
        const { data: aggiornati } = await supabase
            .from('signature_requests')
            .update({
                device_id: legacy,
                device_session_hash: cookieHash,
                device_label: questaEtichetta,
                device_bound_at: ora,
                first_opened_at: sigRequest.first_opened_at || ora,
                first_ip: rete.clientIp,
                first_user_agent: rete.userAgent,
            })
            .eq('id', sigRequest.id)
            .is('device_id', null)
            .is('device_session_hash', null)
            .select('id')
        if (aggiornati && aggiornati.length > 0) {
            await registraEvento(supabase, sigRequest.id, rete, {
                tipo: 'device_bound',
                descrizione: `Sessione ${questaEtichetta} associata alla richiesta di firma (primo dispositivo che ha aperto il link)`,
                deviceLabel: questaEtichetta,
                metadata: { device_label: questaEtichetta, metodo: cookieHash ? 'cookie_httponly' : 'identificativo_browser' },
            })
            return { blocco: null, setCookie, deviceLabel: questaEtichetta }
        }
        const { data: riletto } = await supabase
            .from('signature_requests')
            .select('device_id, device_session_hash, device_label')
            .eq('id', sigRequest.id)
            .single()
        legatoHash = riletto?.device_session_hash || null
        legatoId = riletto?.device_id || null
        legatoEtichetta = riletto?.device_label || null
    }

    const stesso = (!!cookieHash && !!legatoHash && cookieHash === legatoHash)
        || (!!legacy && !!legatoId && legacy === legatoId)

    if (stesso) {
        // Link legato con la prima versione (solo device_id): si aggiunge il
        // cookie, cosi' da qui in poi vale anche quello.
        if (!legatoHash && cookieHash) {
            await supabase
                .from('signature_requests')
                .update({ device_session_hash: cookieHash, device_label: legatoEtichetta || questaEtichetta })
                .eq('id', sigRequest.id)
                .is('device_session_hash', null)
        }
        return { blocco: null, setCookie, deviceLabel: legatoEtichetta || questaEtichetta }
    }

    await registraEvento(supabase, sigRequest.id, rete, {
        tipo: 'new_device_detected',
        descrizione: `Accesso rilevato da una nuova sessione/dispositivo (${questaEtichetta}). ` +
            `Il link e' associato alla sessione ${legatoEtichetta || 'registrata'}: contratto, OTP e firma non consentiti da questa sessione.`,
        deviceLabel: questaEtichetta,
        metadata: {
            new_device_label: questaEtichetta,
            bound_device_label: legatoEtichetta,
            stato: 'NEW_DEVICE_VERIFICATION_REQUIRED',
        },
    })
    return {
        blocco: {
            statusCode: 403,
            ...(setCookie ? { headers: { 'Set-Cookie': setCookie } } : {}),
            body: JSON.stringify({
                error: MESSAGGIO_ALTRO_DISPOSITIVO,
                code: 'altro_dispositivo',
                status: 'NEW_DEVICE_VERIFICATION_REQUIRED',
            }),
        },
        setCookie,
        deviceLabel: questaEtichetta,
    }
}

/**
 * Link annullato, sostituito da un rinvio o revocato dallo staff: non si apre
 * piu'. Prima signature-get lo mostrava ancora e signature-send-otp rimetteva
 * lo stato a otp_sent anche su un link sostituito.
 */
export async function controllaLinkValido(
    supabase: SupabaseClient,
    sigRequest: { id: string; status?: string | null; revoked_at?: string | null; token_expires_at?: string | null },
    rete: Rete,
    deviceLabel: string | null,
): Promise<Risposta | null> {
    if (sigRequest.status === 'signed') return null
    if (sigRequest.revoked_at || sigRequest.status === 'cancelled' || sigRequest.status === 'superseded') {
        await registraEvento(supabase, sigRequest.id, rete, {
            tipo: 'link_revoked_access',
            descrizione: sigRequest.revoked_at
                ? 'Tentativo di usare un link revocato dallo staff DR7: respinto'
                : 'Tentativo di usare un link annullato o sostituito da un invio piu\' recente: respinto',
            deviceLabel,
            metadata: { stato_richiesta: sigRequest.status, revoked_at: sigRequest.revoked_at || null },
        })
        return {
            statusCode: 410,
            body: JSON.stringify({ error: 'Il link di firma non e\' piu\' valido', status: 'revoked', code: 'link_revocato' }),
        }
    }
    if (sigRequest.token_expires_at && new Date(sigRequest.token_expires_at) < new Date()) {
        if (sigRequest.status !== 'expired') {
            await supabase
                .from('signature_requests')
                .update({ status: 'expired', updated_at: new Date().toISOString() })
                .eq('id', sigRequest.id)
                .neq('status', 'signed')
            await registraEvento(supabase, sigRequest.id, rete, {
                tipo: 'link_expired',
                descrizione: 'Link di firma scaduto',
                deviceLabel,
                metadata: { token_expires_at: sigRequest.token_expires_at },
            })
        }
        return { statusCode: 410, body: JSON.stringify({ error: 'Il link di firma e scaduto', status: 'expired' }) }
    }
    return null
}
