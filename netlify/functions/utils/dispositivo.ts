import type { HandlerEvent } from '@netlify/functions'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 25/09/2026 (direzione): il link di firma e' personale. Il cliente non deve
 * poterlo inoltrare, ne' passare il codice OTP a qualcun altro che firmi al
 * suo posto.
 *
 * Un messaggio WhatsApp non si puo' impedire di inoltrarlo, quindi il link
 * appartiene al PRIMO dispositivo che lo apre: FirmaPage genera un
 * identificativo casuale, lo tiene nel browser e lo manda a ogni chiamata.
 * Al primo accesso si scrive su signature_requests.device_id; da li' ogni
 * altro dispositivo viene respinto su tutto (contratto, OTP, verifica, firma).
 * Cosi' anche un codice OTP passato a un altro non serve: sul suo telefono il
 * link non si apre.
 *
 * Nessuna eccezione: per firmare da un altro dispositivo lo staff rimanda il
 * link dal gestionale (signature-init crea un token nuovo e annulla il vecchio).
 */

const FORMATO = /^[A-Za-z0-9-]{20,64}$/

export const MESSAGGIO_ALTRO_DISPOSITIVO =
    'Questo link di firma e\' personale ed e\' gia\' stato aperto su un altro dispositivo. ' +
    'Puo\' essere usato solo da chi lo ha ricevuto, sul dispositivo con cui lo ha aperto la prima volta. ' +
    'Se sei tu il destinatario, contatta DR7 per ricevere un nuovo link.'

type Risposta = { statusCode: number; body: string }

/**
 * null = il dispositivo puo' andare avanti. Altrimenti la risposta da
 * restituire cosi' com'e'. `sigRequest` deve avere id e device_id.
 */
export async function controllaDispositivo(
    supabase: SupabaseClient,
    sigRequest: { id: string; device_id?: string | null; signer_name?: string | null },
    deviceId: unknown,
    event: HandlerEvent,
): Promise<Risposta | null> {
    const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown'
    const userAgent = event.headers['user-agent'] || 'unknown'

    if (typeof deviceId !== 'string' || !FORMATO.test(deviceId)) {
        // Pagina vecchia rimasta in cache o browser senza memoria: si ricarica.
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Ricarica la pagina per continuare.', code: 'dispositivo_mancante' }),
        }
    }

    let legato = sigRequest.device_id || null
    if (!legato) {
        // Primo accesso: il link si lega a questo dispositivo. La condizione
        // `device_id is null` fa vincere uno solo se due aprono insieme.
        const { data: aggiornati } = await supabase
            .from('signature_requests')
            .update({ device_id: deviceId, device_bound_at: new Date().toISOString() })
            .eq('id', sigRequest.id)
            .is('device_id', null)
            .select('id')
        if (aggiornati && aggiornati.length > 0) {
            await supabase.from('signature_audit_trail').insert({
                signature_request_id: sigRequest.id,
                event_type: 'dispositivo_associato',
                event_description: `Link di firma associato al primo dispositivo che lo ha aperto`,
                ip_address: ip,
                user_agent: userAgent,
            })
            return null
        }
        const { data: riletto } = await supabase
            .from('signature_requests')
            .select('device_id')
            .eq('id', sigRequest.id)
            .single()
        legato = riletto?.device_id || null
    }

    if (legato === deviceId) return null

    await supabase.from('signature_audit_trail').insert({
        signature_request_id: sigRequest.id,
        event_type: 'accesso_altro_dispositivo',
        event_description: `Tentativo di aprire il link di firma di ${sigRequest.signer_name || 'firmatario'} da un altro dispositivo: respinto`,
        ip_address: ip,
        user_agent: userAgent,
    })
    return {
        statusCode: 403,
        body: JSON.stringify({ error: MESSAGGIO_ALTRO_DISPOSITIVO, code: 'altro_dispositivo' }),
    }
}
