import type { SupabaseClient } from '@supabase/supabase-js'
import type { FormulaireCv } from './cv'
import { formulaireCvVide } from './cv'
import { chargerCompetencesParDimension } from './iccServer'

/**
 * Pré-remplit le formulaire de CV à partir du profil ICC d'un bénéficiaire — un
 * RACCOURCI DE SAISIE optionnel (§2.2, révision), jamais une dépendance technique :
 * le générateur de CV reste pleinement fonctionnel sans jamais appeler cette fonction
 * (formulaireCvVide suffit pour tous les autres types de compte). Ne pré-remplit que
 * les formations et les compétences validées — l'IGA (autonomie générale) et les
 * projets de vie ne correspondent à aucun champ honnête du formulaire standard,
 * jamais forcés dans un champ qui leur convient mal.
 */
export async function preremplirFormulaireCv(supabase: SupabaseClient, beneficiaireId: string, prenoms: string, nom: string): Promise<FormulaireCv> {
  const competences = await chargerCompetencesParDimension(supabase, beneficiaireId)

  const formationsTitres = new Set<string>()
  const { data: formationsIcc } = await supabase
    .from('icc_evaluations_savoir')
    .select('icc_competences(formations(titre))')
    .eq('beneficiaire_id', beneficiaireId)
  for (const f of (formationsIcc ?? []) as any[]) {
    const titre = f.icc_competences?.formations?.titre
    if (titre) formationsTitres.add(titre)
  }

  const competencesValidees = [...competences.savoirs, ...competences.savoirFaire].filter((c) => c.statut === 'valide').map((c) => c.libelle)

  const base = formulaireCvVide(prenoms, nom)
  return {
    ...base,
    formations: Array.from(formationsTitres).map((titre) => ({ titre, etablissement: '', periode: '' })),
    competences: competencesValidees,
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
