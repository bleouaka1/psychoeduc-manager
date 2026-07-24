import { Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, EmptyState, StatusPill } from '../_components/ui'
import { getMonOrganisation } from '../_lib/getMonOrganisation'
import { creerPaiement, enregistrerVersement } from './actions'

const STATUT_LABEL: Record<string, string> = { a_jour: 'À jour', partiel: 'Partiel', retard: 'Retard' }
const STATUT_PILL: Record<string, 'ok' | 'warn' | 'down'> = { a_jour: 'ok', partiel: 'warn', retard: 'down' }

export default async function PaiementsPage() {
  const organisation = await getMonOrganisation()
  if (!organisation) {
    return (
      <>
        <PageHeader eyebrowIcon={Wallet} eyebrowText="Gestion Administrative" title="Paiements" />
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
        <PageHeader eyebrowIcon={Wallet} eyebrowText="Gestion Administrative" title="Paiements" />
        <Panel>
          <EmptyState text="Le module Gestion Administrative n'est pas activé pour cette organisation. Un Directeur ou Promoteur peut l'activer depuis Paramètres organisation." />
        </Panel>
      </>
    )
  }

  // Les données financières restent réservées à Directeur/Promoteur (§4.1.3) — permissions
  // posées à l'étape 1/10, aucune ligne pour Coordinateur/Éducateur/Formateur.
  const peutGerer = organisation.roles.some((r) => ['directeur', 'promoteur'].includes(r))

  const [{ data: paiements }, { data: beneficiaires }] = await Promise.all([
    supabase
      .from('paiements_scolarite')
      .select('id, type_paiement, montant_du, montant_paye, periode, statut, date_echeance, beneficiaires(id, nom, prenoms)')
      .eq('organisation_id', organisation.id)
      .order('created_at', { ascending: false }),
    peutGerer ? supabase.from('beneficiaires').select('id, nom, prenoms').eq('organisation_id', organisation.id).order('nom') : Promise.resolve({ data: [] as any[] }),
  ])

  const formatterMontant = new Intl.NumberFormat('fr-FR')

  return (
    <>
      <PageHeader eyebrowIcon={Wallet} eyebrowText="Gestion Administrative" title="Paiements" subtitle="Scolarité et frais d'inscription par bénéficiaire." />

      <Panel title={`${paiements?.length ?? 0} paiement(s)`} className="mb-6">
        {!paiements || paiements.length === 0 ? (
          <EmptyState text="Aucun paiement enregistré pour le moment." />
        ) : (
          <ul className="divide-y divide-border-soft/60">
            {paiements.map((p: any) => (
              <li key={p.id} className="py-3.5 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-text-primary text-[13.5px]">
                    {p.beneficiaires?.nom} {p.beneficiaires?.prenoms} — {p.type_paiement === 'inscription' ? 'Inscription' : 'Scolarité'}
                    {p.periode ? ` (${p.periode})` : ''}
                  </p>
                  <p className="text-text-muted text-xs mt-0.5">
                    {formatterMontant.format(p.montant_paye)} / {formatterMontant.format(p.montant_du)} payé{p.date_echeance ? ` — échéance ${p.date_echeance}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <StatusPill status={STATUT_PILL[p.statut] ?? 'idle'}>{STATUT_LABEL[p.statut] ?? p.statut}</StatusPill>
                  {peutGerer && p.statut !== 'a_jour' && (
                    <form action={enregistrerVersement.bind(null, p.id)} className="flex items-center gap-1.5">
                      <input name="montant" type="number" min="1" step="1" required placeholder="Montant" className="w-24 bg-bg-surface border border-border-soft rounded-lg px-2 py-1.5 text-xs text-text-primary" />
                      <input name="methode" placeholder="Méthode" className="w-24 bg-bg-surface border border-border-soft rounded-lg px-2 py-1.5 text-xs text-text-primary" />
                      <button type="submit" className="text-[11.5px] px-3 py-1.5 rounded-full border border-border-soft text-text-primary hover:bg-bg-surface">
                        Verser
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
        <Panel title="Nouveau paiement">
          <form action={creerPaiement} className="flex flex-wrap items-end gap-2.5">
            <select name="beneficiaire_id" required className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary min-w-[200px]">
              {(beneficiaires ?? []).map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.nom} {b.prenoms}
                </option>
              ))}
            </select>
            <select name="type_paiement" required className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary">
              <option value="inscription">Inscription</option>
              <option value="scolarite">Scolarité</option>
            </select>
            <input name="montant_du" type="number" min="1" step="1" required placeholder="Montant dû" className="w-32 bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary" />
            <input name="periode" placeholder="Période (ex: Trim. 1)" className="w-40 bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary" />
            <input name="date_echeance" type="date" className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary" />
            <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
              Créer
            </button>
          </form>
        </Panel>
      )}
    </>
  )
}
