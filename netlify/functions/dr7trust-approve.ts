import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { processSendSigners } from './dr7trust-send-signing'

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://zkcvsewfqnukdkvcairk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY!)

const SITE_URL = process.env.SITE_URL || 'https://dr7trust.com'

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

function buildRejectionNotificationHtml(
  ownerName: string,
  approverName: string,
  documentName: string,
  reason: string
): string {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f9fafb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;">
  <tr><td style="padding:32px 40px 0;text-align:center;">
    <img src="https://dr7trust.com/dr7trust-logo.png" alt="DR7 Trust" style="height:80px;width:auto;max-width:200px;" />
  </td></tr>
  <tr><td style="padding:24px 40px 0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;color:#333;line-height:1.6;">
    <p style="margin:0 0 12px;">Ciao <strong>${ownerName}</strong>,</p>
    <p style="margin:0 0 16px;"><strong>${approverName}</strong> ha rifiutato l'invio del documento per la firma:</p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;margin:0 0 16px;">
      <p style="margin:0;font-size:16px;font-weight:700;color:#dc2626;">${documentName}</p>
    </div>
    ${reason ? `<p style="margin:0 0 8px;font-size:14px;color:#555;"><strong>Motivo:</strong> ${reason}</p>` : ''}
    <p style="margin:16px 0 0;font-size:13px;color:#666;">Puoi modificare il documento e riprovare a inviarlo dalla tua dashboard.</p>
  </td></tr>
  <tr><td style="padding:24px 40px;text-align:center;">
    <a href="${SITE_URL}/dashboard" style="display:inline-block;background-color:#16a34a;color:#fff;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;">
      Vai alla Dashboard
    </a>
  </td></tr>
  <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" /></td></tr>
  <tr><td style="padding:24px 40px 32px;text-align:center;">
    <p style="margin:0;color:#d1d5db;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:11px;">
      DR7 Trust - Infrastructure for Digital Trust<br/>
      <a href="https://dr7trust.com" style="color:#16a34a;text-decoration:none;">www.dr7trust.com</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

export const handler: Handler = async (event) => {
  // Support both GET (from email button links) and POST (from ApprovePage form)
  const method = event.httpMethod

  if (method !== 'GET' && method !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    let token: string | undefined
    let action: 'approve' | 'reject' | undefined
    let reason: string | undefined

    if (method === 'GET') {
      token = event.queryStringParameters?.token
      const rawAction = event.queryStringParameters?.action
      if (rawAction === 'approve' || rawAction === 'reject') action = rawAction
    } else {
      const body = JSON.parse(event.body || '{}')
      token = body.token
      action = body.action
      reason = body.reason
    }

    if (!token) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Token richiesto' }) }
    }
    if (action !== 'approve' && action !== 'reject') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Azione non valida. Usa "approve" o "reject"' }) }
    }

    // Find the document that has this approver token in its approvers jsonb
    // We query all documents with approvers and find the matching one in JS
    // (Supabase jsonb array query with token is complex; a full table scan on pending docs is fine at this scale)
    const { data: docs, error: queryError } = await supabase
      .from('trustera_documents')
      .select('id, name, owner_id, approvers, draft_signers, approval_status')
      .eq('approval_status', 'awaiting_approval')

    if (queryError) {
      console.error('[dr7trust-approve] Query error:', queryError.message)
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
      return { statusCode: 404, body: JSON.stringify({ error: 'Token non valido o documento non trovato' }) }
    }

    if (matchedApprover.status !== 'pending') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          alreadyActed: true,
          status: matchedApprover.status,
          documentName: matchedDoc.name
        })
      }
    }

    // Update this approver's status in the array
    const updatedApprovers = (matchedDoc.approvers as any[]).map((a: any) =>
      a.token === token
        ? { ...a, status: action === 'approve' ? 'approved' : 'rejected', reason: reason || null, acted_at: new Date().toISOString() }
        : a
    )

    if (action === 'reject') {
      // Rejected: update document
      const { error: rejectError } = await supabase
        .from('trustera_documents')
        .update({
          approvers: updatedApprovers,
          approval_status: 'rejected',
          status: 'draft',
        })
        .eq('id', matchedDoc.id)

      if (rejectError) {
        console.error('[dr7trust-approve] Reject update failed:', rejectError.message)
        throw rejectError
      }

      // Notify document owner
      if (matchedDoc.owner_id) {
        try {
          const { data: { user: ownerUser } } = await supabase.auth.admin.getUserById(matchedDoc.owner_id)
          if (ownerUser?.email) {
            const ownerName = ownerUser.user_metadata?.full_name || ownerUser.email
            await resend.emails.send({
              from: 'DR7 Trust <info@dr7trust.com>',
              replyTo: 'info@dr7trust.com',
              to: ownerUser.email,
              subject: `Documento rifiutato: ${matchedDoc.name}`,
              text: `Ciao ${ownerName},\n\n${matchedApprover.name} ha rifiutato l'invio del documento "${matchedDoc.name}".${reason ? `\n\nMotivo: ${reason}` : ''}\n\nPuoi modificare il documento e riprovare dalla tua dashboard.\n\nDR7 Trust - Infrastructure for Digital Trust\nhttps://dr7trust.com`,
              html: buildRejectionNotificationHtml(ownerName, matchedApprover.name, matchedDoc.name, reason || '')
            })
          }
        } catch (emailErr: any) {
          console.warn('[dr7trust-approve] Owner rejection email failed:', emailErr.message)
        }
      }

      await logAudit(matchedDoc.id, 'approval_rejected', matchedApprover.email, undefined, undefined, { approver_name: matchedApprover.name, reason: reason || null })
      console.log('[dr7trust-approve] Document rejected by', matchedApprover.email, 'doc:', matchedDoc.id)

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          action: 'rejected',
          documentName: matchedDoc.name,
          approverName: matchedApprover.name
        })
      }
    }

    // action === 'approve': update this approver's status
    const { error: approveUpdateError } = await supabase
      .from('trustera_documents')
      .update({ approvers: updatedApprovers })
      .eq('id', matchedDoc.id)

    if (approveUpdateError) {
      console.error('[dr7trust-approve] Approve update failed:', approveUpdateError.message)
      throw approveUpdateError
    }

    // Check if ALL approvers have now approved
    const allApproved = updatedApprovers.every((a: any) => a.status === 'approved')

    if (!allApproved) {
      await logAudit(matchedDoc.id, 'approval_approved', matchedApprover.email, undefined, undefined, { approver_name: matchedApprover.name, all_approved: false })
      console.log('[dr7trust-approve] Waiting for more approvals, doc:', matchedDoc.id)
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          action: 'approved',
          allApproved: false,
          documentName: matchedDoc.name,
          approverName: matchedApprover.name
        })
      }
    }

    // All approved — trigger the signing flow
    const draftSigners: any[] = Array.isArray(matchedDoc.draft_signers) ? matchedDoc.draft_signers : []

    if (draftSigners.length === 0) {
      console.error('[dr7trust-approve] No draft_signers found for doc:', matchedDoc.id)
      return { statusCode: 500, body: JSON.stringify({ error: 'Nessun firmatario trovato nel documento' }) }
    }

    // Get the sender name
    let senderName = 'Un utente DR7 Trust'
    if (matchedDoc.owner_id) {
      const { data: { user: ownerUser } } = await supabase.auth.admin.getUserById(matchedDoc.owner_id)
      if (ownerUser?.user_metadata?.full_name) {
        senderName = ownerUser.user_metadata.full_name
      } else if (ownerUser?.email) {
        senderName = ownerUser.email
      }
    }

    // Fetch require_otp from the full document record
    const { data: fullDoc } = await supabase
      .from('trustera_documents')
      .select('require_otp')
      .eq('id', matchedDoc.id)
      .single()

    const requireOtp = fullDoc?.require_otp !== false

    // Send signing links to all signers
    await processSendSigners(matchedDoc.id, draftSigners, matchedDoc, senderName, requireOtp)

    // Update document: all approved, clear approval_status, set status=pending
    const { error: finalUpdateError } = await supabase
      .from('trustera_documents')
      .update({
        approval_status: 'approved',
        status: 'pending',
        approvers: updatedApprovers,
        draft_signers: null,
      })
      .eq('id', matchedDoc.id)

    if (finalUpdateError) {
      console.error('[dr7trust-approve] Final document update failed:', finalUpdateError.message)
      throw finalUpdateError
    }

    await logAudit(matchedDoc.id, 'approval_approved', matchedApprover.email, undefined, undefined, { approver_name: matchedApprover.name, all_approved: true })
    console.log('[dr7trust-approve] All approvers approved, signing links sent for doc:', matchedDoc.id)

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        action: 'approved',
        allApproved: true,
        documentName: matchedDoc.name,
        approverName: matchedApprover.name
      })
    }
  } catch (error: any) {
    console.error('[dr7trust-approve] Unexpected error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Errore interno' })
    }
  }
}
