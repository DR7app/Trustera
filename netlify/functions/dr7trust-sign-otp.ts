import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://zkcvsewfqnukdkvcairk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY!)

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

function cleanPhoneForChatId(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '')
  if (cleaned.startsWith('+')) return cleaned.slice(1)
  if (cleaned.startsWith('00')) return cleaned.slice(2)
  if (cleaned.startsWith('3') && cleaned.length === 10) return '39' + cleaned
  return cleaned
}

async function sendWhatsAppOtp(phone: string, otp: string): Promise<boolean> {
  const idInstance = process.env.GREEN_API_INSTANCE_ID
  const apiToken = process.env.GREEN_API_TOKEN
  if (!idInstance || !apiToken) return false

  const chatId = cleanPhoneForChatId(phone) + '@c.us'
  const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiToken}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: `Il tuo codice di verifica DR7 Trust è: *${otp}*\n\nNon condividere questo codice con nessuno.\nScade tra 10 minuti.`
      })
    })
    const data = await res.json()
    return !!data.idMessage
  } catch (err: any) {
    console.warn('[dr7trust-sign-otp] WhatsApp send error:', err.message)
    return false
  }
}

function buildOtpEmailHtml(otp: string): string {
  return `<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Codice di verifica</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="400" cellpadding="0" cellspacing="0" style="max-width: 400px; background: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="padding: 32px 40px 0; text-align: center;">
              <img src="https://dr7trust.com/dr7trust-logo.png" alt="DR7 Trust" width="120" style="height: auto; max-height: 48px;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 0; text-align: center; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;">
              <p style="margin: 0; color: #333; font-size: 15px;">Il tuo codice di verifica:</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; text-align: center;">
              <div style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #16a34a; padding: 16px; background: #f0fdf4; border-radius: 8px;">
                ${otp}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <p style="margin: 0; color: #999; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 12px;">Scade tra 10 minuti. Non condividere questo codice.</p>
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
                DR7 Trust - Infrastructure for Digital Trust<br/>
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

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { token } = JSON.parse(event.body || '{}')
    if (!token) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Token richiesto' }) }
    }

    const otp = crypto.randomInt(100000, 1000000).toString()
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // --- Try trustera_document_signers first (new multi-signer flow) ---
    const { data: signerRow, error: signerError } = await supabase
      .from('trustera_document_signers')
      .select('*')
      .eq('signing_token', token)
      .maybeSingle()

    if (signerError) {
      console.error('[dr7trust-sign-otp] Signer lookup error:', signerError.message)
    }

    if (signerRow) {
      // Check expiration
      if (signerRow.signing_token_expires_at && new Date(signerRow.signing_token_expires_at) < new Date()) {
        return { statusCode: 410, body: JSON.stringify({ error: 'Link scaduto' }) }
      }

      // Save OTP to signer record
      const { error: otpUpdateError } = await supabase
        .from('trustera_document_signers')
        .update({ otp_code: otp, otp_expires_at: otpExpires })
        .eq('id', signerRow.id)

      if (otpUpdateError) {
        console.error('[dr7trust-sign-otp] OTP update failed (signers):', otpUpdateError.message)
        return { statusCode: 500, body: JSON.stringify({ error: 'Errore nel salvataggio del codice' }) }
      }

      // Send OTP via the signer's notification channel
      let channel: 'whatsapp' | 'email' = 'email'
      const signerPhone = signerRow.signer_phone || ''
      const notificationChannel = signerRow.notification_channel || 'email'

      if (notificationChannel === 'whatsapp' && signerPhone) {
        const sent = await sendWhatsAppOtp(signerPhone, otp)
        if (sent) {
          channel = 'whatsapp'
        } else {
          console.warn('[dr7trust-sign-otp] WhatsApp OTP failed, falling back to email for:', signerPhone)
        }
      }

      if (channel === 'email') {
        if (signerRow.signer_email) {
          await resend.emails.send({
            from: 'DR7 Trust <info@dr7trust.com>',
            replyTo: 'info@dr7trust.com',
            to: signerRow.signer_email,
            subject: 'Codice di verifica DR7 Trust',
            text: `Il tuo codice di verifica DR7 Trust: ${otp}\n\nScade tra 10 minuti. Non condividere questo codice.\n\nDR7 Trust - Infrastructure for Digital Trust\nhttps://dr7trust.com`,
            html: buildOtpEmailHtml(otp)
          })
        } else if (signerPhone) {
          // No email available, try WhatsApp as last resort
          const sent = await sendWhatsAppOtp(signerPhone, otp)
          if (sent) channel = 'whatsapp'
          else return { statusCode: 500, body: JSON.stringify({ error: "Impossibile inviare il codice OTP. Nessun canale disponibile." }) }
        } else {
          return { statusCode: 500, body: JSON.stringify({ error: "Nessun canale disponibile per l'invio del codice OTP" }) }
        }
      }

      // Log OTP sent audit event
      const ip = event.headers['x-forwarded-for']?.split(',')[0].trim() || event.headers['client-ip'] || ''
      const ua = event.headers['user-agent'] || ''
      await logAudit(signerRow.document_id, 'otp_sent', signerRow.signer_email, ip, ua, { channel, otp_expires_at: otpExpires })

      return { statusCode: 200, body: JSON.stringify({ success: true, channel }) }
    }

    // --- Fallback: trustera_documents by signing_token (old single-signer flow) ---
    const { data: doc, error: docError } = await supabase
      .from('trustera_documents')
      .select('*')
      .eq('signing_token', token)
      .maybeSingle()

    if (docError) {
      console.error('[dr7trust-sign-otp] Document lookup error:', docError.message)
    }

    if (!doc) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Documento non trovato' }) }
    }

    // Check expiration
    if (doc.signing_token_expires_at && new Date(doc.signing_token_expires_at) < new Date()) {
      return { statusCode: 410, body: JSON.stringify({ error: 'Link scaduto' }) }
    }

    // Save OTP to document record
    const { error: otpUpdateError } = await supabase
      .from('trustera_documents')
      .update({ otp_code: otp, otp_expires_at: otpExpires })
      .eq('id', doc.id)

    if (otpUpdateError) {
      console.error('[dr7trust-sign-otp] OTP update failed (documents):', otpUpdateError.message)
      return { statusCode: 500, body: JSON.stringify({ error: 'Errore nel salvataggio del codice' }) }
    }

    // Try WhatsApp first, fallback to email
    let channel: 'whatsapp' | 'email' = 'email'
    const signerPhone = doc.signer_phone || ''

    if (signerPhone) {
      const sent = await sendWhatsAppOtp(signerPhone, otp)
      if (sent) channel = 'whatsapp'
    }

    if (channel === 'email') {
      await resend.emails.send({
        from: 'DR7 Trust <info@dr7trust.com>',
        replyTo: 'info@dr7trust.com',
        to: doc.signer_email,
        subject: 'Codice di verifica DR7 Trust',
        text: `Il tuo codice di verifica DR7 Trust: ${otp}\n\nScade tra 10 minuti. Non condividere questo codice.\n\nDR7 Trust - Infrastructure for Digital Trust\nhttps://dr7trust.com`,
        html: buildOtpEmailHtml(otp)
      })
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, channel }) }
  } catch (error: any) {
    console.error('[dr7trust-sign-otp] Error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Errore nell'invio del codice" })
    }
  }
}
