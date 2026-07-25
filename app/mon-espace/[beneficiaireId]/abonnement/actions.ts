'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Démarre un abonnement — bloquée tant qu'aucun prestataire de paiement n'est
 * configuré (même garde-fou que demarrerGenerationCv/genererQuizPayant). Le code
 * complet (confirmation, activation) est écrit via confirmer_abonnement_base() (RPC
 * service_role uniquement, cf. migration 20260740000000) mais inatteignable depuis
 * cette action tant que ABONNEMENT_PAIEMENT_PROVIDER est absent.
 */
export async function demarrerAbonnementBase(
  beneficiaireId: string,
  typeFormule: 'base' | 'pack_2_matieres' | 'tout_inclus',
): Promise<{ error: string | null }> {
  if (!process.env.ABONNEMENT_PAIEMENT_PROVIDER) {
    return {
      error: 'Le paiement de l’abonnement n’est pas encore activé sur cette instance (aucun prestataire configuré). Demande à ta structure ou à un parent de le prendre en charge en attendant.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  // Inatteignable sans ABONNEMENT_PAIEMENT_PROVIDER — laissé ici pour montrer le flux
  // complet une fois un prestataire choisi (redirection checkout réelle à ajouter).
  void typeFormule
  revalidatePath(`/mon-espace/${beneficiaireId}/abonnement`)
  return { error: 'Le paiement de l’abonnement n’est pas encore activé sur cette instance.' }
}
