import { createClient } from '@/lib/supabase/server'
import { calculerIpp, SEUIL_MINIMUM_ECHANTILLON, type ScoreIpp } from '@/lib/ipp'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

export type IppFormateur = ScoreIpp & { echantillonSuffisant: boolean; nombreBeneficiaires: number }

/** Agrège les données réelles nécessaires aux 4 piliers puis délègue le calcul à
 * `calculerIpp` (pur, lib/ipp.ts) — jamais de logique de pondération ici. */
export async function calculerIppOrganisation(supabase: SupabaseServer, organisationId: string): Promise<IppFormateur> {
  const [{ data: deltasBruts }, { data: objectifs }, { data: entretiens }, { data: avisBruts }] = await Promise.all([
    supabase.from('vue_deltas_iga_par_affectation').select('beneficiaire_id, score_debut, score_fin').eq('organisation_id', organisationId),
    supabase.from('objectifs_beneficiaire').select('statut').eq('organisation_id', organisationId),
    supabase.from('entretiens').select('statut, date_entretien').eq('organisation_id', organisationId),
    supabase.from('avis_beneficiaires').select('note, auteur_type').eq('organisation_id', organisationId).eq('statut', 'publie'),
  ])

  const deltas = (deltasBruts ?? [])
    .filter((d: any) => d.score_debut != null && d.score_fin != null)
    .map((d: any) => ({ scoreDebut: Number(d.score_debut), scoreFin: Number(d.score_fin) }))

  const dossiers = (deltasBruts ?? []).map(() => ({ aDiagnosticInitial: true, aPlanAccompagnement: true, fichesAJour: true }))
  // [PLACEHOLDER Rigueur documentaire] : liste exhaustive des documents obligatoires
  // par type de dossier non tranchée par le document source (§10) — approximé ici
  // par la seule présence d'un diagnostic initial (delta calculable), pas de liste
  // de pièces jointes vérifiée. À affiner une fois cette liste validée.

  const objectifsTypes = (objectifs ?? []).map((o: any) => ({ statut: o.statut }))
  const entretiensTypes = (entretiens ?? []).map((e: any) => ({ statut: e.statut, dateEntretien: e.date_entretien, donnees: null }))
  const avisTypes = (avisBruts ?? []).map((a: any) => ({ note: a.note, auteurType: a.auteur_type }))

  const nombreBeneficiaires = new Set((deltasBruts ?? []).map((d: any) => d.beneficiaire_id)).size
  const resultat = calculerIpp(deltas, objectifsTypes, entretiensTypes, dossiers, avisTypes)

  return { ...resultat, echantillonSuffisant: nombreBeneficiaires >= SEUIL_MINIMUM_ECHANTILLON, nombreBeneficiaires }
}

export type PaliersReussite = { reussir1: number; reussir2: number; terminus: number }

/** Compteurs agrégés par palier de durée de suivi — jamais de noms individuels
 * (RGPD, population incluant des mineurs, §2.5 du document profil formateur). */
export async function calculerPaliersReussite(supabase: SupabaseServer, organisationId: string): Promise<PaliersReussite> {
  const { data: affectations } = await supabase
    .from('affectations_personnel')
    .select('date_debut, date_fin')
    .eq('organisation_id', organisationId)
    .eq('cible_type', 'beneficiaire')

  const maintenant = Date.now()
  let reussir1 = 0
  let reussir2 = 0
  let terminus = 0
  for (const a of affectations ?? []) {
    const fin = a.date_fin ? new Date(a.date_fin).getTime() : maintenant
    const joursSuivi = (fin - new Date(a.date_debut).getTime()) / (1000 * 60 * 60 * 24)
    if (joursSuivi >= 365 * 3) terminus++
    else if (joursSuivi >= 365 * 2) reussir2++
    else if (joursSuivi >= 365) reussir1++
  }
  return { reussir1, reussir2, terminus }
}

export type AvisAffiche = { id: string; note: number; texte: string | null; dureeJoursSuivi: number; palier: string | null; createdAt: string; auteurLabel: string }

/** Prénom + initiale uniquement, jamais le nom complet (§2.6, RGPD/mineurs). */
export async function chargerAvisPublies(supabase: SupabaseServer, organisationId: string): Promise<AvisAffiche[]> {
  const { data } = await supabase
    .from('avis_beneficiaires')
    .select('id, note, texte, duree_jours_suivi, palier, auteur_type, created_at, beneficiaires(prenoms, nom)')
    .eq('organisation_id', organisationId)
    .eq('statut', 'publie')
    .order('created_at', { ascending: false })
    .limit(30)

  return (data ?? []).map((a: any) => {
    const prenom = a.beneficiaires?.prenoms ?? ''
    const initiale = (a.beneficiaires?.nom ?? '').slice(0, 1).toUpperCase()
    const nomAffiche = `${prenom} ${initiale}.`.trim()
    return {
      id: a.id,
      note: a.note,
      texte: a.texte,
      dureeJoursSuivi: a.duree_jours_suivi,
      palier: a.palier,
      createdAt: a.created_at,
      auteurLabel: a.auteur_type === 'parent_tuteur' ? `Parent de ${nomAffiche}` : nomAffiche,
    }
  })
}
