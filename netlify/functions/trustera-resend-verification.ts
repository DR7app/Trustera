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

        // Check if user exists and email is not yet confirmed
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
        if (listError) throw listError

        const user = users.find(u => u.email === email)
        if (!user) {
            // Don't reveal whether the email exists
            return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Se l\'email esiste, riceverai un nuovo link di conferma.' }) }
        }

        if (user.email_confirmed_at) {
            return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Email gia confermata. Prova ad accedere.' }) }
        }

        // Generate new verification link
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'signup',
            email,
            options: {
                redirectTo: `${SITE_URL}/dashboard`
            }
        })

        if (linkError) {
            console.error('[trustera-resend-verification] Generate link error:', linkError.message)
            return { statusCode: 500, body: JSON.stringify({ error: 'Errore nella generazione del link' }) }
        }

        let verifyUrl = `${SITE_URL}/login`
        if (linkData?.properties?.hashed_token) {
            verifyUrl = `${SITE_URL}/.netlify/functions/trustera-verify-email?token_hash=${linkData.properties.hashed_token}&type=signup&redirect_to=${encodeURIComponent(`${SITE_URL}/dashboard`)}`
        } else if (linkData?.properties?.action_link) {
            const url = new URL(linkData.properties.action_link)
            const tokenHash = url.searchParams.get('token_hash') || url.searchParams.get('token')
            if (tokenHash) {
                verifyUrl = `${SITE_URL}/.netlify/functions/trustera-verify-email?token_hash=${tokenHash}&type=signup&redirect_to=${encodeURIComponent(`${SITE_URL}/dashboard`)}`
            } else {
                verifyUrl = linkData.properties.action_link
            }
        }

        const fullName = user.user_metadata?.full_name || 'Utente'

        const resendApiKey = process.env.RESEND_API_KEY
        if (!resendApiKey) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Errore di configurazione email' }) }
        }

        const resend = new Resend(resendApiKey)

        const { error: emailError } = await resend.emails.send({
            from: 'Trustera <info@dr7trust.com>',
            replyTo: 'info@dr7trust.com',
            to: email,
            subject: 'Conferma il tuo account Trustera',
            text: `Ciao ${fullName}, conferma il tuo indirizzo email per attivare il tuo account Trustera.\n\nClicca qui per confermare: ${verifyUrl}\n\nSe non hai creato un account su Trustera, ignora questa email.\nIl link scade tra 24 ore.\n\nTrustera - Infrastructure for Digital Trust\nhttps://dr7trust.com`,
            html: `<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Conferma il tuo account Trustera</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="padding: 40px 40px 0; text-align: center;">
              <img src="https://dr7trust.com/trustera-logo.jpeg" alt="Trustera" style="height: 80px; width: auto; max-width: 200px;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px 0; text-align: center;">
              <h1 style="margin: 0 0 8px; color: #111827; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 24px; font-weight: 700;">
                Conferma il tuo account
              </h1>
              <p style="margin: 0; color: #6b7280; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.5;">
                Ciao ${fullName}, conferma il tuo indirizzo email per attivare il tuo account.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px; text-align: center;">
              <a href="${verifyUrl}"
                 style="display: inline-block; background-color: #16a34a; color: #ffffff; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 40px; border-radius: 8px;">
                Conferma Email
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <p style="margin: 0 0 4px; color: #9ca3af; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 13px;">
                Se non hai creato un account su Trustera, ignora questa email.
              </p>
              <p style="margin: 0; color: #9ca3af; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 13px;">
                Il link scade tra 24 ore.
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
        })

        if (emailError) {
            console.error('[trustera-resend-verification] Resend error:', emailError)
            return { statusCode: 500, body: JSON.stringify({ error: 'Errore nell\'invio dell\'email' }) }
        }

        console.log(`[trustera-resend-verification] Verification email resent to ${email}`)

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Email di conferma inviata! Controlla la tua casella di posta.' })
        }
    } catch (error: any) {
        console.error('[trustera-resend-verification] Error:', error)
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Errore nell\'invio' })
        }
    }
}
