import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { controllaDispositivo, controllaLinkValido, conCookie } from './utils/dispositivo'
import { leggiRete, descriviIpGeo, distanzaKm } from './utils/rete'
import { registraEvento } from './utils/audit'

/**
 * 25/09/2026 — Posizione del dispositivo durante la firma.
 *
 * FirmaPage la chiede con la Geolocation API del browser (enableHighAccuracy)
 * due volte: all'apertura del documento e subito prima della firma. Qui si
 * registra quello che il dispositivo ha dichiarato, senza aggiustarlo:
 * latitudine, longitudine, accuratezza, ora del dispositivo, esito del
 * permesso. L'ora ufficiale dell'evento e' quella del server.
 *
 * - L'indirizzo e' STIMATO dalle coordinate (OpenStreetMap Nominatim): non e'
 *   l'indirizzo certo del firmatario. Le coordinate restano sempre il dato
 *   originale.
 * - La posizione IP (Netlify) e' APPROSSIMATIVA e si tiene separata: non
 *   sostituisce mai il GPS mancante.
 * - GPS e IP molto lontani = evento location_mismatch. Non blocca la firma.
 * - Rifiuto del permesso e GPS non disponibile sono due esiti diversi.
 *
 * La posizione non prova l'identita' di nessuno: e' un metadato in piu'.
 */

