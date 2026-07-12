import Link from 'next/link'
import { Users2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, StatusPill } from '../../(dashboard)/_components/ui'
import { getSoloOrganisation } from '../_lib/getSoloOrg'
import { creerCercleAction } from './actions'

export default async function CerclesPage() {
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const supabase = await createClient()
  const { data: cercles } = await supabase
    .from('cercles_apprentissage')
    .select('id, nom, description, reserve_adultes, statut, cercles_membres(id)')
    .eq('organisation_id', organisation.id)
    .order('created_at', { ascending: false })

  return (
    <>
      <PageHeader eyebrowIcon={Users2} eyebrowText="Mon espace Solo" title="Cercles d'apprentissage" subtitle="Groupes de discussion entre bénéficiaires, animés par vous." />

      <Panel title="Créer un cercle" className="mb-6">
        <form action={creerCercleAction} className="space-y-3">
          <div>
            <label className="text-text-muted text-xs mb-1 block">Nom du cercle</label>
            <input name="nom" required placeholder="Ex. Cercle Menuiserie" className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim" />
          </div>
          <div>
            <label className="text-text-muted text-xs mb-1 block">Description</label>
            <input name="description" className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim" />
          </div>
          <div>
            <label className="text-text-muted text-xs mb-1 block">Charte (3-4 lignes)</label>
            <textarea name="charte" rows={3} className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim" />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-text-primary">
            <input type="checkbox" name="reserve_adultes" />
            Réservé aux adultes (modération stricte automatique si mineur présent, sinon)
          </label>
          <div>
            <label className="text-text-muted text-xs mb-1 block">Tarif (optionnel, laisser vide si gratuit)</label>
            <input name="tarif" type="number" step="0.01" className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim" />
          </div>
          <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
            Créer le cercle
          </button>
        </form>
      </Panel>

      <Panel title={`${cercles?.length ?? 0} cercle(s)`}>
        {(cercles ?? []).length === 0 ? (
          <p className="text-text-muted text-sm py-6 text-center">Aucun cercle créé pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {(cercles ?? []).map((c: any) => (
              <li key={c.id}>
                <Link href={`/solo/cercles/${c.id}`} className="flex items-center justify-between bg-bg-surface border border-border-soft rounded-xl px-4 py-3 hover:border-accent-gold-dim transition-colors">
                  <div>
                    <span className="text-text-primary text-[13.5px] font-medium">{c.nom}</span>
                    {c.reserve_adultes && <span className="ml-2 text-[10.5px] text-text-muted">(adultes uniquement)</span>}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-text-muted text-[11.5px]">{c.cercles_membres?.length ?? 0} membre(s)</span>
                    <StatusPill status={c.statut === 'actif' ? 'ok' : 'idle'}>{c.statut === 'actif' ? 'Actif' : 'Fermé'}</StatusPill>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
