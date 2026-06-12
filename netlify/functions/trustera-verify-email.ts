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
    const type = params.type || 'signup'
    const redirectTo = params.redirect_to || `${SITE_URL}/dashboard`

    if (!tokenHash) {
        return {
            statusCode: 302,
            headers: { Location: `${SITE_URL}/login?error=Token mancante` },
            body: ''
        }
    }

    try {
        // Verify the token via Supabase Auth API
        const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any
        })

        if (error) {
            console.error('[trustera-verify-email] Verification error:', error.message)
            return {
                statusCode: 302,
                headers: { Location: `${SITE_URL}/login?error=${encodeURIComponent('Link di verifica non valido o scaduto. Riprova la registrazione.')}` },
                body: ''
            }
        }

        console.log('[trustera-verify-email] Email verified successfully')

        // Redirect to dashboard (or login — user will need to sign in)
        return {
            statusCode: 302,
            headers: { Location: `${SITE_URL}/login?verified=true` },
            body: ''
        }
    } catch (error: any) {
        console.error('[trustera-verify-email] Error:', error)
        return {
            statusCode: 302,
            headers: { Location: `${SITE_URL}/login?error=${encodeURIComponent('Errore nella verifica. Riprova.')}` },
            body: ''
        }
    }
}
