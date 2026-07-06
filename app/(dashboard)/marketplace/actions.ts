'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

type OffrePourModeration = {
  id: string
  titre: string
  organisation_id: string
  created_by: string | null
}

async function chargerOffre(supabase: SupabaseServer, offreId: string): Promise<OffrePourModeration | null> {
  const { data } = await supabase
    .from('marketplace_offres')
    .select('id, titre, organisation_id, created_by')
    .eq('id', offreId)
    .single()
  return data as OffrePourModeration | null
}

/** `audit_logs` a RLS activée sans policy d'écriture pour `authenticated` (append-only
 * strict, Étape 1) : un insert direct depuis une Server Action échoue toujours en RLS.
 * `log_audit_action()` (migration 20260716000000_log_audit_action_rpc.sql, poussée) est
 * la RPC SECURITY DEFINER prévue pour ça — seule fonction autorisée à écrire dans
 * `audit_logs` pour du code applicatif, profile_id toujours auth.uid() (non falsifiable). */
async function enregistrerAudit(supabase: SupabaseServer, action: string, offreId: string, organisationId: string, donnees: Record<string, unknown>) {
  const { error } = await supabase.rpc('log_audit_action', {
    p_action: action,
    p_table_cible: 'marketplace_offres',
    p_ligne_id: offreId,
    p_donnees_apres: donnees,
    p_organisation_id: organisationId,
  })
  if (error) {
    console.error('[marketplace/actions] log_audit_action indisponible (migration non encore poussée ?) :', error.message)
  }
}

async function notifierVendeur(supabase: SupabaseServer, offre: OffrePourModeration, titre: string, contenu: string) {
  if (!offre.created_by) return
  await supabase.from('notifications').insert({
    profile_id: offre.created_by,
    organisation_id: offre.organisation_id,
    titre,
    contenu,
    type_notification: 'moderation_marketplace',
  })
}

/** Suspendre/Supprimer suivent le modèle peut_modifier scoped-organisation déjà en RLS
 * (voir PLAN_MODERATION_MARKETPLACE.md, décision structurante 2) — un rôle habilité de
 * l'organisation propriétaire peut agir sur SES offres, jamais celles d'un tiers.
 * Valider reste réservé au fondateur (contrainte déjà imposée par le trigger
 * enforce_marketplace_offre_statut depuis l'Étape 16, non dupliquée ici sauf pour
 * transformer l'exception SQL en message clair). */
async function estHabilitePourOffre(supabase: SupabaseServer, offre: OffrePourModeration): Promise<boolean> {
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  if (estFondateur) return true
  const { data: peutModifier } = await supabase.rpc('peut_modifier', {
    p_module: 'marketplace_offres',
    p_organisation_id: offre.organisation_id,
  })
  return Boolean(peutModifier)
}

export async function validerOffreMarketplace(offreId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  if (!estFondateur) return { error: 'Seul le Fondateur peut valider une offre marketplace.' }

  const offre = await chargerOffre(supabase, offreId)
  if (!offre) return { error: 'Offre introuvable.' }

  const { error } = await supabase.from('marketplace_offres').update({ statut: 'publiee' }).eq('id', offreId)
  if (error) {
    if (error.message.includes('image de couverture')) {
      return { error: 'Impossible de valider : cette offre n’a pas d’image de couverture.' }
    }
    return { error: 'Impossible de valider cette offre.' }
  }

  await enregistrerAudit(supabase, 'moderation_offre_validee', offreId, offre.organisation_id, { statut: 'publiee' })
  await notifierVendeur(
    supabase,
    offre,
    'Votre offre a été validée',
    `Votre offre « ${offre.titre} » a été validée par le Fondateur et est maintenant publiée sur la marketplace.`,
  )

  revalidatePath('/marketplace')
  return { error: null }
}

export async function suspendreOffreMarketplace(offreId: string, motif?: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const offre = await chargerOffre(supabase, offreId)
  if (!offre) return { error: 'Offre introuvable.' }
  if (!(await estHabilitePourOffre(supabase, offre))) return { error: 'Action non autorisée.' }

  const { error } = await supabase.from('marketplace_offres').update({ statut: 'masquee' }).eq('id', offreId)
  if (error) return { error: 'Impossible de suspendre cette offre.' }

  await enregistrerAudit(supabase, 'moderation_offre_suspendue', offreId, offre.organisation_id, { statut: 'masquee', motif: motif || null })
  await notifierVendeur(
    supabase,
    offre,
    'Votre offre a été suspendue',
    motif
      ? `Votre offre « ${offre.titre} » a été suspendue par la modération. Motif : ${motif}`
      : `Votre offre « ${offre.titre} » a été suspendue par la modération.`,
  )

  revalidatePath('/marketplace')
  return { error: null }
}

export async function envoyerMessageOffre(offreId: string, contenu: string): Promise<{ error: string | null }> {
  const contenuNettoye = contenu.trim()
  if (!contenuNettoye) return { error: 'Le message ne peut pas être vide.' }

  const supabase = await createClient()
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  if (!estFondateur) return { error: 'Action réservée au Fondateur.' }

  const offre = await chargerOffre(supabase, offreId)
  if (!offre) return { error: 'Offre introuvable.' }
  if (!offre.created_by) return { error: 'Impossible de contacter le vendeur : aucun profil associé à cette offre.' }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('messages').insert({
    organisation_id: offre.organisation_id,
    expediteur_id: user?.id,
    destinataire_id: offre.created_by,
    marketplace_offre_id: offreId,
    type_message: 'moderation_marketplace',
    canal: 'interne',
    contenu: contenuNettoye,
  })
  if (error) return { error: 'Impossible d’envoyer ce message.' }

  await enregistrerAudit(supabase, 'message_moderation_envoye', offreId, offre.organisation_id, { destinataire_id: offre.created_by })
  await notifierVendeur(
    supabase,
    offre,
    'Nouveau message du Fondateur',
    `Au sujet de votre offre « ${offre.titre} » : ${contenuNettoye}`,
  )

  revalidatePath('/marketplace')
  return { error: null }
}

export async function supprimerOffreMarketplace(offreId: string, motif?: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const offre = await chargerOffre(supabase, offreId)
  if (!offre) return { error: 'Offre introuvable.' }
  if (!(await estHabilitePourOffre(supabase, offre))) return { error: 'Action non autorisée.' }

  const { error } = await supabase.from('marketplace_offres').update({ statut: 'retiree' }).eq('id', offreId)
  if (error) return { error: 'Impossible de supprimer cette offre.' }

  await enregistrerAudit(supabase, 'moderation_offre_supprimee', offreId, offre.organisation_id, { statut: 'retiree', motif: motif || null })
  await notifierVendeur(
    supabase,
    offre,
    'Votre offre a été retirée',
    motif
      ? `Votre offre « ${offre.titre} » a été retirée de la marketplace par la modération. Motif : ${motif}`
      : `Votre offre « ${offre.titre} » a été retirée de la marketplace par la modération.`,
  )

  revalidatePath('/marketplace')
  return { error: null }
}
