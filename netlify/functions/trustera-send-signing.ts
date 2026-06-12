import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://zkcvsewfqnukdkvcairk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY!)

const SITE_URL = process.env.SITE_URL || 'https://dr7trust.com'

async function logAudit(documentId: string, action: string, email?: string, ip?: string, userAgent?: string, metadata?: Record<string, any>) {
  try {
    await supabase.from('signature_audit_trail').insert({
      document_id: documentId,
      action,
      signer_email: email || null,
      ip_address: ip || null,
      user_agent: userAgent || null,
      metadata: metadata || null,
    })
  } catch (e) { /* non-blocking */ }
}

function cleanPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '')
  if (cleaned.startsWith('+')) return cleaned.slice(1)
  if (cleaned.startsWith('00')) return cleaned.slice(2)
  if (cleaned.startsWith('3') && cleaned.length === 10) return '39' + cleaned
  return cleaned
}

async function sendWhatsAppSigningLink(
  phone: string,
  signerName: string,
  senderName: string,
  documentName: string,
  signingUrl: string
): Promise<boolean> {
  const idInstance = process.env.GREEN_API_INSTANCE_ID
  const apiToken = process.env.GREEN_API_TOKEN
  if (!idInstance || !apiToken) return false

  const chatId = cleanPhone(phone) + '@c.us'
  const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiToken}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: `Ciao ${signerName},\n\n*${senderName}* ti ha inviato un documento da firmare: *${documentName}*\n\nClicca qui per firmarlo:\n${signingUrl}\n\nIl link scade tra 12 ore.\n\n_Trustera - Infrastructure for Digital Trust_`
      })
    })
    const data = await res.json()
    if (res.ok && data.idMessage) {
      console.log('[trustera-send-signing] WhatsApp sent:', data.idMessage)
      return true
    }
    console.warn('[trustera-send-signing] WhatsApp response not OK:', data)
    return false
  } catch (err: any) {
    console.warn('[trustera-send-signing] WhatsApp error:', err.message)
    return false
  }
}

