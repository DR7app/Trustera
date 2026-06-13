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
        const { email, password, fullName } = JSON.parse(event.body || '{}')

        if (!email || !password || !fullName) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Email, password e nome sono obbligatori' }) }
        }

        if (password.length < 6) {
            return { statusCode: 400, body: JSON.stringify({ error: 'La password deve avere almeno 6 caratteri' }) }
        }

        // Create user via admin API (does NOT send Supabase's default email)
        const { data: userData, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: false,
            user_metadata: { full_name: fullName }
        })

        if (createError) {
            // Handle duplicate email
            if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
                return { statusCode: 409, body: JSON.stringify({ error: 'Questa email e gia registrata. Prova ad accedere.' }) }
            }
            console.error('[dr7trust-signup] Create user error:', createError.message)
            return { statusCode: 400, body: JSON.stringify({ error: createError.message }) }
        }

        if (!userData.user) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Errore nella creazione dell\'account' }) }
        }

        // Generate email confirmation link via admin API
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'signup',
            email,
            password,
            options: {
                redirectTo: `${SITE_URL}/dashboard`
            }
        })

        if (linkError) {
            console.error('[dr7trust-signup] Generate link error:', linkError.message)
            // User is created but link failed — still try to send a basic link
        }

        // Extract the token from the generated link
        // Supabase generates: https://project.supabase.co/auth/v1/verify?token=xxx&type=signup&redirect_to=...
        // We want to send our own branded email with a link to our verify endpoint
        let verifyUrl = `${SITE_URL}/login` // fallback
        if (linkData?.properties?.hashed_token) {
            verifyUrl = `${SITE_URL}/.netlify/functions/dr7trust-verify-email?token_hash=${linkData.properties.hashed_token}&type=signup&redirect_to=${encodeURIComponent(`${SITE_URL}/dashboard`)}`
        } else if (linkData?.properties?.action_link) {
            // Use the action link directly but route through our function
            const url = new URL(linkData.properties.action_link)
            const tokenHash = url.searchParams.get('token_hash') || url.searchParams.get('token')
            if (tokenHash) {
                verifyUrl = `${SITE_URL}/.netlify/functions/dr7trust-verify-email?token_hash=${tokenHash}&type=signup&redirect_to=${encodeURIComponent(`${SITE_URL}/dashboard`)}`
            } else {
                verifyUrl = linkData.properties.action_link
            }
        }

        // Send branded verification email via Resend
        const resendApiKey = process.env.RESEND_API_KEY
        if (!resendApiKey) {
            console.error('[dr7trust-signup] RESEND_API_KEY not set')
            return { statusCode: 500, body: JSON.stringify({ error: 'Errore di configurazione email' }) }
        }

        const resend = new Resend(resendApiKey)

        const { error: emailError } = await resend.emails.send({
            from: 'DR7 Trust <info@dr7trust.com>',
            replyTo: 'info@dr7trust.com',
            to: email,
            subject: 'Conferma il tuo account DR7 Trust',
            text: `Benvenuto su DR7 Trust!\n\nCiao ${fullName}, conferma il tuo indirizzo email per attivare il tuo account.\n\nClicca qui per confermare: ${verifyUrl}\n\nSe non hai creato un account su DR7 Trust, ignora questa email.\nIl link scade tra 24 ore.\n\nDR7 Trust - Infrastructure for Digital Trust\nhttps://dr7trust.com`,
            html: `<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Conferma il tuo account DR7 Trust</title>
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
                Benvenuto su DR7 Trust
              </h1>
              <p style="margin: 0; color: #6b7280; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.5;">
                Ciao ${fullName}, conferma il tuo indirizzo email per attivare il tuo account.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px; text-align: center;">
              <a href="${verifyUrl}"
                 style="display: inline-block; background-color: #16a34a; color: #ffffff; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 40px; border-radius: 8px; mso-padding-alt: 0;">
                <!--[if mso]><i style="mso-font-width: 200%; mso-text-raise: 21pt;">&nbsp;</i><![endif]-->
                Conferma Email
                <!--[if mso]><i style="mso-font-width: 200%;">&nbsp;</i><![endif]-->
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <p style="margin: 0 0 4px; color: #9ca3af; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 13px;">
                Se non hai creato un account su DR7 Trust, ignora questa email.
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
            console.error('[dr7trust-signup] Resend error:', emailError)
            return { statusCode: 500, body: JSON.stringify({ error: 'Errore nell\'invio dell\'email di conferma' }) }
        }

        console.log(`[dr7trust-signup] Verification email sent to ${email}`)

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Account creato! Controlla la tua email per confermare.' })
        }
    } catch (error: any) {
        console.error('[dr7trust-signup] Error:', error)
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Errore nella registrazione' })
        }
    }
}
