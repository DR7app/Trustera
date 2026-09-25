import type { HandlerEvent } from '@netlify/functions'
import type { SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import type { Rete } from './rete'
import { registraEvento } from './audit'

/**
 * 25/09/2026 (direzione): il link di firma e' personale. Solo chi ha il
 * recapito registrato del firmatario (telefono, o email se e' il canale
 * scelto) puo' aprire il contratto; un link inoltrato non serve a niente.
 *
 * Come funziona (terza versione, stesso giorno):
 * 1. Chi apre il link la prima volta NON vede il contratto: riceve solo la
 *    richiesta di verifica. Il codice parte al recapito registrato, deciso
 *    dal server (signature-send-otp), mai dalla pagina.
 * 2. Il dispositivo che inserisce il codice giusto si lega al link
 *    (legaDispositivo, chiamata da signature-verify-otp). Solo da li' vede il
 *    contratto e puo' firmare. Prima il link si legava al primo che lo
 *    apriva: inoltrato prima di aprirlo, lo prendeva l'altro.
 * 3. Ogni altro dispositivo viene respinto su tutto (contratto, codice,
 *    firma, posizione): "ACCESSO DA NUOVO DISPOSITIVO".
 * 4. Cambio di telefono, cookie cancellati, navigazione privata: lo staff
 *    autorizza il cambio dal gestionale (Sicurezza Firma), e per 30 minuti
 *    un nuovo dispositivo puo' rifare la verifica del punto 1. Quando la
 *    supera si lega lui e il vecchio dispositivo decade.
 *
 * Come si riconosce il dispositivo:
 * - un cookie HttpOnly + Secure `dr7trust_dev`, casuale (32 byte), che la
 *   pagina non puo' leggere ne' copiare. Nel database va solo il suo SHA-256
 *   (device_session_hash) e un'etichetta leggibile DR7-DVC-XXXXXXXX.
 * - l'identificativo in localStorage della prima versione (device_id) resta
 *   valido: un link legato prima di questa versione continua a funzionare
 *   sullo stesso telefono.
 *
 * Cosa NON e': non e' l'IMEI, non e' il numero di serie, non identifica la
 * persona. Dice solo che le chiamate arrivano dallo stesso browser; chi
 * c'e' dietro lo dice il codice arrivato al recapito registrato.
 */

const FORMATO_LEGACY = /^[A-Za-z0-9-]{20,64}$/
const FORMATO_COOKIE = /^[A-Za-z0-9_-]{40,64}$/
const COOKIE = 'dr7trust_dev'
const DURATA_COOKIE_S = 60 * 60 * 24 * 30
// Finestra del cambio dispositivo autorizzato dallo staff.
export const DURATA_CAMBIO_MIN = 30

export const MESSAGGIO_ALTRO_DISPOSITIVO =
    'Per motivi di sicurezza, questo contratto e\' associato a un altro dispositivo. ' +
    'E\' necessaria una nuova verifica prima di poter procedere con la firma: contatta DR7 per autorizzare il nuovo dispositivo.'

type Risposta = { statusCode: number; headers?: Record<string, string>; body: string }

export type EsitoDispositivo = {
    /** Risposta da restituire cosi' com'e' (dispositivo respinto). */
    blocco: Risposta | null
    /** Header Set-Cookie da aggiungere alla risposta, se il cookie e' nuovo. */
    setCookie: string | null
    /** DR7-DVC-XXXXXXXX della sessione che sta chiamando. */
    deviceLabel: string | null
    /**
     * Il dispositivo non e' (ancora) legato al link: puo' solo chiedere e
     * inserire il codice inviato al recapito registrato. Niente contratto,
     * niente firma, niente posizione.
     */
    daVerificare: boolean
    /** daVerificare per un cambio dispositivo autorizzato dallo staff. */
    cambio: { precedente: string | null; autorizzatoDa: string | null } | null
    cookieHash: string | null
    legacy: string | null
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

/** Risposta per chi non ha ancora verificato il codice (firma, posizione). */
export function rispostaVerificaRichiesta(esito: EsitoDispositivo): Risposta {
    return conCookie({
        statusCode: 403,
        body: JSON.stringify({
            error: 'Prima di procedere verifica il codice inviato al recapito registrato.',
            code: 'verifica_richiesta',
        }),
    }, esito)
}

type RichiestaDispositivo = {
    id: string
    device_id?: string | null
    device_session_hash?: string | null
    device_label?: string | null
    first_opened_at?: string | null
    signer_name?: string | null
    status?: string | null
    rebind_authorized_at?: string | null
    rebind_authorized_by?: string | null
}

function cambioAutorizzato(r: RichiestaDispositivo): boolean {
    if (!r.rebind_authorized_at || r.status === 'signed') return false
    return Date.now() - new Date(r.rebind_authorized_at).getTime() < DURATA_CAMBIO_MIN * 60 * 1000
}

/**
 * `creaCookie`: solo la prima chiamata della pagina (signature-get) crea il
 * cookie se manca. Non lega mai il dispositivo: lo fa legaDispositivo dopo
 * il codice giusto.
 */
export async function controllaDispositivo(
    supabase: SupabaseClient,
    sigRequest: RichiestaDispositivo,
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
    const base = { cookieHash: null as string | null, legacy, cambio: null, daVerificare: false }

    if (!cookie && !legacy) {
        // Pagina vecchia rimasta in cache o browser senza memoria: si ricarica.
        return {
            ...base,
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
    const esitoBase = { ...base, cookieHash, setCookie, deviceLabel: questaEtichetta }

    const legatoHash = sigRequest.device_session_hash || null
    const legatoId = sigRequest.device_id || null
    const legatoEtichetta = sigRequest.device_label || null

    if (!legatoHash && !legatoId && sigRequest.status === 'signed') {
        // Link gia' firmato e mai legato (firme di prima del 25/09/2026): si
        // mostra il documento firmato senza legarlo a chi lo riapre adesso,
        // altrimenti l'audit trail indicherebbe come dispositivo della firma
        // un dispositivo arrivato dopo.
        return { ...esitoBase, blocco: null }
    }

    if (!legatoHash && !legatoId) {
        // Nessun dispositivo legato: prima il codice al recapito registrato.
        return { ...esitoBase, blocco: null, daVerificare: true }
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
        return { ...esitoBase, blocco: null, deviceLabel: legatoEtichetta || questaEtichetta }
    }

    if (cambioAutorizzato(sigRequest)) {
        // Lo staff ha autorizzato il cambio: questo dispositivo puo' rifare
        // la verifica. Fino al codice giusto non vede niente.
        return {
            ...esitoBase,
            blocco: null,
            daVerificare: true,
            cambio: { precedente: legatoEtichetta, autorizzatoDa: sigRequest.rebind_authorized_by || null },
        }
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
        ...esitoBase,
        blocco: {
            statusCode: 403,
            ...(setCookie ? { headers: { 'Set-Cookie': setCookie } } : {}),
            body: JSON.stringify({
                error: MESSAGGIO_ALTRO_DISPOSITIVO,
                code: 'altro_dispositivo',
                status: 'NEW_DEVICE_VERIFICATION_REQUIRED',
            }),
        },
    }
}

/**
 * Dopo il codice giusto: lega il link a questo dispositivo. Primo legame o
 * cambio autorizzato dallo staff; in entrambi i casi la condizione
 * sull'UPDATE fa vincere uno solo se due verificano insieme.
 * Ritorna false se un altro dispositivo ha preso il link nel frattempo.
 */
export async function legaDispositivo(
    supabase: SupabaseClient,
    sigRequest: RichiestaDispositivo,
    esito: EsitoDispositivo,
    rete: Rete,
): Promise<boolean> {
    if (!esito.daVerificare) return true
    const ora = new Date().toISOString()
    const etichetta = esito.deviceLabel
    const legame = {
        device_id: esito.legacy,
        device_session_hash: esito.cookieHash,
        device_label: etichetta,
        device_bound_at: ora,
        signer_ip: rete.clientIp,
        signer_user_agent: rete.userAgent,
        updated_at: ora,
    }

    if (esito.cambio) {
        const { data } = await supabase
            .from('signature_requests')
            .update({ ...legame, rebind_authorized_at: null, rebind_authorized_by: null })
            .eq('id', sigRequest.id)
            .eq('rebind_authorized_at', sigRequest.rebind_authorized_at as string)
            .neq('status', 'signed')
            .select('id')
        if (!data || data.length === 0) return false
        await registraEvento(supabase, sigRequest.id, rete, {
            tipo: 'device_rebound',
            descrizione: `Cambio dispositivo completato: sessione ${etichetta} associata dopo la verifica del codice inviato al recapito registrato. ` +
                `La sessione precedente${esito.cambio.precedente ? ` ${esito.cambio.precedente}` : ''} non e' piu' valida.`,
            deviceLabel: etichetta,
            metadata: {
                previous_device_label: esito.cambio.precedente,
                new_device_label: etichetta,
                rebind_authorized_at: sigRequest.rebind_authorized_at,
                authorized_by: esito.cambio.autorizzatoDa,
                rebind_method: 'autorizzazione_staff_e_codice_recapito_registrato',
            },
        })
        return true
    }

    const { data } = await supabase
        .from('signature_requests')
        .update({
            ...legame,
            first_opened_at: sigRequest.first_opened_at || ora,
            first_ip: rete.clientIp,
            first_user_agent: rete.userAgent,
        })
        .eq('id', sigRequest.id)
        .is('device_id', null)
        .is('device_session_hash', null)
        .select('id')
    if (!data || data.length === 0) return false
    await registraEvento(supabase, sigRequest.id, rete, {
        tipo: 'device_bound',
        descrizione: `Sessione ${etichetta} associata alla richiesta di firma dopo la verifica del codice inviato al recapito registrato`,
        deviceLabel: etichetta,
        metadata: { device_label: etichetta, metodo: esito.cookieHash ? 'cookie_httponly' : 'identificativo_browser', verifica: 'codice_recapito_registrato' },
    })
    return true
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
