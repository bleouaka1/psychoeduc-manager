import { Bot, Hash, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatCard } from '../_components/ui'

export default async function CentreIAPage() {
  const supabase = await createClient()
  const [{ data: agents }, { data: consommations }] = await Promise.all([
    supabase.from('agents_ia').select('id, nom, type_agent, actif, organisations(nom)').limit(50),
    supabase
      .from('consommations_ia')
      .select('id, nb_tokens, cout_estime, created_at, organisations(nom)')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const totalTokens = (consommations ?? []).reduce((acc: number, c: any) => acc + Number(c.nb_tokens ?? 0), 0)

  return (
    <>
      <PageHeader eyebrowIcon={Bot} eyebrowText="Activité" title="Centre IA" subtitle="Agents, sessions et consommation, avec garde-fou de quota par organisation." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <StatCard icon={Bot} label="Agents configurés" value={agents?.length ?? 0} />
        <StatCard icon={Hash} label="Tokens consommés (récents)" value={totalTokens} />
        <StatCard icon={ShieldCheck} label="Garde-fou quota" value="Actif" hint="Rejet automatique en base au-delà du quota mensuel" />
      </div>

      <div className="space-y-6">
        <Panel title={`${agents?.length ?? 0} agent(s) IA`}>
          <DataTable
            columns={['Nom', 'Type', 'Organisation', 'Actif']}
            rows={(agents ?? []).map((a: any) => [a.nom, a.type_agent ?? '—', a.organisations?.nom ?? 'Global', a.actif ? 'Oui' : 'Non'])}
            emptyText="Aucun agent IA configuré pour le moment."
          />
        </Panel>

        <Panel title="Consommation récente">
          <DataTable
            columns={['Organisation', 'Tokens', 'Coût estimé', 'Date']}
            rows={(consommations ?? []).map((c: any) => [c.organisations?.nom ?? '—', c.nb_tokens, c.cout_estime ?? '—', formatter.format(new Date(c.created_at))])}
            emptyText="Aucune consommation enregistrée pour le moment."
          />
        </Panel>
      </div>
    </>
  )
}
