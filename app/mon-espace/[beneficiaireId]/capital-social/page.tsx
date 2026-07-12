import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { chargerCapitalSocial, chargerCamaradesCercles } from '@/lib/capitalSocial'
import { proposerRelationFormateurAction, proposerRelationBeneficiaireAction, confirmerRelationAction, refuserRelationAction } from './actions'

const TYPE_LABEL: Record<string, string> = { formateur_educateur: 'Formateurs & éducateurs', beneficiaire: 'Bénéficiaires', employeur: 'Employeurs', structure: 'Structures' }

export default async function CapitalSocialPage({ params }: { params: Promise<{ beneficiaireId: string }> }) {
  const { beneficiaireId } = await params
  const supabase = await createClient()

  const dossiers = await chargerDossiersBeneficiaire(supabase)
  const dossier = dossiers.find((d) => d.id === beneficiaireId)
  if (!dossier) notFound()

  const [relations, camarades] = await Promise.all([chargerCapitalSocial(supabase, beneficiaireId), chargerCamaradesCercles(supabase, beneficiaireId)])

  const { data: beneficiaireOrg } = await supabase.from('beneficiaires').select('organisation_id').eq('id', beneficiaireId).single()

  const enAttente = relations.filter((r) => r.statut === 'en_attente')
  const confirmees = relations.filter((r) => r.statut === 'confirmee')
  const camaradesNonRelies = camarades.filter((c) => !relations.some((r) => r.nomContact === `${c.prenoms} ${c.nom}`.trim()))
  const aDejaRelationFormateur = relations.some((r) => r.typeRelation === 'formateur_educateur')

  return (
    <div>
      <div className="bg-bg-card border border-border-soft rounded-2xl p-6 mb-6">
        <h1 className="font-display text-xl text-text-primary mb-2">Ton capital social</h1>
        <p className="text-text-muted text-sm">
          Ce sont toutes les personnes et structures qui peuvent t'aider à avancer : formateurs, éducateurs, employeurs, autres bénéficiaires que tu as
          rencontrés dans ton parcours, structures partenaires. Une relation devient capital social quand les deux personnes se le confirment, l'une à
          l'autre. Ce n'est pas une simple liste de contacts — c'est le réseau de ressources que tu construis, une relation à la fois.
        </p>
      </div>

      {enAttente.length > 0 && (
        <div className="bg-bg-card border border-border-soft rounded-2xl p-6 mb-6">
          <h2 className="font-display font-medium text-[16.5px] text-text-primary mb-4">En attente de confirmation</h2>
          <ul className="space-y-2.5">
            {enAttente.map((r) => (
              <li key={r.id} className="flex items-center justify-between bg-bg-surface border border-border-soft rounded-xl px-4 py-3">
                <span className="text-text-primary text-[13px]">
                  {r.nomContact} <span className="text-text-muted text-[11px]">({TYPE_LABEL[r.typeRelation]})</span>
                </span>
                {r.estDemandeur ? (
                  <span className="text-text-muted text-[11.5px]">Demande envoyée</span>
                ) : (
                  <div className="flex gap-2">
                    <form action={confirmerRelationAction.bind(null, beneficiaireId, r.id)}>
                      <button type="submit" className="text-[12px] font-semibold text-bg-base bg-accent-gold rounded-full px-3 py-1.5">
                        Confirmer
                      </button>
                    </form>
                    <form action={refuserRelationAction.bind(null, beneficiaireId, r.id)}>
                      <button type="submit" className="text-[12px] text-text-muted border border-border-soft rounded-full px-3 py-1.5">
                        Refuser
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Object.keys(TYPE_LABEL).map((type) => {
        const relationsDuType = confirmees.filter((r) => r.typeRelation === type)
        if (relationsDuType.length === 0) return null
        return (
          <div key={type} className="bg-bg-card border border-border-soft rounded-2xl p-6 mb-6">
            <h2 className="font-display font-medium text-[16.5px] text-text-primary mb-4">
              {TYPE_LABEL[type]} <span className="text-text-muted text-[12px]">({relationsDuType.length})</span>
            </h2>
            <ul className="space-y-2">
              {relationsDuType.map((r) => (
                <li key={r.id} className="flex items-center justify-between bg-bg-surface border border-border-soft rounded-xl px-4 py-2.5">
                  <span className="text-text-primary text-[13px]">{r.nomContact}</span>
                  {r.contexte && <span className="text-text-muted text-[11px]">{r.contexte}</span>}
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      {!aDejaRelationFormateur && beneficiaireOrg && (
        <div className="bg-bg-card border border-border-soft rounded-2xl p-6 mb-6">
          <p className="text-text-muted text-[13px] mb-3">Proposer une relation avec {dossier.organisationNom}, ton formateur/éducateur référent.</p>
          <form action={proposerRelationFormateurAction.bind(null, beneficiaireId, beneficiaireOrg.organisation_id)}>
            <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
              Proposer la relation
            </button>
          </form>
        </div>
      )}

      {camaradesNonRelies.length > 0 && beneficiaireOrg && (
        <div className="bg-bg-card border border-border-soft rounded-2xl p-6">
          <h2 className="font-display font-medium text-[16.5px] text-text-primary mb-4">Bénéficiaires rencontrés dans tes cercles</h2>
          <ul className="space-y-2">
            {camaradesNonRelies.map((c) => (
              <li key={c.beneficiaireId} className="flex items-center justify-between bg-bg-surface border border-border-soft rounded-xl px-4 py-2.5">
                <div>
                  <span className="text-text-primary text-[13px]">
                    {c.prenoms} {c.nom}
                  </span>
                  <span className="text-text-muted text-[11px] ml-2">{c.nomCercle}</span>
                </div>
                <form action={proposerRelationBeneficiaireAction.bind(null, beneficiaireId, c.beneficiaireId, beneficiaireOrg.organisation_id, c.nomCercle)}>
                  <button type="submit" className="text-[12px] font-semibold text-bg-base bg-accent-gold rounded-full px-3 py-1.5">
                    Proposer
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
