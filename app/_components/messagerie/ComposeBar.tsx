'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Paperclip, FileWarning } from 'lucide-react'

const TYPES_DOCUMENT_PRESETS = ['Attestation de domicile', 'Pièce d’identité', 'Certificat médical', 'Attestation de scolarité', 'Autre']

export function ComposeBar({
  peutDemanderPiece,
  envoyerMessage,
  envoyerPieceJointe,
  demanderPiece,
}: {
  peutDemanderPiece: boolean
  envoyerMessage: (formData: FormData) => Promise<void>
  envoyerPieceJointe: (formData: FormData) => Promise<{ error: string | null }>
  demanderPiece: (formData: FormData) => Promise<void>
}) {
  const router = useRouter()
  const [contenu, setContenu] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [demandeOuverte, setDemandeOuverte] = useState(false)
  const [typeDocument, setTypeDocument] = useState(TYPES_DOCUMENT_PRESETS[0])
  const fichierRef = useRef<HTMLInputElement>(null)

  async function envoyer() {
    if (!contenu.trim()) return
    setEnCours(true)
    const fd = new FormData()
    fd.set('contenu', contenu)
    await envoyerMessage(fd)
    setEnCours(false)
    setContenu('')
    router.refresh()
  }

  async function choisirFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setEnCours(true)
    setErreur(null)
    const fd = new FormData()
    fd.set('fichier', fichier)
    const res = await envoyerPieceJointe(fd)
    setEnCours(false)
    if (res?.error) setErreur(res.error)
    if (fichierRef.current) fichierRef.current.value = ''
    router.refresh()
  }

  async function envoyerDemande() {
    const fd = new FormData()
    fd.set('type_document', typeDocument)
    fd.set('note', '')
    await demanderPiece(fd)
    setDemandeOuverte(false)
    router.refresh()
  }

  return (
    <div className="border-t border-border-soft pt-4">
      {erreur && (
        <p className="text-danger text-[12px] mb-2 flex items-center gap-1.5">
          <FileWarning size={13} /> {erreur}
        </p>
      )}
      {demandeOuverte && (
        <div className="flex gap-2 mb-3 items-center">
          <select
            value={typeDocument}
            onChange={(e) => setTypeDocument(e.target.value)}
            className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-[12.5px] text-text-primary"
          >
            {TYPES_DOCUMENT_PRESETS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button type="button" onClick={envoyerDemande} className="text-[12px] font-semibold text-bg-base bg-status-warn rounded-full px-3.5 py-2">
            Envoyer la demande
          </button>
          <button type="button" onClick={() => setDemandeOuverte(false)} className="text-[12px] text-text-muted px-2">
            Annuler
          </button>
        </div>
      )}
      <div className="flex gap-2 items-end">
        <textarea
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          placeholder="Écrire un message…"
          rows={2}
          className="flex-1 bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim resize-none"
        />
        <label className="flex items-center justify-center w-10 h-10 rounded-lg border border-border-soft text-text-muted hover:text-text-primary cursor-pointer shrink-0" title="Joindre un fichier (PDF, JPG, PNG — 10 Mo max)">
          <Paperclip size={16} />
          <input ref={fichierRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={choisirFichier} className="hidden" />
        </label>
        {peutDemanderPiece && (
          <button
            type="button"
            onClick={() => setDemandeOuverte(true)}
            className="text-[12px] font-semibold text-bg-base bg-status-warn rounded-full px-3.5 py-2.5 shrink-0"
          >
            Demander une pièce
          </button>
        )}
        <button
          type="button"
          disabled={enCours || !contenu.trim()}
          onClick={envoyer}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-bg-base bg-accent-gold rounded-full px-4 py-2.5 disabled:opacity-50 shrink-0"
        >
          <Send size={14} /> {enCours ? '…' : 'Envoyer'}
        </button>
      </div>
    </div>
  )
}
