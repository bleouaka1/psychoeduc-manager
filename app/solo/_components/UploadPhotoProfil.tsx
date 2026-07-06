'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { enregistrerPhotoProfil } from '../profil-actions'

const BUCKET = 'photos-profil'

/**
 * Recadrage carré appliqué côté UI via l'API Canvas native du navigateur (pas de
 * librairie de crop ajoutée pour ce seul besoin) : la plus grande zone carrée
 * centrée de l'image choisie est automatiquement découpée avant l'upload.
 */
function recadrerEnCarre(image: HTMLImageElement): Promise<Blob> {
  const taille = Math.min(image.naturalWidth, image.naturalHeight)
  const decalageX = (image.naturalWidth - taille) / 2
  const decalageY = (image.naturalHeight - taille) / 2

  const canvas = document.createElement('canvas')
  const cible = 480
  canvas.width = cible
  canvas.height = cible
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, decalageX, decalageY, taille, taille, 0, 0, cible, cible)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Échec du recadrage'))), 'image/jpeg', 0.9)
  })
}

export function UploadPhotoProfil({ organisationId, photoActuelle }: { organisationId: string; photoActuelle: string | null }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [apercu, setApercu] = useState<string | null>(photoActuelle)

  async function onFichierChoisi(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setErreur(null)
    setEnCours(true)
    try {
      const image = new Image()
      const urlLocale = URL.createObjectURL(fichier)
      await new Promise((resolve, reject) => {
        image.onload = resolve
        image.onerror = reject
        image.src = urlLocale
      })

      const blobCarre = await recadrerEnCarre(image)
      URL.revokeObjectURL(urlLocale)

      const supabase = createClient()
      const chemin = `${organisationId}/${Date.now()}.jpg`
      const { error: erreurUpload } = await supabase.storage.from(BUCKET).upload(chemin, blobCarre, { contentType: 'image/jpeg', upsert: true })
      if (erreurUpload) {
        setErreur("Échec de l'envoi de la photo.")
        return
      }

      const { data: urlPublique } = supabase.storage.from(BUCKET).getPublicUrl(chemin)
      await enregistrerPhotoProfil(urlPublique.publicUrl)
      setApercu(urlPublique.publicUrl)
      router.refresh()
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-accent-teal to-accent-teal-dim flex items-center justify-center shrink-0">
        {apercu ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={apercu} alt="Photo de profil" className="w-full h-full object-cover" />
        ) : (
          <Camera size={22} className="text-bg-base" />
        )}
      </div>
      <div>
        <button
          type="button"
          disabled={enCours}
          onClick={() => inputRef.current?.click()}
          className="text-[12.5px] text-accent-gold border border-accent-gold-dim/50 rounded-full px-3.5 py-1.5 disabled:opacity-60"
        >
          {enCours ? 'Envoi…' : 'Changer la photo'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFichierChoisi} />
        {erreur && <p className="text-danger text-[11.5px] mt-1">{erreur}</p>}
      </div>
    </div>
  )
}
