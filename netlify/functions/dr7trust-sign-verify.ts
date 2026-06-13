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

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { token, otp } = JSON.parse(event.body || '{}')
    if (!token || !otp) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Token e OTP richiesti' }) }
    }

    console.log('[dr7trust-sign-verify] Looking up token:', token.substring(0, 8) + '...')

    // --- Try trustera_document_signers first (new multi-signer flow) ---
    const { data: signerRow, error: signerError } = await supabase
      .from('trustera_document_signers')
      .select('*')
      .eq('signing_token', token)
      .maybeSingle()

    if (signerError) {
      console.error('[dr7trust-sign-verify] Signer lookup error:', signerError.message, signerError.code)
    }

    if (signerRow) {
      console.log('[dr7trust-sign-verify] Found signer row:', signerRow.id, 'email:', signerRow.signer_email, 'otp_code:', signerRow.otp_code ? 'SET' : 'NULL', 'otp_expires_at:', signerRow.otp_expires_at)
      const ip = event.headers['x-forwarded-for']?.split(',')[0].trim() || event.headers['client-ip'] || ''
      const ua = event.headers['user-agent'] || ''

      // Check OTP expiration
      if (signerRow.otp_expires_at && new Date(signerRow.otp_expires_at) < new Date()) {
        console.log('[dr7trust-sign-verify] OTP expired for signer:', signerRow.id)
        await logAudit(signerRow.document_id, 'otp_expired', signerRow.signer_email, ip, ua)
        return { statusCode: 400, body: JSON.stringify({ error: 'Codice scaduto. Richiedi un nuovo codice.' }) }
      }

      // Verify OTP
      if (signerRow.otp_code !== otp) {
        console.log('[dr7trust-sign-verify] OTP mismatch for signer:', signerRow.id, 'expected:', signerRow.otp_code ? 'exists' : 'NULL', 'got:', otp)
        await logAudit(signerRow.document_id, 'otp_failed', signerRow.signer_email, ip, ua)
        return { statusCode: 400, body: JSON.stringify({ error: 'Codice non valido' }) }
      }

      // Mark OTP as verified, clear code
      const { error: updateError } = await supabase
        .from('trustera_document_signers')
        .update({ otp_verified: true, otp_code: null })
        .eq('id', signerRow.id)

      if (updateError) {
        console.error('[dr7trust-sign-verify] Update failed (signers):', updateError.message, updateError.code, updateError.details)
        return { statusCode: 500, body: JSON.stringify({ error: 'Errore nel salvataggio della verifica' }) }
      }

      await logAudit(signerRow.document_id, 'otp_verified', signerRow.signer_email, ip, ua, { verified_at: new Date().toISOString() })
      console.log('[dr7trust-sign-verify] OTP verified for signer:', signerRow.id)
      return { statusCode: 200, body: JSON.stringify({ success: true }) }
    }

    // --- Fallback: trustera_documents by signing_token (old single-signer flow) ---
    const { data: doc, error: docError } = await supabase
      .from('trustera_documents')
      .select('*')
      .eq('signing_token', token)
      .maybeSingle()

    if (docError) {
      console.error('[dr7trust-sign-verify] Document lookup error:', docError.message, docError.code, docError.details)
      return { statusCode: 404, body: JSON.stringify({ error: 'Documento non trovato', debug: docError.message }) }
    }

    if (!doc) {
      console.error('[dr7trust-sign-verify] No document or signer found for token')
      return { statusCode: 404, body: JSON.stringify({ error: 'Documento non trovato' }) }
    }

    console.log('[dr7trust-sign-verify] Found doc (legacy):', doc.id, 'otp_code:', doc.otp_code ? 'SET' : 'NULL', 'otp_expires_at:', doc.otp_expires_at)

    // Check OTP expiration
    if (doc.otp_expires_at && new Date(doc.otp_expires_at) < new Date()) {
      console.log('[dr7trust-sign-verify] OTP expired for doc:', doc.id)
      return { statusCode: 400, body: JSON.stringify({ error: 'Codice scaduto. Richiedi un nuovo codice.' }) }
    }

    // Verify OTP
    if (doc.otp_code !== otp) {
      console.log('[dr7trust-sign-verify] OTP mismatch for doc:', doc.id, 'expected:', doc.otp_code ? 'exists' : 'NULL', 'got:', otp)
      return { statusCode: 400, body: JSON.stringify({ error: 'Codice non valido' }) }
    }

    // Mark OTP as verified, clear code
    const { error: updateError } = await supabase
      .from('trustera_documents')
      .update({ otp_verified: true, otp_code: null })
      .eq('id', doc.id)

    if (updateError) {
      console.error('[dr7trust-sign-verify] Update failed (documents):', updateError.message, updateError.code, updateError.details)
      return { statusCode: 500, body: JSON.stringify({ error: 'Errore nel salvataggio della verifica' }) }
    }

    console.log('[dr7trust-sign-verify] OTP verified for doc (legacy):', doc.id)
    return { statusCode: 200, body: JSON.stringify({ success: true }) }
  } catch (error: any) {
    console.error('[dr7trust-sign-verify] Unexpected error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Errore nella verifica' })
    }
  }
}
