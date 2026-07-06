'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from '../../_lib/getSoloOrg'

export async function ajouterObjectif(beneficiaireId: string, formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const titre = String(formData.get('titre') ?? '').trim()
  const date_cible = String(formData.get('date_cible') ?? '') || null
  if (!titre) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('objectifs_beneficiaire').insert({
    beneficiaire_id: beneficiaireId,
    organisation_id: organisation.id,
    titre,
    date_cible,
    statut: 'a_venir',
    created_by: user?.id,
  })

  revalidatePath(`/solo/beneficiaires/${beneficiaireId}`)
}

const PROCHAIN_STATUT: Record<string, string> = {
  a_venir: 'en_cours',
  en_cours: 'atteint',
}

export async function avancerObjectif(beneficiaireId: string, objectifId: string, statutActuel: string): Promise<void> {
  const prochain = PROCHAIN_STATUT[statutActuel]
  if (!prochain) return

  const supabase = await createClient()
  await supabase
    .from('objectifs_beneficiaire')
    .update({ statut: prochain, atteint_le: prochain === 'atteint' ? new Date().toISOString() : null })
    .eq('id', objectifId)

  revalidatePath(`/solo/beneficiaires/${beneficiaireId}`)
}

export async function envoyerMessageBeneficiaire(beneficiaireId: string, formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const contenu = String(formData.get('contenu') ?? '').trim()
  const type_message = String(formData.get('type_message') ?? 'suivi')
  if (!contenu || !['suivi', 'entretien', 'signalement'].includes(type_message)) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('messages').insert({
    organisation_id: organisation.id,
    expediteur_id: user?.id,
    destinataire_beneficiaire_id: beneficiaireId,
    contenu,
    type_message,
    canal: 'interne',
    created_by: user?.id,
  })

  revalidatePath(`/solo/beneficiaires/${beneficiaireId}`)
}
