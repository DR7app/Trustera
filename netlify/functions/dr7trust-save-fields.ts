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
    const { documentId, fields, accessToken } = JSON.parse(event.body || '{}')

    if (!documentId || !accessToken) {
      return { statusCode: 400, body: JSON.stringify({ error: 'documentId e accessToken richiesti' }) }
    }

    // Verify user owns this document
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Non autorizzato' }) }
    }

    const { data: doc } = await supabase
      .from('trustera_documents')
      .select('id, owner_id')
      .eq('id', documentId)
      .single()

    if (!doc || doc.owner_id !== user.id) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Accesso negato' }) }
    }

    // Delete existing fields for this document (in case of re-placement)
    await supabase
      .from('trustera_document_fields')
      .delete()
      .eq('document_id', documentId)

    if (!Array.isArray(fields) || fields.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ success: true, fieldCount: 0 }) }
    }

    // Insert new fields
    const rows = fields.map((f: any) => ({
      document_id: documentId,
      signer_index: f.signer_index,
      field_type: f.field_type,
      label: f.label || null,
      page_number: f.page_number,
      x_percent: f.x_percent,
      y_percent: f.y_percent,
      width_percent: f.width_percent,
      height_percent: f.height_percent,
      required: f.required ?? true,
      placeholder: f.placeholder || null,
      radio_group: f.radio_group || null,
      default_value: f.default_value || null,
      sort_order: f.sort_order ?? 0,
    }))

    const { error: insertError } = await supabase
      .from('trustera_document_fields')
      .insert(rows)

    if (insertError) {
      console.error('[dr7trust-save-fields] Insert error:', insertError.message)
      return { statusCode: 500, body: JSON.stringify({ error: 'Errore nel salvataggio dei campi' }) }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, fieldCount: rows.length })
    }
  } catch (error: any) {
    console.error('[dr7trust-save-fields] Error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Errore interno' })
    }
  }
}
