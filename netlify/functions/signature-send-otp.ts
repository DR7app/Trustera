import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { controllaDispositivo } from './utils/dispositivo'
import { Resend } from 'resend'
import { leggiFirmaConfig } from './utils/firmaConfig'

// DR7 Supabase — signature_requests, contracts, bookings live here
const supabase = createClient(
    process.env.DR7_SUPABASE_URL || 'https://ahpmzjgkfxrrgxyirasa.supabase.co',
    process.env.DR7_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Use DR7's Green API for DR7 signing flow (same number that sent the signing link)
const GREEN_API_INSTANCE_ID = process.env.DR7_GREEN_API_INSTANCE_ID || process.env.GREEN_API_INSTANCE_ID
const GREEN_API_TOKEN = process.env.DR7_GREEN_API_TOKEN || process.env.GREEN_API_TOKEN

const OTP_EXPIRY_MINUTES = 10
const MAX_OTP_ATTEMPTS = 5

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    try {
        const { token, deviceId } = JSON.parse(event.body || '{}')

        if (!token) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Token richiesto' }) }
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
        const bloccoDispositivo = await controllaDispositivo(supabase, sigRequest, deviceId, event)
        if (bloccoDispositivo) return bloccoDispositivo

        // Check token expiry
        if (new Date(sigRequest.token_expires_at) < new Date()) {
            await supabase
                .from('signature_requests')
                .update({ status: 'expired', updated_at: new Date().toISOString() })
                .eq('id', sigRequest.id)
            return { statusCode: 410, body: JSON.stringify({ error: 'Il link di firma e scaduto' }) }
        }

        if (sigRequest.status === 'signed') {
            return { statusCode: 400, body: JSON.stringify({ error: 'Il documento e gia stato firmato' }) }
        }

        if (sigRequest.status === 'cancelled') {
            return { statusCode: 400, body: JSON.stringify({ error: 'La richiesta di firma e stata annullata' }) }
        }

        if (sigRequest.status === 'otp_verified') {
            return { statusCode: 400, body: JSON.stringify({ error: 'OTP gia verificato. Procedi con la firma.' }) }
        }

        if (sigRequest.otp_attempts >= MAX_OTP_ATTEMPTS) {
            return { statusCode: 429, body: JSON.stringify({ error: 'Troppi tentativi. Richiedi un nuovo link di firma.' }) }
        }

        // Centralina Pro > Firma del contratto: con l'OTP spento si firma con
        // il pulsante, il codice non serve e non si manda.
        const firma = await leggiFirmaConfig(supabase, sigRequest)
        if (!firma.otpAttivo) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Per questo documento non serve il codice: firma con il pulsante.', otpRequired: false }) }
        }

        // Generate 6-digit OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000))
        const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

        // Save OTP
        await supabase
            .from('signature_requests')
            .update({
                otp_code: otp,
                otp_expires_at: otpExpiresAt.toISOString(),
                status: 'otp_sent',
                updated_at: new Date().toISOString()
            })
            .eq('id', sigRequest.id)

        // Try signer_phone stored directly on the request first
        let customerPhone = sigRequest.signer_phone || ''

        // Then try booking
        if (!customerPhone && sigRequest.booking_id) {
            const { data: booking } = await supabase
                .from('bookings')
                .select('customer_phone, booking_details')
                .eq('id', sigRequest.booking_id)
                .single()
            if (booking) {
                customerPhone = booking.customer_phone || booking.booking_details?.customer?.phone || ''
                console.log(`[signature-send-otp] Booking phone: customer_phone="${booking.customer_phone}", details.phone="${booking.booking_details?.customer?.phone}"`)
            } else {
                console.log(`[signature-send-otp] No booking found for booking_id=${sigRequest.booking_id}`)
            }
        } else {
            console.log(`[signature-send-otp] No booking_id on signature request`)
        }

        // If no phone from booking, try contract
        if (!customerPhone && sigRequest.contract_id) {
            const { data: contract } = await supabase
                .from('contracts')
                .select('customer_phone')
                .eq('id', sigRequest.contract_id)
                .single()
            if (contract) {
                customerPhone = contract.customer_phone || ''
                console.log(`[signature-send-otp] Contract phone: "${contract.customer_phone}"`)
            } else {
                console.log(`[signature-send-otp] No contract found for contract_id=${sigRequest.contract_id}`)
            }
        }

        // If still no phone, try customers_extended by email (for standalone documents)
        if (!customerPhone && sigRequest.signer_email) {
            const { data: customer } = await supabase
                .from('customers_extended')
                .select('telefono')
                .eq('email', sigRequest.signer_email)
                .maybeSingle()
            if (customer?.telefono) {
                customerPhone = customer.telefono
                console.log(`[signature-send-otp] Customer phone from email lookup: "${customerPhone}"`)
            }
        }

        console.log(`[signature-send-otp] Final customerPhone="${customerPhone}", GREEN_API_INSTANCE_ID=${GREEN_API_INSTANCE_ID ? 'set' : 'NOT SET'}, GREEN_API_TOKEN=${GREEN_API_TOKEN ? 'set' : 'NOT SET'}`)

        // Testo OTP firma: editabile da Admin > Messaggi di Sistema Pro nel
        // template DEDICATO 'pro_firma_otp'. NB: NON usiamo 'pro_richiesta_otp'
        // perché quella chiave è condivisa con "Notifica Admin: Nuovo Preventivo"
        // e con il no-cauzione (manderebbe il messaggio sbagliato come OTP).
        // Stesso Supabase DR7. Variabili: {otp}, {expiryMinutes}. Se il template
        // manca o è disattivato si usa il testo DR7 di default — l'OTP parte
        // SEMPRE, non si rompe mai.
        const otpFallback = `*MESSAGGIO AUTOMATICO GENERATO DA DR7 A.i.*\n\n*DR7 – Codice di Verifica*\n\nIl tuo codice OTP per la firma del contratto è:\n\n*${otp}*\n\nIl codice sarà valido per i prossimi ${OTP_EXPIRY_MINUTES} minuti.\n\nNon condividere questo codice con nessuno: serve solo a te per firmare il tuo contratto.\n\nSe non hai richiesto questo codice o ritieni di averlo ricevuto per errore, puoi ignorare il presente messaggio.\n\nDR7`
        let otpMessage = otpFallback
        try {
            // 2026-07-01: BUGFIX — leggi TUTTE le righe 'pro_firma_otp' e scegli
            // quella abilitata + non vuota piu' recente. Prima usavamo
            // .maybeSingle(): se in system_messages esistevano DUE (o piu') righe
            // con message_key='pro_firma_otp' (duplicati), .maybeSingle() torna
            // null → si usava SEMPRE il testo hardcoded (otpFallback). Risultato:
            // l'admin modificava "OTP Firma Contratto" e l'OTP non cambiava mai.
            const { data: otpRows } = await supabase
                .from('system_messages')
                .select('message_body, is_enabled, updated_at')
                .eq('message_key', 'pro_firma_otp')
                .order('updated_at', { ascending: false })
            const otpTpl = (otpRows || []).find((r: any) => r.is_enabled !== false && !!r.message_body)
            if (otpTpl) {
                const signerFullName = String(sigRequest.signer_name || '').trim()
                const signerFirstName = signerFullName.split(/\s+/)[0] || 'Cliente'
                otpMessage = String(otpTpl.message_body)
                    .replace(/\{\{?\s*otp\s*\}?\}/gi, otp)
                    .replace(/\{\{?\s*expiryMinutes\s*\}?\}/gi, String(OTP_EXPIRY_MINUTES))
                    .replace(/\{\{?\s*nome\s*\}?\}/gi, signerFirstName)
                    .replace(/\{\{?\s*(customer_name|cliente)\s*\}?\}/gi, signerFullName || signerFirstName)
                console.log(`[signature-send-otp] pro_firma_otp template used (rows=${otpRows?.length ?? 0})`)
            } else {
                console.warn(`[signature-send-otp] No enabled+non-empty pro_firma_otp row (rows=${otpRows?.length ?? 0}) — using hardcoded fallback`)
            }
        } catch (tplErr) {
            console.warn('[signature-send-otp] pro_firma_otp template fetch failed, using fallback:', tplErr)
        }

        // Canale scelto in Centralina Pro. Se quel canale non puo' partire
        // (niente telefono, WhatsApp scollegato, niente email) si prova l'altro:
        // il cliente con il link in mano deve poter firmare comunque.
        async function inviaWhatsApp(): Promise<boolean> {
            if (!customerPhone || !GREEN_API_INSTANCE_ID || !GREEN_API_TOKEN) return false
            try {
                let cleanPhone = customerPhone.replace(/\D/g, '')
                if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.substring(2)
                if (cleanPhone.length === 10) cleanPhone = '39' + cleanPhone

                const greenApiUrl = `https://api.green-api.com/waInstance${GREEN_API_INSTANCE_ID}/sendMessage/${GREEN_API_TOKEN}`
                const waResponse = await fetch(greenApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: `${cleanPhone}@c.us`,
                        message: otpMessage
                    })
                })

                const waResult = await waResponse.json()
                if (waResponse.ok && waResult.idMessage) {
                    console.log(`[signature-send-otp] OTP sent via WhatsApp to ${cleanPhone}:`, waResult.idMessage)
                    return true
                }
                console.warn('[signature-send-otp] WhatsApp send failed:', waResult)
            } catch (waErr: any) {
                console.warn('[signature-send-otp] WhatsApp error:', waErr.message)
            }
            return false
        }

        let erroreEmail = ''
        async function inviaEmail(): Promise<boolean> {
            const apiKey = process.env.RESEND_API_KEY
            if (!apiKey || !sigRequest.signer_email) {
                erroreEmail = !apiKey ? 'RESEND_API_KEY mancante' : 'email firmatario mancante'
                return false
            }
            const resend = new Resend(apiKey)
            const { error: emailError } = await resend.emails.send({
                from: 'DR7 <info@dr7.app>',
                to: sigRequest.signer_email,
                subject: 'Codice di Verifica - DR7',
                text: `Il tuo codice di verifica DR7 è: ${otp}\n\nIl codice sarà valido per i prossimi ${OTP_EXPIRY_MINUTES} minuti.\n\nNon condividere questo codice con nessuno: serve solo a te per firmare il tuo contratto.\n\nSe non hai richiesto questo codice o ritieni di averlo ricevuto per errore, puoi ignorare il presente messaggio.\n\nDR7 S.p.A. - www.dr7.app`,
                html: `
                    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <img src="https://dr7empire.com/DR7logo1.png" alt="DR7" style="height: 60px;" />
                        </div>
                        <h2 style="color: #111; text-align: center;">Codice di Verifica</h2>
                        <p style="text-align: center;">Usa questo codice per confermare la tua firma:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <div style="display: inline-block; background: #f5f5f5; padding: 20px 40px; border-radius: 12px; letter-spacing: 8px; font-size: 32px; font-weight: 700; color: #111; border: 2px solid #d4af37;">
                                ${otp}
                            </div>
                        </div>
                        <p style="text-align: center; color: #666; font-size: 13px;">Il codice scade tra ${OTP_EXPIRY_MINUTES} minuti.</p>
                        <p style="text-align: center; color: #b45309; font-size: 13px;"><strong>Non condividere questo codice con nessuno</strong>: serve solo a te per firmare il tuo contratto.</p>
                        <p style="text-align: center; color: #666; font-size: 13px;">Se non hai richiesto questo codice, ignora questa email.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                        <p style="color: #999; font-size: 11px; text-align: center;">
                            DR7 S.p.A. - www.dr7empire.com
                        </p>
                    </div>
                `
            })
            if (emailError) {
                console.error('Resend OTP error:', emailError)
                erroreEmail = emailError.message
                return false
            }
            console.log(`[signature-send-otp] OTP sent via email to ${sigRequest.signer_email}`)
            return true
        }

        const ordine: ('whatsapp' | 'email')[] = firma.canale === 'email' ? ['email', 'whatsapp'] : ['whatsapp', 'email']
        let channel: 'whatsapp' | 'email' | null = null
        for (const c of ordine) {
            const ok = c === 'whatsapp' ? await inviaWhatsApp() : await inviaEmail()
            if (ok) { channel = c; break }
        }
        if (!channel) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Impossibile inviare il codice OTP. Contatta DR7.', details: erroreEmail || undefined }) }
        }
        if (channel !== firma.canale) {
            console.warn(`[signature-send-otp] Canale scelto ${firma.canale} non disponibile, inviato via ${channel}`)
        }

        // Log audit
        await supabase.from('signature_audit_trail').insert({
            signature_request_id: sigRequest.id,
            event_type: 'otp_sent',
            event_description: channel === 'whatsapp'
                ? `Codice OTP inviato via WhatsApp`
                : `Codice OTP inviato via email a ${sigRequest.signer_email}`,
            ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown',
            user_agent: event.headers['user-agent'] || 'unknown',
            metadata: { otp_expires_at: otpExpiresAt.toISOString(), channel }
        })

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                channel,
                message: channel === 'whatsapp' ? 'Codice OTP inviato via WhatsApp' : 'Codice OTP inviato via email',
                expiresInMinutes: OTP_EXPIRY_MINUTES
            })
        }
    } catch (error: any) {
        console.error('Error in signature-send-otp:', error)
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Errore nell\'invio del codice OTP', details: error.message })
        }
    }
}
