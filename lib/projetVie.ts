import type { SupabaseClient } from '@supabase/supabase-js'

/** Fil d'activité du Projet de vie (CLAUDE-CODE-DASHBOARD-BENEFICIAIRE.md §3.2) —
 * calculé à la lecture depuis des événements déjà en base, jamais stocké ("vue
 * plutôt que table dupliquée", même principe que l'IPP). Messages-modèles
 * pré-écrits déclenchés par des règles simples, aucune génération IA.
 *
 * Portée V1 : 4 des 5 déclencheurs du document sont implémentés de façon fiable
 * (données structurées existantes). Le 5e ("Nouveau frein identifié", bloc
 * Constat d'une fiche entretien) est explicitement différé : `entretiens.donnees`
 * est un jsonb libre sans schéma fixe (aucun champ "frein" défini) et son contenu
 * n'est de toute façon jamais exposé au bénéficiaire dans cette V1 (cf. migration
 * 20260725000000). Documenté ici plutôt que simulé par un texte trompeur. */

export type TypeEvenementFil = 'objectif_atteint' | 'formation_validee' | 'dimension_en_hausse' | 'palier_atteint'

export type EvenementFilActivite = {
  type: TypeEvenementFil
  date: string
  message: string
  projetVieId: string | null
}

const SEUIL_HAUSSE_DIMENSION_SIGNIFICATIVE = 15 // points sur 100 — [PLACEHOLDER], à ajuster avec des données réelles

export type Projet = { id: string; titre: string | null; description: string | null; statut: string; createdAt: string }

export async function chargerProjetsVie(supabase: SupabaseClient, beneficiaireId: string): Promise<Projet[]> {
  const { data } = await supabase
    .from('projets_vie')
    .select('id, titre, description, statut, created_at')
    .eq('beneficiaire_id', beneficiaireId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((p: any) => ({ id: p.id, titre: p.titre, description: p.description, statut: p.statut, createdAt: p.created_at }))
}

export type ProjetAvecProgression = Projet & { progression: number | null; nombreObjectifs: number }

/** Progression = part des objectifs rattachés à CE projet marqués "atteint" —
 * null tant qu'aucun objectif n'y est rattaché (jamais 0% par défaut, même
 * garde-fou que le reste du projet pour les scores sans données). */
export async function chargerProjetsAvecProgression(supabase: SupabaseClient, beneficiaireId: string): Promise<ProjetAvecProgression[]> {
  const [projets, { data: objectifs }] = await Promise.all([
    chargerProjetsVie(supabase, beneficiaireId),
    supabase.from('objectifs_beneficiaire').select('projet_vie_id, statut').eq('beneficiaire_id', beneficiaireId).not('projet_vie_id', 'is', null),
  ])

  return projets.map((p) => {
    const objectifsProjet = (objectifs ?? []).filter((o: any) => o.projet_vie_id === p.id)
    if (objectifsProjet.length === 0) return { ...p, progression: null, nombreObjectifs: 0 }
    const atteints = objectifsProjet.filter((o: any) => o.statut === 'atteint').length
    return { ...p, progression: Math.round((atteints / objectifsProjet.length) * 100), nombreObjectifs: objectifsProjet.length }
  })
}

export async function chargerFilActivite(supabase: SupabaseClient, beneficiaireId: string): Promise<EvenementFilActivite[]> {
  const { data: beneficiaire } = await supabase.from('beneficiaires').select('profile_id, created_at').eq('id', beneficiaireId).maybeSingle()

  const [{ data: objectifs }, { data: evaluations }] = await Promise.all([
    supabase
      .from('objectifs_beneficiaire')
      .select('titre, atteint_le, projet_vie_id')
      .eq('beneficiaire_id', beneficiaireId)
      .eq('statut', 'atteint')
      .not('atteint_le', 'is', null),
    supabase.from('evaluations_iga').select('id, date_evaluation').eq('beneficiaire_id', beneficiaireId).order('date_evaluation', { ascending: false }).limit(2),
  ])

  const evenements: EvenementFilActivite[] = (objectifs ?? []).map((o: any) => ({
    type: 'objectif_atteint',
    date: o.atteint_le,
    message: `Étape franchie : ${o.titre}`,
    projetVieId: o.projet_vie_id,
  }))

  // Formation validée : nécessite le profile_id du bénéficiaire (acheteur_id sur
  // inscriptions_formations), absent tant que l'accès bénéficiaire n'est pas activé.
  if (beneficiaire?.profile_id) {
    const { data: formations } = await supabase
      .from('inscriptions_formations')
      .select('formations(titre), updated_at')
      .eq('acheteur_id', beneficiaire.profile_id)
      .eq('statut', 'termine')

    for (const f of (formations ?? []) as any[]) {
      evenements.push({ type: 'formation_validee', date: f.updated_at, message: `Tu as terminé ${f.formations?.titre ?? 'une formation'} — une étape de plus`, projetVieId: null })
    }
  }

  // Dimension IGA en hausse significative : compare les deux dernières évaluations.
  if ((evaluations ?? []).length === 2) {
    const [recente, precedente] = evaluations as any[]
    const [{ data: scoresRecents }, { data: scoresPrecedents }] = await Promise.all([
      supabase.from('scores_iga').select('score, dimension_id, dimensions_iga(nom)').eq('evaluation_id', recente.id),
      supabase.from('scores_iga').select('score, dimension_id').eq('evaluation_id', precedente.id),
    ])
    const scorePrecedentParDim = new Map((scoresPrecedents ?? []).map((s: any) => [s.dimension_id, Number(s.score)]))
    for (const s of (scoresRecents ?? []) as any[]) {
      const avant = scorePrecedentParDim.get(s.dimension_id)
      if (avant != null && Number(s.score) - avant >= SEUIL_HAUSSE_DIMENSION_SIGNIFICATIVE) {
        evenements.push({ type: 'dimension_en_hausse', date: recente.date_evaluation, message: `Progrès notable sur ${s.dimensions_iga?.nom ?? 'une dimension'}`, projetVieId: null })
      }
    }
  }

  // Palier de réussite (durée de suivi, même seuils que le module IPP formateur).
  if (beneficiaire?.created_at) {
    const joursSuivi = (Date.now() - new Date(beneficiaire.created_at).getTime()) / (1000 * 60 * 60 * 24)
    const palier = joursSuivi >= 365 * 3 ? 'Terminus' : joursSuivi >= 365 * 2 ? 'Réussir 2' : joursSuivi >= 365 ? 'Réussir 1' : null
    if (palier) {
      evenements.push({ type: 'palier_atteint', date: beneficiaire.created_at, message: `Palier franchi : ${palier}`, projetVieId: null })
    }
  }

  return evenements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
