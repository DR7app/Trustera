import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://zkcvsewfqnukdkvcairk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const token = event.queryStringParameters?.token
  if (!token) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Token richiesto' }) }
  }

  try {
    // Find document with this approver token
    const { data: docs, error: queryError } = await supabase
      .from('trustera_documents')
      .select('id, name, owner_id, approvers, draft_signers, approval_status, created_at')
      .eq('approval_status', 'awaiting_approval')

    if (queryError) {
      console.error('[dr7trust-approve-get] Query error:', queryError.message)
      return { statusCode: 500, body: JSON.stringify({ error: 'Errore nel recupero del documento' }) }
    }

    let matchedDoc: any = null
    let matchedApprover: any = null

    for (const doc of (docs || [])) {
      const approversArr: any[] = Array.isArray(doc.approvers) ? doc.approvers : []
      const approver = approversArr.find((a: any) => a.token === token)
      if (approver) {
        matchedDoc = doc
        matchedApprover = approver
        break
      }
    }

    if (!matchedDoc || !matchedApprover) {
      // Also check if already acted (document might have moved past awaiting_approval)
      const { data: allDocs } = await supabase
        .from('trustera_documents')
        .select('id, name, approvers, approval_status')
        .not('approvers', 'is', null)

      for (const doc of (allDocs || [])) {
        const approversArr: any[] = Array.isArray(doc.approvers) ? doc.approvers : []
        const approver = approversArr.find((a: any) => a.token === token)
        if (approver) {
          return {
            statusCode: 200,
            body: JSON.stringify({
              alreadyActed: true,
              status: approver.status,
              documentName: doc.name,
              approvalStatus: doc.approval_status
            })
          }
        }
      }

      return { statusCode: 404, body: JSON.stringify({ error: 'Token non valido o documento non trovato' }) }
    }

    if (matchedApprover.status !== 'pending') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          alreadyActed: true,
          status: matchedApprover.status,
          documentName: matchedDoc.name,
          approvalStatus: matchedDoc.approval_status
        })
      }
    }

    // Get sender name
    let senderName = 'Un utente DR7 Trust'
    if (matchedDoc.owner_id) {
      const { data: { user: ownerUser } } = await supabase.auth.admin.getUserById(matchedDoc.owner_id)
      if (ownerUser?.user_metadata?.full_name) {
        senderName = ownerUser.user_metadata.full_name
      } else if (ownerUser?.email) {
        senderName = ownerUser.email
      }
    }

    const signers: Array<{ name: string; email?: string }> = (matchedDoc.draft_signers || []).map((s: any) => ({
      name: s.name,
      email: s.email
    }))

    return {
      statusCode: 200,
      body: JSON.stringify({
        alreadyActed: false,
        documentName: matchedDoc.name,
        senderName,
        approverName: matchedApprover.name,
        signers,
        createdAt: matchedDoc.created_at
      })
    }
  } catch (error: any) {
    console.error('[dr7trust-approve-get] Unexpected error:', error)
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Errore interno' }) }
  }
}
