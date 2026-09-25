import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { controllaDispositivo, controllaLinkValido, conCookie } from './utils/dispositivo'
import { leggiRete } from './utils/rete'
import { registraEvento } from './utils/audit'

// DR7 Supabase — signature_requests, contracts, bookings live here
const supabase = createClient(
    process.env.DR7_SUPABASE_URL || 'https://ahpmzjgkfxrrgxyirasa.supabase.co',
    process.env.DR7_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_OTP_ATTEMPTS = 5

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    try {
        const { token, otp, deviceId } = JSON.parse(event.body || '{}')

        if (!token || !otp) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Token e codice OTP richiesti' }) }
        }

        // Fetch signature request
        const { data: sigRequest, error } = await supabase
            .from('signature_requests')
            .select('*')
            .eq('token', token)
            .single()

        if (error || !sigRequest) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Richiesta di firma non trovata' }) }
        }

        // Link personale: solo il primo dispositivo che l'ha aperto (utils/dispositivo.ts).
        const rete = leggiRete(event)
        const dispositivo = await controllaDispositivo(supabase, sigRequest, deviceId, event, rete)
        if (dispositivo.blocco) return dispositivo.blocco
        const deviceLabel = dispositivo.deviceLabel

        // Scaduto, annullato, sostituito da un rinvio o revocato dallo staff.
        const linkNonValido = await controllaLinkValido(supabase, sigRequest, rete, deviceLabel)
        if (linkNonValido) return conCookie(linkNonValido, dispositivo)

        if (sigRequest.status === 'signed') {
            return { statusCode: 400, body: JSON.stringify({ error: 'Il documento e gia stato firmato' }) }
        }

        // 25/09/2026: il tentativo e' UNA operazione nel database
        // (firma_otp_tentativo): conta il tentativo, controlla scadenza e
        // codice e, se giusto, lo consuma. Prima lettura e scrittura erano
        // separate: due tentativi insieme potevano superare il limite.
        // Si confrontano impronte SHA-256, il codice in chiaro non si salva.
        const otpHash = crypto.createHash('sha256').update(`${sigRequest.id}:${String(otp).trim()}`).digest('hex')
        const { data: esitoRaw, error: rpcError } = await supabase.rpc('firma_otp_tentativo', {
            p_request: sigRequest.id,
            p_hash: otpHash,
            p_max: MAX_OTP_ATTEMPTS,
        })
        if (rpcError) throw rpcError
        const esito = (esitoRaw || {}) as { esito?: string; tentativi?: number }
        const tentativi = esito.tentativi ?? (sigRequest.otp_attempts || 0)

        switch (esito.esito) {
            case 'ok':
                break
            case 'errato':
                await registraEvento(supabase, sigRequest.id, rete, {
                    tipo: 'otp_failed',
                    descrizione: `Tentativo OTP non valido (${tentativi} di ${MAX_OTP_ATTEMPTS})`,
                    deviceLabel,
                    metadata: { attempts: tentativi },
                })
                return {
                    statusCode: 401,
                    body: JSON.stringify({
                        error: 'Codice OTP non valido',
                        remainingAttempts: Math.max(0, MAX_OTP_ATTEMPTS - tentativi)
                    })
                }
            case 'bloccato':
                await registraEvento(supabase, sigRequest.id, rete, {
                    tipo: 'otp_locked',
                    descrizione: 'Raggiunto il numero massimo di tentativi OTP: verifica bloccata',
                    deviceLabel,
                    metadata: { attempts: tentativi },
                })
                return { statusCode: 429, body: JSON.stringify({ error: 'Troppi tentativi. Richiedi un nuovo link di firma.' }) }
            case 'scaduto':
                await registraEvento(supabase, sigRequest.id, rete, {
                    tipo: 'otp_expired',
                    descrizione: 'Codice OTP scaduto',
                    deviceLabel,
                    metadata: { attempts: tentativi },
                })
                return { statusCode: 410, body: JSON.stringify({ error: 'Il codice OTP e scaduto. Richiedi un nuovo codice.' }) }
            case 'firmato':
                return { statusCode: 400, body: JSON.stringify({ error: 'Il documento e gia stato firmato' }) }
            case 'revocato':
                return { statusCode: 410, body: JSON.stringify({ error: 'Il link di firma non e\' piu\' valido', status: 'revoked', code: 'link_revocato' }) }
            default:
                return { statusCode: 400, body: JSON.stringify({ error: 'Nessun codice OTP attivo. Richiedi un nuovo codice.' }) }
        }

        // OTP verified successfully
        await supabase
            .from('signature_requests')
            .update({
                signer_ip: rete.clientIp,
                signer_user_agent: rete.userAgent,
                updated_at: new Date().toISOString()
            })
            .eq('id', sigRequest.id)

        await registraEvento(supabase, sigRequest.id, rete, {
            tipo: 'otp_verified',
            descrizione: `Autenticazione OTP completata da ${sigRequest.signer_name || sigRequest.signer_email}`,
            deviceLabel,
            metadata: { verified_at: new Date().toISOString(), attempts: tentativi, channel: sigRequest.otp_channel || null },
        })

        return conCookie({
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Codice OTP verificato. Puoi procedere con la firma.'
            })
        }, dispositivo)
    } catch (error: any) {
        console.error('Error in signature-verify-otp:', error)
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Errore nella verifica del codice OTP', details: error.message })
        }
    }
}
