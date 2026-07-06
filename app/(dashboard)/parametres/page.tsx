import { Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable } from '../_components/ui'

export default async function ParametresPage() {
  const supabase = await createClient()
  const [{ data: plateforme }, { data: modules }, { data: securite }, { data: notifications }] = await Promise.all([
    supabase.from('parametres_plateforme').select('cle, valeur, description'),
    supabase.from('parametres_modules').select('module, actif_par_defaut, description'),
    supabase.from('parametres_securite').select('cle, valeur, description'),
    supabase.from('parametres_notifications').select('cle, valeur, description'),
  ])

  return (
    <>
      <PageHeader eyebrowIcon={Settings} eyebrowText="Gouvernance" title="Paramètres" subtitle="Configuration générale de la plateforme, réservée au Fondateur." />
      <div className="space-y-6">
        <Panel title="Paramètres plateforme">
          <DataTable
            columns={['Clé', 'Valeur', 'Description']}
            rows={(plateforme ?? []).map((p: any) => [p.cle, JSON.stringify(p.valeur), p.description ?? '—'])}
            emptyText="Aucun paramètre plateforme défini."
          />
        </Panel>
        <Panel title="Paramètres de sécurité">
          <DataTable
            columns={['Clé', 'Valeur', 'Description']}
            rows={(securite ?? []).map((p: any) => [p.cle, JSON.stringify(p.valeur), p.description ?? '—'])}
            emptyText="Aucun paramètre de sécurité défini."
          />
        </Panel>
        <Panel title="Paramètres de notifications">
          <DataTable
            columns={['Clé', 'Valeur', 'Description']}
            rows={(notifications ?? []).map((p: any) => [p.cle, JSON.stringify(p.valeur), p.description ?? '—'])}
            emptyText="Aucun paramètre de notification défini."
          />
        </Panel>
        <Panel title="Modules — activation par défaut">
          <DataTable
            columns={['Module', 'Actif par défaut', 'Description']}
            rows={(modules ?? []).map((m: any) => [m.module, m.actif_par_defaut ? 'Oui' : 'Non', m.description ?? '—'])}
            emptyText="Aucune configuration de module définie."
          />
        </Panel>
      </div>
    </>
  )
}
