import { createClient } from '@/lib/supabase/server'

/**
 * Suppression définitive d'un bénéficiaire, distincte de l'archivage : si un historique
 * existe déjà (évaluation IGA, message, séance), on refuse et on propose d'archiver à la
 * place — vérifié côté serveur, pas seulement dans l'UI. Partagée entre le Compte Solo
 * et le Cockpit Fondateur (même règle, pas de logique dupliquée).
 */
export async function supprimerBeneficiaireAvecGarde(beneficiaireId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const [{ count: nbEvaluations }, { count: nbMessages }, { count: nbSeances }] = await Promise.all([
    supabase.from('evaluations_iga').select('id', { count: 'exact', head: true }).eq('beneficiaire_id', beneficiaireId),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('destinataire_beneficiaire_id', beneficiaireId),
    supabase.from('seances').select('id', { count: 'exact', head: true }).eq('beneficiaire_id', beneficiaireId),
  ])

  const totalHistorique = (nbEvaluations ?? 0) + (nbMessages ?? 0) + (nbSeances ?? 0)
  if (totalHistorique > 0) {
    return { error: `Ce bénéficiaire a un historique (${totalHistorique} élément(s) : évaluations, messages ou séances). Archivez-le à la place pour le retirer des listes actives sans perdre les données.` }
  }

  const { error } = await supabase.from('beneficiaires').delete().eq('id', beneficiaireId)
  if (error) return { error: error.message }

  return { error: null }
}
