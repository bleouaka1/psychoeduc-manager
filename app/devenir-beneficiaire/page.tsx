import { HeartHandshake } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { chercherFormateurs } from '@/lib/devenirBeneficiaire'
import { devenirBeneficiaireAction } from './actions'
import { RetourButton } from './RetourButton'

export default async function DevenirBeneficiairePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: mesOrganisations } = user
    ? await supabase.from('membres_organisations').select('organisation_id').eq('profile_id', user.id)
    : { data: [] as any[] }
  const mesOrganisationIds = (mesOrganisations ?? []).map((m: any) => m.organisation_id)

  const formateurs = await chercherFormateurs(supabase, q, mesOrganisationIds)

  return (
    <div className="min-h-screen bg-bg-base relative overflow-x-hidden">
      <div className="ambient-halo" />
      <div className="relative z-[1] px-6 sm:px-10 py-8 max-w-3xl mx-auto">
        <RetourButton />

        <div className="flex items-center gap-2.5 mb-2">
          <HeartHandshake size={20} className="text-accent-gold" />
          <h1 className="font-display text-2xl text-text-primary">Devenir bénéficiaire</h1>
        </div>
        <p className="text-text-muted text-sm mb-6">
          Un même compte peut cumuler son activité habituelle et un accompagnement suivi par un autre praticien — bascule gratuite et
          instantanée, aucun test IGA n'est déclenché ici : votre praticien vous en proposera un pour formaliser le début du suivi.
        </p>

        <form method="get" className="mb-6">
          <input
            name="q"
            defaultValue={q}
            placeholder="Rechercher un praticien par nom…"
            className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
          />
        </form>

        {formateurs.length === 0 ? (
          <div className="bg-bg-card border border-border-soft rounded-2xl p-10 text-center">
            <p className="text-text-muted text-sm">Aucun praticien disponible pour l'instant.</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {formateurs.map((f) => (
              <li key={f.organisationId} className="flex items-center justify-between bg-bg-card border border-border-soft rounded-2xl px-5 py-4">
                <div>
                  <p className="text-text-primary font-medium">{f.nom}</p>
                  {f.bio && <p className="text-text-muted text-[12.5px] mt-0.5 max-w-md">{f.bio}</p>}
                </div>
                <form action={devenirBeneficiaireAction.bind(null, f.organisationId)}>
                  <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full shrink-0">
                    Devenir bénéficiaire ici
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
