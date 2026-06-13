import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'
// DR7 Supabase — primary (signature_requests, contracts, bookings, customers_extended)
const supabase = createClient(
    process.env.DR7_SUPABASE_URL || 'https://ahpmzjgkfxrrgxyirasa.supabase.co',
    process.env.DR7_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// DR7 Trust Supabase — secondary (copy signed docs + marketing consent)
const supabaseTrustera = createClient(
    process.env.SUPABASE_URL || 'https://zkcvsewfqnukdkvcairk.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    try {
        const { token, signatureImage, signatureImage2, marketingConsent } = JSON.parse(event.body || '{}')

        if (!token) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Token richiesto' }) }
        }

        const ipAddress = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown'
        const userAgent = event.headers['user-agent'] || 'unknown'

        // Fetch signature request
        const { data: sigRequest, error } = await supabase
            .from('signature_requests')
            .select('*')
            .eq('token', token)
            .single()

        if (error || !sigRequest) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Richiesta di firma non trovata' }) }
        }

        // Validate state
        if (sigRequest.status === 'signed') {
            return { statusCode: 400, body: JSON.stringify({ error: 'Il documento e gia stato firmato' }) }
        }

        if (sigRequest.status !== 'otp_verified') {
            return { statusCode: 400, body: JSON.stringify({ error: 'Verifica OTP richiesta prima della firma' }) }
        }

        if (new Date(sigRequest.token_expires_at) < new Date()) {
            await supabase
                .from('signature_requests')
                .update({ status: 'expired', updated_at: new Date().toISOString() })
                .eq('id', sigRequest.id)
            return { statusCode: 410, body: JSON.stringify({ error: 'Il link di firma e scaduto' }) }
        }

        // Look up which channel was used for OTP (WhatsApp or email) from audit trail
        let otpChannel: 'whatsapp' | 'email' = 'email'
        const { data: otpAudit } = await supabase
            .from('signature_audit_trail')
            .select('metadata')
            .eq('signature_request_id', sigRequest.id)
            .eq('event_type', 'otp_sent')
            .order('created_at', { ascending: false })
            .limit(1)
        if (otpAudit && otpAudit.length > 0 && otpAudit[0].metadata?.channel) {
            otpChannel = otpAudit[0].metadata.channel
        }

        // Fetch original document — either from contract or standalone document
        let contract: any = null
        let originalPdfUrl: string | null = null
        let docIdentifier: string = sigRequest.id

        if (sigRequest.contract_id) {
            const { data: contractData } = await supabase
                .from('contracts')
                .select('*')
                .eq('id', sigRequest.contract_id)
                .single()
            contract = contractData
            originalPdfUrl = contract?.pdf_url
            docIdentifier = contract?.contract_number || sigRequest.contract_id
        } else {
            // Standalone document
            originalPdfUrl = sigRequest.document_url
            docIdentifier = sigRequest.document_name || 'documento'
        }

        if (!originalPdfUrl) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Documento PDF non trovato' }) }
        }

        // Download the original (CURRENT) contract PDF and compute its hash FIRST.
        // Serve sia per il controllo integrità sia per decidere se l'eventuale
        // firma accumulata di un altro firmatario è sulla STESSA versione corrente.
        const origPdfResponse = await fetch(originalPdfUrl)
        if (!origPdfResponse.ok) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Impossibile scaricare il PDF' }) }
        }
        const originalPdfBytes = new Uint8Array(await origPdfResponse.arrayBuffer())
        const currentHash = crypto.createHash('sha256').update(Buffer.from(originalPdfBytes)).digest('hex')

        // Verify PDF integrity (hash must match what was stored at init)
        if (sigRequest.original_pdf_hash && currentHash !== sigRequest.original_pdf_hash) {
            await supabase.from('signature_audit_trail').insert({
                signature_request_id: sigRequest.id,
                event_type: 'integrity_check_failed',
                event_description: 'Hash del PDF non corrisponde. Il documento potrebbe essere stato modificato.',
                ip_address: ipAddress,
                user_agent: userAgent,
                metadata: { expected_hash: sigRequest.original_pdf_hash, actual_hash: currentHash }
            })
            return {
                statusCode: 409,
                body: JSON.stringify({ error: 'Il documento e stato modificato dopo la creazione della richiesta di firma. Genera una nuova richiesta.' })
            }
        }

        // ── Accumulative signing: usa l'ultimo PDF firmato come base SOLO se quel
        // firmatario ha firmato la STESSA versione corrente del contratto (stesso
        // original_pdf_hash). BUG 2026-06: dopo "modifica + rigenera contratto"
        // restava una firma vecchia su una versione OBSOLETA; accumulando su
        // quella, il PDF firmato finale mostrava i DATI VECCHI. Filtrando per
        // original_pdf_hash === currentHash si riparte sempre dalla versione
        // corrente quando il contratto è stato rigenerato. ──
        let basePdfUrl = originalPdfUrl
        let isFirstSigner = true
        if (sigRequest.contract_id) {
            const { data: signedRequests } = await supabase
                .from('signature_requests')
                .select('id, signed_pdf_url, signed_at, original_pdf_hash')
                .eq('contract_id', sigRequest.contract_id)
                .eq('status', 'signed')
                .eq('original_pdf_hash', currentHash)
                .neq('id', sigRequest.id)
                .order('signed_at', { ascending: false })
                .limit(1)

            if (signedRequests && signedRequests.length > 0 && signedRequests[0].signed_pdf_url) {
                basePdfUrl = signedRequests[0].signed_pdf_url
                isFirstSigner = false
                console.log(`[signature-complete] Using accumulated PDF from previous signer (same version) as base`)
            }
        }

        // Download the base PDF (accumulated or original) for modification
        let basePdfBytes: Uint8Array
        if (basePdfUrl === originalPdfUrl) {
            basePdfBytes = originalPdfBytes
        } else {
            const basePdfResponse = await fetch(basePdfUrl)
            if (!basePdfResponse.ok) {
                console.warn('[signature-complete] Could not download accumulated PDF, falling back to original')
                basePdfBytes = originalPdfBytes
                isFirstSigner = true
            } else {
                basePdfBytes = new Uint8Array(await basePdfResponse.arrayBuffer())
            }
        }

        // Load and modify PDF — add seals
        const pdfDoc = await PDFDocument.load(basePdfBytes)
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)


        const signedAt = new Date()
        const signedAtRome = signedAt.toLocaleString('it-IT', { timeZone: 'Europe/Rome' })

        // ── Determine signer position (needed for seal placement + footer offset) ──
        let signerIndex = 0
        // 2026-05-29: signerRole — quando un booking DR7 ha fideiussori
        // solidali (booking_details.guarantors[]), il signer corrente puo'
        // essere fideiussore_1/2/3 invece di customer / 2° guidatore.
        // Posizioniamo il seal sotto nel riquadro "Firma del garante" in
        // colonne (1=sx, 2=centro, 3=dx) invece di farlo cadere nel box
        // "2° guidatore" del template.
        let signerRole: 'locatore' | '1_guidatore' | '2_guidatore' | 'fideiussore_1' | 'fideiussore_2' | 'fideiussore_3' | 'garante' = '1_guidatore'
        if (sigRequest.contract_id) {
            const { data: allRequests } = await supabase
                .from('signature_requests')
                .select('id, created_at, signer_name, signer_email, signer_phone')
                .eq('contract_id', sigRequest.contract_id)
                .in('status', ['signed', 'otp_verified', 'otp_sent', 'pending'])
                .order('created_at', { ascending: true })
            if (allRequests) {
                signerIndex = allRequests.findIndex((r: any) => r.id === sigRequest.id)
                if (signerIndex < 0) signerIndex = 0
            }
            console.log(`[signature-complete] Signer index: ${signerIndex} of ${allRequests?.length || 1}`)

            // ── Role detection via booking_details ────────────────────
            // 2026-05-29: ORDER IS CRITICAL. Controlliamo PRIMA i fideiussori
            // (match by NAME, che e' unico) e SOLO DOPO il customer / 2° guidatore.
            // Motivo: i fideiussori senza email in OperatoriTab ricevono in
            // fallback l'email del CUSTOMER quando salvati in signature_requests.
            // Quindi confrontare per email metterebbe TUTTI i fideiussori senza
            // email nel ruolo di customer. Il match by name evita la collisione.
            try {
                const { data: ctx } = await supabase
                    .from('contracts')
                    .select('booking_id')
                    .eq('id', sigRequest.contract_id)
                    .maybeSingle()
                if (ctx?.booking_id) {
                    const { data: bk } = await supabase
                        .from('bookings')
                        .select('customer_email, customer_phone, customer_name, booking_details')
                        .eq('id', ctx.booking_id)
                        .maybeSingle()
                    const normPhone = (s: any) => String(s || '').replace(/[\s\+\-\(\)]/g, '').replace(/^00/, '').toLowerCase()
                    const normEmail = (s: any) => String(s || '').trim().toLowerCase()
                    const normName = (s: any) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
                    const sigEmail = normEmail(sigRequest.signer_email)
                    const sigPhone = normPhone(sigRequest.signer_phone)
                    const sigName = normName(sigRequest.signer_name)

                    // Step 1: fideiussori PRIMA (by name OR phone; mai by email
                    // perche' potrebbero condividere l'email fallback del customer)
                    const fids: any[] = Array.isArray(bk?.booking_details?.guarantors)
                        ? bk.booking_details.guarantors
                        : []
                    let matchedFid: 1 | 2 | 3 | null = null
                    for (const row of fids) {
                        const n = Number(row?.index)
                        if (n !== 1 && n !== 2 && n !== 3) continue
                        const fName = normName(row[`garante_${n}_nome_cognome`])
                        const fPhone = normPhone(row[`garante_${n}_telefono`])
                        // Name match e' la chiave primaria (unica per riga)
                        if (sigName && fName && sigName === fName) {
                            matchedFid = n as 1 | 2 | 3
                            break
                        }
                        // Phone fallback se il name e' vuoto/typo
                        if (sigPhone && fPhone && sigPhone === fPhone) {
                            matchedFid = n as 1 | 2 | 3
                            break
                        }
                    }
                    if (matchedFid) {
                        signerRole = `fideiussore_${matchedFid}` as typeof signerRole
                    } else {
                        // Step 2: 2° guidatore (by phone preferibilmente, by name come fallback)
                        const sd = bk?.booking_details?.second_driver
                        const sdName = normName((sd?.name || '') + ' ' + (sd?.surname || ''))
                        const sdEmail = normEmail(sd?.email)
                        const sdPhone = normPhone(sd?.phone)
                        if ((sigPhone && sdPhone && sigPhone === sdPhone)
                            || (sigName && sdName && sigName === sdName)
                            || (sigEmail && sdEmail && sigEmail === sdEmail)) {
                            signerRole = '2_guidatore'
                        } else {
                            // Step 3: garante veicolo (cauzione_auto legacy)
                            const gv = bk?.booking_details?.garante_veicolo
                            const gvName = normName((gv?.nome || '') + ' ' + (gv?.cognome || ''))
                            const gvEmail = normEmail(gv?.email)
                            const gvPhone = normPhone(gv?.telefono || gv?.phone)
                            if ((sigPhone && gvPhone && sigPhone === gvPhone)
                                || (sigName && gvName && sigName === gvName)
                                || (sigEmail && gvEmail && sigEmail === gvEmail)) {
                                signerRole = 'garante'
                            } else {
                                // Step 4: default -> customer (1° guidatore)
                                signerRole = '1_guidatore'
                            }
                        }
                    }
                    console.log(`[signature-complete] Role detected: ${signerRole} for "${sigRequest.signer_name}" (email=${sigEmail}, phone=${sigPhone})`)
                }
            } catch (roleErr: any) {
                console.warn('[signature-complete] Role detection failed (fallback to index-based):', roleErr?.message)
            }
        }

        // ── DR7 Trust Verified Seals with QR code on last page ──
        // FIRMA LOCATORE gets a seal too (Ilenia Campagnola), same format as guidatore
        {
            const verifyUrl = `https://dr7trust.com/verify/${currentHash}`
            const qrPng = await QRCode.toBuffer(verifyUrl, { type: 'png', width: 300, margin: 1 })
            const qrImage = await pdfDoc.embedPng(qrPng)

            // Embed DR7 Trust logo
            let logoImage: any = null
            try {
                const logoResp = await fetch('https://dr7trust.com/dr7trust-logo.png')
                if (logoResp.ok) {
                    logoImage = await pdfDoc.embedPng(new Uint8Array(await logoResp.arrayBuffer()))
                }
            } catch (e) {
                console.warn('[signature-complete] Could not embed logo:', e)
            }

            const pages = pdfDoc.getPages()
            const sealPage = pages[pages.length - 1]
            const { width: pageWidth } = sealPage.getSize()

            const certId = `TR-${new Date().getFullYear()}-${currentHash.slice(0, 8).toUpperCase()}`

            // Seal dimensions — compact to fit inside contract signature boxes
            const sealW = 130
            const sealH = 42

            const darkGreen = rgb(0.06, 0.35, 0.18)
            const sealGray = rgb(0.35, 0.35, 0.35)
            const sealLightGray = rgb(0.75, 0.75, 0.75)

            // Contract last page layout (A4 = 595pt, y=0 at bottom):
            //   Row 1 (y≈105–235): FIRMA LOCATORE (x 30–208) | 1° guidatore (x 208–388) | 2° guidatore (x 388–567)
            //   Row 2 (y≈30–105):  Firma del garante (full width x 30–567)
            // From screenshot: three-column row bottom border ≈ y=105, top ≈ y=235

            // ── FIRMA LOCATORE seal (only drawn by the first signer to complete) ──
            if (contract && isFirstSigner) {
                const locSealX = 40  // Left side of LOCATORE column
                const locSealY = 135 // Inside LOCATORE box, below header text

                // Draw seal for Ilenia Campagnola
                sealPage.drawRectangle({
                    x: locSealX, y: locSealY, width: sealW, height: sealH,
                    borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.75,
                    color: rgb(1, 1, 1),
                })
                const locHeaderY = locSealY + sealH - 12
                if (logoImage) {
                    const hLogoH = 9
                    const hLogoW = (logoImage.width / logoImage.height) * hLogoH
                    sealPage.drawImage(logoImage, { x: locSealX + 4, y: locHeaderY - 1, width: hLogoW, height: hLogoH })
                    sealPage.drawText('Verified Seal', { x: locSealX + 4 + hLogoW + 2, y: locHeaderY + 1, size: 4.5, font, color: sealLightGray })
                } else {
                    sealPage.drawText('DR7 Trust  Verified Seal', { x: locSealX + 4, y: locHeaderY + 1, size: 4.5, font: fontBold, color: sealGray })
                }
                const locInfoX = locSealX + 4
                const locInfoY = locHeaderY - 9
                sealPage.drawText('Ilenia Campagnola', { x: locInfoX, y: locInfoY, size: 5.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
                const dd = String(signedAt.getDate()).padStart(2, '0')
                const mo = String(signedAt.getMonth() + 1).padStart(2, '0')
                const yy = signedAt.getFullYear()
                const hh = String(signedAt.getHours()).padStart(2, '0')
                const mi = String(signedAt.getMinutes()).padStart(2, '0')
                sealPage.drawText(`${dd}/${mo}/${yy} — ${hh}:${mi} CET`, { x: locInfoX, y: locInfoY - 7, size: 4, font, color: sealGray })
                sealPage.drawText(`ID: ${certId}`, { x: locInfoX, y: locInfoY - 13, size: 3.5, font, color: sealLightGray })
                const locQrSize = 13
                sealPage.drawImage(qrImage, { x: locSealX + sealW - locQrSize - 4, y: locInfoY - 3, width: locQrSize, height: locQrSize })
                const locFooterY = locSealY
                sealPage.drawText('Verifica ', { x: locSealX + 4, y: locFooterY + 2, size: 3, font, color: sealLightGray })
                sealPage.drawText('AuditTrail', { x: locSealX + 4 + font.widthOfTextAtSize('Verifica ', 3), y: locFooterY + 2, size: 3, font: fontBold, color: darkGreen })
                if (logoImage) {
                    const lH = 6
                    const lW = (logoImage.width / logoImage.height) * lH
                    sealPage.drawImage(logoImage, { x: locSealX + sealW - lW - 4, y: locFooterY + 1, width: lW, height: lH })
                }
                console.log('[signature-complete] FIRMA LOCATORE seal placed')
            }

            // ── Guidatore / Garante / Fideiussore seal positions ──
            // Layout PDF master DR7:
            //   Row 1 top (y≈105–235): LOCATORE (col 30–248, seal x=40) |
            //                          1° guidatore (col 248–438, seal x=230) |
            //                          2° guidatore (col 438–567, seal x=437)
            //   Row 2 bottom (y≈30–105): "Firma del garante o Firma, timbro aziendale"
            //                            in 3 colonne EQUIVALENTI alla riga top
            //                            (direzione redesigna il PDF in modo
            //                            speculare): fideiussore_1 → col sx,
            //                            fideiussore_2 → col centro, fideiussore_3
            //                            → col dx. Stesse X cosi' i seal sono
            //                            allineati verticalmente top↔bottom.
            // 2026-05-29: usiamo signerRole (non signerIndex) per evitare che
            // un fideiussore cada nel box "2° guidatore" quando il booking
            // non ha secondo guidatore reale.
            let sealX: number
            let sealYPos: number
            if (signerRole === '1_guidatore') {
                sealX = 230
                sealYPos = 135
            } else if (signerRole === '2_guidatore') {
                sealX = 437
                sealYPos = 135
            } else if (signerRole === 'fideiussore_1') {
                sealX = 40            // colonna sinistra (allineata a LOCATORE top)
                sealYPos = 35
            } else if (signerRole === 'fideiussore_2') {
                sealX = 230           // colonna centro (allineata a 1° guidatore top)
                sealYPos = 35
            } else if (signerRole === 'fideiussore_3') {
                sealX = 437           // colonna destra (allineata a 2° guidatore top)
                sealYPos = 35
            } else {
                // 'garante' (cauzione_auto, single legacy garante) o unknown
                // -> centro della riga (compatibilita' indietro).
                sealX = (pageWidth - sealW) / 2
                sealYPos = 35
            }

            // Outer rectangle
            sealPage.drawRectangle({
                x: sealX, y: sealYPos, width: sealW, height: sealH,
                borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.75,
                color: rgb(1, 1, 1),
            })

            // Header: logo + "Verified Seal"
            const headerY = sealYPos + sealH - 12
            if (logoImage) {
                const hLogoH = 9
                const hLogoW = (logoImage.width / logoImage.height) * hLogoH
                sealPage.drawImage(logoImage, { x: sealX + 4, y: headerY - 1, width: hLogoW, height: hLogoH })
                const vsX = sealX + 4 + hLogoW + 2
                sealPage.drawText('Verified Seal', { x: vsX, y: headerY + 1, size: 4.5, font, color: sealLightGray })
            } else {
                sealPage.drawText('DR7 Trust  Verified Seal', { x: sealX + 4, y: headerY + 1, size: 4.5, font: fontBold, color: sealGray })
            }

            // Signer info
            const infoX = sealX + 4
            const infoY = headerY - 9
            const signerDisplayName = sigRequest.signer_name || 'Firmatario'
            sealPage.drawText(signerDisplayName, { x: infoX, y: infoY, size: 5.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) })

            // Date + time
            const dd = String(signedAt.getDate()).padStart(2, '0')
            const mo = String(signedAt.getMonth() + 1).padStart(2, '0')
            const yy = signedAt.getFullYear()
            const hh = String(signedAt.getHours()).padStart(2, '0')
            const mi = String(signedAt.getMinutes()).padStart(2, '0')
            sealPage.drawText(`${dd}/${mo}/${yy} — ${hh}:${mi} CET`, { x: infoX, y: infoY - 7, size: 4, font, color: sealGray })

            // Certificate ID
            sealPage.drawText(`ID: ${certId}`, { x: infoX, y: infoY - 13, size: 3.5, font, color: sealLightGray })

            // QR code (right side)
            const qrSize = 13
            sealPage.drawImage(qrImage, {
                x: sealX + sealW - qrSize - 4,
                y: infoY - 3,
                width: qrSize, height: qrSize,
            })

            // Footer bar
            const footerBarY = sealYPos
            const footerBarH = 8
            sealPage.drawText('Verifica ', { x: sealX + 4, y: footerBarY + 2, size: 3, font, color: sealLightGray })
            sealPage.drawText('AuditTrail', { x: sealX + 4 + font.widthOfTextAtSize('Verifica ', 3), y: footerBarY + 2, size: 3, font: fontBold, color: darkGreen })

            if (logoImage) {
                const lH = 6
                const lW = (logoImage.width / logoImage.height) * lH
                sealPage.drawImage(logoImage, {
                    x: sealX + sealW - lW - 4,
                    y: footerBarY + (footerBarH - lH) / 2,
                    width: lW, height: lH,
                })
            }

            console.log(`[signature-complete] DR7 Trust verified seal placed at x=${sealX}, y=${sealYPos}`)
        }

        // Add signer full name on footer right of ALL pages (offset by signerIndex to avoid overlap)
        {
            const allPages = pdfDoc.getPages()
            const signerName = sigRequest.signer_name || 'N/A'
            const nameSize = 8
            const footerY = 15 + (signerIndex * 11) // Stack names vertically for multiple signers

            for (const pg of allPages) {
                const { width: pageWidth } = pg.getSize()
                const nameWidth = font.widthOfTextAtSize(signerName, nameSize)
                pg.drawText(signerName, {
                    x: pageWidth - nameWidth - 30,
                    y: footerY,
                    size: nameSize,
                    font,
                    color: rgb(0.3, 0.3, 0.3),
                })
            }

            console.log(`[signature-complete] Footer name added on ${allPages.length} pages for: ${signerName} (index ${signerIndex})`)
        }

        // No extra attestation page — the DR7 Trust verified seal with QR code
        // on the contract's last page IS the attestation (same as /sign/ flow)

        // Serialize final PDF
        const signedPdfBytes = await pdfDoc.save()
        const signedPdfHash = crypto.createHash('sha256').update(Buffer.from(signedPdfBytes)).digest('hex')

        // Upload signed PDF to Supabase storage
        const fileName = `signed/${docIdentifier}_firmato_${Date.now()}.pdf`
        const { error: uploadError } = await supabase
            .storage
            .from('contracts')
            .upload(fileName, signedPdfBytes, {
                contentType: 'application/pdf',
                upsert: false
            })

        if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`)
        }

        const { data: publicUrl } = supabase.storage.from('contracts').getPublicUrl(fileName)
        const signedPdfUrl = publicUrl.publicUrl

        // Update signature request as signed
        await supabase
            .from('signature_requests')
            .update({
                status: 'signed',
                signed_pdf_url: signedPdfUrl,
                signed_pdf_hash: signedPdfHash,
                signer_ip: ipAddress,
                signer_user_agent: userAgent,
                signed_at: signedAt.toISOString(),
                updated_at: signedAt.toISOString()
            })
            .eq('id', sigRequest.id)

        // Update contract record (only if this is a contract-based signature)
        if (sigRequest.contract_id) {
            await supabase
                .from('contracts')
                .update({
                    signed_pdf_url: signedPdfUrl,
                    updated_at: signedAt.toISOString()
                })
                .eq('id', sigRequest.contract_id)
        }

        // Log final audit event
        await supabase.from('signature_audit_trail').insert({
            signature_request_id: sigRequest.id,
            event_type: 'document_signed',
            event_description: `Documento firmato da ${sigRequest.signer_name} (${sigRequest.signer_email})`,
            ip_address: ipAddress,
            user_agent: userAgent,
            metadata: {
                signed_at: signedAt.toISOString(),
                signed_at_rome: signedAtRome,
                original_pdf_hash: currentHash,
                signed_pdf_hash: signedPdfHash,
                signed_pdf_url: signedPdfUrl,
                document_identifier: docIdentifier,
                marketing_consent: !!marketingConsent
            }
        })

        // Save marketing consent on customer record — NEVER overwrite true with false (GDPR: consent once given is kept)
        if (marketingConsent !== undefined) {
            try {
                // Determine customer email — from booking (contract) or signer email (standalone doc)
                let customerEmail = sigRequest.signer_email || ''

                if (contract?.booking_id) {
                    const { data: booking } = await supabase
                        .from('bookings')
                        .select('customer_email, booking_details')
                        .eq('id', contract.booking_id)
                        .single()
                    customerEmail = booking?.customer_email || booking?.booking_details?.customer?.email || customerEmail
                }

                if (customerEmail) {
                    // Case-insensitive lookup
                    const { data: existingCustomer } = await supabase
                        .from('customers_extended')
                        .select('marketing_consent, email')
                        .ilike('email', customerEmail)
                        .maybeSingle()

                    const currentConsent = existingCustomer?.marketing_consent ?? null

                    // Only update if:
                    // - New consent is true (always record a yes)
                    // - OR current consent is null (no record yet — record even a no)
                    // NEVER overwrite true with false
                    if (existingCustomer && (currentConsent !== true || !!marketingConsent === true)) {
                        await supabase
                            .from('customers_extended')
                            .update({
                                marketing_consent: !!marketingConsent,
                                marketing_consent_date: signedAt.toISOString()
                            })
                            .ilike('email', customerEmail)
                        console.log(`[signature-complete] Marketing consent (${marketingConsent}) saved for ${customerEmail}`)
                    } else if (!existingCustomer) {
                        // CREATE the row so consent is persisted for future signings
                        await supabase
                            .from('customers_extended')
                            .insert({
                                email: customerEmail.toLowerCase(),
                                marketing_consent: !!marketingConsent,
                                marketing_consent_date: signedAt.toISOString()
                            })
                        console.log(`[signature-complete] Created customers_extended record for ${customerEmail} with marketing_consent=${!!marketingConsent}`)
                    } else {
                        console.log(`[signature-complete] Skipping consent update for ${customerEmail}: existing=true, new=false — kept as true`)
                    }
                }
            } catch (mcErr: any) {
                console.error('[signature-complete] Failed to save marketing consent:', mcErr.message)
            }
        }

        // ── Check if ALL signers for this contract have now signed ──
        let allSignersDone = true
        let totalSigners = 1
        let allSignerRequests: any[] = []
        if (sigRequest.contract_id) {
            const { data: allReqs } = await supabase
                .from('signature_requests')
                .select('id, status, signer_name, signer_email, signer_phone, signed_pdf_url')
                .eq('contract_id', sigRequest.contract_id)
                .in('status', ['pending', 'otp_sent', 'otp_verified', 'signed'])
            allSignerRequests = allReqs || []
            totalSigners = allSignerRequests.length
            allSignersDone = allSignerRequests.length > 0 && allSignerRequests.every((r: any) => r.status === 'signed')
            console.log(`[signature-complete] ${allSignerRequests.filter((r: any) => r.status === 'signed').length}/${totalSigners} signers done. All done: ${allSignersDone}`)
        }

        // Send signed document via WhatsApp ONLY when ALL signers have completed
        const GREEN_API_INSTANCE_ID = process.env.DR7_GREEN_API_INSTANCE_ID || process.env.GREEN_API_INSTANCE_ID
        const GREEN_API_TOKEN = process.env.DR7_GREEN_API_TOKEN || process.env.GREEN_API_TOKEN
        if (allSignersDone && GREEN_API_INSTANCE_ID && GREEN_API_TOKEN && signedPdfUrl) {
            console.log(`[signature-complete] All ${totalSigners} signers done — sending fully-signed PDF via WhatsApp`)

            // Send to ALL signers (not just the last one)
            const phonesToSend: Set<string> = new Set()
            for (const req of allSignerRequests) {
                let phone = req.signer_phone || ''
                if (!phone && contract?.booking_id) {
                    const { data: booking } = await supabase
                        .from('bookings')
                        .select('customer_phone, booking_details')
                        .eq('id', contract.booking_id)
                        .single()
                    phone = booking?.customer_phone || booking?.booking_details?.customer?.phone || ''
                }
                if (!phone && req.signer_email) {
                    const { data: cust } = await supabase
                        .from('customers_extended')
                        .select('telefono')
                        .eq('email', req.signer_email)
                        .maybeSingle()
                    phone = cust?.telefono || ''
                }
                if (phone) {
                    let cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '')
                    if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.substring(2)
                    if (cleanPhone.length === 10) cleanPhone = '39' + cleanPhone
                    phonesToSend.add(cleanPhone)
                }
            }

            for (const cleanPhone of Array.from(phonesToSend)) {
                try {
                    const greenApiUrl = `https://api.green-api.com/waInstance${GREEN_API_INSTANCE_ID}/sendFileByUrl/${GREEN_API_TOKEN}`
                    const waResponse = await fetch(greenApiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chatId: `${cleanPhone}@c.us`,
                            urlFile: signedPdfUrl,
                            fileName: `${docIdentifier}_firmato.pdf`,
                            caption: `${contract ? 'Contratto' : 'Documento'} ${docIdentifier} firmato da tutti i firmatari - DR7 Empire`
                        })
                    })
                    const waResult = await waResponse.json()
                    if (waResponse.ok && !waResult.error) {
                        console.log(`[signature-complete] Fully-signed PDF sent to ${cleanPhone}:`, waResult.idMessage)
                    } else {
                        console.error(`[signature-complete] WhatsApp send failed for ${cleanPhone}:`, waResult)
                    }
                } catch (waErr: any) {
                    console.error(`[signature-complete] WhatsApp send failed for ${cleanPhone}:`, waErr.message)
                }
            }

            // Also send a copy to owner via DR7 Trust's Green API
            const TRUSTERA_INSTANCE = process.env.GREEN_API_INSTANCE_ID
            const TRUSTERA_TOKEN = process.env.GREEN_API_TOKEN
            const ownerPhone = process.env.TRUSTERA_OWNER_WHATSAPP || '393457905205'
            if (TRUSTERA_INSTANCE && TRUSTERA_TOKEN && TRUSTERA_INSTANCE !== GREEN_API_INSTANCE_ID) {
                try {
                    const dr7trustUrl = `https://api.green-api.com/waInstance${TRUSTERA_INSTANCE}/sendFileByUrl/${TRUSTERA_TOKEN}`
                    const ownerRes = await fetch(dr7trustUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chatId: `${ownerPhone}@c.us`,
                            urlFile: signedPdfUrl,
                            fileName: `${docIdentifier}_firmato.pdf`,
                            caption: `✅ Contratto ${docIdentifier} — firmato da tutti (${totalSigners} firmatari)`
                        })
                    })
                    const ownerResult = await ownerRes.json()
                    if (ownerRes.ok && ownerResult.idMessage) {
                        console.log('[signature-complete] Owner copy sent via DR7 Trust WhatsApp:', ownerResult.idMessage)
                    } else {
                        console.warn('[signature-complete] DR7 Trust owner copy failed:', ownerResult)
                    }
                } catch (ownerErr: any) {
                    console.warn('[signature-complete] DR7 Trust owner copy error:', ownerErr.message)
                }
            }
        } else if (!allSignersDone) {
            const signedCount = allSignerRequests.filter((r: any) => r.status === 'signed').length
            console.log(`[signature-complete] ${signedCount}/${totalSigners} signed — waiting for remaining signers before sending PDF`)
        }

        // Dual-write to DR7 Trust Supabase — copy signed document + marketing consent
        try {
            await supabaseTrustera.from('signed_documents_log').insert({
                source: contract ? 'dr7_contract' : 'dr7_standalone',
                document_name: contract ? (contract.contract_number || 'N/A') : (sigRequest.document_name || 'documento'),
                signer_name: sigRequest.signer_name,
                signer_email: sigRequest.signer_email,
                signed_pdf_url: signedPdfUrl,
                signed_at: signedAt.toISOString(),
                original_pdf_hash: currentHash,
                signed_pdf_hash: signedPdfHash,
                signer_ip: ipAddress,
                marketing_consent: marketingConsent !== undefined ? !!marketingConsent : null,
                metadata: {
                    document_identifier: docIdentifier,
                    booking_id: contract?.booking_id || null,
                    contract_id: sigRequest.contract_id || null,
                }
            })
            console.log('[signature-complete] Signed doc copied to DR7 Trust DB')

            // Mirror marketing consent to DR7 Trust
            if (marketingConsent !== undefined && sigRequest.signer_email) {
                const email = sigRequest.signer_email.toLowerCase()
                const { data: existing } = await supabaseTrustera
                    .from('marketing_consents')
                    .select('marketing_consent')
                    .eq('email', email)
                    .maybeSingle()

                if (existing) {
                    // Never overwrite true with false (GDPR)
                    if (existing.marketing_consent !== true || !!marketingConsent === true) {
                        await supabaseTrustera.from('marketing_consents').update({
                            marketing_consent: !!marketingConsent,
                            consent_date: signedAt.toISOString(),
                            name: sigRequest.signer_name,
                            updated_at: signedAt.toISOString(),
                        }).eq('email', email)
                    }
                } else {
                    await supabaseTrustera.from('marketing_consents').insert({
                        email,
                        name: sigRequest.signer_name,
                        marketing_consent: !!marketingConsent,
                        consent_date: signedAt.toISOString(),
                        source: contract ? 'dr7_contract' : 'dr7_standalone',
                    })
                }
            }
        } catch (syncErr: any) {
            console.warn('[signature-complete] DR7 Trust sync failed (non-blocking):', syncErr.message)
        }

        // Auto-send to CARGOS via admin panel (only after ALL signers done)
        if (allSignersDone && contract?.booking_id) {
            try {
                const cargosRes = await fetch('https://admin.dr7empire.com/.netlify/functions/cargos-auto-trigger', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Cargos-Key': process.env.CARGOS_TRIGGER_KEY || 'dr7-cargos-auto-2024'
                    },
                    body: JSON.stringify({ bookingId: contract.booking_id })
                })
                const cargosResult = await cargosRes.json()
                if (cargosResult.success) {
                    console.log('[signature-complete] ✅ Contract auto-sent to CARGOS via admin')
                } else {
                    console.warn('[signature-complete] ⚠️ CARGOS auto-send failed:', cargosResult.error)
                }
            } catch (cargosErr: any) {
                console.error('[signature-complete] ⚠️ CARGOS trigger error:', cargosErr.message)
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Documento firmato con successo',
                signedPdfUrl,
                signedAt: signedAtRome
            })
        }
    } catch (error: any) {
        console.error('Error in signature-complete:', error)
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Errore nella firma del documento', details: error.message })
        }
    }
}
