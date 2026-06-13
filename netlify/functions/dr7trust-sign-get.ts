import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://zkcvsewfqnukdkvcairk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

async function createSignedStorageUrl(rawUrl: string): Promise<string> {
  const match = rawUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/dr7trust\/(.+)/)
  if (!match) return rawUrl
  const { data } = await supabase.storage.from('dr7trust').createSignedUrl(match[1], 3600)
  return data?.signedUrl || rawUrl
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

    // --- Try trustera_document_signers first (new multi-signer flow) ---
    const { data: signerRow, error: signerError } = await supabase
      .from('trustera_document_signers')
      .select('*, trustera_documents(*)')
      .eq('signing_token', token)
      .maybeSingle()

    if (signerError) {
      console.error('[dr7trust-sign-get] Signer lookup error:', signerError.message)
    }

    if (signerRow) {
      const doc = signerRow.trustera_documents as Record<string, any>

      if (!doc) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Documento non trovato' }) }
      }

      // Check expiration
      if (signerRow.signing_token_expires_at && new Date(signerRow.signing_token_expires_at) < new Date()) {
        return { statusCode: 410, body: JSON.stringify({ error: 'Link scaduto' }) }
      }

      // Generate signed URL for original PDF
      const pdfUrl = doc.pdf_url ? await createSignedStorageUrl(doc.pdf_url) : null

      // Generate signed URL for signed PDF if document is fully signed
      let signedPdfUrl: string | undefined
      if (doc.signed_pdf_url) {
        signedPdfUrl = await createSignedStorageUrl(doc.signed_pdf_url)
      }

      // Fetch all signers for this document (for status overview)
      const { data: allSignersRows } = await supabase
        .from('trustera_document_signers')
        .select('signer_name, status, signed_at')
        .eq('document_id', doc.id)
        .order('created_at', { ascending: true })

      const allSigners = (allSignersRows || []).map((s: any) => ({
        name: s.signer_name,
        status: s.status,
        signed_at: s.signed_at || null
      }))

      // Fetch fields assigned to this signer
      const { data: fieldRows } = await supabase
        .from('trustera_document_fields')
        .select('*')
        .eq('document_id', doc.id)
        .eq('signer_id', signerRow.id)
        .order('page_number', { ascending: true })
        .order('sort_order', { ascending: true })

      // Log document opened event
      const ip = event.headers['x-forwarded-for']?.split(',')[0].trim() || event.headers['client-ip'] || ''
      const userAgent = event.headers['user-agent'] || ''
      if (signerRow.status !== 'signed') {
        await logAudit(doc.id, 'document_opened', signerRow.signer_email, ip, userAgent, { signer_name: signerRow.signer_name })
      }

      const response: Record<string, any> = {
        signerName: signerRow.signer_name,
        signerEmail: signerRow.signer_email,
        documentName: doc.name,
        pdfUrl,
        status: signerRow.status,
        requireOtp: signerRow.require_otp !== false, // default true for backwards compat
        allSigners,
        fields: fieldRows || []
      }

      if (signerRow.status === 'signed') {
        response.signedPdfUrl = signedPdfUrl
        response.signedAt = signerRow.signed_at
      }

      return { statusCode: 200, body: JSON.stringify(response) }
    }

    // --- Fallback: trustera_documents by signing_token (old single-signer flow) ---
    const { data: doc, error: docError } = await supabase
      .from('trustera_documents')
      .select('*')
      .eq('signing_token', token)
      .maybeSingle()

    if (docError) {
      console.error('[dr7trust-sign-get] Document lookup error:', docError.message)
    }

    if (!doc) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Documento non trovato' }) }
    }

    // Check expiration
    if (doc.signing_token_expires_at && new Date(doc.signing_token_expires_at) < new Date()) {
      return { statusCode: 410, body: JSON.stringify({ error: 'Link scaduto' }) }
    }

    // Generate signed URL for original PDF
    const pdfUrl = doc.pdf_url ? await createSignedStorageUrl(doc.pdf_url) : null

    let signedPdfUrl: string | undefined
    if (doc.signed_pdf_url) {
      signedPdfUrl = await createSignedStorageUrl(doc.signed_pdf_url)
    }

    const response: Record<string, any> = {
      signerName: doc.signer_name,
      signerEmail: doc.signer_email,
      documentName: doc.name,
      pdfUrl,
      status: doc.status,
      requireOtp: doc.require_otp !== false
    }

    if (doc.status === 'signed') {
      response.signedPdfUrl = signedPdfUrl
      response.signedAt = doc.signed_at
    }

    return { statusCode: 200, body: JSON.stringify(response) }
  } catch (error: any) {
    console.error('[dr7trust-sign-get] Error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Errore interno' })
    }
  }
}
