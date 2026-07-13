import { Archive, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatusPill } from '../../(dashboard)/_components/ui'
import { getSoloOrganisation } from '../_lib/getSoloOrg'
import { chargerArchivesBeneficiaires } from '@/lib/beneficiaires'
import { reactiverBeneficiaire } from '../beneficiaires/actions'

export default async function ArchivesSoloPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const supabase = await createClient()
  const qNettoye = q.trim().toLowerCase()

  let lignes = await chargerArchivesBeneficiaires(supabase, organisation.id)
  if (qNettoye) {
    lignes = lignes.filter((l) => l.nom.toLowerCase().includes(qNettoye) || l.prenoms.toLowerCase().includes(qNettoye))
  }

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <PageHeader
        eyebrowIcon={Archive}
        eyebrowText="Mon compte"
        title="Archives"
        subtitle="Vos bénéficiaires archivés ou supprimés — consultable par nom et par date."
      />

      <Panel title={`${lignes.length} élément(s)`}>
        <form action="/solo/archives" method="get" className="flex flex-wrap gap-2.5 mb-5">
          <input
            name="q"
            defaultValue={q}
            placeholder="Rechercher par nom ou prénoms…"
            className="flex-1 min-w-[220px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
          />
          <button type="submit" className="text-[13px] text-accent-gold border border-accent-gold-dim/50 rounded-full px-4 py-2">
            Filtrer
          </button>
        </form>

        <DataTable
          columns={['Nom', 'Prénoms', 'Type', 'Date', 'Actions']}
          rows={lignes.map((l) => [
            l.nom,
            l.prenoms,
            <StatusPill key="t" status={l.type === 'archive' ? 'idle' : 'down'}>{l.type === 'archive' ? 'Archivé' : 'Supprimé'}</StatusPill>,
            formatter.format(new Date(l.date)),
            l.type === 'archive' && l.id ? (
              <form key="actions" action={reactiverBeneficiaire.bind(null, l.id)}>
                <button
                  type="submit"
                  className="flex items-center gap-1 text-[12px] border border-status-ok/40 text-status-ok rounded-lg px-2.5 py-1.5"
                >
                  <RotateCcw size={13} /> Réactiver
                </button>
              </form>
            ) : (
              <span key="actions" className="text-text-muted text-[12px]">
                —
              </span>
            ),
          ])}
          emptyText="Aucun élément archivé ou supprimé pour le moment."
        />
      </Panel>
    </>
  )
}
