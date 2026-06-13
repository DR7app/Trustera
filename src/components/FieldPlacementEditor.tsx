import { useState, useRef, useCallback, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { FIELD_TYPES, SIGNER_COLORS } from '../types/fields'
import type { FieldType, DocumentField } from '../types/fields'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface SignerInfo {
  name: string
  email: string
}

interface FieldPlacementEditorProps {
  pdfUrl: string
  signers: SignerInfo[]
  onComplete: (fields: Omit<DocumentField, 'id' | 'document_id' | 'signer_id'>[]) => void
  onCancel: () => void
}

interface PlacedField {
  tempId: string
  fieldType: FieldType
  signerIndex: number
  pageNumber: number
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
  label?: string
  required: boolean
  radioGroup?: string
  placeholder?: string
  fontSize?: number
  fontStyle?: string
  defaultValue?: string
}

// Font options for signature fields
const FONT_STYLES = [
  { value: 'caveat', label: 'Caveat', css: "'Caveat', cursive" },
  { value: 'dancing', label: 'Dancing Script', css: "'Dancing Script', cursive" },
  { value: 'inconsolata', label: 'Inconsolata', css: "'Inconsolata', monospace" },
  { value: 'opensans', label: 'Open Sans', css: "'Open Sans', sans-serif" },
  { value: 'lato', label: 'Lato', css: "'Lato', sans-serif" },
  { value: 'raleway', label: 'Raleway', css: "'Raleway', sans-serif" },
  { value: 'merriweather', label: 'Merriweather', css: "'Merriweather', serif" },
  { value: 'garamond', label: 'EB Garamond', css: "'EB Garamond', serif" },
  { value: 'comicneue', label: 'Comic Neue', css: "'Comic Neue', cursive" },
  { value: 'monaco', label: 'Monaco', css: "'Monaco', 'Courier New', monospace" },
  { value: 'helvetica', label: 'Helvetica', css: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif" },
  { value: 'courier', label: 'Courier', css: "'Courier New', 'Courier', monospace" },
  { value: 'times', label: 'Times', css: "'Times New Roman', 'Times', serif" },
  { value: 'georgia', label: 'Georgia', css: "'Georgia', serif" },
]

function getFontCss(style?: string) {
  return FONT_STYLES.find(f => f.value === style)?.css || FONT_STYLES[0].css
}

let fieldCounter = 0
function nextTempId() {
  return `field_${++fieldCounter}_${Date.now()}`
}

// ─── Field type icons (inline SVGs) ─────────────────────────────────────────

function FieldIcon({ type, className }: { type: FieldType; className?: string }) {
  const cls = className || 'w-5 h-5'
  switch (type) {
    case 'signature':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
    case 'date':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
    case 'name':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
    case 'email':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
    case 'text':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>
    case 'label':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor"><text x="4" y="18" fontSize="16" fontWeight="bold" fill="currentColor" stroke="none">99</text></svg>
    case 'checkbox':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    case 'radio':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" fill="currentColor" /></svg>
    case 'initials':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor"><text x="3" y="18" fontSize="14" fontWeight="bold" fontStyle="italic" fill="currentColor" stroke="none">A.B.</text></svg>
    case 'readonly':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.2 48.2 0 0 0 5.166-.479c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

// Field types split into categories
const GLOBAL_FIELD_TYPES: FieldType[] = ['readonly', 'initials']
const SIGNER_FIELD_TYPES: FieldType[] = ['signature', 'date', 'name', 'email', 'text', 'label', 'checkbox', 'radio']

export default function FieldPlacementEditor({ pdfUrl, signers, onComplete, onCancel }: FieldPlacementEditorProps) {
  const [numPages, setNumPages] = useState(0)
  const [fields, setFields] = useState<PlacedField[]>([])
  const [activeSignerIndex, setActiveSignerIndex] = useState(0)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(true)
  const [showMobilePalette, setShowMobilePalette] = useState(false)
  const [tapPlaceType, setTapPlaceType] = useState<FieldType | null>(null)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [pageWidth, setPageWidth] = useState(() => {
    if (typeof window === 'undefined') return 700
    const w = window.innerWidth
    return Math.min(700, w - (w >= 768 ? 280 : 32))
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => {
      const w = window.innerWidth
      setPageWidth(Math.min(700, Math.max(280, w - (w >= 768 ? 280 : 32))))
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [expandedSignerIndex, setExpandedSignerIndex] = useState<number | null>(0)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  function toggleSection(key: string) {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Fetch PDF as blob to avoid CORS issues with Supabase storage
  useEffect(() => {
    if (!pdfUrl) return
    let cancelled = false
    async function loadPdf() {
      try {
        const res = await fetch(pdfUrl)
        if (!res.ok) throw new Error(`PDF fetch failed: ${res.status}`)
        const blob = await res.blob()
        if (!cancelled) {
          const url = URL.createObjectURL(blob)
          setPdfBlobUrl(url)
        }
      } catch (err: any) {
        console.error('[FieldPlacementEditor] PDF blob load error, falling back to direct URL:', err)
        if (!cancelled) setPdfBlobUrl(pdfUrl)
      }
    }
    loadPdf()
    return () => { cancelled = true }
  }, [pdfUrl])

  // Drag state for repositioning existing fields
  const dragRef = useRef<{
    fieldId: string
    startX: number
    startY: number
    startFieldX: number
    startFieldY: number
    pageEl: HTMLDivElement
  } | null>(null)

  function onDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n)
    setPdfLoading(false)
  }

  // ── Add field from drop or tap ─────────────────────────────────────────────

  const addFieldAtPosition = useCallback((fieldType: FieldType, pageNumber: number, xPercent: number, yPercent: number) => {
    const config = FIELD_TYPES[fieldType]
    const signer = signers[activeSignerIndex]
    const newField: PlacedField = {
      tempId: nextTempId(),
      fieldType,
      signerIndex: activeSignerIndex,
      pageNumber,
      xPercent: Math.max(0, Math.min(100 - config.defaultWidth, xPercent)),
      yPercent: Math.max(0, Math.min(100 - config.defaultHeight, yPercent)),
      widthPercent: config.defaultWidth,
      heightPercent: config.defaultHeight,
      required: true,
      // Smart defaults
      ...(fieldType === 'initials' && signer ? {
        defaultValue: signer.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3),
      } : {}),
      ...(fieldType === 'signature' ? { fontStyle: 'caveat', fontSize: 18 } : {}),
      ...(fieldType === 'name' && signer ? { defaultValue: signer.name } : {}),
    }
    setFields(prev => [...prev, newField])
    setSelectedFieldId(newField.tempId)
    setTapPlaceType(null)
    setShowMobilePalette(false)
  }, [activeSignerIndex, signers])

  // ── Drag from palette (desktop) ────────────────────────────────────────────

  function handlePaletteDragStart(e: React.DragEvent, fieldType: FieldType) {

    e.dataTransfer.setData('fieldType', fieldType)
    e.dataTransfer.effectAllowed = 'copy'
  }

  function handlePageDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  function handlePageDrop(e: React.DragEvent, pageNumber: number) {
    e.preventDefault()
    const fieldType = e.dataTransfer.getData('fieldType') as FieldType
    if (!fieldType) return

    const pageEl = pageRefs.current.get(pageNumber)
    if (!pageEl) return

    const rect = pageEl.getBoundingClientRect()
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100

    addFieldAtPosition(fieldType, pageNumber, xPercent, yPercent)

  }

  // ── Tap to place (mobile) ──────────────────────────────────────────────────

  function handlePageTap(e: React.MouseEvent, pageNumber: number) {
    if (!tapPlaceType) return
    const pageEl = pageRefs.current.get(pageNumber)
    if (!pageEl) return

    const rect = pageEl.getBoundingClientRect()
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100

    addFieldAtPosition(tapPlaceType, pageNumber, xPercent, yPercent)
  }

  // ── Drag to reposition existing field ──────────────────────────────────────

  function handleFieldMouseDown(e: React.MouseEvent | React.TouchEvent, fieldId: string, pageNumber: number) {
    e.stopPropagation()
    e.preventDefault()
    setSelectedFieldId(fieldId)

    const field = fields.find(f => f.tempId === fieldId)
    if (!field) return

    const pageEl = pageRefs.current.get(pageNumber)
    if (!pageEl) return

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    dragRef.current = {
      fieldId,
      startX: clientX,
      startY: clientY,
      startFieldX: field.xPercent,
      startFieldY: field.yPercent,
      pageEl,
    }
  }

  useEffect(() => {
    function handleMove(e: MouseEvent | TouchEvent) {
      if (!dragRef.current) return
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

      const { fieldId, startX, startY, startFieldX, startFieldY, pageEl } = dragRef.current
      const rect = pageEl.getBoundingClientRect()
      const dx = ((clientX - startX) / rect.width) * 100
      const dy = ((clientY - startY) / rect.height) * 100

      setFields(prev => prev.map(f => {
        if (f.tempId !== fieldId) return f
        return {
          ...f,
          xPercent: Math.max(0, Math.min(100 - f.widthPercent, startFieldX + dx)),
          yPercent: Math.max(0, Math.min(100 - f.heightPercent, startFieldY + dy)),
        }
      }))
    }

    function handleUp() {
      dragRef.current = null
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleUp)
    }
  }, [])

  // ── Delete field ───────────────────────────────────────────────────────────

  function deleteField(fieldId: string) {
    setFields(prev => prev.filter(f => f.tempId !== fieldId))
    if (selectedFieldId === fieldId) setSelectedFieldId(null)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  function handleSubmit() {
    const output = fields.map((f, i) => ({
      signer_index: f.signerIndex,
      field_type: f.fieldType,
      label: f.label || FIELD_TYPES[f.fieldType].label,
      page_number: f.pageNumber,
      x_percent: f.xPercent,
      y_percent: f.yPercent,
      width_percent: f.widthPercent,
      height_percent: f.heightPercent,
      required: f.required,
      placeholder: f.placeholder,
      radio_group: f.radioGroup,
      default_value: f.defaultValue,
      font_size: f.fontSize,
      font_style: f.fontStyle,
      sort_order: i,
    }))
    onComplete(output as any)
  }

  function updateField(fieldId: string, updates: Partial<PlacedField>) {
    setFields(prev => prev.map(f => f.tempId === fieldId ? { ...f, ...updates } : f))
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedFieldId && !(e.target instanceof HTMLInputElement)) {
          deleteField(selectedFieldId)
        }
      }
      if (e.key === 'Escape') {
        setSelectedFieldId(null)
        setTapPlaceType(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedFieldId])

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0 z-20">
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 font-medium flex-shrink-0">
          Annulla
        </button>
        <h2 className="hidden sm:block text-[15px] font-semibold text-gray-900 truncate">Posiziona i campi</h2>
        <button
          onClick={handleSubmit}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-3 sm:px-5 py-2 rounded-lg transition-colors flex-shrink-0"
        >
          <span className="sm:hidden">Invia ({fields.length})</span>
          <span className="hidden sm:inline">Invia per Firma ({fields.length})</span>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Desktop sidebar (YouSign-style) ──────────────────────────────── */}
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto">

          {/* ── Campi (global fields) ── */}
          <div className="border-b border-gray-100">
            <button
              onClick={() => toggleSection('campi')}
              className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <span className="text-sm font-semibold text-gray-800 flex-1 text-left">Campi</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${collapsedSections['campi'] ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
              </svg>
            </button>
            {!collapsedSections['campi'] && (
              <div className="px-3 pb-3 space-y-1">
                {GLOBAL_FIELD_TYPES.map(type => (
                  <div
                    key={type}
                    draggable
                    onDragStart={e => handlePaletteDragStart(e, type)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-50/50 hover:bg-blue-100/60 cursor-grab active:cursor-grabbing transition-colors"
                  >
                    <svg className="w-3 h-3 text-gray-300" viewBox="0 0 12 12" fill="currentColor">
                      <circle cx="3" cy="3" r="1.2" /><circle cx="3" cy="9" r="1.2" />
                      <circle cx="9" cy="3" r="1.2" /><circle cx="9" cy="9" r="1.2" />
                    </svg>
                    <FieldIcon type={type} className="w-5 h-5 text-gray-500" />
                    <span className="text-sm text-gray-700 font-medium">{FIELD_TYPES[type].label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Firmatari ── */}
          <div className="border-b border-gray-100">
            <button
              onClick={() => toggleSection('firmatari')}
              className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
              <span className="text-sm font-semibold text-gray-800 flex-1 text-left">Firmatari</span>
              <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{signers.length}</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${collapsedSections['firmatari'] ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
              </svg>
            </button>
            {!collapsedSections['firmatari'] && (
              <div className="pb-2">
                {signers.map((signer, i) => {
                  const color = SIGNER_COLORS[i % SIGNER_COLORS.length]
                  const count = fields.filter(f => f.signerIndex === i).length
                  const isExpanded = expandedSignerIndex === i
                  const initials = signer.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

                  return (
                    <div key={i}>
                      {/* Signer header */}
                      <button
                        onClick={() => { setActiveSignerIndex(i); setExpandedSignerIndex(isExpanded ? null : i) }}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 transition-colors ${
                          activeSignerIndex === i ? 'bg-gray-50' : ''
                        }`}
                      >
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ backgroundColor: color.hex }}>
                          {initials}
                        </span>
                        <span className="text-sm font-medium text-gray-800 flex-1 text-left uppercase truncate">{signer.name}</span>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: color.hex + '20', color: color.hex }}>
                          {count}
                        </span>
                        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Signer's field palette */}
                      {isExpanded && (
                        <div className="px-3 pb-2 space-y-1">
                          {SIGNER_FIELD_TYPES.map(type => (
                            <div
                              key={type}
                              draggable
                              onDragStart={e => { setActiveSignerIndex(i); handlePaletteDragStart(e, type) }}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-50/50 hover:bg-blue-100/60 cursor-grab active:cursor-grabbing transition-colors"
                            >
                              <svg className="w-3 h-3 text-gray-300" viewBox="0 0 12 12" fill="currentColor">
                                <circle cx="3" cy="3" r="1.2" /><circle cx="3" cy="9" r="1.2" />
                                <circle cx="9" cy="3" r="1.2" /><circle cx="9" cy="9" r="1.2" />
                              </svg>
                              <FieldIcon type={type} className="w-5 h-5 text-gray-500" />
                              <span className="text-sm text-gray-700 font-medium">{FIELD_TYPES[type].label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-auto p-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 leading-relaxed">
              Trascina i campi sul documento per posizionarli. Espandi un firmatario per assegnare i campi.
            </p>
          </div>
        </aside>

        {/* ── PDF pages (center) ────────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto px-4 py-6"
          onClick={() => setSelectedFieldId(null)}
        >
          {(pdfLoading || !pdfBlobUrl) && !pdfError && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
            </div>
          )}

          {pdfError && (
            <div className="flex items-center justify-center py-20 text-red-500 text-sm">
              Errore nel caricamento del PDF: {pdfError}
            </div>
          )}

          {pdfBlobUrl && <Document
            file={pdfBlobUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(err) => { console.error('[FieldPlacementEditor] react-pdf error:', err); setPdfError(err.message); setPdfLoading(false) }}
            loading=""
            className="flex flex-col items-center gap-6"
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
              <div
                key={pageNum}
                className="relative shadow-lg bg-white overflow-visible"
                ref={el => { if (el) pageRefs.current.set(pageNum, el) }}
                onDragOver={handlePageDragOver}
                onDrop={e => handlePageDrop(e, pageNum)}
                onClick={e => handlePageTap(e, pageNum)}
                style={{ cursor: tapPlaceType ? 'crosshair' : 'default' }}
              >
                <Page
                  pageNumber={pageNum}
                  width={pageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />

                {/* Page number label */}
                <div className="absolute bottom-2 right-3 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                  {pageNum} / {numPages}
                </div>

                {/* Placed fields on this page */}
                {fields.filter(f => f.pageNumber === pageNum).map(field => {
                  const color = SIGNER_COLORS[field.signerIndex % SIGNER_COLORS.length]
                  const isSelected = selectedFieldId === field.tempId
                  const isSignature = field.fieldType === 'signature' || field.fieldType === 'initials'
                  const signerName = signers[field.signerIndex]?.name || 'Firmatario'
                  const signerInitials = signerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                  return (
                    <div
                      key={field.tempId}
                      className="absolute select-none"
                      style={{
                        left: `${field.xPercent}%`,
                        top: `${field.yPercent}%`,
                        width: `${field.widthPercent}%`,
                        height: `${field.heightPercent}%`,
                        zIndex: isSelected ? 10 : 5,
                      }}
                    >
                      {/* Toolbar on top when selected */}
                      {isSelected && (
                        <div className="absolute -top-9 left-0 flex items-center gap-1 bg-gray-900 rounded-lg px-2 py-1.5 shadow-lg whitespace-nowrap" style={{ zIndex: 20 }}>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0" style={{ backgroundColor: color.hex }}>
                            {signerInitials}
                          </div>
                          <span className="text-[11px] font-medium text-white truncate max-w-[100px]">{signerName.toUpperCase()}</span>
                          <div className="w-px h-4 bg-gray-600 mx-0.5" />
                          <button onClick={e => { e.stopPropagation(); setEditingFieldId(field.tempId) }}
                            className="w-6 h-6 flex items-center justify-center text-white hover:bg-gray-700 rounded transition-colors" title="Modifica">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                          </button>
                          <button onClick={e => { e.stopPropagation(); deleteField(field.tempId) }}
                            className="w-6 h-6 flex items-center justify-center text-white hover:bg-red-600 rounded transition-colors" title="Elimina">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                          </button>
                        </div>
                      )}

                      {/* Resize handle bottom-right when selected */}
                      {isSelected && (
                        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 rounded-full cursor-se-resize" style={{ borderColor: color.hex, zIndex: 20 }} />
                      )}

                      {/* Field box */}
                      <div
                        className={`w-full h-full rounded cursor-grab ${isSelected ? 'shadow-md' : ''}`}
                        style={isSignature ? {
                          backgroundColor: '#ffffff',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          boxShadow: isSelected ? `0 0 0 1px ${color.hex}` : undefined,
                        } : {
                          backgroundColor: color.hex + '12',
                          border: `1px dashed ${color.hex}80`,
                          boxShadow: isSelected ? `0 0 0 1px ${color.hex}` : undefined,
                        }}
                        onClick={e => { e.stopPropagation(); setSelectedFieldId(field.tempId) }}
                        onDoubleClick={e => { e.stopPropagation(); setEditingFieldId(field.tempId) }}
                        onMouseDown={e => handleFieldMouseDown(e, field.tempId, pageNum)}
                        onTouchStart={e => handleFieldMouseDown(e, field.tempId, pageNum)}
                      >
                        {isSignature ? (
                          /* Signature / Initials: YouSign-style box */
                          <div className="w-full h-full flex flex-col items-center justify-center px-2 overflow-hidden">
                            <span className="text-gray-800 truncate w-full text-center" style={{
                              fontFamily: getFontCss(field.fontStyle),
                              fontSize: `${Math.min(field.fontSize || 22, 20)}px`,
                              fontStyle: field.fieldType === 'initials' ? 'italic' : 'italic',
                              fontWeight: 500,
                            }}>
                              {field.fieldType === 'initials'
                                ? signerInitials
                                : (field.defaultValue || signerName).toUpperCase()}
                            </span>
                            <span className="text-[7px] text-gray-400 flex items-center gap-0.5 mt-0.5">
                              <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                              Certificato da <img src="/dr7trust-logo.png" alt="DR7 Trust" className="inline h-[8px] ml-0.5" />
                            </span>
                          </div>
                        ) : (
                          /* Non-signature: icon + label */
                          <div className="w-full h-full flex items-center gap-1 px-1.5 text-xs font-medium truncate" style={{ color: color.hex }}>
                            <FieldIcon type={field.fieldType} className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">
                              {field.defaultValue || field.label || FIELD_TYPES[field.fieldType].label}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </Document>}
        </div>
      </div>

      {/* ── Field Settings Modal (double-click) ─────────────────────────── */}
      {editingFieldId && (() => {
        const field = fields.find(f => f.tempId === editingFieldId)
        if (!field) return null
        const signer = signers[field.signerIndex]
        const isSignatureType = field.fieldType === 'signature' || field.fieldType === 'initials'
        const sigName = field.defaultValue || signer?.name || 'Nome Cognome'
        const sigInitials = signer?.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'NC'
        const sigEmail = signer?.email || ''
        const layout = (field as any).signatureLayout || 'minimal'
        const dateFormat = (field as any).dateFormat || 'GG/MM/AAAA'
        const timeFormat = (field as any).timeFormat || 'none'
        const showEmail = (field as any).showEmail !== false

        // Format preview date
        const now = new Date()
        const dd = String(now.getDate()).padStart(2, '0')
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const yyyy = now.getFullYear()
        const hh = String(now.getHours()).padStart(2, '0')
        const min = String(now.getMinutes()).padStart(2, '0')
        const hh12 = now.getHours() % 12 || 12
        const ampm = now.getHours() >= 12 ? 'PM' : 'AM'
        const monthLong = now.toLocaleString('it-IT', { month: 'long' })
        const monthShort = now.toLocaleString('it-IT', { month: 'short' })
        const dateStr = dateFormat === 'GG/MM/AAAA' ? `${dd}/${mm}/${yyyy}`
          : dateFormat === 'GG-MM-AAAA' ? `${dd}-${mm}-${yyyy}`
          : dateFormat === 'GG.MM.AAAA' ? `${dd}.${mm}.${yyyy}`
          : dateFormat === 'AAAA-MM-GG' ? `${yyyy}-${mm}-${dd}`
          : dateFormat === 'MM/GG/AAAA' ? `${mm}/${dd}/${yyyy}`
          : dateFormat === 'GG MMMM AAAA' ? `${dd} ${monthLong} ${yyyy}`
          : dateFormat === 'MMMM GG, AAAA' ? `${monthLong} ${dd}, ${yyyy}`
          : dateFormat === 'MMM GG, AAAA' ? `${monthShort} ${dd}, ${yyyy}`
          : `${dd}/${mm}/${yyyy}`
        const timeStr = timeFormat === 'hh:mm' ? `${hh}:${min}` : timeFormat === 'hh:mm a' ? `${hh12}:${min} ${ampm}` : ''

        return (
          <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setEditingFieldId(null)}>
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">{FIELD_TYPES[field.fieldType].label}</h3>
                <button onClick={() => setEditingFieldId(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

                {/* ── Signature / Initials specific settings ── */}
                {isSignatureType && (
                  <>
                    {/* Signature preview */}
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-2">Anteprima della firma</p>
                      <div className="bg-blue-50/50 rounded-xl p-5">
                        <div className="bg-white border border-gray-200 rounded-lg p-4 max-w-[280px] mx-auto text-center">
                          {layout === 'detailed' && (
                            <p className="text-[10px] text-gray-400 mb-0.5">
                              Firmato il {dateStr}{timeStr ? ` ${timeStr}` : ''}
                            </p>
                          )}
                          {layout === 'detailed' && showEmail && sigEmail && (
                            <p className="text-[10px] text-gray-500 mb-1.5">
                              {sigName.toUpperCase()} ({sigEmail})
                            </p>
                          )}
                          {layout === 'detailed' && !showEmail && (
                            <p className="text-[10px] text-gray-500 mb-1.5">
                              {sigName.toUpperCase()}
                            </p>
                          )}
                          <p style={{
                            fontFamily: getFontCss(field.fontStyle),
                            fontSize: `${field.fontSize || 22}px`,
                            fontStyle: field.fieldType === 'initials' ? 'italic' : undefined,
                          }} className="text-gray-900">
                            {field.fieldType === 'initials' ? sigInitials : sigName.toUpperCase()}
                          </p>
                          <p className="text-[9px] text-gray-400 mt-2 flex items-center justify-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                            Certificato da <img src="/dr7trust-logo.png" alt="DR7 Trust" className="inline h-[10px] ml-0.5" />
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Layout toggle */}
                    <div className="flex gap-3">
                      <button onClick={() => updateField(field.tempId, { signatureLayout: 'minimal' } as any)}
                        className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm transition-all ${layout === 'minimal' ? 'border-gray-900 bg-white' : 'border-gray-200 bg-white text-gray-500'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${layout === 'minimal' ? 'border-gray-900' : 'border-gray-300'}`}>
                          {layout === 'minimal' && <div className="w-2 h-2 rounded-full bg-gray-900" />}
                        </div>
                        <span className="font-medium">Layout minimal</span>
                      </button>
                      <button onClick={() => updateField(field.tempId, { signatureLayout: 'detailed' } as any)}
                        className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm transition-all ${layout === 'detailed' ? 'border-gray-900 bg-white' : 'border-gray-200 bg-white text-gray-500'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${layout === 'detailed' ? 'border-gray-900' : 'border-gray-300'}`}>
                          {layout === 'detailed' && <div className="w-2 h-2 rounded-full bg-gray-900" />}
                        </div>
                        <span className="font-medium">Layout dettagliato</span>
                      </button>
                    </div>

                    {/* Date & Time format (only for detailed) */}
                    {layout === 'detailed' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-800 mb-1.5">Formato data</p>
                          <select value={dateFormat} onChange={e => updateField(field.tempId, { dateFormat: e.target.value } as any)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-green-500">
                            <option value="GG/MM/AAAA">GG/MM/AAAA — {dd}/{mm}/{yyyy}</option>
                            <option value="GG-MM-AAAA">GG-MM-AAAA — {dd}-{mm}-{yyyy}</option>
                            <option value="GG.MM.AAAA">GG.MM.AAAA — {dd}.{mm}.{yyyy}</option>
                            <option value="AAAA-MM-GG">AAAA-MM-GG — {yyyy}-{mm}-{dd}</option>
                            <option value="MM/GG/AAAA">MM/GG/AAAA — {mm}/{dd}/{yyyy}</option>
                            <option value="GG MMMM AAAA">GG MMMM AAAA — {dd} {now.toLocaleString('it-IT', { month: 'long' })} {yyyy}</option>
                            <option value="MMMM GG, AAAA">MMMM GG, AAAA — {now.toLocaleString('it-IT', { month: 'long' })} {dd}, {yyyy}</option>
                            <option value="MMM GG, AAAA">MMM GG, AAAA — {now.toLocaleString('it-IT', { month: 'short' })} {dd}, {yyyy}</option>
                          </select>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800 mb-1.5">Formato dell'ora</p>
                          <select value={timeFormat} onChange={e => updateField(field.tempId, { timeFormat: e.target.value } as any)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-green-500">
                            <option value="none">Nessuno</option>
                            <option value="hh:mm">hh:mm</option>
                            <option value="hh:mm a">hh:mm a</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Show email toggle (only for detailed) */}
                    {layout === 'detailed' && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Mostra l'e-mail del firmatario</span>
                        <button onClick={() => updateField(field.tempId, { showEmail: !showEmail } as any)}
                          className={`w-11 h-6 rounded-full transition-colors flex items-center ${showEmail ? 'bg-green-500' : 'bg-gray-200'}`}>
                          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${showEmail ? 'translate-x-[22px]' : 'translate-x-0.5'}`}>
                            {showEmail && <svg className="w-3 h-3 text-green-500 m-1" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}
                          </div>
                        </button>
                      </div>
                    )}

                    <hr className="border-gray-100" />

                    {/* Font style */}
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-1.5">Carattere</p>
                      <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[240px] overflow-y-auto">
                        {FONT_STYLES.map(fs => (
                          <button key={fs.value} onClick={() => updateField(field.tempId, { fontStyle: fs.value })}
                            className={`w-full flex items-center justify-between px-4 py-3 text-left border-b border-gray-50 last:border-0 transition-colors ${(field.fontStyle || 'caveat') === fs.value ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                            <span style={{ fontFamily: fs.css }} className="text-base text-gray-800">{fs.label}</span>
                            {(field.fontStyle || 'caveat') === fs.value && (
                              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Font size */}
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-1">Dimensione font: {field.fontSize || 18}px</p>
                      <input type="range" min={12} max={36} value={field.fontSize || 18}
                        onChange={e => updateField(field.tempId, { fontSize: parseInt(e.target.value) })}
                        className="w-full accent-green-600" />
                    </div>
                  </>
                )}

                {/* ── Non-signature field settings (YouSign style) ── */}
                {!isSignatureType && (
                  <>
                    {/* Name field: Formato del nome */}
                    {field.fieldType === 'name' && (
                      <div>
                        <p className="text-sm font-semibold text-gray-800 mb-2">Formato del nome</p>
                        <div className="space-y-2">
                          {[
                            { value: 'full', label: 'Nome e cognome' },
                            { value: 'first', label: 'Nome' },
                            { value: 'last', label: 'Cognome' },
                          ].map(opt => (
                            <button key={opt.value} onClick={() => updateField(field.tempId, { nameFormat: opt.value } as any)}
                              className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm transition-all ${((field as any).nameFormat || 'full') === opt.value ? 'border-gray-900 bg-white' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}>
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${((field as any).nameFormat || 'full') === opt.value ? 'border-gray-900' : 'border-gray-300'}`}>
                                {((field as any).nameFormat || 'full') === opt.value && <div className="w-2 h-2 rounded-full bg-gray-900" />}
                              </div>
                              <span className="font-medium">{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Carattere (Font) dropdown — for name, text, label, readonly */}
                    {['name', 'text', 'label', 'readonly'].includes(field.fieldType) && (
                      <div>
                        <p className="text-sm font-semibold text-gray-800 mb-1.5">Carattere</p>
                        <select value={field.fontStyle || 'opensans'} onChange={e => updateField(field.tempId, { fontStyle: e.target.value })}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-green-500"
                          style={{ fontFamily: getFontCss(field.fontStyle || 'opensans') }}>
                          {FONT_STYLES.map(fs => (
                            <option key={fs.value} value={fs.value} style={{ fontFamily: fs.css }}>{fs.label}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Dimensione + Bold + Color row — for name, text, label, readonly */}
                    {['name', 'text', 'label', 'readonly'].includes(field.fieldType) && (
                      <div>
                        <p className="text-sm font-semibold text-gray-800 mb-1.5">Dimensione</p>
                        <div className="flex items-center gap-2">
                          <select value={field.fontSize || 14} onChange={e => updateField(field.tempId, { fontSize: parseInt(e.target.value) })}
                            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-green-500">
                            {[8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32].map(s => (
                              <option key={s} value={s}>{s}px</option>
                            ))}
                          </select>
                          <button onClick={() => updateField(field.tempId, { fontBold: !(field as any).fontBold } as any)}
                            className={`w-10 h-10 rounded-xl border text-sm font-bold flex items-center justify-center transition-all ${(field as any).fontBold ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                            B
                          </button>
                          <div className="relative">
                            <input type="color" value={(field as any).fontColor || '#000000'}
                              onChange={e => updateField(field.tempId, { fontColor: e.target.value } as any)}
                              className="absolute inset-0 w-10 h-10 opacity-0 cursor-pointer" />
                            <div className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-50">
                              <div className="w-5 h-5 rounded-full border border-gray-300" style={{ backgroundColor: (field as any).fontColor || '#000000' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Nome del campo (field label) */}
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-1.5">Nome del campo</p>
                      <input type="text" value={field.label || ''} onChange={e => updateField(field.tempId, { label: e.target.value })}
                        placeholder={FIELD_TYPES[field.fieldType].label}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20" />
                    </div>

                    {/* Default value — for name, readonly, label */}
                    {['name', 'readonly', 'label'].includes(field.fieldType) && (
                      <div>
                        <p className="text-sm font-semibold text-gray-800 mb-1.5">Valore predefinito</p>
                        <input type="text" value={field.defaultValue || ''} onChange={e => updateField(field.tempId, { defaultValue: e.target.value })}
                          placeholder="Testo..."
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20" />
                      </div>
                    )}

                    {/* Placeholder — for text input */}
                    {field.fieldType === 'text' && (
                      <div>
                        <p className="text-sm font-semibold text-gray-800 mb-1.5">Placeholder</p>
                        <input type="text" value={field.placeholder || ''} onChange={e => updateField(field.tempId, { placeholder: e.target.value })}
                          placeholder="Testo suggerito..."
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20" />
                      </div>
                    )}

                    {/* Required toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Obbligatorio</span>
                      <button onClick={() => updateField(field.tempId, { required: !field.required })}
                        className={`w-11 h-6 rounded-full transition-colors flex items-center ${field.required ? 'bg-green-500' : 'bg-gray-200'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${field.required ? 'translate-x-[22px]' : 'translate-x-0.5'}`}>
                          {field.required && <svg className="w-3 h-3 text-green-500 m-1" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}
                        </div>
                      </button>
                    </div>

                    {/* Radio group */}
                    {field.fieldType === 'radio' && (
                      <div>
                        <p className="text-sm font-semibold text-gray-800 mb-1.5">Gruppo radio</p>
                        <input type="text" value={field.radioGroup || ''} onChange={e => updateField(field.tempId, { radioGroup: e.target.value })}
                          placeholder="gruppo_1"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20" />
                      </div>
                    )}
                  </>
                )}

                {/* Assigned signer */}
                {signer && (
                  <>
                    <hr className="border-gray-100" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-2">Assegnato a</p>
                      <div className="flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: SIGNER_COLORS[field.signerIndex % SIGNER_COLORS.length].hex }}>
                          <span className="text-[10px] font-bold text-white">{signer.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-800 flex-1 truncate">{signer.name.toUpperCase()}</span>
                        <span className="text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 bg-white">IT</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <button onClick={() => setEditingFieldId(null)}
                  className="px-5 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">
                  ANNULLA
                </button>
                <div className="flex gap-2">
                  <button onClick={() => { deleteField(field.tempId); setEditingFieldId(null) }}
                    className="px-4 py-2.5 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium">
                    Elimina
                  </button>
                  <button onClick={() => setEditingFieldId(null)}
                    className="px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-xl text-sm transition-colors">
                    SALVA
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Mobile bottom sheet (field palette) ────────────────────────────── */}
      <div className="md:hidden">
        {/* Tap place indicator */}
        {tapPlaceType && (
          <div className="bg-blue-50 border-t border-blue-200 px-4 py-2.5 flex items-center justify-between">
            <p className="text-sm text-blue-700 font-medium">
              Tocca il documento per posizionare: {FIELD_TYPES[tapPlaceType].label}
            </p>
            <button onClick={() => setTapPlaceType(null)} className="text-blue-600 text-sm font-semibold">Annulla</button>
          </div>
        )}

        {/* Toggle button */}
        {!tapPlaceType && (
          <button
            onClick={() => setShowMobilePalette(!showMobilePalette)}
            className="w-full bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between"
          >
            <span className="text-sm font-semibold text-gray-700">Aggiungi campo</span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showMobilePalette ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Mobile palette sheet */}
        {showMobilePalette && !tapPlaceType && (
          <div className="bg-white border-t border-gray-200 px-4 pb-6 pt-2 max-h-[50vh] overflow-y-auto">
            {/* Signer selector */}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-2 border-b border-gray-100">
              {signers.map((signer, i) => {
                const color = SIGNER_COLORS[i % SIGNER_COLORS.length]
                return (
                  <button
                    key={i}
                    onClick={() => setActiveSignerIndex(i)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      activeSignerIndex === i ? 'text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                    style={activeSignerIndex === i ? { backgroundColor: color.hex } : undefined}
                  >
                    {signer.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[...GLOBAL_FIELD_TYPES, ...SIGNER_FIELD_TYPES].map(type => (
                <button
                  key={type}
                  onClick={() => { setTapPlaceType(type); setShowMobilePalette(false) }}
                  className="flex items-center gap-2.5 px-3 py-3 rounded-xl bg-gray-50 hover:bg-blue-50 transition-colors border border-gray-100 text-left"
                >
                  <FieldIcon type={type} className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 font-medium">{FIELD_TYPES[type].label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
