import { createClient } from '@/lib/supabase/server'
import { FicheEntretienGeneral } from '../../../../../solo/_components/FicheEntretienGeneral'
import { FicheEntretienSpecialise } from '../../../../../solo/_components/FicheEntretienSpecialise'
import { calculerAge, SEXE_LABEL, donneesEntretienGeneralParDefaut, donneesEntretienSpecialiseParDefaut, type Interlocuteur } from '@/lib/entretiens'
import { enregistrerEntretien, mettreAJourScolarisation } from '../actions'

const COMPTE_LABEL: Record<string, string> = {
  solo: 'Compte Solo',
  structure: 'Compte Structure',
  employeur: 'Compte Employeur',
  ecole: 'Compte Structure',
  ong: 'Compte Structure',
  centre: 'Compte Structure',
}

export default async function FicheEntretienStructurePage({ params }: { params: Promise<{ id: string; entretienId: string }> }) {
  const { id, entretienId } = await params
  const supabase = await createClient()

  const [{ data: entretien }, { data: beneficiaire }, { data: dimensions }] = await Promise.all([
    supabase.from('entretiens').select('id, type_entretien, statut, date_entretien, donnees, mene_par, interlocuteur, organisation_id').eq('id', entretienId).eq('beneficiaire_id', id).single(),
    supabase.from('beneficiaires').select('id, nom, prenoms, date_naissance, sexe, scolarise, classe').eq('id', id).single(),
    supabase.from('dimensions_iga').select('id, nom').order('ordre'),
  ])

  if (!entretien || !beneficiaire) return null

  const { data: organisation } = await supabase.from('organisations').select('nom, type_organisation, logo_url').eq('id', entretien.organisation_id).single()
  if (!organisation) return null

  const { data: praticien } = entretien.mene_par
    ? await supabase.from('profiles').select('nom, prenoms').eq('id', entretien.mene_par).single()
    : { data: null }

  const beneficiaireNom = `${beneficiaire.nom} ${beneficiaire.prenoms}`.trim()
  const age = calculerAge(beneficiaire.date_naissance)
  const praticienNom = praticien ? `${praticien.prenoms ?? ''} ${praticien.nom ?? ''}`.trim() || 'Praticien' : 'Praticien'
  const organisationInfo = { nom: organisation.nom, type_organisation: organisation.type_organisation, logo_url: organisation.logo_url ?? null }
  const interlocuteurInitial = (entretien.interlocuteur ?? 'beneficiaire') as Interlocuteur
  const retourHref = `/beneficiaires/${id}`

  if (entretien.type_entretien === 'general') {
    const donnees = { ...donneesEntretienGeneralParDefaut(), ...(entretien.donnees as any) }
    return (
      <FicheEntretienGeneral
        beneficiaireId={id}
        entretienId={entretien.id}
        statutInitial={entretien.statut as 'brouillon' | 'valide'}
        donneesInitiales={donnees}
        interlocuteurInitial={interlocuteurInitial}
        dateEntretien={entretien.date_entretien}
        beneficiaireNom={beneficiaireNom}
        age={age}
        praticienNom={praticienNom}
        compteLabel={COMPTE_LABEL[organisation.type_organisation] ?? 'Compte Structure'}
        dimensions={dimensions ?? []}
        organisation={organisationInfo}
        retourHref={retourHref}
        enregistrerEntretien={enregistrerEntretien}
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
      interlocuteurInitial={interlocuteurInitial}
      dateEntretien={entretien.date_entretien}
      beneficiaireNom={beneficiaireNom}
      age={age}
      sexeLabel={SEXE_LABEL[beneficiaire.sexe] ?? beneficiaire.sexe}
      scolarise={beneficiaire.scolarise}
      classe={beneficiaire.classe}
      praticienNom={praticienNom}
      organisation={organisationInfo}
      retourHref={retourHref}
      enregistrerEntretien={enregistrerEntretien}
      mettreAJourScolarisation={mettreAJourScolarisation}
    />
  )
}
