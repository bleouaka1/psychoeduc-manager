import { Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, EmptyState } from '../_components/ui'
import { getMonOrganisation } from '../_lib/getMonOrganisation'
import { genererFacture } from './actions'

export default async function FacturesPage() {
  const organisation = await getMonOrganisation()
  if (!organisation) {
    return (
      <>
        <PageHeader eyebrowIcon={Receipt} eyebrowText="Gestion Administrative" title="Facturation" />
        <Panel>
          <EmptyState text="Aucune organisation Structure rattachée à ce compte." />
        </Panel>
      </>
    )
  }

  const supabase = await createClient()

  const { data: org } = await supabase.from('organisations').select('module_admin_actif').eq('id', organisation.id).single()
  if (!org?.module_admin_actif) {
    return (
      <>
        <PageHeader eyebrowIcon={Receipt} eyebrowText="Gestion Administrative" title="Facturation" />
        <Panel>
          <EmptyState text="Le module Gestion Administrative n'est pas activé pour cette organisation. Un Directeur ou Promoteur peut l'activer depuis Paramètres organisation." />
        </Panel>
      </>
    )
  }

  const peutGerer = organisation.roles.some((r) => ['directeur', 'promoteur'].includes(r))

  const [{ data: factures }, { data: paiements }] = await Promise.all([
    supabase
      .from('factures_scolarite')
      .select('id, numero_facture, created_at, paiements_scolarite(type_paiement, montant_du, beneficiaires(nom, prenoms))')
      .eq('organisation_id', organisation.id)
      .order('created_at', { ascending: false }),
    peutGerer
      ? supabase
          .from('paiements_scolarite')
          .select('id, type_paiement, montant_du, periode, beneficiaires(nom, prenoms), factures_scolarite(id)')
          .eq('organisation_id', organisation.id)
      : Promise.resolve({ data: [] as any[] }),
  ])

  // Un paiement ne peut être facturé qu'une fois (pas de contrainte DB dédiée, filtré ici) —
  // évite de proposer "Générer" sur un paiement déjà pourvu d'une facture.
  const paiementsNonFactures = (paiements ?? []).filter((p: any) => !p.factures_scolarite || p.factures_scolarite.length === 0)

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  const formatterMontant = new Intl.NumberFormat('fr-FR')

  return (
    <>
      <PageHeader eyebrowIcon={Receipt} eyebrowText="Gestion Administrative" title="Facturation" subtitle="Factures émises à partir des paiements de scolarité." />

      <Panel title={`${factures?.length ?? 0} facture(s)`} className="mb-6">
        {!factures || factures.length === 0 ? (
          <EmptyState text="Aucune facture émise pour le moment." />
        ) : (
          <ul className="divide-y divide-border-soft/60">
            {factures.map((f: any) => (
              <li key={f.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-text-primary text-[13.5px] font-medium">{f.numero_facture}</p>
                  <p className="text-text-muted text-xs mt-0.5">
                    {f.paiements_scolarite?.beneficiaires?.nom} {f.paiements_scolarite?.beneficiaires?.prenoms} — {formatterMontant.format(f.paiements_scolarite?.montant_du ?? 0)}
                  </p>
                </div>
                <span className="text-text-muted text-xs">{formatter.format(new Date(f.created_at))}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {peutGerer && (
        <Panel title="Générer une facture">
          {paiementsNonFactures.length === 0 ? (
            <p className="text-text-muted text-sm">Tous les paiements enregistrés ont déjà une facture.</p>
          ) : (
            <ul className="divide-y divide-border-soft/60">
              {paiementsNonFactures.map((p: any) => (
                <li key={p.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-text-primary text-[13.5px]">
                    {p.beneficiaires?.nom} {p.beneficiaires?.prenoms} — {p.type_paiement === 'inscription' ? 'Inscription' : 'Scolarité'}
                    {p.periode ? ` (${p.periode})` : ''} — {formatterMontant.format(p.montant_du)}
                  </span>
                  <form action={genererFacture.bind(null, p.id)}>
                    <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[12.5px] px-3.5 py-1.5 rounded-full">
                      Générer
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </>
  )
}
