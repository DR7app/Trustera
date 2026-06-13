import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://zkcvsewfqnukdkvcairk.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SITE_URL = process.env.SITE_URL || 'https://dr7trust.com'

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    try {
        const { email } = JSON.parse(event.body || '{}')

        if (!email) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Email obbligatoria' }) }
        }

        // Generate password recovery link via admin API
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: {
                redirectTo: `${SITE_URL}/reset-password`
            }
        })

        if (linkError) {
            console.error('[dr7trust-reset-password] Generate link error:', linkError.message)
            // Don't reveal whether the email exists
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, message: 'Se l\'email esiste, riceverai un link per reimpostare la password.' })
            }
        }

        // Extract token from generated link
        let resetUrl = `${SITE_URL}/login`
        if (linkData?.properties?.hashed_token) {
            resetUrl = `${SITE_URL}/.netlify/functions/dr7trust-verify-reset?token_hash=${linkData.properties.hashed_token}&type=recovery&redirect_to=${encodeURIComponent(`${SITE_URL}/reset-password`)}`
        } else if (linkData?.properties?.action_link) {
            const url = new URL(linkData.properties.action_link)
            const tokenHash = url.searchParams.get('token_hash') || url.searchParams.get('token')
            if (tokenHash) {
                resetUrl = `${SITE_URL}/.netlify/functions/dr7trust-verify-reset?token_hash=${tokenHash}&type=recovery&redirect_to=${encodeURIComponent(`${SITE_URL}/reset-password`)}`
            } else {
                resetUrl = linkData.properties.action_link
            }
        }

        // Look up user name for personalized email
        let fullName = 'Utente'
        try {
            const { data: { users } } = await supabase.auth.admin.listUsers()
            const user = users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
            if (user?.user_metadata?.full_name) {
                fullName = user.user_metadata.full_name
            }
        } catch { /* ignore */ }

        const resendApiKey = process.env.RESEND_API_KEY
        if (!resendApiKey) {
            console.error('[dr7trust-reset-password] RESEND_API_KEY not set')
            return { statusCode: 500, body: JSON.stringify({ error: 'Errore di configurazione email' }) }
        }

        const resend = new Resend(resendApiKey)

        const { error: emailError } = await resend.emails.send({
            from: 'DR7 Trust <info@dr7trust.com>',
            replyTo: 'info@dr7trust.com',
            to: email,
            subject: 'Reimposta la tua password - DR7 Trust',
            text: `Ciao ${fullName},\n\nHai richiesto di reimpostare la password del tuo account DR7 Trust.\n\nClicca qui per reimpostare la password: ${resetUrl}\n\nSe non hai richiesto questa operazione, ignora questa email.\nIl link scade tra 1 ora.\n\nDR7 Trust - Infrastructure for Digital Trust\nhttps://dr7trust.com`,
            html: `<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Reimposta la tua password - DR7 Trust</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="padding: 40px 40px 0; text-align: center;">
              <img src="https://dr7trust.com/dr7trust-logo.png" alt="DR7 Trust" style="height: 80px; width: auto; max-width: 200px;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px 0; text-align: center;">
              <h1 style="margin: 0 0 8px; color: #111827; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 24px; font-weight: 700;">
                Reimposta la password
              </h1>
              <p style="margin: 0; color: #6b7280; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.5;">
                Ciao ${fullName}, clicca il pulsante qui sotto per reimpostare la password del tuo account.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px; text-align: center;">
              <a href="${resetUrl}"
                 style="display: inline-block; background-color: #16a34a; color: #ffffff; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 40px; border-radius: 8px;">
                Reimposta Password
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <p style="margin: 0 0 4px; color: #9ca3af; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 13px;">
                Se non hai richiesto questa operazione, ignora questa email.
              </p>
              <p style="margin: 0; color: #9ca3af; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 13px;">
                Il link scade tra 1 ora.
              </p>
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
        })

        if (emailError) {
            console.error('[dr7trust-reset-password] Resend error:', emailError)
            return { statusCode: 500, body: JSON.stringify({ error: 'Errore nell\'invio dell\'email' }) }
        }

        console.log(`[dr7trust-reset-password] Reset email sent to ${email}`)

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Se l\'email esiste, riceverai un link per reimpostare la password.' })
        }
    } catch (error: any) {
        console.error('[dr7trust-reset-password] Error:', error)
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Errore nell\'invio' })
        }
    }
}
