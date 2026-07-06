'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from '../_lib/getSoloOrg'

export async function ajouterBeneficiaire(formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const nom = String(formData.get('nom') ?? '').trim()
  const prenoms = String(formData.get('prenoms') ?? '').trim()
  const commeDemande = formData.get('comme_demande') === 'on'
  if (!nom || !prenoms) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('beneficiaires').insert({
    organisation_id: organisation.id,
    nom,
    prenoms,
    statut_beneficiaire: commeDemande ? 'en_attente' : 'actif',
    created_by: user?.id,
  })

  revalidatePath('/solo/beneficiaires')
}

export async function validerDemande(beneficiaireId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase
    .from('beneficiaires')
    .update({ statut_beneficiaire: 'actif', valide_par: user?.id, date_validation: new Date().toISOString() })
    .eq('id', beneficiaireId)

  revalidatePath('/solo/beneficiaires')
}

export async function refuserDemande(beneficiaireId: string, formData: FormData): Promise<void> {
  const motif = String(formData.get('motif') ?? '').trim()
  const supabase = await createClient()

  await supabase.from('beneficiaires').update({ statut_beneficiaire: 'refuse', motif_refus: motif || null }).eq('id', beneficiaireId)

  revalidatePath('/solo/beneficiaires')
}

export async function archiverBeneficiaire(beneficiaireId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('beneficiaires').update({ statut_beneficiaire: 'archive' }).eq('id', beneficiaireId)
  revalidatePath('/solo/beneficiaires')
}

/**
 * Suppression définitive, distincte de l'archivage : si un historique existe déjà
 * (évaluation IGA, message, séance), on refuse et on propose d'archiver à la place —
 * vérifié côté serveur, pas seulement dans l'UI.
 */
export async function supprimerBeneficiaire(beneficiaireId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const [{ count: nbEvaluations }, { count: nbMessages }, { count: nbSeances }] = await Promise.all([
    supabase.from('evaluations_iga').select('id', { count: 'exact', head: true }).eq('beneficiaire_id', beneficiaireId),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('destinataire_beneficiaire_id', beneficiaireId),
    supabase.from('seances').select('id', { count: 'exact', head: true }).eq('beneficiaire_id', beneficiaireId),
  ])

  const totalHistorique = (nbEvaluations ?? 0) + (nbMessages ?? 0) + (nbSeances ?? 0)
  if (totalHistorique > 0) {
    return { error: `Ce bénéficiaire a un historique (${totalHistorique} élément(s) : évaluations, messages ou séances). Archivez-le à la place pour le retirer de vos listes actives sans perdre les données.` }
  }

  const { error } = await supabase.from('beneficiaires').delete().eq('id', beneficiaireId)
  if (error) return { error: error.message }

  revalidatePath('/solo/beneficiaires')
  return { error: null }
}
