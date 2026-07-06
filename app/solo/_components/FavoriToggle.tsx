'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { basculerFavori } from '../marketplace/actions'

export function FavoriToggle({ offreType, offreId, actif }: { offreType: 'formation' | 'marketplace_offre'; offreId: string; actif: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={actif ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      onClick={() =>
        startTransition(async () => {
          await basculerFavori(offreType, offreId)
          router.refresh()
        })
      }
      className="disabled:opacity-50"
    >
      <Heart size={16} className={actif ? 'text-danger fill-danger' : 'text-text-muted'} />
    </button>
  )
}
