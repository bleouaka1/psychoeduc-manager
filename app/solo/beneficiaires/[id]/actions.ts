'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from '../../_lib/getSoloOrg'
import { enregistrerAvisBeneficiaire } from '@/lib/avisBeneficiaires'

export async function ajouterObjectif(beneficiaireId: string, formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const titre = String(formData.get('titre') ?? '').trim()
  const date_cible = String(formData.get('date_cible') ?? '') || null
  const projet_vie_id = String(formData.get('projet_vie_id') ?? '') || null
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
    projet_vie_id,
    statut: 'a_venir',
    created_by: user?.id,
  })

  revalidatePath(`/solo/beneficiaires/${beneficiaireId}`)
}

/** Un bénéficiaire peut avoir plusieurs projets de vie actifs en parallèle
 * (CLAUDE-CODE-DASHBOARD-BENEFICIAIRE.md §3.1) — créé ici par le praticien, ou
 * en autonomie par le bénéficiaire lui-même depuis /mon-espace (RLS déjà ouverte
 * aux deux, cf. migration 20260725000000). */
export async function creerProjetVieAction(beneficiaireId: string, formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const titre = String(formData.get('titre') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  if (!titre) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('projets_vie').insert({
    beneficiaire_id: beneficiaireId,
    organisation_id: organisation.id,
    titre,
    description: description || null,
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

/** Aucun portail bénéficiaire/parent n'existe (cf. PLAN_IPP_PROFIL_FORMATEUR.md) —
 * le praticien enregistre l'avis pour le compte du bénéficiaire/parent au jalon. */
export async function enregistrerAvisAction(beneficiaireId: string, formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const auteurType = String(formData.get('auteur_type') ?? 'beneficiaire') as 'beneficiaire' | 'parent_tuteur'
  const note = Number(formData.get('note') ?? 0)
  const texte = String(formData.get('texte') ?? '')
  if (!note) return

  await enregistrerAvisBeneficiaire(beneficiaireId, organisation.id, auteurType, null, note, texte, 'jalon')
  revalidatePath(`/solo/beneficiaires/${beneficiaireId}`)
}

/** Aucune UI d'édition des coordonnées n'existait jusqu'ici sur la fiche
 * bénéficiaire — un e-mail est nécessaire pour activer l'accès bénéficiaire,
 * ajouté au plus près de ce besoin plutôt qu'un formulaire d'édition complet
 * hors périmètre de ce plan. */
export async function definirEmailBeneficiaireAction(beneficiaireId: string, formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const email = String(formData.get('email') ?? '').trim()
  if (!email) return

  const supabase = await createClient()
  await supabase.from('beneficiaires').update({ email }).eq('id', beneficiaireId).eq('organisation_id', organisation.id)
  revalidatePath(`/solo/beneficiaires/${beneficiaireId}`)
}

/** Activation de l'accès bénéficiaire (CLAUDE-CODE-COMPTES-MULTIPROFILS.md) : le
 * praticien déclenche l'invitation, jamais un self-signup public — pas de service
 * d'e-mail transactionnel dans ce projet, le lien généré est partagé manuellement
 * par le praticien (même geste que la messagerie directe WhatsApp/Email déjà en
 * place). Idempotent : ne crée pas de doublon si une invitation est déjà en attente. */
export async function activerAccesBeneficiaireAction(beneficiaireId: string): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const supabase = await createClient()
  const { data: beneficiaire } = await supabase.from('beneficiaires').select('email, profile_id').eq('id', beneficiaireId).maybeSingle()
  if (!beneficiaire || beneficiaire.profile_id || !beneficiaire.email) return

  const { count } = await supabase
    .from('invitations_utilisateurs')
    .select('id', { count: 'exact', head: true })
    .eq('beneficiaire_id', beneficiaireId)
    .eq('statut', 'en_attente')
  if ((count ?? 0) > 0) return

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('invitations_utilisateurs').insert({
    organisation_id: organisation.id,
    email: beneficiaire.email,
    role_propose: 'beneficiaire',
    beneficiaire_id: beneficiaireId,
    invite_par: user?.id,
  })

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
