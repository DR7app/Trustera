import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import type { Session } from '@supabase/supabase-js'
import type { DocumentField } from '../types/fields'

import { PDFDocument } from 'pdf-lib'

const FieldPlacementEditor = lazy(() => import('../components/FieldPlacementEditor'))

// Convert non-PDF files to PDF
async function convertFileToPdf(file: File): Promise<File> {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  // Already PDF
  if (ext === 'pdf') return file

  // Images → embed in a PDF page
  if (['jpg', 'jpeg', 'png'].includes(ext)) {
    const bytes = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.create()
    let img
    if (ext === 'png') {
      img = await pdfDoc.embedPng(bytes)
    } else {
      img = await pdfDoc.embedJpg(bytes)
    }
    // Fit image on A4 page with margins
    const a4W = 595, a4H = 842, margin = 40
    const maxW = a4W - margin * 2, maxH = a4H - margin * 2
    const scale = Math.min(maxW / img.width, maxH / img.height, 1)
    const w = img.width * scale, h = img.height * scale
    const page = pdfDoc.addPage([a4W, a4H])
    page.drawImage(img, { x: (a4W - w) / 2, y: a4H - margin - h, width: w, height: h })
    const pdfBytes = await pdfDoc.save()
    const pdfName = file.name.replace(/\.[^.]+$/, '.pdf')
    return new File([new Uint8Array(pdfBytes) as any], pdfName, { type: 'application/pdf' })
  }

  // Other formats (docx, doc, odt, etc.) → convert via Netlify function
  const formData = new FormData()
  formData.append('file', file)
  const resp = await fetch('/.netlify/functions/convert-to-pdf', { method: 'POST', body: formData })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Conversione fallita' }))
    throw new Error(err.error || 'Conversione fallita')
  }
  const pdfBlob = await resp.blob()
  const pdfName = file.name.replace(/\.[^.]+$/, '.pdf')
  return new File([pdfBlob], pdfName, { type: 'application/pdf' })
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Signer {
  id: string
  document_id: string
  name: string
  email: string
  phone?: string | null
  status: 'pending' | 'signed'
  signed_at?: string | null
}

interface Document {
  id: string
  name: string
  status: 'draft' | 'scheduled' | 'pending' | 'signed' | 'deleted'
  approval_status?: 'awaiting_approval' | 'approved' | 'rejected' | null
  created_at: string
  // legacy single-signer fields
  signer_email?: string
  signer_name?: string
  pdf_url?: string
  raw_pdf_url?: string
  signed_pdf_url?: string
  signed_at?: string
  owner_id?: string
  source?: string
  // new multi-signer relation
  signers?: Signer[]
  draft_signers?: SignerRow[] | null
  scheduled_at?: string | null
}

interface Contact {
  id: string
  owner_id: string
  name: string
  email: string
  phone?: string | null
  created_at: string
}

interface SignerRow {
  name: string
  email: string
  phone: string
  countryCode: string
  channel: 'email' | 'whatsapp'
  mode: 'contact' | 'new'
}

type SidebarSection = 'documenti' | 'contatti'
type DocTab = 'sent' | 'signed_by_me'
type DocFilter = 'tutte' | 'in_corso' | 'completate' | 'bozza' | 'cestino'
type SortOption = 'created_desc' | 'created_asc' | 'signed_desc' | 'signed_asc' | 'name_asc' | 'name_desc'

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconDocuments({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}

function IconContacts({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
    </svg>
  )
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )
}

// ─── Country codes ───────────────────────────────────────────────────────────

