import { redirect } from 'next/navigation'
import { Eye, Building2, User, Briefcase } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, EmptyState } from '../_components/ui'
import { activerApercuEtRedirection } from './actions'

const TYPE_LABEL: Record<string, string> = {
  solo: 'Compte Solo',
  structure: 'Structure',
  ecole: 'Structure — École',
  ong: 'Structure — ONG',
  centre: 'Structure — Centre de formation',
  association: 'Structure — Association',
  fondation: 'Structure — Fondation',
  employeur: 'Employeur',
  entreprise: 'Employeur — Entreprise',
}

export default async function ApercuPage() {
  const supabase = await createClient()
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  if (!estFondateur) redirect('/dashboard')

  const { data: organisations } = await supabase
    .from('organisations')
    .select('id, nom, type_organisation, created_at')
    .order('nom')

  const solo = (organisations ?? []).filter((o) => o.type_organisation === 'solo')
  const employeur = (organisations ?? []).filter((o) => o.type_organisation === 'employeur')
  const structures = (organisations ?? []).filter((o) => !['solo', 'employeur'].includes(o.type_organisation))

  return (
    <>
      <PageHeader
        eyebrowIcon={Eye}
        eyebrowText="Mode Test"
        title="Aperçu — voir en tant que"
        subtitle="Réservé au Fondateur. Consulte n'importe quel tableau de bord avec de vraies données, en lecture ET écriture (RLS te laisse déjà tout faire) — toute action reste attribuée à ton propre profil, jamais usurpée."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel title="Comptes Solo" icon={User}>
          {solo.length === 0 ? (
            <EmptyState text="Aucun compte Solo." />
          ) : (
            <ListeOrganisations organisations={solo} />
          )}
        </Panel>

        <Panel title="Structures" icon={Building2}>
          {structures.length === 0 ? (
            <EmptyState text="Aucune structure." />
          ) : (
            <ListeOrganisations organisations={structures} />
          )}
        </Panel>

        <Panel title="Employeurs" icon={Briefcase}>
          {employeur.length === 0 ? (
            <EmptyState text="Aucun employeur." />
          ) : (
            <ListeOrganisations organisations={employeur} />
          )}
        </Panel>
      </div>
    </>
  )
}

function ListeOrganisations({ organisations }: { organisations: { id: string; nom: string; type_organisation: string }[] }) {
  return (
    <ul className="divide-y divide-border-soft/60">
      {organisations.map((o) => (
        <li key={o.id} className="py-2.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-text-primary text-[13.5px]">{o.nom}</p>
            <p className="text-text-muted text-[11px]">{TYPE_LABEL[o.type_organisation] ?? o.type_organisation}</p>
          </div>
          <form action={activerApercuEtRedirection}>
            <input type="hidden" name="organisation_id" value={o.id} />
            <button type="submit" className="text-[11.5px] px-3 py-1.5 rounded-full border border-border-soft text-text-primary hover:bg-bg-surface whitespace-nowrap">
              Voir
            </button>
          </form>
        </li>
      ))}
    </ul>
  )
}
