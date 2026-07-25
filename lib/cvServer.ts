import type { SupabaseClient } from '@supabase/supabase-js'
import type { DonneesSourceCv } from './cv'
import { chargerFormationsAvecIcc } from './iccServer'
import { agregerScoresIcc } from './icc'
import { chargerBoussoleAutonomie } from './beneficiaireDashboard'
import { chargerProjetsAvecProgression } from './projetVie'

/** Agrège les données source pour la génération de CV d'un bénéficiaire (§2.2) —
 * réutilise les mêmes lectures que le dashboard bénéficiaire (Boussole, ICC, projets
 * de vie), jamais une nouvelle copie de cette logique. Les autres types de compte
 * (Solo, Structure, Employeur) auront leur propre fonction d'agrégation plus tard
 * (saisie manuelle probable, pas de profil ICC/IGA pour eux) — différé au §4. */
export async function chargerDonneesCvBeneficiaire(
  supabase: SupabaseClient,
  beneficiaireId: string,
  identite: { prenoms: string; nom: string; organisationNom: string | null },
): Promise<DonneesSourceCv> {
  const [boussole, formationsIcc, projets] = await Promise.all([
    chargerBoussoleAutonomie(supabase, beneficiaireId),
    chargerFormationsAvecIcc(supabase, beneficiaireId),
    chargerProjetsAvecProgression(supabase, beneficiaireId),
  ])

  return {
    prenoms: identite.prenoms,
    nom: identite.nom,
    organisationNom: identite.organisationNom,
    scoreIga: boussole.scoreGlobal,
    niveauIga: boussole.niveau,
    icc: agregerScoresIcc(formationsIcc.map((f) => f.score)),
    formations: formationsIcc.map((f) => f.formationTitre).filter(Boolean),
    projetsVie: projets.filter((p) => p.statut !== 'abandonne' && p.titre).map((p) => p.titre as string),
  }
}

export type CvGeneration = {
  id: string
  statut: 'en_attente' | 'confirme' | 'echoue'
  montantPaye: number
  devise: string
  contenuJson: unknown
  createdAt: string
}

export async function chargerHistoriqueCv(supabase: SupabaseClient, compteId: string): Promise<CvGeneration[]> {
  const { data } = await supabase
    .from('cv_generations')
    .select('id, statut, montant_paye, devise, contenu_json, created_at')
    .eq('compte_id', compteId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((g: any) => ({
    id: g.id,
    statut: g.statut,
    montantPaye: Number(g.montant_paye),
    devise: g.devise,
    contenuJson: g.contenu_json,
    createdAt: g.created_at,
  }))
}
