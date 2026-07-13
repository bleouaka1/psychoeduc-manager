import { Archive, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatusPill } from '../_components/ui'
import { reactiverBeneficiaire } from './actions'

type LigneArchive = {
  type: 'archive' | 'supprime'
  id: string | null
  nom: string
  prenoms: string
  date: string
}

export default async function ArchivesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  const supabase = await createClient()

  // Recherche appliquée après récupération plutôt que via un filtre PostgREST sur le
  // champ JSONB `donnees_avant` (syntaxe `->>` fragile en `.or()`) — volume attendu
  // faible pour un journal d'archives, aucun besoin de filtrer côté base.
  const qNettoye = q.trim().toLowerCase()

  const [{ data: archives }, { data: suppressions }] = await Promise.all([
    supabase.from('beneficiaires').select('id, nom, prenoms, updated_at').eq('statut_beneficiaire', 'archive').order('updated_at', { ascending: false }).limit(200),
    supabase
      .from('audit_logs')
      .select('donnees_avant, created_at')
      .eq('table_cible', 'beneficiaires')
      .eq('action', 'DELETE')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  let lignes: LigneArchive[] = [
    ...(archives ?? []).map((b: any) => ({ type: 'archive' as const, id: b.id as string, nom: b.nom, prenoms: b.prenoms, date: b.updated_at })),
    ...(suppressions ?? []).map((s: any) => ({
      type: 'supprime' as const,
      id: null,
      nom: s.donnees_avant?.nom ?? '—',
      prenoms: s.donnees_avant?.prenoms ?? '—',
      date: s.created_at,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (qNettoye) {
    lignes = lignes.filter((l) => l.nom.toLowerCase().includes(qNettoye) || l.prenoms.toLowerCase().includes(qNettoye))
  }

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <PageHeader
        eyebrowIcon={Archive}
        eyebrowText="Gouvernance"
        title="Archives"
        subtitle="Bénéficiaires archivés ou supprimés — consultable par nom et par date. Aucune donnée n'est perdue silencieusement : chaque suppression reste tracée dans le journal d'audit."
      />

      <Panel title={`${lignes.length} élément(s)`}>
        <form action="/archives" method="get" className="flex flex-wrap gap-2.5 mb-5">
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
