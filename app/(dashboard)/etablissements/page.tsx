import { Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, EmptyState, StatusPill } from '../_components/ui'
import { getMonOrganisation } from '../_lib/getMonOrganisation'
import { creerEtablissement, basculerActifEtablissement } from './actions'

const RYTHME_LABEL: Record<string, string> = { lun_ven: 'Lun–Ven', lun_sam: 'Lun–Sam' }

export default async function EtablissementsPage() {
  const organisation = await getMonOrganisation()
  if (!organisation) {
    return (
      <>
        <PageHeader eyebrowIcon={Building2} eyebrowText="Gouvernance" title="Établissements" />
        <Panel>
          <EmptyState text="Aucune organisation Structure rattachée à ce compte." />
        </Panel>
      </>
    )
  }

  const supabase = await createClient()
  const { data: etablissements } = await supabase
    .from('etablissements')
    .select('id, nom, adresse, rythme_jours, actif')
    .eq('organisation_id', organisation.id)
    .order('created_at')

  const peutGerer = organisation.roles.some((r) => ['directeur', 'promoteur'].includes(r))
  const nbActifs = (etablissements ?? []).filter((e) => e.actif).length
  // §2.2 : les 2 premiers établissements rattachés sont gratuits, le 3e et les suivants
  // déclenchent un montant fixe absorbé dans l'abonnement annuel global (pas de ligne de
  // facturation récurrente séparée) — affiché ici à titre indicatif pour le Directeur/
  // Promoteur, ajusté manuellement par le Fondateur au renouvellement.
  const nombreEtablissementsPayants = Math.max(0, nbActifs - 2)

  return (
    <>
      <PageHeader eyebrowIcon={Building2} eyebrowText="Gouvernance" title="Établissements" subtitle={`${nbActifs} établissement(s) actif(s)${nombreEtablissementsPayants > 0 ? ` — dont ${nombreEtablissementsPayants} payant(s) au-delà des 2 premiers` : ' — tous gratuits (2 premiers inclus)'}.`} />

      <Panel title="Sites rattachés" className="mb-6">
        {!etablissements || etablissements.length === 0 ? (
          <EmptyState text="Aucun établissement déclaré pour le moment." />
        ) : (
          <ul className="divide-y divide-border-soft/60">
            {etablissements.map((e) => (
              <li key={e.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-text-primary text-[13.5px]">{e.nom}</p>
                  <p className="text-text-muted text-xs mt-0.5">
                    {e.adresse ?? 'Adresse non renseignée'}
                    {e.rythme_jours ? ` · ${RYTHME_LABEL[e.rythme_jours] ?? e.rythme_jours}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <StatusPill status={e.actif ? 'ok' : 'idle'}>{e.actif ? 'Actif' : 'Fermé'}</StatusPill>
                  {peutGerer && (
                    <form action={basculerActifEtablissement.bind(null, e.id, !e.actif)}>
                      <button type="submit" className="text-[11.5px] px-3 py-1.5 rounded-full border border-border-soft text-text-muted hover:text-text-primary">
                        {e.actif ? 'Fermer' : 'Réactiver'}
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {peutGerer && (
        <Panel title="Rattacher un établissement">
          <form action={creerEtablissement} className="flex flex-wrap items-center gap-2.5">
            <input name="nom" required placeholder="Nom de l'établissement" className="flex-1 min-w-[200px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary" />
            <input name="adresse" placeholder="Adresse" className="flex-1 min-w-[200px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary" />
            <select name="rythme_jours" className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary">
              <option value="lun_ven">Lun–Ven</option>
              <option value="lun_sam">Lun–Sam</option>
            </select>
            <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
              Ajouter
            </button>
          </form>
        </Panel>
      )}
    </>
  )
}
