'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from '../_lib/getSoloOrg'

// Ces actions sont branchées directement sur `<form action={...}>` (pas de useActionState
// dans ce composant serveur) : React 19 exige qu'une action de formulaire retourne void.
// Les erreurs de validation restent défendues côté serveur (garde-fou), mais ne sont pas
// remontées à l'UI ici — cohérent avec le comportement déjà en place pour ces formulaires.
export async function creerFormation(formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const titre = String(formData.get('titre') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const duree_texte = String(formData.get('duree_texte') ?? '').trim()
  const mode_transmission = String(formData.get('mode_transmission') ?? '') || null
  const prixRaw = String(formData.get('prix') ?? '').trim()
  const prix = prixRaw ? Number(prixRaw) : null

  if (!titre) return

  await supabase.from('formations').insert({
    organisation_id: organisation.id,
    titre,
    description: description || null,
    duree_texte: duree_texte || null,
    mode_transmission,
    prix,
    statut: 'brouillon',
    created_by: user?.id,
  })

  revalidatePath('/solo/formations')
}

async function changerStatut(formationId: string, statut: 'publiee' | 'suspendue' | 'archivee' | 'brouillon'): Promise<void> {
  const supabase = await createClient()
  await supabase.from('formations').update({ statut }).eq('id', formationId)
  revalidatePath('/solo/formations')
}

export async function publierFormation(formationId: string): Promise<void> {
  return changerStatut(formationId, 'publiee')
}

export async function suspendreFormation(formationId: string): Promise<void> {
  return changerStatut(formationId, 'suspendue')
}

export async function archiverFormation(formationId: string): Promise<void> {
  return changerStatut(formationId, 'archivee')
}

export async function modifierFormation(formationId: string, formData: FormData): Promise<void> {
  const supabase = await createClient()

  const titre = String(formData.get('titre') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const duree_texte = String(formData.get('duree_texte') ?? '').trim()
  const mode_transmission = String(formData.get('mode_transmission') ?? '') || null
  const prixRaw = String(formData.get('prix') ?? '').trim()
  const prix = prixRaw ? Number(prixRaw) : null

  if (!titre) return

  await supabase
    .from('formations')
    .update({
      titre,
      description: description || null,
      duree_texte: duree_texte || null,
      mode_transmission,
      prix,
    })
    .eq('id', formationId)

  revalidatePath('/solo/formations')
}

/**
 * Suppression définitive, distincte de l'archivage : si des élèves sont déjà
 * inscrits, on refuse (leur accès et leur progression ne doivent pas disparaître)
 * et on suggère l'archivage à la place. Vérifié côté serveur, pas seulement dans l'UI.
 */
export async function supprimerFormation(formationId: string) {
  const supabase = await createClient()

  const { count } = await supabase
    .from('inscriptions_formations')
    .select('id', { count: 'exact', head: true })
    .eq('formation_id', formationId)

  if (count && count > 0) {
    return { error: `Impossible de supprimer : ${count} élève(s) déjà inscrit(s). Archivez la formation à la place pour préserver leur accès et leur historique.` }
  }

  const { error } = await supabase.from('formations').delete().eq('id', formationId)
  if (error) return { error: error.message }

  revalidatePath('/solo/formations')
  return { error: null }
}
