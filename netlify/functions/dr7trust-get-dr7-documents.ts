import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

// DR7 Supabase — signature_requests, contracts live here
const supabaseDR7 = createClient(
    process.env.DR7_SUPABASE_URL || 'https://ahpmzjgkfxrrgxyirasa.supabase.co',
    process.env.DR7_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// DR7 Trust Supabase — to verify the user is authenticated
const supabaseTrustera = createClient(
    process.env.SUPABASE_URL || 'https://zkcvsewfqnukdkvcairk.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    try {
        const { email, accessToken } = JSON.parse(event.body || '{}')

        if (!email || !accessToken) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Email e token richiesti' }) }
        }

        // Verify the user is actually authenticated on DR7 Trust
        const { data: { user }, error: authError } = await supabaseTrustera.auth.getUser(accessToken)
        if (authError || !user || user.email?.toLowerCase() !== email.toLowerCase()) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Non autorizzato' }) }
        }

        // Fetch signed documents from DR7 where user was the signer
        const { data: signatureRequests, error: srError } = await supabaseDR7
            .from('signature_requests')
            .select('id, contract_id, document_name, document_url, signer_name, signer_email, status, signed_pdf_url, signed_at, created_at')
            .ilike('signer_email', email)
            .eq('status', 'signed')
            .order('signed_at', { ascending: false })

        if (srError) {
            console.error('[dr7trust-get-dr7-documents] Error fetching signature_requests:', srError.message)
            return { statusCode: 500, body: JSON.stringify({ error: 'Errore nel recupero documenti' }) }
        }

        // For contract-based signatures, fetch contract numbers
        const contractIds = (signatureRequests || [])
            .filter(sr => sr.contract_id)
            .map(sr => sr.contract_id)

        let contractMap: Record<string, string> = {}
        if (contractIds.length > 0) {
            const { data: contracts } = await supabaseDR7
                .from('contracts')
                .select('id, contract_number')
                .in('id', contractIds)

            if (contracts) {
                contractMap = Object.fromEntries(contracts.map(c => [c.id, c.contract_number]))
            }
        }

        // Also fetch from trustera_documents on DR7 (old DR7 Trust docs before migration)
        const { data: oldDr7trustDocs } = await supabaseDR7
            .from('trustera_documents')
            .select('id, name, status, signer_name, signer_email, signed_pdf_url, signed_at, created_at, pdf_url, owner_id')
            .or(`signer_email.ilike.${email},owner_id.not.is.null`)
            .order('created_at', { ascending: false })

        // Filter old dr7trust docs to ones related to this user
        const relevantOldDocs = (oldDr7trustDocs || []).filter(d =>
            d.signer_email?.toLowerCase() === email.toLowerCase()
        )

        // Map to a unified format
        const documents = [
            ...(signatureRequests || []).map(sr => ({
                id: `dr7_sr_${sr.id}`,
                name: sr.contract_id
                    ? `Contratto ${contractMap[sr.contract_id] || sr.contract_id}`
                    : (sr.document_name || 'Documento'),
                status: 'signed' as const,
                signer_name: sr.signer_name,
                signer_email: sr.signer_email,
                signed_pdf_url: sr.signed_pdf_url,
                signed_at: sr.signed_at,
                created_at: sr.created_at,
                source: 'dr7_contract',
            })),
            ...relevantOldDocs.map(d => ({
                id: `dr7_td_${d.id}`,
                name: d.name,
                status: d.status as 'draft' | 'pending' | 'signed',
                signer_name: d.signer_name,
                signer_email: d.signer_email,
                signed_pdf_url: d.signed_pdf_url,
                signed_at: d.signed_at,
                created_at: d.created_at,
                source: 'dr7_trustera',
            })),
        ]

        return {
            statusCode: 200,
            body: JSON.stringify({ documents })
        }
    } catch (error: any) {
        console.error('[dr7trust-get-dr7-documents] Error:', error)
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Errore interno' })
        }
    }
}
