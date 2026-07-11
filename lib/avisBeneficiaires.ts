import { createClient } from '@/lib/supabase/server'

/** Soumission d'un avis — adaptation nécessaire : aucun portail bénéficiaire ni
 * compte parent/tuteur n'existe dans ce projet (limite déjà documentée pour la
 * messagerie interne et le mécanisme IGA→Marketplace). Le praticien enregistre
 * l'avis pour le compte du bénéficiaire/parent au moment du jalon, plutôt que le
 * bénéficiaire lui-même via un espace self-service inexistant. */
export async function enregistrerAvisBeneficiaire(
  beneficiaireId: string,
  organisationId: string,
  auteurType: 'beneficiaire' | 'parent_tuteur',
  parentTuteurId: string | null,
  note: number,
  texte: string,
  declencheur: 'jalon' | 'periodique' | 'silencieux',
): Promise<{ error: string | null }> {
  if (note < 1 || note > 5) return { error: 'La note doit être comprise entre 1 et 5.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: beneficiaire } = await supabase.from('beneficiaires').select('created_at').eq('id', beneficiaireId).maybeSingle()
  if (!beneficiaire) return { error: 'Bénéficiaire introuvable.' }

  const dureeJoursSuivi = Math.floor((Date.now() - new Date(beneficiaire.created_at).getTime()) / (1000 * 60 * 60 * 24))
  const palier = dureeJoursSuivi >= 365 * 3 ? 'terminus' : dureeJoursSuivi >= 365 * 2 ? 'reussir_2' : dureeJoursSuivi >= 365 ? 'reussir_1' : null

  const { error } = await supabase.from('avis_beneficiaires').insert({
    beneficiaire_id: beneficiaireId,
    organisation_id: organisationId,
    auteur_type: auteurType,
    parent_tuteur_id: parentTuteurId,
    note,
    texte: texte.trim() || null,
    duree_jours_suivi: dureeJoursSuivi,
    palier,
    declencheur,
    created_by: user?.id,
  })

  return { error: error ? 'Impossible d’enregistrer l’avis.' : null }
}

export async function moderarAvisBeneficiaire(avisId: string, statut: 'publie' | 'masque' | 'retiree'): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  if (!estFondateur) return { error: 'Seul le Fondateur peut modérer un avis.' }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('avis_beneficiaires')
    .update({ statut, valide_par: user?.id, date_validation: new Date().toISOString() })
    .eq('id', avisId)

  return { error: error ? 'Impossible de modérer cet avis.' : null }
}
