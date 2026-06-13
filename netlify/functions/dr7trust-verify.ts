import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://zkcvsewfqnukdkvcairk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// DR7 Supabase — for fetching audit trail + signature requests for DR7 contracts
const supabaseDR7 = createClient(
  process.env.DR7_SUPABASE_URL || 'https://ahpmzjgkfxrrgxyirasa.supabase.co',
  process.env.DR7_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { hash } = JSON.parse(event.body || '{}')
    if (!hash) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Hash richiesto' }) }
    }

    console.log('[dr7trust-verify] Looking up hash:', hash)

    // 1. Look up document by pdf_hash in trustera_documents
    const { data: docs, error: docError } = await supabase
      .from('trustera_documents')
      .select('id, name, signed_at, pdf_hash, status, created_at, owner_id, signed_pdf_url')
      .eq('pdf_hash', hash)
      .eq('status', 'signed')
      .order('signed_at', { ascending: false })
      .limit(1)

    const doc = docs?.[0] || null

    if (docError) {
      console.error('[dr7trust-verify] trustera_documents lookup error:', docError.message)
    }

    if (doc) {
      console.log('[dr7trust-verify] Found in trustera_documents:', doc.id)

      // Fetch owner name
      let senderName = ''
      if (doc.owner_id) {
        const { data: { user: ownerUser } } = await supabase.auth.admin.getUserById(doc.owner_id)
        senderName = ownerUser?.user_metadata?.full_name || ownerUser?.email || ''
      }

      // Fetch sender email
      let senderEmail = ''
      if (doc.owner_id) {
        const { data: { user: ownerUserEmail } } = await supabase.auth.admin.getUserById(doc.owner_id)
        senderEmail = ownerUserEmail?.email || ''
      }

      // Fetch signers with full audit data
      const { data: signers } = await supabase
        .from('trustera_document_signers')
        .select('signer_name, signer_email, signer_phone, notification_channel, signed_at, signing_ip, signing_user_agent, marketing_consent')
        .eq('document_id', doc.id)
        .eq('status', 'signed')
        .order('signed_at', { ascending: true })

      const signerList = (signers || []).map((s: any) => ({
        name: s.signer_name,
        email: s.signer_email || '',
        phone: s.signer_phone || '',
        channel: s.notification_channel || 'email',
        signed_at: s.signed_at,
        signing_ip: s.signing_ip || 'N/A',
        user_agent: s.signing_user_agent || '',
        marketing_consent: s.marketing_consent ?? false,
      }))

      // Fallback: check signed_documents_log for signers
      if (signerList.length === 0) {
        const { data: logEntry } = await supabase
          .from('signed_documents_log')
          .select('signer_name, signer_email, signed_at, signer_ip, metadata')
          .eq('original_pdf_hash', hash)
          .limit(1)

        const log = logEntry?.[0]
        if (log) {
          if (log.metadata?.signers) {
            for (const s of log.metadata.signers) {
              signerList.push({
                name: s.name,
                email: s.email || '',
                phone: '',
                channel: 'email',
                signed_at: s.signed_at,
                signing_ip: s.ip || 'N/A',
                user_agent: s.user_agent || ''
              })
            }
          } else {
            signerList.push({
              name: log.signer_name,
              email: log.signer_email || '',
              phone: '',
              channel: 'email',
              signed_at: log.signed_at,
              signing_ip: log.signer_ip || 'N/A',
              user_agent: ''
            })
          }
        }
      }

      // Fetch audit trail events
      const { data: auditEvents } = await supabase
        .from('signature_audit_trail')
        .select('action, signer_email, ip_address, user_agent, created_at, metadata')
        .eq('document_id', doc.id)
        .order('created_at', { ascending: true })

      return {
        statusCode: 200,
        body: JSON.stringify({
          documentName: doc.name,
          signedAt: doc.signed_at,
          createdAt: doc.created_at,
          originalHash: doc.pdf_hash,
          senderName,
          senderEmail,
          signers: signerList,
          auditTrail: (auditEvents || []).map((e: any) => ({
            action: e.action,
            email: e.signer_email || '',
            ip: e.ip_address || '',
            userAgent: e.user_agent || '',
            timestamp: e.created_at,
            metadata: e.metadata || {}
          }))
        })
      }
    }

    // 2. Fallback: look up by original_pdf_hash in signed_documents_log
    console.log('[dr7trust-verify] Not found in trustera_documents, trying signed_documents_log')
    const { data: logEntries, error: logError } = await supabase
      .from('signed_documents_log')
      .select('document_name, signer_name, signer_email, signed_at, signer_ip, original_pdf_hash, metadata, source')
      .eq('original_pdf_hash', hash)
      .limit(1)

    if (logError) {
      console.error('[dr7trust-verify] signed_documents_log lookup error:', logError.message)
    }

    const logEntry = logEntries?.[0]
    if (!logEntry) {
      console.log('[dr7trust-verify] Hash not found anywhere:', hash)
      return { statusCode: 404, body: JSON.stringify({ error: 'Documento non trovato o non ancora firmato' }) }
    }

    console.log('[dr7trust-verify] Found in signed_documents_log:', logEntry.document_name)

    const signerList: any[] = []
    let auditTrail: any[] = []
    let createdAt: string | null = null
    const contractId = logEntry.metadata?.contract_id || null
    const source = (logEntry as any).source || ''

    // For DR7 contracts, fetch rich signer data + audit trail from DR7 DB
    if (source.startsWith('dr7') && contractId) {
      // Fetch all signature_requests for this contract
      const { data: dr7Signers } = await supabaseDR7
        .from('signature_requests')
        .select('id, signer_name, signer_email, signer_phone, status, signed_at, signer_ip, signer_user_agent, created_at')
        .eq('contract_id', contractId)
        .in('status', ['signed'])
        .order('created_at', { ascending: true })

      if (dr7Signers && dr7Signers.length > 0) {
        for (const s of dr7Signers) {
          signerList.push({
            name: s.signer_name,
            email: s.signer_email || '',
            phone: s.signer_phone || '',
            channel: 'whatsapp',
            signed_at: s.signed_at,
            signing_ip: s.signer_ip || 'N/A',
            user_agent: s.signer_user_agent || '',
            marketing_consent: false
          })
        }

        // Fetch audit trail from DR7 for all signature_requests of this contract
        const sigRequestIds = dr7Signers.map((s: any) => s.id)
        const { data: dr7Audit } = await supabaseDR7
          .from('signature_audit_trail')
          .select('event_type, event_description, ip_address, user_agent, created_at, metadata')
          .in('signature_request_id', sigRequestIds)
          .order('created_at', { ascending: true })

        if (dr7Audit && dr7Audit.length > 0) {
          auditTrail = dr7Audit.map((e: any) => ({
            action: e.event_type,
            email: e.metadata?.signer_email || '',
            ip: e.ip_address || '',
            userAgent: e.user_agent || '',
            timestamp: e.created_at,
            metadata: e.metadata || {}
          }))
        }
      }

      // Get contract creation date
      const { data: contractData } = await supabaseDR7
        .from('contracts')
        .select('created_at')
        .eq('id', contractId)
        .single()
      createdAt = contractData?.created_at || null
    }

    // Fallback: use signed_documents_log data if DR7 query returned nothing
    if (signerList.length === 0) {
      if (logEntry.metadata?.signers) {
        for (const s of logEntry.metadata.signers) {
          signerList.push({
            name: s.name,
            email: s.email || '',
            phone: '',
            channel: 'email',
            signed_at: s.signed_at,
            signing_ip: s.ip || 'N/A',
            user_agent: s.user_agent || ''
          })
        }
      } else {
        signerList.push({
          name: logEntry.signer_name,
          email: logEntry.signer_email || '',
          phone: '',
          channel: 'email',
          signed_at: logEntry.signed_at,
          signing_ip: logEntry.signer_ip || 'N/A',
          user_agent: ''
        })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        documentName: logEntry.document_name,
        signedAt: logEntry.signed_at,
        createdAt,
        originalHash: logEntry.original_pdf_hash,
        senderName: 'DR7 Empire S.p.A.',
        signers: signerList,
        auditTrail
      })
    }
  } catch (error: any) {
    console.error('[dr7trust-verify] Error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Errore interno' })
    }
  }
}
