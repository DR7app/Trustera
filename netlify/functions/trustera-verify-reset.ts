import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://zkcvsewfqnukdkvcairk.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SITE_URL = process.env.SITE_URL || 'https://dr7trust.com'

export const handler: Handler = async (event) => {
    const params = event.queryStringParameters || {}
    const tokenHash = params.token_hash
    const type = params.type || 'recovery'
    const redirectTo = params.redirect_to || `${SITE_URL}/reset-password`

    if (!tokenHash) {
        return {
            statusCode: 302,
            headers: { Location: `${SITE_URL}/login?error=${encodeURIComponent('Token mancante')}` },
            body: ''
        }
    }

    try {
        // Verify the recovery token
        const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any
        })

        if (error) {
            console.error('[trustera-verify-reset] Verification error:', error.message)
            return {
                statusCode: 302,
                headers: { Location: `${SITE_URL}/login?error=${encodeURIComponent('Link di recupero non valido o scaduto. Richiedi un nuovo link.')}` },
                body: ''
            }
        }

        // Pass the session access token so the frontend can use it to update the password
        const accessToken = data.session?.access_token || ''
        const refreshToken = data.session?.refresh_token || ''

        return {
            statusCode: 302,
            headers: { Location: `${SITE_URL}/reset-password?access_token=${accessToken}&refresh_token=${refreshToken}` },
            body: ''
        }
    } catch (error: any) {
        console.error('[trustera-verify-reset] Error:', error)
        return {
            statusCode: 302,
            headers: { Location: `${SITE_URL}/login?error=${encodeURIComponent('Errore nella verifica. Riprova.')}` },
            body: ''
        }
    }
}