const COUNTRY_CODES = [
  { code: '+39', flag: '🇮🇹', name: 'Italia' },
  { code: '+33', flag: '🇫🇷', name: 'Francia' },
  { code: '+49', flag: '🇩🇪', name: 'Germania' },
  { code: '+44', flag: '🇬🇧', name: 'Regno Unito' },
  { code: '+34', flag: '🇪🇸', name: 'Spagna' },
  { code: '+351', flag: '🇵🇹', name: 'Portogallo' },
  { code: '+41', flag: '🇨🇭', name: 'Svizzera' },
  { code: '+43', flag: '🇦🇹', name: 'Austria' },
  { code: '+32', flag: '🇧🇪', name: 'Belgio' },
  { code: '+31', flag: '🇳🇱', name: 'Paesi Bassi' },
  { code: '+46', flag: '🇸🇪', name: 'Svezia' },
  { code: '+47', flag: '🇳🇴', name: 'Norvegia' },
  { code: '+45', flag: '🇩🇰', name: 'Danimarca' },
  { code: '+358', flag: '🇫🇮', name: 'Finlandia' },
  { code: '+48', flag: '🇵🇱', name: 'Polonia' },
  { code: '+420', flag: '🇨🇿', name: 'Rep. Ceca' },
  { code: '+36', flag: '🇭🇺', name: 'Ungheria' },
  { code: '+40', flag: '🇷🇴', name: 'Romania' },
  { code: '+30', flag: '🇬🇷', name: 'Grecia' },
  { code: '+385', flag: '🇭🇷', name: 'Croazia' },
  { code: '+386', flag: '🇸🇮', name: 'Slovenia' },
  { code: '+421', flag: '🇸🇰', name: 'Slovacchia' },
  { code: '+353', flag: '🇮🇪', name: 'Irlanda' },
  { code: '+352', flag: '🇱🇺', name: 'Lussemburgo' },
  { code: '+356', flag: '🇲🇹', name: 'Malta' },
  { code: '+359', flag: '🇧🇬', name: 'Bulgaria' },
  { code: '+370', flag: '🇱🇹', name: 'Lituania' },
  { code: '+371', flag: '🇱🇻', name: 'Lettonia' },
  { code: '+372', flag: '🇪🇪', name: 'Estonia' },
  { code: '+357', flag: '🇨🇾', name: 'Cipro' },
  { code: '+1', flag: '🇺🇸', name: 'USA' },
  { code: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: '+52', flag: '🇲🇽', name: 'Messico' },
  { code: '+55', flag: '🇧🇷', name: 'Brasile' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: '+56', flag: '🇨🇱', name: 'Cile' },
  { code: '+51', flag: '🇵🇪', name: 'Peru' },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+86', flag: '🇨🇳', name: 'Cina' },
  { code: '+81', flag: '🇯🇵', name: 'Giappone' },
  { code: '+82', flag: '🇰🇷', name: 'Corea del Sud' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+64', flag: '🇳🇿', name: 'Nuova Zelanda' },
  { code: '+7', flag: '🇷🇺', name: 'Russia' },
  { code: '+90', flag: '🇹🇷', name: 'Turchia' },
  { code: '+966', flag: '🇸🇦', name: 'Arabia Saudita' },
  { code: '+971', flag: '🇦🇪', name: 'Emirati Arabi' },
  { code: '+20', flag: '🇪🇬', name: 'Egitto' },
  { code: '+212', flag: '🇲🇦', name: 'Marocco' },
  { code: '+216', flag: '🇹🇳', name: 'Tunisia' },
  { code: '+213', flag: '🇩🇿', name: 'Algeria' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+27', flag: '🇿🇦', name: 'Sudafrica' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+63', flag: '🇵🇭', name: 'Filippine' },
  { code: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+66', flag: '🇹🇭', name: 'Thailandia' },
  { code: '+84', flag: '🇻🇳', name: 'Vietnam' },
  { code: '+60', flag: '🇲🇾', name: 'Malesia' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+852', flag: '🇭🇰', name: 'Hong Kong' },
  { code: '+972', flag: '🇮🇱', name: 'Israele' },
  { code: '+380', flag: '🇺🇦', name: 'Ucraina' },
  { code: '+381', flag: '🇷🇸', name: 'Serbia' },
  { code: '+355', flag: '🇦🇱', name: 'Albania' },
  { code: '+382', flag: '🇲🇪', name: 'Montenegro' },
  { code: '+387', flag: '🇧🇦', name: 'Bosnia' },
  { code: '+389', flag: '🇲🇰', name: 'Macedonia del Nord' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  draft: 'bg-gray-400',
  scheduled: 'bg-blue-500',
  pending: 'bg-yellow-500',
  awaiting_approval: 'bg-amber-500',
  signed: 'bg-green-600',
  deleted: 'bg-red-400',
}

const statusLabels: Record<string, string> = {
  draft: 'Bozza',
  scheduled: 'Programmato',
  pending: 'In attesa',
  awaiting_approval: 'In attesa di approvazione',
  signed: 'Firmato',
  deleted: 'Cestino',
}

function getDocDisplayStatus(doc: Document): string {
  if (doc.approval_status === 'awaiting_approval') return 'awaiting_approval'
  return doc.status
}

function formatDateIT(iso: string) {
  return new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })
}


// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardPage({ session }: { session: Session }) {
  const navigate = useNavigate()

  // Sidebar
  const [section, setSection] = useState<SidebarSection>('documenti')

  // Documents
  const [sentDocuments, setSentDocuments] = useState<Document[]>([])
  const [signedByMeDocuments, setSignedByMeDocuments] = useState<Document[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [activeDocTab, setActiveDocTab] = useState<DocTab>('sent')
  const [expandedDocIds, setExpandedDocIds] = useState<Set<string>>(new Set())
  const [docFilter, setDocFilter] = useState<DocFilter>('tutte')
  const [docSort, setDocSort] = useState<SortOption>('created_desc')
  const [docSearch, setDocSearch] = useState('')
  const [editingScheduleDocId, setEditingScheduleDocId] = useState<string | null>(null)
  const [editingScheduleValue, setEditingScheduleValue] = useState('')
  const [showSortMenu, setShowSortMenu] = useState(false)

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [converting, setConverting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [signerRows, setSignerRows] = useState<SignerRow[]>([{ name: '', email: '', phone: '', countryCode: '+39', channel: 'email', mode: 'contact' }])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scheduled send
  const [showSchedulePicker, setShowSchedulePicker] = useState(false)
  const [scheduledDateTime, setScheduledDateTime] = useState('')

  // Field editor
  const [showFieldEditor, setShowFieldEditor] = useState(false)
  const [editorPdfUrl, setEditorPdfUrl] = useState('')
  const [editorDocumentId, setEditorDocumentId] = useState('')
  const [editorSigners, setEditorSigners] = useState<SignerRow[]>([])

  // Contacts
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactSearch, setContactSearch] = useState('')
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())

  const userName = session.user.user_metadata?.full_name || session.user.email || 'Utente'
  const userEmail = session.user.email || ''

  // ── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    loadDocuments()
    loadContacts()
  }, [])

  async function getSignedUrl(url: string | null) {
    if (!url) return url
    const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/dr7trust\/(.+)/)
    if (!match) return url
    const { data: signed } = await supabase.storage.from('dr7trust').createSignedUrl(match[1], 3600)
    return signed?.signedUrl || url
  }

  function mapSigners(rawSigners: any[]): Signer[] {
    return (rawSigners || []).map((s: any) => ({
      id: s.id,
      document_id: s.document_id,
      name: s.signer_name || s.name,
      email: s.signer_email || s.email,
      phone: s.signer_phone || s.phone || null,
      status: s.status,
      signed_at: s.signed_at || null,
    }))
  }

  async function processDocUrls(docs: any[]): Promise<Document[]> {
    return Promise.all(docs.map(async (doc) => ({
      ...doc,
      signers: mapSigners(doc.signers),
      raw_pdf_url: doc.pdf_url || undefined,
      pdf_url: (await getSignedUrl(doc.pdf_url ?? null)) ?? undefined,
      signed_pdf_url: (await getSignedUrl(doc.signed_pdf_url ?? null)) ?? undefined,
    })))
  }

  async function loadDocuments() {
    setDocsLoading(true)

    const sentPromise = supabase
      .from('trustera_documents')
      .select('*, signers:trustera_document_signers(*)')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false })

    const signedByMePromise = supabase
      .from('trustera_documents')
      .select('*, signers:trustera_document_signers(*)')
      .eq('signer_email', userEmail)
      .eq('status', 'signed')
      .order('signed_at', { ascending: false })

    const [sentResult, signedResult] = await Promise.all([sentPromise, signedByMePromise])

    if (sentResult.error) {
      console.error('Error loading sent documents:', sentResult.error)
    } else {
      setSentDocuments(await processDocUrls(sentResult.data || []))
    }

    if (signedResult.error) {
      console.error('Error loading signed documents:', signedResult.error)
    } else {
      const externalDocs = (signedResult.data || []).filter((d: Document) => d.owner_id !== session.user.id)
      const dr7trustDocs = await processDocUrls(externalDocs)

      let dr7Docs: Document[] = []
      try {
        const res = await fetch('/.netlify/functions/dr7trust-get-dr7-documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail, accessToken: session.access_token })
        })
        if (res.ok) {
          const { documents } = await res.json()
          dr7Docs = (documents || []).map((d: Document) => ({
            ...d,
            pdf_url: d.pdf_url || d.signed_pdf_url || '',
          }))
        }
      } catch (err) {
        console.warn('Could not fetch DR7 documents:', err)
      }

      const seenUrls = new Set(dr7trustDocs.map(d => d.signed_pdf_url).filter(Boolean))
      const uniqueDR7 = dr7Docs.filter(d => !d.signed_pdf_url || !seenUrls.has(d.signed_pdf_url))
      setSignedByMeDocuments([...dr7trustDocs, ...uniqueDR7])
    }

    setDocsLoading(false)
  }

  async function loadContacts() {
    setContactsLoading(true)
    // Fetch all contacts (Supabase default limit is 1000, so paginate)
    let allContacts: any[] = []
    let from = 0
    const pageSize = 1000
    let fetchError: any = null
    while (true) {
      const { data, error } = await supabase
        .from('trustera_contacts')
        .select('*')
        .eq('owner_id', session.user.id)
        .order('name')
        .range(from, from + pageSize - 1)
      if (error) { fetchError = error; break }
      allContacts = allContacts.concat(data || [])
      if (!data || data.length < pageSize) break
      from += pageSize
    }
    const data = allContacts
    const error = fetchError
    if (error) {
      console.error('Error loading contacts:', error)
    } else {
      // Deduplicate contacts by email (keep the most recently updated)
      const seen = new Map<string, typeof data[0]>()
      const dupeIds: string[] = []
      for (const c of (data || [])) {
        const key = (c.email || '').toLowerCase().trim()
        if (!key) continue
        const existing = seen.get(key)
        if (existing) {
          // Keep the one with more recent updated_at, mark the other for deletion
          const existingDate = new Date(existing.updated_at || existing.created_at || 0)
          const currentDate = new Date(c.updated_at || c.created_at || 0)
          if (currentDate > existingDate) {
            dupeIds.push(existing.id)
            seen.set(key, c)
          } else {
            dupeIds.push(c.id)
          }
        } else {
          seen.set(key, c)
        }
      }
      // Clean up duplicates in background
      if (dupeIds.length > 0) {
        supabase.from('trustera_contacts').delete().in('id', dupeIds).then(() => {
          console.log(`Cleaned ${dupeIds.length} duplicate contacts`)
        })
      }
      setContacts(Array.from(seen.values()))
    }
    setContactsLoading(false)
  }

  // ── Upload modal ──────────────────────────────────────────────────────────

  // ── Modal state ──
  const [signerCount, setSignerCount] = useState(0) // 0 = not yet chosen
  const [_focusedSignerField, setFocusedSignerField] = useState<{ index: number; field: 'email' | 'name' } | null>(null)
  const [useOtp, setUseOtp] = useState(false)
  const [approverRows, setApproverRows] = useState<{ name: string; email: string }[]>([])
  const [showApproverSearch, setShowApproverSearch] = useState(false)
  const [approverSearchQuery, setApproverSearchQuery] = useState('')
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [editingDraftPdfUrl, setEditingDraftPdfUrl] = useState<string | null>(null)

  function resetUploadModal() {
    setSelectedFile(null)
    setSignerRows([])
    setSignerCount(0)
    setFocusedSignerField(null)
    setShowSchedulePicker(false)
    setScheduledDateTime('')
    setUseOtp(false)
    setApproverRows([])
    setShowApproverSearch(false)
    setApproverSearchQuery('')
    setEditingDraftId(null)
    setEditingDraftPdfUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleOpenDraft(doc: Document) {
    resetUploadModal()
    setEditingDraftId(doc.id)
    setEditingDraftPdfUrl(doc.raw_pdf_url || doc.pdf_url || null)
    // Restore signers from draft_signers
    if (doc.draft_signers && doc.draft_signers.length > 0) {
      const rows: SignerRow[] = doc.draft_signers.map(s => ({
        name: s.name || '',
        email: s.email || '',
        phone: s.phone || '',
        countryCode: s.countryCode || '+39',
        channel: s.channel || 'email',
        mode: s.name ? 'contact' as const : 'contact' as const,
      }))
      setSignerCount(rows.length)
      setSignerRows(rows)
    } else {
      setSignerCount(1)
      setSignerRows([{ name: '', email: '', phone: '', countryCode: '+39', channel: 'email', mode: 'contact' }])
    }
    setShowUploadModal(true)
  }

  function handleSelectSignerCount(count: number) {
    if (count < 1) count = 1
    if (count > 10) count = 10
    setSignerCount(count)
    setSignerRows(prev => {
      if (count > prev.length) {
        // Add new empty rows
        return [...prev, ...Array.from({ length: count - prev.length }, () => ({
          name: '', email: '', phone: '', countryCode: '+39', channel: 'email' as const, mode: 'contact' as const
        }))]
      }
      // Trim extra rows
      return prev.slice(0, count)
    })
  }

  function updateSignerRow(index: number, field: keyof SignerRow, value: string) {
    setSignerRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  function applyContactToSigner(index: number, contact: Contact) {
    // Try to extract country code from stored phone
    let countryCode = '+39'
    let phoneNum = contact.phone || ''
    if (phoneNum.startsWith('+')) {
      const match = COUNTRY_CODES.find(cc => phoneNum.startsWith(cc.code))
      if (match) {
        countryCode = match.code
        phoneNum = phoneNum.slice(match.code.length).trim()
      }
    }
    setSignerRows(prev => prev.map((r, i) => i === index ? {
      ...r,
      name: contact.name,
      email: contact.email,
      phone: phoneNum,
      countryCode,
      channel: contact.phone ? 'whatsapp' : 'email',
      mode: 'contact'
    } : r))
    setFocusedSignerField(null)
  }

  function getContactSuggestions(query: string, currentIndex: number): Contact[] {
    const q = query.toLowerCase().trim()
    return contacts.filter(c => {
      const usedByOther = signerRows.some((s, i) => i !== currentIndex && s.email && c.email && s.email.toLowerCase() === c.email.toLowerCase())
      if (usedByOther) return false
      if (!q) return false
      return c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q)
    }).slice(0, 5)
  }

  async function handleUploadAndOpenEditor(e: React.FormEvent) {
    e.preventDefault()

    const validSigners = signerRows.filter(s => s.name.trim() && (s.channel === 'email' ? s.email.trim() : s.phone.trim()))
    if (validSigners.length === 0) {
      toast.error('Aggiungi almeno un destinatario con nome e email')
      return
    }

    setUploading(true)
    try {
      let publicUrl: string
      let docId: string

      if (editingDraftId && editingDraftPdfUrl) {
        // Editing existing draft — use existing PDF (or re-upload if new file selected)
        if (selectedFile) {
          const fileName = `documents/${session.user.id}/${Date.now()}_${selectedFile.name}`
          const { error: uploadError } = await supabase.storage
            .from('dr7trust')
            .upload(fileName, selectedFile, { contentType: 'application/pdf' })
          if (uploadError) throw uploadError
          publicUrl = supabase.storage.from('dr7trust').getPublicUrl(fileName).data.publicUrl
          await supabase.from('trustera_documents').update({ pdf_url: publicUrl, name: selectedFile.name, draft_signers: validSigners }).eq('id', editingDraftId)
        } else {
          publicUrl = editingDraftPdfUrl
          await supabase.from('trustera_documents').update({ draft_signers: validSigners }).eq('id', editingDraftId)
        }
        docId = editingDraftId
      } else {
        if (!selectedFile) { toast.error('Seleziona un documento'); return }
        const fileName = `documents/${session.user.id}/${Date.now()}_${selectedFile.name}`
        const { error: uploadError } = await supabase.storage
          .from('dr7trust')
          .upload(fileName, selectedFile, { contentType: 'application/pdf' })
        if (uploadError) throw uploadError
        publicUrl = supabase.storage.from('dr7trust').getPublicUrl(fileName).data.publicUrl

        const { data: doc, error: insertError } = await supabase
          .from('trustera_documents')
          .insert({
            owner_id: session.user.id,
            name: selectedFile.name,
            pdf_url: publicUrl,
            status: 'draft',
          })
          .select()
          .single()
        if (insertError) throw insertError
        docId = doc.id
      }

      // Generate a signed URL for the PDF so react-pdf can load it
      const signedUrl = await getSignedUrl(publicUrl)

      // Open field placement editor
      setEditorPdfUrl(signedUrl || publicUrl)
      setEditorDocumentId(docId)
      setEditorSigners(validSigners)
      setShowUploadModal(false)
      setShowFieldEditor(true)
    } catch (error: any) {
      toast.error(error.message || 'Errore nel caricamento')
    } finally {
      setUploading(false)
    }
  }

  async function handleSendWithoutFields() {
    const validSigners = signerRows.filter(s => s.name.trim() && (s.channel === 'email' ? s.email.trim() : s.phone.trim()))
    if (validSigners.length === 0) return

    setUploading(true)
    try {
      let publicUrl: string
      let docId: string

      if (editingDraftId && editingDraftPdfUrl && !selectedFile) {
        // Use existing draft PDF
        publicUrl = editingDraftPdfUrl
        await supabase.from('trustera_documents').update({ status: 'pending', draft_signers: null }).eq('id', editingDraftId)
        docId = editingDraftId
      } else {
        if (!selectedFile) { toast.error('Seleziona un documento'); return }
        const fileName = `documents/${session.user.id}/${Date.now()}_${selectedFile.name}`
        const { error: uploadError } = await supabase.storage
          .from('dr7trust')
          .upload(fileName, selectedFile, { contentType: 'application/pdf' })
        if (uploadError) throw uploadError
        publicUrl = supabase.storage.from('dr7trust').getPublicUrl(fileName).data.publicUrl

        if (editingDraftId) {
          await supabase.from('trustera_documents').update({ pdf_url: publicUrl, name: selectedFile.name, status: 'pending', draft_signers: null }).eq('id', editingDraftId)
          docId = editingDraftId
        } else {
          const { data: doc, error: insertError } = await supabase
            .from('trustera_documents')
            .insert({
              owner_id: session.user.id,
              name: selectedFile.name,
              pdf_url: publicUrl,
              status: 'pending',
            })
            .select()
            .single()
          if (insertError) throw insertError
          docId = doc.id
        }
      }

      const res = await fetch('/.netlify/functions/dr7trust-send-signing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: docId,
          requireOtp: useOtp,
          approvers: approverRows.length > 0 ? approverRows : undefined,
          signers: validSigners.map(s => ({
            name: s.name.trim(),
            email: s.email.trim(),
            phone: s.phone.trim() ? `${s.countryCode}${s.phone.trim()}` : null,
            channel: s.channel,
          }))
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Errore invio')
      }

      toast.success(`Richiesta di firma inviata a ${validSigners.length} destinatario${validSigners.length > 1 ? 'i' : ''}`)
      setShowUploadModal(false)
      resetUploadModal()
      loadDocuments()
    } catch (error: any) {
      toast.error(error.message || 'Errore nel caricamento')
    } finally {
      setUploading(false)
    }
  }

  async function handleSaveDraft() {
    if (!selectedFile && !editingDraftId) { toast.error('Seleziona un documento'); return }
    const validSigners = signerRows.filter(s => s.name.trim() && (s.channel === 'email' ? s.email.trim() : s.phone.trim()))

    setUploading(true)
    try {
      if (editingDraftId) {
        // Update existing draft
        const updates: Record<string, any> = {
          draft_signers: validSigners.length > 0 ? validSigners : null,
        }
        if (selectedFile) {
          const fileName = `documents/${session.user.id}/${Date.now()}_${selectedFile.name}`
          const { error: uploadError } = await supabase.storage
            .from('dr7trust')
            .upload(fileName, selectedFile, { contentType: 'application/pdf' })
          if (uploadError) throw uploadError
          updates.pdf_url = supabase.storage.from('dr7trust').getPublicUrl(fileName).data.publicUrl
          updates.name = selectedFile.name
        }
        const { error: updateError } = await supabase
          .from('trustera_documents')
          .update(updates)
          .eq('id', editingDraftId)
        if (updateError) throw updateError
      } else {
        const fileName = `documents/${session.user.id}/${Date.now()}_${selectedFile!.name}`
        const { error: uploadError } = await supabase.storage
          .from('dr7trust')
          .upload(fileName, selectedFile!, { contentType: 'application/pdf' })
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('dr7trust').getPublicUrl(fileName)

        const { error: insertError } = await supabase
          .from('trustera_documents')
          .insert({
            owner_id: session.user.id,
            name: selectedFile!.name,
            pdf_url: publicUrl,
            status: 'draft',
            draft_signers: validSigners.length > 0 ? validSigners : null,
          })
          .select()
          .single()
        if (insertError) throw insertError
      }

      toast.success('Bozza salvata')
      setShowUploadModal(false)
      resetUploadModal()
      loadDocuments()
    } catch (error: any) {
      toast.error(error.message || 'Errore nel salvataggio')
    } finally {
      setUploading(false)
    }
  }

  async function handleScheduledSend() {
    if (!selectedFile) { toast.error('Seleziona un documento'); return }
    if (!scheduledDateTime) { toast.error('Seleziona data e ora'); return }

    const validSigners = signerRows.filter(s => s.name.trim() && (s.channel === 'email' ? s.email.trim() : s.phone.trim()))
    if (validSigners.length === 0) {
      toast.error('Aggiungi almeno un firmatario con nome e email')
      return
    }

    const scheduledDate = new Date(scheduledDateTime)
    if (scheduledDate <= new Date()) {
      toast.error('La data deve essere nel futuro')
      return
    }

    setUploading(true)
    try {
      const fileName = `documents/${session.user.id}/${Date.now()}_${selectedFile.name}`
      const { error: uploadError } = await supabase.storage
        .from('dr7trust')
        .upload(fileName, selectedFile, { contentType: 'application/pdf' })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('dr7trust').getPublicUrl(fileName)

      const { error: insertError } = await supabase
        .from('trustera_documents')
        .insert({
          owner_id: session.user.id,
          name: selectedFile.name,
          pdf_url: publicUrl,
          status: 'scheduled',
          scheduled_at: scheduledDate.toISOString(),
          draft_signers: validSigners,
        })
        .select()
        .single()
      if (insertError) throw insertError

      toast.success(`Invio programmato per ${scheduledDate.toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}`)
      setShowUploadModal(false)
      resetUploadModal()
      loadDocuments()
    } catch (error: any) {
      toast.error(error.message || 'Errore nella programmazione')
    } finally {
      setUploading(false)
    }
  }

  async function handleFieldEditorComplete(fields: Omit<DocumentField, 'id' | 'document_id' | 'signer_id'>[]) {
    try {
      // Save fields
      if (fields.length > 0) {
        const res = await fetch('/.netlify/functions/dr7trust-save-fields', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: editorDocumentId,
            fields,
            accessToken: session.access_token,
          })
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Errore salvataggio campi')
        }
      }

      // Send signing requests
      const res = await fetch('/.netlify/functions/dr7trust-send-signing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: editorDocumentId,
          requireOtp: useOtp,
          approvers: approverRows.length > 0 ? approverRows : undefined,
          signers: editorSigners.map(s => ({
            name: s.name.trim(),
            email: s.email.trim(),
            phone: s.phone.trim() ? `${s.countryCode}${s.phone.trim()}` : null,
            channel: s.channel,
          }))
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Errore invio')
      }

      toast.success(`Richiesta di firma inviata a ${editorSigners.length} destinatario${editorSigners.length > 1 ? 'i' : ''}`)
      setShowFieldEditor(false)
      resetUploadModal()
      loadDocuments()
    } catch (error: any) {
      toast.error(error.message || 'Errore nell\'invio')
    }
  }

  // ── Document trash / restore ─────────────────────────────────────────────

  async function handleCancelSigning(docId: string) {
    if (!confirm('Annullare la richiesta di firma? I link inviati ai firmatari non saranno più validi.')) return
    // Invalidate all signer tokens by clearing them
    const { error: signerErr } = await supabase
      .from('trustera_document_signers')
      .update({ signing_token: null, signing_token_expires_at: new Date().toISOString(), status: 'cancelled' })
      .eq('document_id', docId)
    const { error: docErr } = await supabase
      .from('trustera_documents')
      .update({ status: 'draft' })
      .eq('id', docId)
    if (signerErr || docErr) {
      toast.error('Errore nell\'annullamento')
    } else {
      toast.success('Richiesta di firma annullata. I link non sono più validi.')
      loadDocuments()
    }
  }

  async function handleTrashDocument(docId: string) {
    const { error } = await supabase
      .from('trustera_documents')
      .update({ status: 'deleted' })
      .eq('id', docId)
    if (error) {
      toast.error('Errore nello spostamento nel cestino')
    } else {
      toast.success('Documento spostato nel cestino')
      loadDocuments()
    }
  }

  async function handleUpdateSchedule(docId: string, newDateTime: string) {
    const scheduled = new Date(newDateTime)
    if (scheduled <= new Date()) { toast.error('La data deve essere nel futuro'); return }
    const { error } = await supabase
      .from('trustera_documents')
      .update({ scheduled_at: scheduled.toISOString() })
      .eq('id', docId)
    if (error) {
      toast.error('Errore nell\'aggiornamento')
    } else {
      toast.success('Orario aggiornato')
      setEditingScheduleDocId(null)
      loadDocuments()
    }
  }

  async function handleRestoreDocument(docId: string) {
    const { error } = await supabase
      .from('trustera_documents')
      .update({ status: 'draft' })
      .eq('id', docId)
    if (error) {
      toast.error('Errore nel ripristino')
    } else {
      toast.success('Documento ripristinato')
      loadDocuments()
    }
  }

  async function handleDeleteDocumentPermanently(docId: string) {
    if (!confirm('Eliminare definitivamente questo documento? Questa azione non può essere annullata.')) return
    const { error } = await supabase
      .from('trustera_documents')
      .delete()
      .eq('id', docId)
    if (error) {
      toast.error('Errore nell\'eliminazione')
    } else {
      toast.success('Documento eliminato definitivamente')
      loadDocuments()
    }
  }

  // ── Contacts ──────────────────────────────────────────────────────────────

  const importFileRef = useRef<HTMLInputElement>(null)

  const filteredContacts = contacts.filter(c => {
    const q = contactSearch.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
  })

  function toggleContactSelection(id: string) {
    setSelectedContacts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAllContacts() {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set())
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)))
    }
  }

  async function handleExportContacts() {
    const toExport = selectedContacts.size > 0
      ? contacts.filter(c => selectedContacts.has(c.id))
      : contacts
    if (toExport.length === 0) { toast.error('Nessun contatto da esportare'); return }
    const header = 'Nome,Email,Telefono'
    const rows = toExport.map(c => {
      const name = c.name.replace(/"/g, '""')
      const email = c.email.replace(/"/g, '""')
      const phone = (c.phone || '').replace(/"/g, '""')
      return `"${name}","${email}","${phone}"`
    })
    const csv = [header, ...rows].join('\n')
    const csvBytes = new TextEncoder().encode('\uFEFF' + csv)
    const dateSuffix = new Date().toISOString().slice(0, 10)

    if (toExport.length > 500) {
      // ZIP for large exports
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      zip.file(`contatti_trustera_${dateSuffix}.csv`, csvBytes)
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contatti_trustera_${dateSuffix}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const blob = new Blob([csvBytes], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contatti_trustera_${dateSuffix}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
    toast.success(`${toExport.length} contatti esportati`)
    setSelectedContacts(new Set())
  }

  async function handleImportContacts(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so same file can be re-selected
    if (importFileRef.current) importFileRef.current.value = ''

    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) { toast.error('File vuoto o senza dati'); return }

      // Auto-detect delimiter (; or ,)
      const headerLine = lines[0]
      const delimiter = headerLine.includes(';') ? ';' : ','

      // Parse a CSV line respecting quotes
      function parseCsvLine(line: string): string[] {
        const result: string[] = []
        let current = ''
        let inQuotes = false
        for (let c = 0; c < line.length; c++) {
          const ch = line[c]
          if (inQuotes) {
            if (ch === '"' && line[c + 1] === '"') { current += '"'; c++; }
            else if (ch === '"') inQuotes = false
            else current += ch
          } else {
            if (ch === '"') inQuotes = true
            else if (ch === delimiter) { result.push(current.trim()); current = '' }
            else current += ch
          }
        }
        result.push(current.trim())
        return result
      }

      // Auto-detect columns from header
      const headers = parseCsvLine(headerLine).map(h => h.toLowerCase().replace(/[^a-z]/g, ''))
      let nameCol = headers.findIndex(h => h === 'nome' || h === 'name' || h === 'nominativo' || h === 'ragionesociale')
      let emailCol = headers.findIndex(h => h === 'email' || h === 'mail' || h === 'emailaddress' || h === 'indirizzoemail')
      let phoneCol = headers.findIndex(h => h === 'telefono' || h === 'phone' || h === 'tel' || h === 'cellulare' || h === 'mobile' || h === 'numero')

      // Fallback: if no header match, assume order: name, email, phone
      if (nameCol === -1 && emailCol === -1) {
        nameCol = 0
        emailCol = headers.length > 1 ? 1 : -1
        phoneCol = headers.length > 2 ? 2 : -1
      }

      // Parse data rows
      const imported: { name: string; email: string; phone: string }[] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i])
        const name = (nameCol >= 0 ? cols[nameCol] : '').trim()
        const email = (emailCol >= 0 ? cols[emailCol] : '').trim()
        const phone = (phoneCol >= 0 ? cols[phoneCol] : '').trim()
        // Accept if we have at least a name
        if (name) {
          imported.push({ name, email: email.includes('@') ? email : '', phone })
        }
      }

      if (imported.length === 0) { toast.error('Nessun contatto valido trovato nel file. Verifica che il CSV abbia colonne: Nome, Email, Telefono'); return }

      // Split: contacts with email can be upserted, without email must be inserted
      const withEmail = imported.filter(c => c.email)
      const withoutEmail = imported.filter(c => !c.email)

      let successCount = 0
      let errorCount = 0

      // Upsert contacts with email in batches of 50
      for (let b = 0; b < withEmail.length; b += 50) {
        const batch = withEmail.slice(b, b + 50).map(c => ({
          owner_id: session.user.id,
          name: c.name,
          email: c.email,
          phone: c.phone || null,
          updated_at: new Date().toISOString(),
        }))
        const { error } = await supabase
          .from('trustera_contacts')
          .upsert(batch, { onConflict: 'owner_id,email' })
        if (error) {
          console.error('Import batch error:', error.message)
          errorCount += batch.length
        } else {
          successCount += batch.length
        }
      }

      // Insert contacts without email one by one (each needs unique placeholder)
      // Pre-load existing no-email contacts for duplicate check
      const { data: existingNoEmail } = await supabase
        .from('trustera_contacts')
        .select('name, phone')
        .eq('owner_id', session.user.id)
        .like('email', '%@noemail')
      const normalizePhone = (p: string) => p.replace(/[\s\-\(\)\+]/g, '')
      const existingSet = new Set(
        (existingNoEmail || []).map(e => `${e.name.trim().toLowerCase()}|${e.phone ? normalizePhone(e.phone) : ''}`)
      )

      for (const c of withoutEmail) {
        const placeholder = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}@noemail`
        const lookupPhone = c.phone || null
        const key = `${c.name.trim().toLowerCase()}|${lookupPhone ? normalizePhone(lookupPhone) : ''}`
        const exists = existingSet.has(key)
        if (!exists) {
          existingSet.add(key) // prevent duplicates within same import
          const { error } = await supabase
            .from('trustera_contacts')
            .insert({
              owner_id: session.user.id,
              name: c.name,
              email: placeholder,
              phone: lookupPhone,
              updated_at: new Date().toISOString(),
            })
          if (error) {
            console.error('Import no-email error:', error.message)
            errorCount++
          } else {
            successCount++
          }
        } else {
          successCount++ // already exists, count as success
        }
      }

      if (successCount > 0) {
        let msg = `${successCount} contatti importati`
        if (errorCount > 0) msg += `, ${errorCount} errori`
        toast.success(msg)
        loadContacts()
      } else {
        toast.error('Importazione fallita: verifica il formato del file')
      }
      console.log(`[Import] Parsed: ${imported.length}, With email: ${withEmail.length}, Without email: ${withoutEmail.length}, Success: ${successCount}, Errors: ${errorCount}`)
    } catch (err: any) {
      toast.error('Errore nella lettura del file')
    }
  }

  async function handleRemoveDuplicates() {
    if (contacts.length === 0) return

    const normalizePhone = (p: string) => p.replace(/[\s\-\(\)\+]/g, '')
    const isPlaceholderEmail = (e: string) => e.includes('@noemail') || /^\+?\d[\d\s\-]+$/.test(e)

    // Pass 1: Group by name+email (real emails only)
    const byEmail = new Map<string, typeof contacts>()
    // Pass 2: Group by name+phone (for contacts without real email)
    const byPhone = new Map<string, typeof contacts>()
    const alreadyMarked = new Set<string>()

    for (const c of contacts) {
      if (c.email && !isPlaceholderEmail(c.email)) {
        const key = `${c.name.trim().toLowerCase()}|${c.email.trim().toLowerCase()}`
        const group = byEmail.get(key) || []
        group.push(c)
        byEmail.set(key, group)
      } else if (c.phone) {
        const key = `${c.name.trim().toLowerCase()}|${normalizePhone(c.phone)}`
        const group = byPhone.get(key) || []
        group.push(c)
        byPhone.set(key, group)
      }
    }

    const toDelete: string[] = []
    for (const group of [...byEmail.values(), ...byPhone.values()]) {
      if (group.length <= 1) continue
      group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      for (let i = 1; i < group.length; i++) {
        if (!alreadyMarked.has(group[i].id)) {
          toDelete.push(group[i].id)
          alreadyMarked.add(group[i].id)
        }
      }
    }
    if (toDelete.length === 0) { toast.success('Nessun duplicato trovato'); return }
    if (!confirm(`Trovati ${toDelete.length} duplicati. Eliminare?`)) return

    // Delete in batches
    let deleted = 0
    for (let b = 0; b < toDelete.length; b += 50) {
      const batch = toDelete.slice(b, b + 50)
      const { error } = await supabase.from('trustera_contacts').delete().in('id', batch)
      if (!error) deleted += batch.length
    }
    toast.success(`${deleted} duplicati rimossi`)
    loadContacts()
  }

  async function handleDeleteContact(id: string) {
    if (!confirm('Eliminare questo contatto?')) return
    const { error } = await supabase.from('trustera_contacts').delete().eq('id', id)
    if (error) {
      toast.error('Errore nell\'eliminazione')
    } else {
      setContacts(prev => prev.filter(c => c.id !== id))
      toast.success('Contatto eliminato')
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const totalSent = sentDocuments.length
  const draftCount = sentDocuments.filter(d => d.status === 'draft' || d.status === 'scheduled').length
  const deletedCount = sentDocuments.filter(d => d.status === 'deleted').length
  const pendingCount = sentDocuments.filter(d => d.status === 'pending' || d.approval_status === 'awaiting_approval').length
  const signedSentCount = sentDocuments.filter(d => d.status === 'signed').length
  const signedByMeCount = signedByMeDocuments.length

  // Filter documents
  const baseDocuments = activeDocTab === 'sent' ? sentDocuments : signedByMeDocuments
  const filteredDocuments = baseDocuments.filter(doc => {
    // Status filter
    if (docFilter === 'tutte' && doc.status === 'deleted') return false
    if (docFilter === 'in_corso' && doc.status !== 'pending' && doc.approval_status !== 'awaiting_approval') return false
    if (docFilter === 'completate' && doc.status !== 'signed') return false
    if (docFilter === 'bozza' && doc.status !== 'draft' && doc.status !== 'scheduled') return false
    if (docFilter === 'cestino' && doc.status !== 'deleted') return false
    // Search
    if (docSearch) {
      const q = docSearch.toLowerCase()
      const nameMatch = doc.name.toLowerCase().includes(q)
      const signerMatch = doc.signers?.some(s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
      const legacyMatch = doc.signer_name?.toLowerCase().includes(q) || doc.signer_email?.toLowerCase().includes(q)
      if (!nameMatch && !signerMatch && !legacyMatch) return false
    }
    return true
  })

  // Sort documents
  const activeDocuments = [...filteredDocuments].sort((a, b) => {
    switch (docSort) {
      case 'created_desc': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'created_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'signed_desc': return (b.signed_at ? new Date(b.signed_at).getTime() : 0) - (a.signed_at ? new Date(a.signed_at).getTime() : 0)
      case 'signed_asc': return (a.signed_at ? new Date(a.signed_at).getTime() : 0) - (b.signed_at ? new Date(b.signed_at).getTime() : 0)
      case 'name_asc': return a.name.localeCompare(b.name)
      case 'name_desc': return b.name.localeCompare(a.name)
      default: return 0
    }
  })

  const sortLabels: Record<SortOption, string> = {
    created_desc: 'Data di creazione (recente)',
    created_asc: 'Data di creazione (vecchia)',
    signed_desc: 'Data della firma (recente)',
    signed_asc: 'Data della firma (vecchia)',
    name_asc: 'Nome (A-Z)',
    name_desc: 'Nome (Z-A)',
  }

  // ── Sidebar nav items ─────────────────────────────────────────────────────

  const navItems: { key: SidebarSection; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { key: 'documenti', label: 'Documenti', Icon: IconDocuments },
    { key: 'contatti', label: 'Contatti', Icon: IconContacts },
  ]

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <img src="/dr7trust-logo.png" alt="DR7 Trust" className="h-10 sm:h-16 w-auto" />
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <span className="text-sm text-gray-500 hidden sm:block truncate max-w-[200px]">{userName}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors flex-shrink-0"
            >
              Esci
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile top tabs ─────────────────────────────────────────────────── */}
      <nav className="md:hidden bg-white border-b border-gray-200 px-4 flex gap-1 overflow-x-auto flex-shrink-0">
        {navItems.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => { setSection(key); if (key === 'contatti') loadContacts() }}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              section === key
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>

      {/* ── Body (sidebar + content) ─────────────────────────────────────────── */}
      <div className="flex flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-6 gap-6">

        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-52 flex-shrink-0">
          <nav className="bg-white rounded-xl border border-gray-200 p-2 space-y-1">
            {navItems.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => { setSection(key); if (key === 'contatti') loadContacts() }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  section === key
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-4 bg-white rounded-xl border border-gray-200 p-2 space-y-1">
            <a href="/pricing" className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors">
              Pricing
            </a>
            <a href="/privacy" className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors">
              Privacy & GDPR
            </a>
            <a href="/terms" className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors">
              Termini
            </a>
          </div>
        </aside>

        {/* ── Main content ───────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">

          {/* ════════════════ DOCUMENTI ════════════════ */}
          {section === 'documenti' && (
            <div>
              {/* Sent / Signed by me tabs + new button */}
              <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1 min-w-0">
                  <button
                    onClick={() => setActiveDocTab('sent')}
                    className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                      activeDocTab === 'sent' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Inviati ({totalSent})
                  </button>
                  <button
                    onClick={() => setActiveDocTab('signed_by_me')}
                    className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                      activeDocTab === 'signed_by_me' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <span className="sm:hidden">Firmati</span>
                    <span className="hidden sm:inline">Firmati da me</span> ({signedByMeCount})
                  </button>
                </div>
                {activeDocTab === 'sent' && (
                  <button
                    onClick={() => { resetUploadModal(); setShowUploadModal(true) }}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 sm:px-5 rounded-lg text-sm transition-colors flex-shrink-0"
                  >
                    <span className="sm:hidden">+ Nuovo</span>
                    <span className="hidden sm:inline">+ Nuovo Documento</span>
                  </button>
                )}
              </div>

              {/* Filter tabs (YouSign-style) */}
              {activeDocTab === 'sent' && (
                <div className="flex gap-0 border-b border-gray-200 mb-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
                  {([
                    { key: 'tutte' as DocFilter, label: 'Tutte', count: totalSent },
                    { key: 'in_corso' as DocFilter, label: 'In corso', count: pendingCount },
                    { key: 'completate' as DocFilter, label: 'Completate', count: signedSentCount },
                    { key: 'bozza' as DocFilter, label: 'Bozza', count: draftCount },
                    { key: 'cestino' as DocFilter, label: 'Cestino', count: deletedCount },
                  ]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setDocFilter(tab.key)}
                      className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                        docFilter === tab.key
                          ? 'border-green-600 text-green-700'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label} {tab.count > 0 && <span className="text-xs ml-1 opacity-60">({tab.count})</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* Search + Sort bar */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                  <input
                    type="text"
                    value={docSearch}
                    onChange={e => setDocSearch(e.target.value)}
                    placeholder="Cerca per nome documento o firmatario..."
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
                  />
                </div>

                {/* Sort dropdown */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                  >
                    Ordina per
                    <svg className={`w-3.5 h-3.5 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                    </svg>
                  </button>

                  {showSortMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 w-72 overflow-hidden">
                      {(Object.entries(sortLabels) as [SortOption, string][]).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => { setDocSort(key); setShowSortMenu(false) }}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between border-b border-gray-50 last:border-0"
                        >
                          <span className={docSort === key ? 'text-green-700 font-medium' : 'text-gray-700'}>{label}</span>
                          {docSort === key && (
                            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Count */}
              <p className="text-xs text-gray-400 mb-3">{activeDocuments.length} di {baseDocuments.length} documenti</p>

              {/* Document list */}
              {docsLoading ? (
                <div className="text-center py-16">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto" />
                </div>
              ) : activeDocuments.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                  {docFilter !== 'tutte' || docSearch ? (
                    <p className="text-gray-400 text-lg">Nessun risultato</p>
                  ) : activeDocTab === 'sent' ? (
                    <>
                      <p className="text-gray-400 text-lg mb-4">Nessun documento inviato</p>
                      <button
                        onClick={() => { resetUploadModal(); setShowUploadModal(true) }}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                      >
                        Carica il primo documento
                      </button>
                    </>
                  ) : (
                    <p className="text-gray-400 text-lg">Nessun documento firmato da te</p>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {activeDocuments.map(doc => {
                    const isExpanded = expandedDocIds.has(doc.id)
                    const signers = doc.signers && doc.signers.length > 0
                      ? doc.signers
                      : doc.signer_name
                        ? [{ id: 'legacy', document_id: doc.id, name: doc.signer_name!, email: doc.signer_email!, status: doc.status === 'signed' ? 'signed' as const : 'pending' as const, signed_at: doc.signed_at }]
                        : []

                    return (
                      <div key={doc.id}>
                        <div
                          className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 hover:bg-gray-50/50 transition-colors cursor-pointer"
                          onClick={() => setExpandedDocIds(prev => {
                            const next = new Set(prev)
                            if (next.has(doc.id)) next.delete(doc.id)
                            else next.add(doc.id)
                            return next
                          })}
                        >
                          {/* Left: doc info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-semibold text-gray-800 truncate text-sm">{doc.name}</h3>
                              {doc.signers && doc.signers.length > 0 && (
                                <span className="text-xs text-gray-400 flex-shrink-0">{doc.signers.length}</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">
                              {formatDateIT(doc.created_at)}
                              {activeDocTab === 'sent' && <span className="mx-1.5">|</span>}
                              {activeDocTab === 'sent' && <span>Da me</span>}
                            </p>
                          </div>

                          {/* Center: signer status icons */}
                          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                            {signers.map((signer, si) => (
                              <div key={signer.id || si} className="flex items-center gap-1" title={`${signer.name} — ${signer.status === 'signed' ? 'Firmato' : 'In attesa'}`}>
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                                  signer.status === 'signed' ? 'bg-green-500' : 'bg-yellow-400'
                                }`}>
                                  {signer.status === 'signed' ? (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                  ) : (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg>
                                  )}
                                </span>
                                <span className="text-xs text-gray-500 max-w-[100px] truncate">
                                  {signer.name.split(' ').map(w => w[0] + '.').join(' ')}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Right: status + actions */}
                          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
                            <div className="flex items-center gap-1.5" title={statusLabels[getDocDisplayStatus(doc)] || doc.status}>
                              <span className={`w-2 h-2 rounded-full ${statusColors[getDocDisplayStatus(doc)] || 'bg-gray-400'}`} />
                              <span className="hidden sm:inline text-sm font-medium text-gray-600">{statusLabels[getDocDisplayStatus(doc)] || doc.status}</span>
                            </div>
                            {doc.signed_pdf_url && (
                              <a
                                href={doc.signed_pdf_url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                title="Scarica PDF firmato"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                              </a>
                            )}
                            {(doc.status === 'draft' || doc.status === 'scheduled') && (
                              <button
                                onClick={e => { e.stopPropagation(); handleOpenDraft(doc) }}
                                className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Modifica bozza"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                </svg>
                              </button>
                            )}
                            {doc.status === 'pending' && (
                              <button
                                onClick={e => { e.stopPropagation(); handleCancelSigning(doc.id) }}
                                className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-orange-500 transition-colors"
                                title="Annulla richiesta di firma"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </button>
                            )}
                            {doc.status === 'deleted' ? (
                              <>
                                <button
                                  onClick={e => { e.stopPropagation(); handleRestoreDocument(doc.id) }}
                                  className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                                  title="Ripristina"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                  </svg>
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); handleDeleteDocumentPermanently(doc.id) }}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                  title="Elimina definitivamente"
                                >
                                  <IconTrash className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={e => { e.stopPropagation(); handleTrashDocument(doc.id) }}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                title="Sposta nel cestino"
                              >
                                <IconTrash className="w-4 h-4" />
                              </button>
                            )}
                            <IconChevron open={isExpanded} />
                          </div>
                        </div>

                        {/* Expanded: details */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 bg-gray-50/80 px-5 py-3 space-y-2">
                            {/* Scheduled info */}
                            {doc.status === 'scheduled' && doc.scheduled_at && (
                              <div className="bg-blue-50 rounded-lg px-3 py-2 mb-2 space-y-2">
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                  </svg>
                                  <span className="text-sm text-blue-700 font-medium flex-1">
                                    Invio programmato: {formatDateIT(doc.scheduled_at)}
                                  </span>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation()
                                      if (editingScheduleDocId === doc.id) {
                                        setEditingScheduleDocId(null)
                                      } else {
                                        setEditingScheduleDocId(doc.id)
                                        // Pre-fill with current scheduled time in local format
                                        const d = new Date(doc.scheduled_at!)
                                        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                                        setEditingScheduleValue(local)
                                      }
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                  >
                                    {editingScheduleDocId === doc.id ? 'Annulla' : 'Modifica'}
                                  </button>
                                </div>
                                {editingScheduleDocId === doc.id && (
                                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                    <input
                                      type="datetime-local"
                                      value={editingScheduleValue}
                                      onChange={e => setEditingScheduleValue(e.target.value)}
                                      min={new Date().toISOString().slice(0, 16)}
                                      className="flex-1 border border-blue-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-blue-500"
                                    />
                                    <button
                                      onClick={() => handleUpdateSchedule(doc.id, editingScheduleValue)}
                                      disabled={!editingScheduleValue}
                                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                      Salva
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Draft/Scheduled signers from draft_signers */}
                            {(doc.status === 'draft' || doc.status === 'scheduled') && doc.draft_signers && doc.draft_signers.length > 0 && (
                              <>
                                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Destinatari</p>
                                {doc.draft_signers.map((ds, di) => (
                                  <div key={di} className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 bg-gray-300">
                                        {di + 1}
                                      </span>
                                      <div className="min-w-0">
                                        <span className="text-sm font-medium text-gray-700">{ds.name || '—'}</span>
                                        <span className="text-xs text-gray-400 ml-2">
                                          {ds.channel === 'whatsapp'
                                            ? `${ds.countryCode || ''}${ds.phone || ''}`
                                            : ds.email || '—'}
                                        </span>
                                      </div>
                                    </div>
                                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                      ds.channel === 'whatsapp' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                      {ds.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                                    </span>
                                  </div>
                                ))}
                              </>
                            )}

                            {/* No signers info for draft */}
                            {(doc.status === 'draft' || doc.status === 'scheduled') && (!doc.draft_signers || doc.draft_signers.length === 0) && signers.length === 0 && (
                              <p className="text-sm text-gray-400 italic">Nessun destinatario configurato</p>
                            )}

                            {/* Active signers (pending/signed docs) */}
                            {signers.length > 0 && signers.map((signer, si) => (
                              <div key={signer.id || si} className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${
                                    signer.status === 'signed' ? 'bg-green-500' : 'bg-yellow-400'
                                  }`}>
                                    {signer.status === 'signed' ? (
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                    ) : (
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                                    )}
                                  </span>
                                  <div className="min-w-0">
                                    <span className="text-sm font-medium text-gray-700">{signer.name}</span>
                                    <span className="text-xs text-gray-400 ml-2">{signer.email}</span>
                                  </div>
                                </div>
                                <span className="text-xs text-gray-400 flex-shrink-0">
                                  {signer.status === 'signed'
                                    ? signer.signed_at ? `Firmato il ${formatDateIT(signer.signed_at)}` : 'Firmato'
                                    : 'In attesa'
                                  }
                                </span>
                              </div>
                            ))}

                            {/* Document actions */}
                            <div className="flex gap-2 pt-2 border-t border-gray-200 mt-2">
                              {doc.pdf_url && (
                                <a
                                  href={doc.pdf_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-gray-500 hover:text-green-600 font-medium transition-colors"
                                >
                                  Vedi originale
                                </a>
                              )}
                              {doc.signed_pdf_url && (
                                <a
                                  href={doc.signed_pdf_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-green-600 hover:text-green-700 font-medium transition-colors"
                                >
                                  Scarica firmato
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════════ CONTATTI ════════════════ */}
          {section === 'contatti' && (
            <div>
              <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Contatti</h2>
                  <span className="text-sm text-gray-400">
                    {contacts.length} totali
                    {selectedContacts.size > 0 && ` · ${selectedContacts.size} selezionati`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => importFileRef.current?.click()}
                    className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    Importa
                  </button>
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".csv"
                    onChange={handleImportContacts}
                    className="hidden"
                  />
                  <button
                    onClick={handleExportContacts}
                    className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    {selectedContacts.size > 0 ? `Esporta (${selectedContacts.size})` : 'Esporta'}
                  </button>
                  <button
                    onClick={handleRemoveDuplicates}
                    className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                    </svg>
                    Rimuovi duplicati
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <input
                  type="text"
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  placeholder="Cerca per nome o email..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
              </div>

              {contactsLoading ? (
                <div className="text-center py-16">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto" />
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                  <p className="text-gray-400">
                    {contactSearch ? 'Nessun contatto trovato' : 'Nessun contatto ancora — vengono salvati automaticamente quando invii un documento'}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Select All header */}
                  <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                    <input
                      type="checkbox"
                      checked={filteredContacts.length > 0 && selectedContacts.size === filteredContacts.length}
                      onChange={toggleSelectAllContacts}
                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {selectedContacts.size === filteredContacts.length && filteredContacts.length > 0
                        ? 'Deseleziona tutti'
                        : 'Seleziona tutti'}
                    </span>
                    {selectedContacts.size > 0 && (
                      <button
                        onClick={() => setSelectedContacts(new Set())}
                        className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        Annulla selezione
                      </button>
                    )}
                  </div>
                  {filteredContacts.map((contact, i) => (
                    <div
                      key={contact.id}
                      className={`flex items-center gap-3 px-5 py-4 ${
                        i < filteredContacts.length - 1 ? 'border-b border-gray-100' : ''
                      } ${selectedContacts.has(contact.id) ? 'bg-green-50/40' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedContacts.has(contact.id)}
                        onChange={() => toggleContactSelection(contact.id)}
                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm">{contact.name}</p>
                        {contact.email && !contact.email.includes('@noemail') && !/^\+?\d[\d\s]*$/.test(contact.email) && (
                          <p className="text-xs text-gray-400 mt-0.5">{contact.email}</p>
                        )}
                        {contact.phone && <p className="text-xs text-gray-400">{contact.phone}</p>}
                      </div>
                      <button
                        onClick={() => handleDeleteContact(contact.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                        aria-label="Elimina contatto"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* ── Upload Modal (Apple-style) ──────────────────────────────────────── */}
      {showUploadModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={() => { setShowUploadModal(false); resetUploadModal() }}
        >
          <div
            className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto"
            style={{ boxShadow: '0 -4px 40px rgba(0,0,0,0.12)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
              <h2 className="text-[17px] font-semibold text-gray-900">{editingDraftId ? 'Modifica Bozza' : 'Nuovo Documento'}</h2>
              <button
                onClick={() => { setShowUploadModal(false); resetUploadModal() }}
                className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUploadAndOpenEditor} className="px-5 pb-5">

              {/* File upload */}
              <div className="py-4 border-b border-gray-100">
                <label className="block text-[13px] font-medium text-gray-500 uppercase tracking-wide mb-2">Documento</label>
                {converting ? (
                  <div className="w-full border-2 border-dashed border-green-300 rounded-2xl py-8 flex flex-col items-center gap-2 bg-green-50/30">
                    <svg className="w-8 h-8 text-green-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm text-green-600">Conversione in PDF...</span>
                  </div>
                ) : !selectedFile && !editingDraftPdfUrl ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-8 flex flex-col items-center gap-2 hover:border-green-400 hover:bg-green-50/30 transition-all"
                  >
                    <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                    <span className="text-sm text-gray-400">PDF, Word, immagini...</span>
                  </button>
                ) : !selectedFile && editingDraftPdfUrl ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                      <span className="text-sm text-blue-800 font-medium truncate flex-1">
                        {sentDocuments.find(d => d.id === editingDraftId)?.name || 'PDF già caricato'}
                      </span>
                      <a
                        href={editingDraftPdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                      >
                        Apri
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors py-1"
                    >
                      Sostituisci con un altro PDF
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-green-50 rounded-xl px-4 py-3">
                    <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span className="text-sm text-green-800 font-medium truncate flex-1">{selectedFile!.name}</span>
                    <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="text-green-600 hover:text-red-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.odt,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.jpg,.jpeg,.png" onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) { setSelectedFile(null); return }
                  const ext = file.name.split('.').pop()?.toLowerCase() || ''
                  if (ext === 'pdf') {
                    setSelectedFile(file)
                  } else {
                    try {
                      setConverting(true)
                      const converted = await convertFileToPdf(file)
                      setSelectedFile(converted)
                    } catch (err: any) {
                      toast.error(err.message || 'Errore nella conversione del file')
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    } finally {
                      setConverting(false)
                    }
                  }
                }} className="hidden" />
              </div>

              {/* Approvatori section */}
              <div className="py-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <label className="text-[11px] font-normal text-gray-400 uppercase tracking-wide">Approvatori</label>
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{approverRows.length}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowApproverSearch(true); setApproverSearchQuery('') }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
                </div>

                {/* Added approvers */}
                {approverRows.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {approverRows.map((a, i) => (
                      <div key={i} className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3 py-2.5">
                        <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-amber-700 font-bold text-[10px]">
                            {a.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{a.name}</p>
                          {a.email && <p className="text-xs text-gray-400 truncate">{a.email}</p>}
                        </div>
                        <button type="button" onClick={() => setApproverRows(prev => prev.filter((_, idx) => idx !== i))} className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Approver search */}
                {showApproverSearch && (
                  <div className="border border-gray-200 rounded-xl p-3 bg-white">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-semibold text-gray-500 flex-1">Aggiungi approvatore</p>
                      <button type="button" onClick={() => setShowApproverSearch(false)} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Contatti DR7 Trust</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <svg className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                        <input type="text" value={approverSearchQuery} onChange={e => setApproverSearchQuery(e.target.value)} placeholder="Cerca un approvatore o creane uno" className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500" />
                      </div>
                      <button type="button" onClick={() => {
                        if (approverSearchQuery.trim()) {
                          const isEmail = approverSearchQuery.includes('@')
                          setApproverRows(prev => [...prev, { name: isEmail ? approverSearchQuery.split('@')[0] : approverSearchQuery.trim(), email: isEmail ? approverSearchQuery.trim() : '' }])
                          setApproverSearchQuery('')
                          setShowApproverSearch(false)
                        }
                      }} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap">NUOVO</button>
                    </div>
                    {approverSearchQuery.trim().length > 0 && (
                      <div className="mt-2 max-h-36 overflow-y-auto space-y-1">
                        {contacts
                          .filter(c => c.name.toLowerCase().includes(approverSearchQuery.toLowerCase()) || (c.email && c.email.toLowerCase().includes(approverSearchQuery.toLowerCase())))
                          .filter(c => !approverRows.some(a => a.name === c.name && a.email === c.email))
                          .slice(0, 8)
                          .map(contact => {
                            const hasRealEmail = contact.email && !contact.email.includes('@noemail') && !/^\+?\d[\d\s]*$/.test(contact.email)
                            return (
                              <button key={contact.id} type="button" onClick={() => {
                                setApproverRows(prev => [...prev, { name: contact.name, email: hasRealEmail ? contact.email : '' }])
                                setApproverSearchQuery('')
                                setShowApproverSearch(false)
                              }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left">
                                <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <span className="text-amber-700 font-bold text-[10px]">{contact.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-800 truncate">{contact.name}</p>
                                  <p className="text-xs text-gray-400 truncate">{hasRealEmail ? contact.email : contact.phone || ''}</p>
                                </div>
                              </button>
                            )
                          })}
                        {contacts.filter(c => c.name.toLowerCase().includes(approverSearchQuery.toLowerCase()) || (c.email && c.email.toLowerCase().includes(approverSearchQuery.toLowerCase()))).filter(c => !approverRows.some(a => a.name === c.name && a.email === c.email)).length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-2">Nessun contatto trovato. Premi NUOVO per crearne uno.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Firmatari section */}
              <div className="py-4">
                <label className="block text-[13px] font-medium text-gray-500 uppercase tracking-wide mb-3">Firmatari</label>

                {/* Step 1: Select number of signers */}
                <div>
                  <p className="text-sm text-gray-600 mb-3">Quanti firmatari?</p>
                  <div className="flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleSelectSignerCount(signerCount - 1)}
                      disabled={signerCount <= 1}
                      className="w-11 h-11 rounded-full border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-xl font-medium text-gray-600 transition-all"
                    >
                      &minus;
                    </button>
                    <span className="text-2xl font-bold text-gray-800 w-8 text-center tabular-nums">{signerCount || 1}</span>
                    <button
                      type="button"
                      onClick={() => handleSelectSignerCount((signerCount || 0) + 1)}
                      disabled={signerCount >= 10}
                      className="w-11 h-11 rounded-full border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-xl font-medium text-gray-600 transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>

                {signerCount > 0 && (
                  <div className="space-y-4">

                    {/* Step 2+3: For each signer — channel, then email (with autocomplete), name, phone */}
                    {signerRows.map((signer, i) => (
                      <div key={i} className="border border-gray-200 rounded-2xl p-4 bg-gray-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[13px] font-semibold text-gray-700">Firmatario {i + 1}</p>
                          {signer.name && signer.mode === 'contact' && (
                            <button type="button" onClick={() => setSignerRows(prev => prev.map((r, idx) => idx === i ? { ...r, name: '', email: '', phone: '', mode: 'contact' } : r))}
                              className="text-xs text-gray-400 hover:text-red-500 transition-colors">Cambia</button>
                          )}
                        </div>

                        {/* Mode: Contact selection or manual entry */}
                        {signer.mode === 'new' || !signer.name ? (
                          <>
                            {/* Contatto / Nuovo toggle */}
                            <div className="flex gap-2">
                              <button type="button" onClick={() => updateSignerRow(i, 'mode', 'contact')}
                                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${signer.mode === 'contact' ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                              >Contatto</button>
                              <button type="button" onClick={() => updateSignerRow(i, 'mode', 'new')}
                                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${signer.mode === 'new' ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                              >Nuovo</button>
                            </div>

                            {signer.mode === 'contact' ? (
                              /* Contact search + list */
                              <div>
                                <div className="relative mb-2">
                                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                  </svg>
                                  <input
                                    type="text"
                                    value={signer.email}
                                    onChange={e => updateSignerRow(i, 'email', e.target.value)}
                                    placeholder="Cerca contatto..."
                                    className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-green-500"
                                  />
                                </div>
                                {(() => {
                                  const suggestions = getContactSuggestions(signer.email, i)
                                  if (suggestions.length === 0 && !signer.email) {
                                    return <p className="text-xs text-gray-400 text-center py-2">Nessun contatto</p>
                                  }
                                  if (suggestions.length === 0) {
                                    return <p className="text-xs text-gray-400 text-center py-2">Nessun risultato</p>
                                  }
                                  return (
                                    <div className="border border-gray-100 rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                                      {suggestions.map(contact => (
                                        <button
                                          key={contact.id}
                                          type="button"
                                          onClick={() => applyContactToSigner(i, contact)}
                                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-gray-50 last:border-0"
                                        >
                                          <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                                            <span className="text-xs font-bold text-green-600">
                                              {contact.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                                            </span>
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">{contact.name}</p>
                                            <p className="text-xs text-gray-400 truncate">{(() => {
                                              const hasRealEmail = contact.email && !contact.email.includes('@noemail') && !/^\+?\d[\d\s]*$/.test(contact.email)
                                              if (hasRealEmail && contact.phone) return `${contact.email} · ${contact.phone}`
                                              if (hasRealEmail) return contact.email
                                              if (contact.phone) return contact.phone
                                              return ''
                                            })()}</p>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )
                                })()}
                              </div>
                            ) : (
                              /* New: manual entry form */
                              <>
                                {/* Channel toggle */}
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => updateSignerRow(i, 'channel', 'email')}
                                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${signer.channel === 'email' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                  >Email</button>
                                  <button type="button" onClick={() => updateSignerRow(i, 'channel', 'whatsapp')}
                                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${signer.channel === 'whatsapp' ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                  >WhatsApp</button>
                                </div>
                                <input
                                  type="text"
                                  value={signer.name}
                                  onChange={e => updateSignerRow(i, 'name', e.target.value)}
                                  placeholder="Nome e Cognome"
                                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] text-gray-800 bg-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                                />
                                {signer.channel === 'email' ? (
                                  <input
                                    type="email"
                                    value={signer.email}
                                    onChange={e => updateSignerRow(i, 'email', e.target.value)}
                                    placeholder="email@esempio.com"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] text-gray-800 bg-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                                  />
                                ) : (
                                  <div className="flex gap-2">
                                    <div className="relative flex-shrink-0">
                                      <select
                                        value={signer.countryCode}
                                        onChange={e => updateSignerRow(i, 'countryCode', e.target.value)}
                                        className="appearance-none border border-gray-200 rounded-xl pl-3 pr-8 py-3 text-[15px] text-gray-800 bg-white focus:outline-none focus:border-green-500 w-[110px]"
                                      >
                                        {COUNTRY_CODES.map((cc, ci) => (
                                          <option key={`${cc.code}-${ci}`} value={cc.code}>
                                            {cc.flag} {cc.code}
                                          </option>
                                        ))}
                                      </select>
                                      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                                      </svg>
                                    </div>
                                    <input
                                      type="tel"
                                      value={signer.phone}
                                      onChange={e => updateSignerRow(i, 'phone', e.target.value.replace(/[^\d\s]/g, ''))}
                                      placeholder="347 1234567"
                                      className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-[15px] text-gray-800 bg-white focus:outline-none focus:border-green-500"
                                    />
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        ) : (
                          /* Selected contact summary + channel toggle */
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                              <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-green-600">
                                  {signer.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-800 truncate">{signer.name}</p>
                                <p className="text-xs text-gray-400 truncate">
                                  {signer.channel === 'whatsapp' && signer.phone
                                    ? `${signer.countryCode}${signer.phone}`
                                    : signer.email || ''}
                                </p>
                              </div>
                            </div>

                            {/* Channel toggle: Email / WhatsApp */}
                            <div>
                              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Invia tramite</p>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => updateSignerRow(i, 'channel', 'email')}
                                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${signer.channel === 'email' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >Email</button>
                                <button type="button" onClick={() => updateSignerRow(i, 'channel', 'whatsapp')}
                                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${signer.channel === 'whatsapp' ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >WhatsApp</button>
                              </div>
                            </div>

                            {/* If WhatsApp selected but no phone, show phone input */}
                            {signer.channel === 'whatsapp' && !signer.phone && (
                              <div className="flex gap-2">
                                <select value={signer.countryCode} onChange={e => updateSignerRow(i, 'countryCode', e.target.value)}
                                  className="w-24 border border-gray-200 rounded-xl px-2 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-green-500">
                                  {COUNTRY_CODES.map(cc => (
                                    <option key={cc.code} value={cc.code}>{cc.flag} {cc.code}</option>
                                  ))}
                                </select>
                                <input type="tel" value={signer.phone}
                                  onChange={e => updateSignerRow(i, 'phone', e.target.value.replace(/[^\d\s]/g, ''))}
                                  placeholder="347 1234567"
                                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-green-500" />
                              </div>
                            )}

                            {/* If Email selected but no real email, show email input */}
                            {signer.channel === 'email' && (!signer.email || signer.email.includes('@noemail')) && (
                              <input type="email" value={signer.email.includes('@noemail') ? '' : signer.email}
                                onChange={e => updateSignerRow(i, 'email', e.target.value)}
                                placeholder="email@esempio.com"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-green-500" />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* OTP toggle */}
              {signerCount > 0 && (
                <div className="mt-4 border border-gray-200 rounded-xl p-4">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Verifica identità</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setUseOtp(false)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border transition-all ${
                        !useOtp
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                      Senza OTP
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseOtp(true)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border transition-all ${
                        useOtp
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                      Con OTP
                    </button>
                  </div>
                  {useOtp && (
                    <p className="text-[12px] text-gray-400 mt-2">
                      Il firmatario riceverà un codice OTP per verificare la sua identità prima di firmare.
                    </p>
                  )}
                </div>
              )}

              {/* Submit buttons */}
              {signerCount > 0 && (
                <div className="space-y-2 mt-2">
                  {/* Primary: place fields and send */}
                  <button
                    type="submit"
                    disabled={uploading || (!selectedFile && !editingDraftPdfUrl) || signerRows.some(s => !s.name.trim() || (s.channel === 'email' ? !s.email.trim() : !s.phone.trim()))}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-4 rounded-2xl transition-all text-[16px]"
                  >
                    {uploading ? (
                      <span className="inline-flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Caricamento...
                      </span>
                    ) : `Posiziona Campi e Invia (${signerCount})`}
                  </button>

                  {/* Send without fields */}
                  <button
                    type="button"
                    onClick={handleSendWithoutFields}
                    disabled={uploading || (!selectedFile && !editingDraftPdfUrl) || signerRows.some(s => !s.name.trim() || (s.channel === 'email' ? !s.email.trim() : !s.phone.trim()))}
                    className="w-full text-gray-500 hover:text-gray-700 disabled:text-gray-300 text-sm font-medium py-2 transition-colors"
                  >
                    Invia senza campi
                  </button>

                  <div className="border-t border-gray-100 pt-3 mt-3 flex gap-2">
                    {/* Save draft */}
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={uploading || (!selectedFile && !editingDraftPdfUrl)}
                      className="flex-1 border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-300 text-gray-700 text-sm font-medium py-3 rounded-xl transition-all"
                    >
                      Salva Bozza
                    </button>

                    {/* Scheduled send */}
                    <button
                      type="button"
                      onClick={() => setShowSchedulePicker(!showSchedulePicker)}
                      disabled={uploading || (!selectedFile && !editingDraftPdfUrl) || signerRows.some(s => !s.name.trim() || (s.channel === 'email' ? !s.email.trim() : !s.phone.trim()))}
                      className="flex-1 border border-gray-200 hover:border-blue-300 bg-white hover:bg-blue-50 disabled:bg-gray-50 disabled:text-gray-300 text-gray-700 text-sm font-medium py-3 rounded-xl transition-all"
                    >
                      Invio Programmato
                    </button>
                  </div>

                  {/* Schedule datetime picker */}
                  {showSchedulePicker && (
                    <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-4 space-y-3">
                      <p className="text-[13px] font-semibold text-gray-700">Programma invio</p>
                      <input
                        type="datetime-local"
                        value={scheduledDateTime}
                        onChange={e => setScheduledDateTime(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] text-gray-800 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={handleScheduledSend}
                        disabled={uploading || !scheduledDateTime}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-xl transition-colors"
                      >
                        Conferma Invio Programmato
                      </button>
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ── Field Placement Editor ─────────────────────────────────────────── */}
      {showFieldEditor && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-gray-100 z-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
          </div>
        }>
          <FieldPlacementEditor
            pdfUrl={editorPdfUrl}
            signers={editorSigners.map(s => ({ name: s.name, email: s.email }))}
            onComplete={handleFieldEditorComplete}
            onCancel={() => setShowFieldEditor(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
