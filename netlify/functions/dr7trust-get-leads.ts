import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://zkcvsewfqnukdkvcairk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { accessToken } = JSON.parse(event.body || '{}')
    if (!accessToken) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Access token richiesto' }) }
    }

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !user) {
      console.error('[dr7trust-get-leads] Auth error:', authError?.message)
      return { statusCode: 401, body: JSON.stringify({ error: 'Non autorizzato' }) }
    }

    // Fetch all leads ordered by last_seen_at desc
    const { data: leads, error: leadsError } = await supabase
      .from('trustera_leads')
      .select('*')
      .order('last_seen_at', { ascending: false })

    if (leadsError) {
      console.error('[dr7trust-get-leads] Leads fetch error:', leadsError.message)
      return { statusCode: 500, body: JSON.stringify({ error: 'Errore nel recupero dei lead' }) }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ leads: leads || [] })
    }
  } catch (error: any) {
    console.error('[dr7trust-get-leads] Unexpected error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Errore interno' })
    }
  }
}
