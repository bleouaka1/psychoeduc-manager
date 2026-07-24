import { Settings2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, EmptyState } from '../_components/ui'
import { getMonOrganisation } from '../_lib/getMonOrganisation'
import { basculerModuleAdmin } from './actions'

export default async function ParametresOrganisationPage() {
  const organisation = await getMonOrganisation()
  if (!organisation) {
    return (
      <>
        <PageHeader eyebrowIcon={Settings2} eyebrowText="Gouvernance" title="Paramètres de l'organisation" />
        <Panel>
          <EmptyState text="Aucune organisation Structure rattachée à ce compte." />
        </Panel>
      </>
    )
  }

  const supabase = await createClient()
  const { data } = await supabase.from('organisations').select('module_admin_actif').eq('id', organisation.id).single()
  const peutModifier = organisation.roles.some((r) => ['directeur', 'promoteur'].includes(r))

  return (
    <>
      <PageHeader eyebrowIcon={Settings2} eyebrowText="Gouvernance" title="Paramètres de l'organisation" subtitle={organisation.nom} />

      <Panel title="Module Gestion Administrative">
        <p className="text-text-muted text-sm mb-4">
          Présences, dossiers, paiements et facturation de scolarité. Reste désactivé par défaut — une ONG qui ne gère pas de scolarité n&apos;a besoin d&apos;aucun de ces sous-menus.
        </p>
        {peutModifier ? (
          <form action={basculerModuleAdmin} className="flex items-center gap-3">
            <input type="checkbox" id="module_admin_actif" name="module_admin_actif" defaultChecked={data?.module_admin_actif ?? false} className="w-4 h-4 accent-current" />
            <label htmlFor="module_admin_actif" className="text-text-primary text-sm">
              Activer le module Gestion Administrative pour cette organisation
            </label>
            <button type="submit" className="ml-auto bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
              Enregistrer
            </button>
          </form>
        ) : (
          <p className="text-text-muted text-sm">
            Module actuellement <strong className="text-text-primary">{data?.module_admin_actif ? 'activé' : 'désactivé'}</strong>. Seul un Directeur ou Promoteur peut le basculer.
          </p>
        )}
      </Panel>
    </>
  )
}
