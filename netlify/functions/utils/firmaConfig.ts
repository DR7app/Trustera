/**
 * Come si firma un contratto DR7: con codice OTP o con il solo pulsante.
 *
 * Si decide in Centralina Pro > Contratto & Modifiche > Firma del contratto,
 * salvato in `centralina_pro_config.config.firma` sul Supabase DR7. La
 * Centralina e' una riga per business (`main` = Noleggio Terra, poi
 * `business_mare`, `business_aria`, ...): si legge la riga del business della
 * prenotazione e, voce per voce, si ricade su `main`. Una firma senza
 * prenotazione (documento libero) usa `main`.
 *
 * Senza configurazione vale il comportamento di sempre: OTP via WhatsApp.
 * Se la lettura fallisce si resta sull'OTP: meglio un passaggio in piu' che
 * una firma senza verifica che nessuno ha scelto.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type CanaleOtp = 'whatsapp' | 'email'
// gpsObbligatorio (25/09/2026): senza posizione autorizzata non si firma.
// Spento di default: chi rifiuta la posizione firma lo stesso e l'audit
// trail lo scrive ("GPS NON AUTORIZZATO DAL CLIENTE").
export type FirmaConfig = { otpAttivo: boolean; canale: CanaleOtp; gpsObbligatorio: boolean }

const DEFAULT: FirmaConfig = { otpAttivo: true, canale: 'whatsapp', gpsObbligatorio: false }

// Stessa mappa di DR7-AI netlify/functions/utils/businessConfig.ts
function rigaBusiness(serviceType?: string | null): string {
    switch (String(serviceType || '').toLowerCase()) {
        case 'boat_rental': return 'business_mare'
        case 'heli_rental': return 'business_aria'
        case 'stay_rental': return 'business_soggiorni'
        case 'car_wash':
        case 'mechanical':
        case 'mechanical_service': return 'business_lavaggio'
        default: return 'main'
    }
}

export async function leggiFirmaConfig(
    supabase: SupabaseClient,
    sigRequest: { booking_id?: string | null; contract_id?: string | null }
): Promise<FirmaConfig> {
    try {
        let bookingId = sigRequest.booking_id || null
        if (!bookingId && sigRequest.contract_id) {
            const { data: c } = await supabase
                .from('contracts')
                .select('booking_id')
                .eq('id', sigRequest.contract_id)
                .maybeSingle()
            bookingId = c?.booking_id || null
        }
        let serviceType: string | null = null
        if (bookingId) {
            const { data: b } = await supabase
                .from('bookings')
                .select('service_type')
                .eq('id', bookingId)
                .maybeSingle()
            serviceType = b?.service_type || null
        }

        const riga = rigaBusiness(serviceType)
        const ids = riga === 'main' ? ['main'] : [riga, 'main']
        const { data, error } = await supabase
            .from('centralina_pro_config')
            .select('id, config')
            .in('id', ids)
        if (error) throw error

        const firmaDi = (id: string) => {
            const f = (data || []).find((r: any) => r.id === id)?.config?.firma
            return (f && typeof f === 'object') ? f as Record<string, unknown> : {}
        }
        const business = firmaDi(riga)
        const main = firmaDi('main')
        const voce = (k: string) => (business[k] !== undefined ? business[k] : main[k])

        const otp = voce('otp_attivo')
        const canale = voce('otp_canale')
        return {
            otpAttivo: otp === false ? false : true,
            canale: canale === 'email' ? 'email' : 'whatsapp',
            gpsObbligatorio: voce('gps_obbligatorio') === true,
        }
    } catch (err) {
        console.warn('[firmaConfig] lettura fallita, resta OTP WhatsApp:', (err as Error).message)
        return DEFAULT
    }
}
