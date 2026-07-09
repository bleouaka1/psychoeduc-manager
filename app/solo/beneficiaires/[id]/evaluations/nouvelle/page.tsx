import Link from 'next/link'
import { Gauge } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel } from '../../../../../(dashboard)/_components/ui'
import { getSoloOrganisation } from '../../../../_lib/getSoloOrg'
import { suggererReferentiel, REFERENTIEL_LABEL, type CodeReferentielIga } from '@/lib/iga'
import { creerEvaluationIga } from '../actions'

const CODES_REFERENTIELS: CodeReferentielIga[] = ['iga_e', 'iga_a', 'iga_j', 'iga_ad']

export default async function NouvelleEvaluationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ referentiel?: string }>
}) {
  const { id } = await params
  const { referentiel: referentielParam } = await searchParams
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const supabase = await createClient()
  const { data: beneficiaire } = await supabase
    .from('beneficiaires')
    .select('id, nom, prenoms, date_naissance')
    .eq('id', id)
    .eq('organisation_id', organisation.id)
    .single()
  if (!beneficiaire) return null

  const codeSelectionne = (CODES_REFERENTIELS.includes(referentielParam as CodeReferentielIga) ? referentielParam : null) as CodeReferentielIga | null
  const codeSuggere = suggererReferentiel(beneficiaire.date_naissance)
  const codeActif = codeSelectionne ?? codeSuggere

  const { data: referentiel } = await supabase.from('referentiels_iga').select('id, code').eq('code', codeActif).single()
  if (!referentiel) return null

  const { data: dimensions } = await supabase
    .from('dimensions_iga')
    .select('id, code, nom, ordre, poids, criteres_iga(id, code, libelle, poids, ordre, echelle)')
    .eq('referentiel_id', referentiel.id)
    .order('ordre')

  return (
    <>
      <PageHeader
        eyebrowIcon={Gauge}
        eyebrowText="Mon espace Solo"
        title={`Nouvelle évaluation IGA — ${beneficiaire.nom} ${beneficiaire.prenoms}`}
        subtitle="Chaque critère s'évalue sur un fait observable, pas sur une impression."
      />

      <Panel className="mb-6">
        <p className="text-xs text-text-muted mb-2.5">
          Référentiel {codeActif === codeSuggere ? 'suggéré selon l’âge' : 'sélectionné'} — modifiable à tout moment (le choix reste au praticien).
        </p>
        <div className="flex flex-wrap gap-2">
          {CODES_REFERENTIELS.map((code) => (
            <Link
              key={code}
              href={`/solo/beneficiaires/${id}/evaluations/nouvelle?referentiel=${code}`}
              className={`text-[12.5px] px-3.5 py-2 rounded-full border ${
                code === codeActif ? 'bg-accent-gold text-bg-base border-accent-gold font-semibold' : 'text-text-muted border-border-soft hover:text-text-primary'
              }`}
            >
              {REFERENTIEL_LABEL[code]}
            </Link>
          ))}
        </div>
      </Panel>

      <form action={creerEvaluationIga.bind(null, id, referentiel.id)}>
        <div className="space-y-5 mb-6">
          {(dimensions ?? []).map((dim: any) => (
            <Panel key={dim.id} title={`${dim.nom} (/${dim.poids})`}>
              <div className="space-y-5">
                {(dim.criteres_iga ?? [])
                  .sort((a: any, b: any) => (a.ordre ?? 0) - (b.ordre ?? 0))
                  .map((critere: any) => (
                    <div key={critere.id}>
                      <p className="text-text-primary text-[13.5px] font-medium mb-2">
                        {critere.libelle} <span className="text-text-muted font-normal">(/{critere.poids})</span>
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                        {['0', '1', '2', '3', '4'].map((valeur) => (
                          <label
                            key={valeur}
                            className="flex items-start gap-1.5 text-[12px] text-text-muted bg-bg-surface border border-border-soft rounded-lg px-2.5 py-2 cursor-pointer has-[:checked]:border-accent-gold-dim has-[:checked]:text-text-primary"
                          >
                            <input type="radio" name={`critere_${critere.id}`} value={valeur} required className="mt-0.5" />
                            <span>
                              <span className="font-data font-semibold">{valeur}</span> — {critere.echelle?.[valeur] ?? ''}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </Panel>
          ))}
        </div>

        <Panel className="mb-6">
          <label className="block text-text-primary text-[13.5px] font-medium mb-2">Commentaire général (optionnel)</label>
          <textarea
            name="commentaire"
            rows={3}
            className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim resize-none"
          />
        </Panel>

        <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13.5px] px-5 py-2.5 rounded-full">
          Enregistrer l&apos;évaluation
        </button>
      </form>
    </>
  )
}
