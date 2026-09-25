import type { SupabaseClient } from '@supabase/supabase-js'
import type { Rete } from './rete'

/**
 * Un evento dell'audit trail di firma. 25/09/2026: stesso formato per tutte
 * le funzioni, con la rete separata (IP cliente / proxy / catena) e
 * l'identificativo di sessione DR7 del dispositivo.
 *
 * L'ora ufficiale la mette il database (created_at, ora del server) e il
 * database aggancia ogni evento al precedente con una catena SHA-256
 * (trigger trg_signature_audit_trail_catena): gli eventi non si modificano.
 *
 * I tipi gia' in uso (request_created, link_sent, document_viewed, otp_sent,
 * otp_verified, otp_failed, otp_expired, document_signed, ...) restano quelli:
 * li leggono altre funzioni. I tipi nuovi sono in minuscolo come quelli;
 * l'audit trail li mostra con i codici SIGN_REQUEST_CREATED, DEVICE_BOUND, ...
 */
export type Evento = {
    tipo: string
    descrizione: string
    metadata?: Record<string, unknown>
    deviceLabel?: string | null
}

export async function registraEvento(
    supabase: SupabaseClient,
    sigRequestId: string,
    rete: Rete | null,
    ev: Evento,
): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('signature_audit_trail')
            .insert({
                signature_request_id: sigRequestId,
                event_type: ev.tipo,
                event_description: ev.descrizione,
                ip_address: rete?.clientIp ?? null,
                user_agent: rete?.userAgent ?? null,
                client_ip: rete?.clientIp ?? null,
                proxy_ip: rete?.proxyIp ?? null,
                forwarded_for: rete?.forwardedFor ?? null,
                device_label: ev.deviceLabel ?? null,
                metadata: {
                    ...(ev.metadata || {}),
                    ...(rete && !rete.clientIpVerificato ? { client_ip_non_verificato: true } : {}),
                },
            })
            .select('event_hash')
            .single()
        if (error) throw error
        return (data as any)?.event_hash ?? null
    } catch (err) {
        // L'evento non deve mai far fallire la firma, ma deve restare nei log.
        console.error(`[audit] evento ${ev.tipo} non registrato:`, (err as Error)?.message)
        return null
    }
}
