import Link from 'next/link'
import { Plus, Pencil, X } from 'lucide-react'

type OffreExistante = {
  id: string
  type_offre: string
  titre: string
  description: string | null
  prix: number | null
  image_couverture_url: string | null
  stock_disponible: number | null
  modalites_livraison: string | null
  duree_texte: string | null
  mode_transmission: string | null
}

/** Formulaire de création/modification d'une offre produit/service, partagé entre
 * le module Compte Solo et le module Employeur — même formulaire, mêmes règles. */
export function OffreForm({
  action,
  offre,
  hrefAnnuler,
}: {
  action: (formData: FormData) => Promise<void>
  offre?: OffreExistante
  hrefAnnuler?: string
}) {
  return (
    <form action={action} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="text-text-muted text-xs mb-1 block">Type d'offre</label>
        <select name="type_offre" required defaultValue={offre?.type_offre ?? 'produit'} className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary">
          <option value="produit">Produit physique</option>
          <option value="service">Service (formation courte incluse)</option>
        </select>
      </div>
      <div>
        <label className="text-text-muted text-xs mb-1 block">Titre</label>
        <input
          name="titre"
          required
          defaultValue={offre?.titre ?? ''}
          className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
        />
      </div>
      <div className="md:col-span-2">
        <label className="text-text-muted text-xs mb-1 block">Description</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={offre?.description ?? ''}
          className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
        />
      </div>
      <div>
        <label className="text-text-muted text-xs mb-1 block">Prix (FCFA)</label>
        <input
          name="prix"
          type="number"
          min="0"
          defaultValue={offre?.prix ?? ''}
          className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
        />
      </div>
      <div>
        <label className="text-text-muted text-xs mb-1 block">Image de couverture (URL — obligatoire avant publication)</label>
        <input
          name="image_couverture_url"
          type="url"
          defaultValue={offre?.image_couverture_url ?? ''}
          className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
        />
      </div>
      <div>
        <label className="text-text-muted text-xs mb-1 block">Stock disponible (produit uniquement)</label>
        <input
          name="stock_disponible"
          type="number"
          min="0"
          defaultValue={offre?.stock_disponible ?? ''}
          className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
        />
      </div>
      <div>
        <label className="text-text-muted text-xs mb-1 block">Modalités de livraison (produit, optionnel)</label>
        <input
          name="modalites_livraison"
          defaultValue={offre?.modalites_livraison ?? ''}
          className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
        />
      </div>
      <div>
        <label className="text-text-muted text-xs mb-1 block">Durée (service, ex. "2 heures")</label>
        <input
          name="duree_texte"
          defaultValue={offre?.duree_texte ?? ''}
          className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
        />
      </div>
      <div>
        <label className="text-text-muted text-xs mb-1 block">Mode de transmission (service)</label>
        <select name="mode_transmission" defaultValue={offre?.mode_transmission ?? ''} className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary">
          <option value="">— Choisir —</option>
          <option value="presentiel">Présentiel</option>
          <option value="video_tutoriel">Vidéo-tutoriel</option>
          <option value="mixte">Mixte — tous moyens</option>
          <option value="autre">Autre</option>
        </select>
      </div>
      <div className="flex items-end gap-2.5">
        <button type="submit" className="flex items-center gap-1.5 bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
          {offre ? <Pencil size={14} /> : <Plus size={14} />}
          {offre ? 'Enregistrer les modifications' : 'Soumettre pour validation'}
        </button>
        {offre && hrefAnnuler && (
          <Link href={hrefAnnuler} className="flex items-center gap-1 text-[13px] text-text-muted hover:text-text-primary px-3 py-2">
            <X size={14} /> Annuler
          </Link>
        )}
      </div>
    </form>
  )
}
