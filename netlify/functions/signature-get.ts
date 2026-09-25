import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { controllaDispositivo } from './utils/dispositivo'
import { leggiFirmaConfig } from './utils/firmaConfig'

// DR7 Supabase — signature_requests, contracts, bookings live here
const supabase = createClient(
    process.env.DR7_SUPABASE_URL || 'https://ahpmzjgkfxrrgxyirasa.supabase.co',
    process.env.DR7_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
            .select('id, contract_id, booking_id, signer_name, signer_email, status, token_expires_at, signed_pdf_url, signed_at, document_url, document_name, device_id')
            .eq('token', token)
            .single()

        if (error || !sigRequest) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Richiesta di firma non trovata' }) }
        }

        // Link personale: solo il primo dispositivo che l'ha aperto (utils/dispositivo.ts).
        const bloccoDispositivo = await controllaDispositivo(supabase, sigRequest, deviceId, event)
        if (bloccoDispositivo) return bloccoDispositivo

        // Check expiry
        if (new Date(sigRequest.token_expires_at) < new Date() && sigRequest.status !== 'signed') {
            await supabase
                .from('signature_requests')
                .update({ status: 'expired', updated_at: new Date().toISOString() })
                .eq('id', sigRequest.id)
            return { statusCode: 410, body: JSON.stringify({ error: 'Il link di firma e scaduto', status: 'expired' }) }
        }

        // Fetch contract for PDF URL and details (only if contract_id exists)
        let contract: any = null
        let secondDriverName: string | null = null
        let existingMarketingConsent: boolean | null = null

        if (sigRequest.contract_id) {
            const { data: contractData } = await supabase
                .from('contracts')
                .select('contract_number, pdf_url, customer_name, vehicle_name, rental_start_date, rental_end_date, booking_id')
                .eq('id', sigRequest.contract_id)
                .single()
            contract = contractData

            // Check if booking has a second driver, and fetch existing marketing consent
            if (contract?.booking_id) {
                const { data: booking } = await supabase
                    .from('bookings')
                    .select('booking_details, customer_email')
                    .eq('id', contract.booking_id)
                    .single()

                if (booking?.booking_details?.second_driver) {
                    const sd = booking.booking_details.second_driver
                    secondDriverName = sd.fullName || sd.full_name || sd.name ||
                        [sd.nome, sd.cognome].filter(Boolean).join(' ') || null
                }

                // Look up existing marketing consent from customers_extended
                const customerEmail = booking?.customer_email || booking?.booking_details?.customer?.email
                if (customerEmail) {
                    // Use .limit(1) instead of .maybeSingle() to avoid error when multiple rows exist
                    const { data: extRows, error: extErr } = await supabase
                        .from('customers_extended')
                        .select('marketing_consent')
                        .ilike('email', customerEmail.trim())
                        .limit(1)

                    if (extErr) {
                        console.error(`[signature-get] Error looking up consent for ${customerEmail}:`, extErr.message)
                    }
                    if (extRows && extRows.length > 0) {
                        existingMarketingConsent = extRows[0].marketing_consent ?? null
                        console.log(`[signature-get] Found consent=${existingMarketingConsent} for booking email ${customerEmail}`)
                    } else {
                        console.log(`[signature-get] No customers_extended row for booking email ${customerEmail}`)
                    }
                }
            }
        }

        // Fallback: always try signer_email if consent still unknown
        if (existingMarketingConsent === null && sigRequest.signer_email) {
            const { data: extRows } = await supabase
                .from('customers_extended')
                .select('marketing_consent')
                .ilike('email', sigRequest.signer_email.trim())
                .limit(1)
            if (extRows && extRows.length > 0) {
                existingMarketingConsent = extRows[0].marketing_consent ?? null
                console.log(`[signature-get] Found consent=${existingMarketingConsent} for signer email ${sigRequest.signer_email}`)
            }
        }

        // Last resort: check audit trail for any previous signing by this signer with marketing_consent=true
        if (existingMarketingConsent === null && sigRequest.signer_email) {
            // Find previous signature_requests by this email that have been signed
            const { data: prevSignRequests } = await supabase
                .from('signature_requests')
                .select('id')
                .ilike('signer_email', sigRequest.signer_email)
                .eq('status', 'signed')
                .neq('id', sigRequest.id)

            if (prevSignRequests && prevSignRequests.length > 0) {
                const ids = prevSignRequests.map((r: any) => r.id)
                const { data: auditRows } = await supabase
                    .from('signature_audit_trail')
                    .select('metadata')
                    .eq('event_type', 'document_signed')
                    .in('signature_request_id', ids)
                    .order('created_at', { ascending: false })
                    .limit(10)

                if (auditRows) {
                    const found = auditRows.find((row: any) => row.metadata?.marketing_consent === true)
                    if (found) {
                        existingMarketingConsent = true
                        console.log(`[signature-get] Found marketing consent=true in audit trail for ${sigRequest.signer_email}`)
                    }
                }
            }
        }

        console.log(`[signature-get] Marketing consent for ${sigRequest.signer_email}: ${existingMarketingConsent}`)

        // Log document view
        if (sigRequest.status !== 'signed') {
            await supabase.from('signature_audit_trail').insert({
                signature_request_id: sigRequest.id,
                event_type: 'document_viewed',
                event_description: `Documento visualizzato da ${sigRequest.signer_name}`,
                ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown',
                user_agent: event.headers['user-agent'] || 'unknown'
            })
        }

        // Generate signed URLs for PDFs (public URLs fail if bucket isn't public)
        async function getSignedUrl(url: string | null): Promise<string | null> {
            if (!url) return null
            try {
                const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/)
                if (match) {
                    const { data } = await supabase.storage.from(match[1]).createSignedUrl(decodeURIComponent(match[2]), 3600)
                    if (data?.signedUrl) return data.signedUrl
                }
            } catch (e) {
                console.warn('[signature-get] Failed to create signed URL, using original:', e)
            }
            return url
        }

        // OTP o pulsante, e su quale canale: deciso in Centralina Pro.
        const firma = await leggiFirmaConfig(supabase, sigRequest)

        const contractPdfUrl = contract ? await getSignedUrl(contract.pdf_url) : await getSignedUrl(sigRequest.document_url)
        const signedPdfUrl = await getSignedUrl(sigRequest.signed_pdf_url)

        return {
            statusCode: 200,
            body: JSON.stringify({
                status: sigRequest.status,
                signerName: sigRequest.signer_name,
                signerEmail: sigRequest.signer_email,
                signedPdfUrl,
                signedAt: sigRequest.signed_at,
                secondDriverName,
                existingMarketingConsent,
                otpRequired: firma.otpAttivo,
                otpChannel: firma.canale,
                contract: contract ? {
                    contractNumber: contract.contract_number,
                    pdfUrl: contractPdfUrl,
                    customerName: contract.customer_name,
                    vehicleName: contract.vehicle_name,
                    rentalStartDate: contract.rental_start_date,
                    rentalEndDate: contract.rental_end_date
                } : sigRequest.document_url ? {
                    contractNumber: sigRequest.document_name || 'Documento',
                    pdfUrl: contractPdfUrl,
                    customerName: sigRequest.signer_name,
                    vehicleName: null,
                    rentalStartDate: null,
                    rentalEndDate: null
                } : null
            })
        }
    } catch (error: any) {
        console.error('Error in signature-get:', error)
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Errore nel recupero dei dati', details: error.message })
        }
    }
}