function buildSigningEmailHtml(signerName: string, senderName: string, documentName: string, signingUrl: string): string {
  return `<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Documento da firmare</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="padding: 32px 40px 0; text-align: center;">
              <img src="https://dr7trust.com/trustera-logo.jpeg" alt="Trustera" style="height: 80px; width: auto; max-width: 200px;" />
              <p style="margin: 8px 0 0; color: #666; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 14px;">Firma Elettronica</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 0; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 15px; color: #333; line-height: 1.6;">
              <p style="margin: 0 0 12px;">Ciao <strong>${signerName}</strong>,</p>
              <p style="margin: 0 0 12px;"><strong>${senderName}</strong> ti ha inviato un documento da firmare: <strong>${documentName}</strong></p>
              <p style="margin: 0;">Clicca il pulsante qui sotto per visualizzare e firmare il documento:</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 40px; text-align: center;">
              <a href="${signingUrl}" style="display: inline-block; background-color: #16a34a; color: #ffffff; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                Firma il Documento
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 24px; text-align: center;">
              <p style="margin: 0; color: #999; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 12px;">Questo link scade tra 12 ore.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 32px; text-align: center;">
              <p style="margin: 0; color: #d1d5db; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 11px;">
                Trustera - Infrastructure for Digital Trust<br/>
                <a href="https://dr7trust.com" style="color: #16a34a; text-decoration: none;">www.dr7trust.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildApprovalEmailHtml(
  approverName: string,
  senderName: string,
  documentName: string,
  signerNames: string[],
  approveUrl: string,
  rejectUrl: string
): string {
  const signersHtml = signerNames.map(n => `<li style="margin:4px 0;">${n}</li>`).join('')
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Richiesta di approvazione</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="padding: 32px 40px 0; text-align: center;">
              <img src="https://dr7trust.com/trustera-logo.jpeg" alt="Trustera" style="height: 80px; width: auto; max-width: 200px;" />
              <p style="margin: 8px 0 0; color: #666; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 14px;">Richiesta di Approvazione</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 0; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 15px; color: #333; line-height: 1.6;">
              <p style="margin: 0 0 12px;">Ciao <strong>${approverName}</strong>,</p>
              <p style="margin: 0 0 16px;"><strong>${senderName}</strong> richiede la tua approvazione prima di inviare il documento per la firma:</p>
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 18px; margin: 0 0 16px;">
                <p style="margin: 0; font-size: 16px; font-weight: 700; color: #15803d;">${documentName}</p>
              </div>
              <p style="margin: 0 0 8px; font-size: 14px; color: #555;">Firmatari previsti:</p>
              <ul style="margin: 0 0 20px; padding-left: 20px; font-size: 14px; color: #444;">
                ${signersHtml}
              </ul>
              <p style="margin: 0 0 8px; font-size: 13px; color: #666;">Se approvi, le richieste di firma verranno inviate automaticamente ai firmatari. Se rifiuti, il documento non verrà inviato.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 40px; text-align: center;">
              <a href="${approveUrl}" style="display: inline-block; background-color: #16a34a; color: #ffffff; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 15px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; margin: 0 8px 12px;">
                Approva
              </a>
              <a href="${rejectUrl}" style="display: inline-block; background-color: #dc2626; color: #ffffff; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 15px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; margin: 0 8px 12px;">
                Rifiuta
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 24px; text-align: center;">
              <p style="margin: 0; color: #999; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 12px;">Puoi anche aprire la pagina di approvazione direttamente dal link Approva.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 32px; text-align: center;">
              <p style="margin: 0; color: #d1d5db; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 11px;">
                Trustera - Infrastructure for Digital Trust<br/>
                <a href="https://dr7trust.com" style="color: #16a34a; text-decoration: none;">www.dr7trust.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Insert signer rows into trustera_document_signers and send signing emails/WhatsApp.
 * Used both in the direct flow (no approvers) and after all approvers have approved.
 */
export async function processSendSigners(
  documentId: string,
  signers: Array<{ name: string; email?: string; phone?: string; channel?: string }>,
  doc: { id: string; name: string; owner_id?: string },
  senderName: string,
  requireOtp: boolean
): Promise<void> {
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()

  for (let signerIndex = 0; signerIndex < signers.length; signerIndex++) {
    const signer = signers[signerIndex]
    const token = crypto.randomBytes(32).toString('hex')
    const signingUrl = `${SITE_URL}/sign/${token}`

    const { data: insertedSigner, error: signerInsertError } = await supabase
      .from('trustera_document_signers')
      .insert({
        document_id: documentId,
        signer_name: signer.name,
        signer_email: signer.email,
        signer_phone: signer.phone || null,
        notification_channel: signer.channel || 'email',
        require_otp: requireOtp,
        signing_token: token,
        signing_token_expires_at: expiresAt,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (signerInsertError) {
      console.error('[trustera-send-signing] Failed to insert signer:', signerInsertError.message)
      throw signerInsertError
    }

    if (insertedSigner) {
      const { error: fieldLinkError } = await supabase
        .from('trustera_document_fields')
        .update({ signer_id: insertedSigner.id })
        .eq('document_id', documentId)
        .eq('signer_index', signerIndex)

      if (fieldLinkError) {
        console.warn('[trustera-send-signing] Field link error:', fieldLinkError.message)
      }
    }

    // Upsert into trustera_contacts
    if (doc.owner_id && signer.email) {
      const normalizedEmail = signer.email.trim().toLowerCase()
      const normalizedPhone = signer.phone?.trim() || null

      const { data: existingContact } = await supabase
        .from('trustera_contacts')
        .select('id')
        .eq('owner_id', doc.owner_id)
        .ilike('email', normalizedEmail)
        .maybeSingle()

      if (existingContact) {
        await supabase
          .from('trustera_contacts')
          .update({ name: signer.name, phone: normalizedPhone, updated_at: new Date().toISOString() })
          .eq('id', existingContact.id)
      } else {
        await supabase
          .from('trustera_contacts')
          .insert({ owner_id: doc.owner_id, email: normalizedEmail, name: signer.name, phone: normalizedPhone, updated_at: new Date().toISOString() })
      }
    }

    // Upsert into trustera_leads
    const { data: existingLead } = await supabase
      .from('trustera_leads')
      .select('id, marketing_consent')
      .eq('email', signer.email)
      .maybeSingle()

    const leadPayload: Record<string, any> = {
      email: signer.email,
      name: signer.name,
      phone: signer.phone || null,
      last_seen_at: new Date().toISOString(),
      source: 'signing_request'
    }

    if (!existingLead || existingLead.marketing_consent !== true) {
      leadPayload.marketing_consent = false
    }

    await supabase.from('trustera_leads').upsert(leadPayload, { onConflict: 'email' })

    // Send notification
    const channel = signer.channel || 'email'
    if (channel === 'whatsapp' && signer.phone) {
      await sendWhatsAppSigningLink(signer.phone, signer.name, senderName, doc.name, signingUrl)
      await logAudit(documentId, 'whatsapp_sent', signer.email, undefined, undefined, { channel: 'whatsapp', phone: signer.phone, signer_name: signer.name })
    } else {
      try {
        await resend.emails.send({
          from: 'Trustera <info@dr7trust.com>',
          replyTo: 'info@dr7trust.com',
          to: signer.email!,
          subject: `${senderName} ti ha inviato un documento da firmare`,
          text: `Ciao ${signer.name},\n\n${senderName} ti ha inviato un documento da firmare: ${doc.name}\n\nClicca qui per visualizzare e firmare il documento:\n${signingUrl}\n\nQuesto link scade tra 12 ore.\n\nTrustera - Infrastructure for Digital Trust\nhttps://dr7trust.com`,
          html: buildSigningEmailHtml(signer.name, senderName, doc.name, signingUrl)
        })
        await logAudit(documentId, 'email_sent', signer.email, undefined, undefined, { channel: 'email', signer_name: signer.name })
      } catch (emailErr: any) {
        console.error('[trustera-send-signing] Email send failed for', signer.email, ':', emailErr.message)
        throw emailErr
      }
    }

    console.log('[trustera-send-signing] Signer processed:', signer.email)
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { documentId, signers, requireOtp = true, approvers = [] } = JSON.parse(event.body || '{}')

    if (!documentId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'documentId richiesto' }) }
    }
    if (!Array.isArray(signers) || signers.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'signers richiesto (array non vuoto)' }) }
    }

    for (const s of signers) {
      if (!s.name) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Ogni firmatario deve avere un nome' }) }
      }
      if (!s.email && !s.phone) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Ogni firmatario deve avere email o telefono' }) }
      }
    }

    // Fetch document
    const { data: doc, error: docError } = await supabase
      .from('trustera_documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      console.error('[trustera-send-signing] Document not found:', docError?.message)
      return { statusCode: 404, body: JSON.stringify({ error: 'Documento non trovato' }) }
    }

    // Get sender name
    let senderName = 'Un utente Trustera'
    if (doc.owner_id) {
      const { data: { user: ownerUser } } = await supabase.auth.admin.getUserById(doc.owner_id)
      if (ownerUser?.user_metadata?.full_name) {
        senderName = ownerUser.user_metadata.full_name
      } else if (ownerUser?.email) {
        senderName = ownerUser.email
      }
    }

    const hasApprovers = Array.isArray(approvers) && approvers.length > 0

    if (hasApprovers) {
      // ── Approval flow: hold signers, send approval requests ──────────────────

      // Build approver records with unique tokens
      const approverRecords = approvers
        .filter((a: any) => a.email)
        .map((a: any) => ({
          name: a.name || a.email,
          email: a.email,
          token: crypto.randomBytes(32).toString('hex'),
          status: 'pending' as const,
        }))

      const signerNames = signers.map((s: any) => s.name)

      // Store approvers + draft_signers; set approval_status
      const { error: updateError } = await supabase
        .from('trustera_documents')
        .update({
          status: 'pending',
          approval_status: 'awaiting_approval',
          approvers: approverRecords,
          draft_signers: signers,
        })
        .eq('id', documentId)

      if (updateError) {
        console.error('[trustera-send-signing] Document update failed:', updateError.message)
        throw updateError
      }

      // Send approval email to each approver
      for (const approver of approverRecords) {
        const approveUrl = `${SITE_URL}/approve/${approver.token}?action=approve`
        const rejectUrl = `${SITE_URL}/approve/${approver.token}?action=reject`

        try {
          await resend.emails.send({
            from: 'Trustera <info@dr7trust.com>',
            replyTo: 'info@dr7trust.com',
            to: approver.email,
            subject: `${senderName} richiede la tua approvazione: ${doc.name}`,
            text: `Ciao ${approver.name},\n\n${senderName} richiede la tua approvazione per il documento "${doc.name}".\n\nFirmatari previsti: ${signerNames.join(', ')}\n\nApprova: ${approveUrl}\nRifiuta: ${rejectUrl}\n\nTrustera - Infrastructure for Digital Trust\nhttps://dr7trust.com`,
            html: buildApprovalEmailHtml(approver.name, senderName, doc.name, signerNames, approveUrl, rejectUrl)
          })
          console.log('[trustera-send-signing] Approval email sent to:', approver.email)
          await logAudit(documentId, 'approval_requested', approver.email, undefined, undefined, { approver_name: approver.name })
        } catch (err: any) {
          console.warn('[trustera-send-signing] Approval email failed for', approver.email, ':', err.message)
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          signerCount: signers.length,
          approverCount: approverRecords.length,
          awaitingApproval: true,
        })
      }
    }

    // ── Direct flow: no approvers ─────────────────────────────────────────────

    await processSendSigners(documentId, signers, doc, senderName, requireOtp)

    const { error: statusError } = await supabase
      .from('trustera_documents')
      .update({ status: 'pending' })
      .eq('id', documentId)

    if (statusError) {
      console.error('[trustera-send-signing] Status update failed:', statusError.message)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, signerCount: signers.length, approverCount: 0 })
    }
  } catch (error: any) {
    console.error('[trustera-send-signing] Error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Errore interno' })
    }
  }
}
