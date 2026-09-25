import type { HandlerEvent } from '@netlify/functions'

/**
 * Da dove arriva la richiesta. 25/09/2026: prima si salvava l'header
 * x-forwarded-for cosi' com'era, quindi nell'audit comparivano due IP
 * ("79.23.166.58, 63.181.68.26": il cliente e il proxy davanti alla funzione).
 *
 * L'IP del cliente si prende solo da `x-nf-client-connection-ip`, che scrive
 * Netlify (l'unico proxy di cui ci fidiamo): chi chiama non puo' falsificarlo.
 * x-forwarded-for invece lo puo' mandare chiunque, quindi resta come catena
 * informativa e non decide nulla. Se Netlify non manda il suo header si usa
 * il primo IP della catena, segnato come "non verificato".
 */
export type Rete = {
    clientIp: string
    clientIpVerificato: boolean
    proxyIp: string | null
    forwardedFor: string | null
    userAgent: string
    ipGeo: IpGeo | null
}

/** Localizzazione APPROSSIMATIVA dell'IP (Netlify). Non e' il GPS. */
export type IpGeo = {
    city: string | null
    region: string | null
    country: string | null
    countryCode: string | null
    latitude: number | null
    longitude: number | null
}

function header(event: HandlerEvent, nome: string): string {
    const v = event.headers[nome] ?? event.headers[nome.toLowerCase()]
    return typeof v === 'string' ? v.trim() : ''
}

function leggiIpGeo(event: HandlerEvent): IpGeo | null {
    const raw = header(event, 'x-nf-geo')
    if (!raw) return null
    try {
        const testo = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
        const g = JSON.parse(testo)
        const num = (x: unknown) => (typeof x === 'number' && isFinite(x) ? x : null)
        return {
            city: g?.city || null,
            region: g?.subdivision?.name || null,
            country: g?.country?.name || null,
            countryCode: g?.country?.code || null,
            latitude: num(g?.latitude),
            longitude: num(g?.longitude),
        }
    } catch {
        return null
    }
}

export function leggiRete(event: HandlerEvent): Rete {
    const netlifyIp = header(event, 'x-nf-client-connection-ip')
    const xff = header(event, 'x-forwarded-for')
    const catena = xff.split(',').map(s => s.trim()).filter(Boolean)
    const clientIp = netlifyIp || catena[0] || header(event, 'client-ip') || 'unknown'
    // Proxy = solo quello che viene DOPO il cliente nella catena (aggiunto
    // dall'infrastruttura). Quello che sta prima l'ha scritto chi chiama e
    // resta solo in forwardedFor.
    const pos = catena.lastIndexOf(clientIp)
    const proxy = pos >= 0 ? catena.slice(pos + 1) : (netlifyIp ? [] : catena.slice(1))
    return {
        clientIp,
        clientIpVerificato: !!netlifyIp,
        proxyIp: proxy.length ? proxy.join(', ') : null,
        forwardedFor: xff || null,
        userAgent: header(event, 'user-agent') || 'unknown',
        ipGeo: leggiIpGeo(event),
    }
}

export function descriviIpGeo(g: IpGeo | null): string | null {
    if (!g) return null
    const parti = [g.city, g.region, g.country].filter(Boolean)
    return parti.length ? parti.join(', ') : null
}

/** Distanza in km tra due coordinate (formula dell'emisenoverso). */
export function distanzaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const r = (x: number) => (x * Math.PI) / 180
    const dLat = r(lat2 - lat1)
    const dLon = r(lon2 - lon1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** "+39 *** *** 4567" / "m***o@gmail.com": il recapito si vede, il numero intero no. */
export function mascheraTelefono(tel: string | null | undefined): string | null {
    const cifre = String(tel || '').replace(/\D/g, '')
    if (cifre.length < 4) return null
    return `*** *** ${cifre.slice(-4)}`
}

export function mascheraEmail(email: string | null | undefined): string | null {
    const e = String(email || '').trim()
    const at = e.indexOf('@')
    if (at < 1) return null
    const nome = e.slice(0, at)
    const visibile = nome.length <= 2 ? nome[0] : `${nome[0]}***${nome[nome.length - 1]}`
    return `${visibile}@${e.slice(at + 1)}`
}
