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
 * 25/09/2026: il blocco e' stato tolto su richiesta della direzione (il
 * garante restava fuori). Il primo dispositivo viene ancora associato e gli
 * accessi da altri dispositivi finiscono nell'audit trail, ma nessuno e'
 * respinto: chiunque apra il link puo' firmare.
 */

const FORMATO = /^[A-Za-z0-9-]{20,64}$/

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

    // 25/09/2026 (direzione): il legame al dispositivo NON blocca piu'. Il
    // garante non riusciva a firmare perche' il link era gia' stato aperto su
    // un altro telefono. Ora chiunque apra il link puo' vedere e firmare; il
    // dispositivo resta solo annotato nell'audit trail.
    if (typeof deviceId !== 'string' || !FORMATO.test(deviceId)) return null

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
        event_description: `Link di firma di ${sigRequest.signer_name || 'firmatario'} aperto da un altro dispositivo: consentito`,
        ip_address: ip,
        user_agent: userAgent,
    })
    return null
}