const supabase = createClient(
    process.env.DR7_SUPABASE_URL || 'https://ahpmzjgkfxrrgxyirasa.supabase.co',
    process.env.DR7_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Oltre questa distanza tra GPS e posizione IP si segnala la discordanza.
// La posizione IP di un operatore mobile italiano puo' cadere a Milano anche
// per chi e' a Cagliari (circa 700 km): sotto i 1000 km non e' un segnale utile.
const SOGLIA_DISCORDANZA_KM = 1000
const MAX_EVENTI_POSIZIONE_10_MIN = 12

type Indirizzo = {
    via: string | null
    civico: string | null
    cap: string | null
    citta: string | null
    provincia: string | null
    regione: string | null
    nazione: string | null
    testo: string | null
}

async function indirizzoStimato(lat: number, lon: number): Promise<Indirizzo | null> {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lon}`
        const res = await fetch(url, {
            headers: { 'User-Agent': 'DR7Trust/1.0 (firma contratti; info@dr7.app)', 'Accept-Language': 'it' },
            signal: AbortSignal.timeout(4000),
        })
        if (!res.ok) return null
        const j: any = await res.json()
        const a = j?.address || {}
        const citta = a.city || a.town || a.village || a.municipality || a.hamlet || null
        const ind: Indirizzo = {
            via: a.road || a.pedestrian || a.square || null,
            civico: a.house_number || null,
            cap: a.postcode || null,
            citta,
            provincia: a.county || a.province || null,
            regione: a.state || null,
            nazione: a.country || null,
            testo: null,
        }
        const riga1 = [ind.via, ind.civico].filter(Boolean).join(' ')
        const riga2 = [ind.cap, ind.citta].filter(Boolean).join(' ')
        ind.testo = [riga1, riga2, ind.provincia, ind.nazione].filter(Boolean).join(', ') || j?.display_name || null
        return ind
    } catch (err) {
        console.warn('[signature-posizione] reverse geocoding non riuscito:', (err as Error).message)
        return null
    }
}

const numero = (x: unknown): number | null => (typeof x === 'number' && isFinite(x) ? x : null)

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    try {
        const body = JSON.parse(event.body || '{}')
        const { token, deviceId } = body
        const fase: 'apertura' | 'firma' = body.fase === 'firma' ? 'firma' : 'apertura'
        const esito: string = ['concessa', 'negata', 'non_disponibile', 'timeout', 'non_supportata'].includes(body.esito)
            ? body.esito : 'non_disponibile'

        if (!token) return { statusCode: 400, body: JSON.stringify({ error: 'Token richiesto' }) }

        const { data: sigRequest, error } = await supabase
            .from('signature_requests')
            .select('id, status, signer_name, token_expires_at, revoked_at, device_id, device_session_hash, device_label, first_opened_at')
            .eq('token', token)
            .single()
        if (error || !sigRequest) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Richiesta di firma non trovata' }) }
        }

        const rete = leggiRete(event)
        const dispositivo = await controllaDispositivo(supabase, sigRequest, deviceId, event, rete)
        if (dispositivo.blocco) return dispositivo.blocco
        const deviceLabel = dispositivo.deviceLabel

        // Firmato: la posizione non serve piu'. Scaduto/revocato: si respinge.
        if (sigRequest.status === 'signed') return conCookie({ statusCode: 200, body: JSON.stringify({ ok: true, ignorata: true }) }, dispositivo)
        const linkNonValido = await controllaLinkValido(supabase, sigRequest, rete, deviceLabel)
        if (linkNonValido) return conCookie(linkNonValido, dispositivo)

        // Una pagina che manda posizioni a raffica non riempie il registro.
        const { count: recenti } = await supabase
            .from('signature_audit_trail')
            .select('id', { count: 'exact', head: true })
            .eq('signature_request_id', sigRequest.id)
            .in('event_type', ['gps_captured', 'gps_permission_granted', 'gps_permission_denied', 'gps_unavailable', 'location_mismatch'])
            .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
        if ((recenti || 0) >= MAX_EVENTI_POSIZIONE_10_MIN) {
            return conCookie({ statusCode: 429, body: JSON.stringify({ error: 'Troppe richieste' }) }, dispositivo)
        }

        const permesso = typeof body.permessoStato === 'string' ? body.permessoStato.slice(0, 20) : null
        const quando = fase === 'firma' ? 'prima della firma' : 'all\'apertura del documento'

        if (esito !== 'concessa') {
            const negata = esito === 'negata'
            await registraEvento(supabase, sigRequest.id, rete, {
                tipo: negata ? 'gps_permission_denied' : 'gps_unavailable',
                descrizione: negata
                    ? `GPS NON AUTORIZZATO DAL CLIENTE (${quando})`
                    : `GPS NON DISPONIBILE (${quando}): ${esito === 'timeout' ? 'il dispositivo non ha fornito la posizione in tempo' : esito === 'non_supportata' ? 'il browser non supporta la geolocalizzazione' : 'posizione non disponibile sul dispositivo'}`,
                deviceLabel,
                metadata: { fase, esito, permission_status: permesso, errore_browser: typeof body.errore === 'string' ? body.errore.slice(0, 200) : null },
            })
            return conCookie({ statusCode: 200, body: JSON.stringify({ ok: true }) }, dispositivo)
        }

        const lat = numero(body.latitude)
        const lon = numero(body.longitude)
        const acc = numero(body.accuracy)
        if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
            return conCookie({ statusCode: 400, body: JSON.stringify({ error: 'Coordinate non valide' }) }, dispositivo)
        }
        const oraDispositivo = numero(body.timestamp)

        if (fase === 'apertura') {
            await registraEvento(supabase, sigRequest.id, rete, {
                tipo: 'gps_permission_granted',
                descrizione: 'Il cliente ha autorizzato la posizione del dispositivo',
                deviceLabel,
                metadata: { fase, permission_status: permesso || 'granted' },
            })
        }

        const indirizzo = await indirizzoStimato(lat, lon)
        const ipGeo = rete.ipGeo
        // Con la sola nazione (coordinate = centro del paese) la distanza non
        // dice nulla: si confronta solo quando l'IP e' localizzato a una citta'.
        const distanza = ipGeo?.city && ipGeo?.latitude != null && ipGeo?.longitude != null
            ? Math.round(distanzaKm(lat, lon, ipGeo.latitude, ipGeo.longitude))
            : null

        const accTesto = acc !== null ? ` Accuratezza dichiarata dal dispositivo: ±${Math.round(acc)} m.` : ''
        await registraEvento(supabase, sigRequest.id, rete, {
            tipo: 'gps_captured',
            descrizione: fase === 'firma'
                ? `Posizione acquisita per la firma.${accTesto}`
                : `Posizione acquisita all'apertura del documento.${accTesto}`,
            deviceLabel,
            metadata: {
                fase,
                latitude: lat,
                longitude: lon,
                accuracy: acc,
                location_timestamp: oraDispositivo ? new Date(oraDispositivo).toISOString() : null,
                location_timestamp_fonte: 'orologio del dispositivo',
                permission_status: permesso || 'granted',
                location_source: 'GPS/BROWSER',
                location_source_testo: 'Browser Geolocation API (enableHighAccuracy)',
                indirizzo_stimato: indirizzo,
                indirizzo_fonte: indirizzo ? 'OpenStreetMap Nominatim (stimato dalle coordinate)' : null,
                ip_geo: ipGeo,
                ip_geo_testo: descriviIpGeo(ipGeo),
                distanza_gps_ip_km: distanza,
            },
        })

        if (distanza !== null && distanza > SOGLIA_DISCORDANZA_KM) {
            await registraEvento(supabase, sigRequest.id, rete, {
                tipo: 'location_mismatch',
                descrizione: `Posizione GPS e posizione approssimativa dell'IP distanti circa ${distanza} km (${quando}). Segnalazione informativa: la firma non viene bloccata.`,
                deviceLabel,
                metadata: { fase, distanza_km: distanza, soglia_km: SOGLIA_DISCORDANZA_KM, ip_geo_testo: descriviIpGeo(ipGeo) },
            })
        }

        return conCookie({ statusCode: 200, body: JSON.stringify({ ok: true }) }, dispositivo)
    } catch (error: any) {
        console.error('Error in signature-posizione:', error)
        return { statusCode: 500, body: JSON.stringify({ error: 'Errore nel salvataggio della posizione' }) }
    }
}
