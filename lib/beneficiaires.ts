import type { SupabaseClient } from '@supabase/supabase-js'
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

export type LigneArchiveBeneficiaire = {
  type: 'archive' | 'supprime'
  id: string | null
  nom: string
  prenoms: string
  date: string
}

/**
 * Bénéficiaires archivés (statut='archive', toujours en base) + supprimés (trace
 * conservée par le trigger d'audit sur `beneficiaires`, `donnees_avant`). Partagée
 * entre `/archives` (Cockpit Fondateur, vue globale) et `/solo/archives` (scopée à
 * l'organisation appelante) — `organisationId` omis = pas de filtre (vue Fondateur).
 * Note : les suppressions antérieures à la migration `20260719000000` n'ont pas
 * d'`organisation_id` renseigné dans `audit_logs` — elles n'apparaîtront donc pas
 * dans une vue scopée par organisation (uniquement dans la vue globale Fondateur),
 * seules les suppressions futures sont pleinement rattachées.
 */
export async function chargerArchivesBeneficiaires(supabase: SupabaseClient, organisationId?: string): Promise<LigneArchiveBeneficiaire[]> {
  let requeteArchives = supabase.from('beneficiaires').select('id, nom, prenoms, updated_at').eq('statut_beneficiaire', 'archive')
  if (organisationId) requeteArchives = requeteArchives.eq('organisation_id', organisationId)

  let requeteSuppressions = supabase.from('audit_logs').select('donnees_avant, created_at').eq('table_cible', 'beneficiaires').eq('action', 'DELETE')
  if (organisationId) requeteSuppressions = requeteSuppressions.eq('organisation_id', organisationId)

  const [{ data: archives }, { data: suppressions }] = await Promise.all([
    requeteArchives.order('updated_at', { ascending: false }).limit(200),
    requeteSuppressions.order('created_at', { ascending: false }).limit(200),
  ])

  return [
    ...(archives ?? []).map((b: any) => ({ type: 'archive' as const, id: b.id as string, nom: b.nom, prenoms: b.prenoms, date: b.updated_at })),
    ...(suppressions ?? []).map((s: any) => ({
      type: 'supprime' as const,
      id: null,
      nom: s.donnees_avant?.nom ?? '—',
      prenoms: s.donnees_avant?.prenoms ?? '—',
      date: s.created_at,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
