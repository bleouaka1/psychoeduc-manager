import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from '../../../../_lib/getSoloOrg'
import { FicheEntretienGeneral } from '../../../../_components/FicheEntretienGeneral'
import { FicheEntretienSpecialise } from '../../../../_components/FicheEntretienSpecialise'
import { calculerAge, SEXE_LABEL, donneesEntretienGeneralParDefaut, donneesEntretienSpecialiseParDefaut } from '@/lib/entretiens'

const COMPTE_LABEL: Record<string, string> = {
  solo: 'Compte Solo',
  structure: 'Compte Structure',
  employeur: 'Compte Employeur',
}

export default async function FicheEntretienPage({ params }: { params: Promise<{ id: string; entretienId: string }> }) {
  const { id, entretienId } = await params
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const supabase = await createClient()

  const [{ data: entretien }, { data: beneficiaire }, { data: dimensions }] = await Promise.all([
    supabase
      .from('entretiens')
      .select('id, type_entretien, statut, date_entretien, donnees, mene_par')
      .eq('id', entretienId)
      .eq('beneficiaire_id', id)
      .eq('organisation_id', organisation.id)
      .single(),
    supabase.from('beneficiaires').select('id, nom, prenoms, date_naissance, sexe, scolarise, classe').eq('id', id).eq('organisation_id', organisation.id).single(),
    supabase.from('dimensions_iga').select('id, nom').order('ordre'),
  ])

  if (!entretien || !beneficiaire) return null

  const { data: praticien } = entretien.mene_par
    ? await supabase.from('profiles').select('nom, prenoms').eq('id', entretien.mene_par).single()
    : { data: null }

  const beneficiaireNom = `${beneficiaire.nom} ${beneficiaire.prenoms}`.trim()
  const age = calculerAge(beneficiaire.date_naissance)
  const praticienNom = praticien ? `${praticien.prenoms ?? ''} ${praticien.nom ?? ''}`.trim() || 'Praticien' : 'Praticien'
  const organisationInfo = { nom: organisation.nom, type_organisation: organisation.type_organisation, logo_url: (organisation as any).logo_url ?? null }

  if (entretien.type_entretien === 'general') {
    const donnees = { ...donneesEntretienGeneralParDefaut(), ...(entretien.donnees as any) }
    return (
      <FicheEntretienGeneral
        beneficiaireId={id}
        entretienId={entretien.id}
        statutInitial={entretien.statut as 'brouillon' | 'valide'}
        donneesInitiales={donnees}
        dateEntretien={entretien.date_entretien}
        beneficiaireNom={beneficiaireNom}
        age={age}
        praticienNom={praticienNom}
        compteLabel={COMPTE_LABEL[organisation.type_organisation] ?? organisation.type_organisation}
        dimensions={dimensions ?? []}
        organisation={organisationInfo}
      />
    )
  }

  const donnees = { ...donneesEntretienSpecialiseParDefaut(), ...(entretien.donnees as any) }
  return (
    <FicheEntretienSpecialise
      beneficiaireId={id}
      entretienId={entretien.id}
      statutInitial={entretien.statut as 'brouillon' | 'valide'}
      donneesInitiales={donnees}
      dateEntretien={entretien.date_entretien}
      beneficiaireNom={beneficiaireNom}
      age={age}
      sexeLabel={SEXE_LABEL[beneficiaire.sexe] ?? beneficiaire.sexe}
      scolarise={beneficiaire.scolarise}
      classe={beneficiaire.classe}
      praticienNom={praticienNom}
      organisation={organisationInfo}
    />
  )
}
