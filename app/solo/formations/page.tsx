import Link from 'next/link'
import { GraduationCap, Plus, Upload, PauseCircle, Archive, Clock, Video, Users2, Banknote, Pencil, X, Star, TrendingDown, Wallet2, Paperclip, Trash2, FileDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, StatusPill } from '../../(dashboard)/_components/ui'
import { getSoloOrganisation } from '../_lib/getSoloOrg'
import { creerFormation, publierFormation, suspendreFormation, archiverFormation, modifierFormation, supprimerFormation } from './actions'
import { televerserRessource, supprimerRessource } from './ressources-actions'
import { SupprimerAvecConfirmation } from '../_components/ConfirmModal'
import { RelancerEleve } from '../_components/RelancerEleve'

const SEUIL_INACTIVITE_JOURS = 14

const STATUT_LABEL: Record<string, string> = {
  brouillon: 'Brouillon',
  publiee: 'Publiée',
  suspendue: 'Suspendue',
  archivee: 'Archivée',
}
const STATUT_PILL: Record<string, 'ok' | 'warn' | 'down' | 'idle'> = {
  brouillon: 'idle',
  publiee: 'ok',
  suspendue: 'warn',
  archivee: 'down',
}
const MODE_LABEL: Record<string, string> = {
  presentiel: 'Présentiel',
  video_tutoriel: 'Vidéo-tutoriel',
  mixte: 'Mixte — tous moyens',
  autre: 'Autre',
}

export default async function SoloFormationsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit: editId } = await searchParams
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const supabase = await createClient()
  const { data: formations } = await supabase
    .from('formations')
    .select('id, titre, description, duree_texte, mode_transmission, prix, devise, statut')
    .eq('organisation_id', organisation.id)
    .order('created_at', { ascending: false })

  const formationIds = (formations ?? []).map((f: any) => f.id)

  const [{ data: inscriptions }, { data: paiements }, { data: notes }, { data: ressources }] = await Promise.all([
    formationIds.length > 0
      ? supabase.from('inscriptions_formations').select('id, formation_id, statut, acheteur_id, date_inscription').in('formation_id', formationIds)
      : Promise.resolve({ data: [] as any[] }),
    formationIds.length > 0
      ? supabase
          .from('paiements_formation')
          .select('montant, statut, inscriptions_formations!inner(formation_id)')
          .eq('statut', 'confirme')
          .in('inscriptions_formations.formation_id', formationIds)
      : Promise.resolve({ data: [] as any[] }),
    formationIds.length > 0
      ? supabase.from('vue_notes_formations').select('formation_id, note_moyenne, nombre_avis').in('formation_id', formationIds)
      : Promise.resolve({ data: [] as any[] }),
    formationIds.length > 0
      ? supabase.from('ressources_formation').select('id, formation_id, nom_fichier, chemin_storage, taille_octets').in('formation_id', formationIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const inscriptionIds = (inscriptions ?? []).map((i: any) => i.id)
  const acheteurIds = [...new Set((inscriptions ?? []).map((i: any) => i.acheteur_id))]
  const [{ data: progressions }, { data: profilsAcheteurs }] = await Promise.all([
    inscriptionIds.length > 0
      ? supabase.from('progression_formation').select('inscription_id, created_at').in('inscription_id', inscriptionIds)
      : Promise.resolve({ data: [] as any[] }),
    acheteurIds.length > 0 ? supabase.from('profiles').select('id, nom, prenoms, email').in('id', acheteurIds) : Promise.resolve({ data: [] as any[] }),
  ])

  const derniereActiviteParInscription = new Map<string, number>()
  for (const i of inscriptions ?? []) derniereActiviteParInscription.set(i.id, new Date(i.date_inscription).getTime())
  for (const p of progressions ?? []) {
    const t = new Date(p.created_at).getTime()
    if (t > (derniereActiviteParInscription.get(p.inscription_id) ?? 0)) derniereActiviteParInscription.set(p.inscription_id, t)
  }
  const profilParId = new Map((profilsAcheteurs ?? []).map((p: any) => [p.id, p]))
  const seuilMs = Date.now() - SEUIL_INACTIVITE_JOURS * 24 * 60 * 60 * 1000

  const ressourcesParFormation = new Map<string, any[]>()
  for (const r of ressources ?? []) {
    const liste = ressourcesParFormation.get(r.formation_id) ?? []
    liste.push(r)
    ressourcesParFormation.set(r.formation_id, liste)
  }
  const cheminsRessources = (ressources ?? []).map((r: any) => r.chemin_storage)
  const signedUrlParChemin = new Map<string, string>()
  if (cheminsRessources.length > 0) {
    const { data: signes } = await supabase.storage.from('ressources-formations').createSignedUrls(cheminsRessources, 300)
    for (const s of signes ?? []) {
      if (s.signedUrl) signedUrlParChemin.set(s.path ?? '', s.signedUrl)
    }
  }

  const inscriptionsParFormation = new Map<string, any[]>()
  for (const i of inscriptions ?? []) {
    const liste = inscriptionsParFormation.get(i.formation_id) ?? []
    liste.push(i)
    inscriptionsParFormation.set(i.formation_id, liste)
  }
  const revenuParFormation = new Map<string, number>()
  for (const p of paiements ?? []) {
    const fid = (p as any).inscriptions_formations?.formation_id
    if (!fid) continue
    revenuParFormation.set(fid, (revenuParFormation.get(fid) ?? 0) + Number(p.montant ?? 0))
  }
  const noteParFormation = new Map<string, any>()
  for (const n of notes ?? []) noteParFormation.set(n.formation_id, n)

  const formationEnEdition = editId ? (formations ?? []).find((f: any) => f.id === editId) : null

  return (
    <>
      <PageHeader eyebrowIcon={GraduationCap} eyebrowText="Mon espace Solo" title="Mes formations" subtitle="Gérez votre catalogue de compétences à transmettre." />

      <Panel title={formationEnEdition ? `Modifier « ${formationEnEdition.titre} »` : 'Ajouter une formation'} className="mb-6">
        <form action={formationEnEdition ? modifierFormation.bind(null, formationEnEdition.id) : creerFormation} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-text-muted text-xs mb-1 block">Titre</label>
            <input
              name="titre"
              required
              defaultValue={formationEnEdition?.titre ?? ''}
              className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-text-muted text-xs mb-1 block">Description de la compétence</label>
            <textarea
              name="description"
              rows={2}
              defaultValue={formationEnEdition?.description ?? ''}
              placeholder="Ce que l’élève saura faire à la fin…"
              className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
            />
          </div>
          <div>
            <label className="text-text-muted text-xs mb-1 block">Durée</label>
            <input
              name="duree_texte"
              defaultValue={formationEnEdition?.duree_texte ?? ''}
              placeholder="ex. 6 heures, 3 semaines…"
              className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
            />
          </div>
          <div>
            <label className="text-text-muted text-xs mb-1 block">Mode de transmission</label>
            <select
              name="mode_transmission"
              defaultValue={formationEnEdition?.mode_transmission ?? ''}
              className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
            >
              <option value="">— Choisir —</option>
              <option value="presentiel">Présentiel</option>
              <option value="video_tutoriel">Vidéo-tutoriel</option>
              <option value="mixte">Mixte — tous moyens</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label className="text-text-muted text-xs mb-1 block">Prix (FCFA)</label>
            <input
              name="prix"
              type="number"
              min="0"
              step="1"
              defaultValue={formationEnEdition?.prix ?? ''}
              className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
            />
          </div>
          <div className="flex items-end gap-2.5">
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full"
            >
              {formationEnEdition ? <Pencil size={14} /> : <Plus size={14} />}
              {formationEnEdition ? 'Enregistrer les modifications' : 'Ajouter'}
            </button>
            {formationEnEdition && (
              <Link href="/solo/formations" className="flex items-center gap-1 text-[13px] text-text-muted hover:text-text-primary px-3 py-2">
                <X size={14} /> Annuler
              </Link>
            )}
          </div>
        </form>
      </Panel>

      <Panel title={`${formations?.length ?? 0} formation(s)`}>
        {(formations ?? []).length === 0 ? (
          <p className="text-text-muted text-sm py-6 text-center">Aucune formation créée pour le moment.</p>
        ) : (
          <div className="divide-y divide-border-soft">
            {(formations ?? []).map((f: any) => {
              const inscriptionsF = inscriptionsParFormation.get(f.id) ?? []
              const total = inscriptionsF.length
              const termine = inscriptionsF.filter((i) => i.statut === 'termine').length
              const abandonne = inscriptionsF.filter((i) => i.statut === 'abandonne').length
              const revenu = revenuParFormation.get(f.id) ?? 0
              const note = noteParFormation.get(f.id)
              const aDesInscriptions = total > 0

              return (
                <div key={f.id} className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-text-primary text-[13.5px] font-medium font-display">{f.titre}</p>
                    <StatusPill status={STATUT_PILL[f.statut] ?? 'idle'}>{STATUT_LABEL[f.statut] ?? f.statut}</StatusPill>
                  </div>
                  {f.description && <p className="text-text-muted text-xs mb-2.5 max-w-2xl">{f.description}</p>}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {f.duree_texte && (
                      <span className="inline-flex items-center gap-1 text-[11.5px] bg-bg-surface border border-border-soft text-text-muted px-2.5 py-1 rounded-full">
                        <Clock size={12} /> {f.duree_texte}
                      </span>
                    )}
                    {f.mode_transmission && (
                      <span className="inline-flex items-center gap-1 text-[11.5px] bg-bg-surface border border-border-soft text-text-muted px-2.5 py-1 rounded-full">
                        {f.mode_transmission === 'presentiel' ? <Users2 size={12} /> : <Video size={12} />} {MODE_LABEL[f.mode_transmission]}
                      </span>
                    )}
                    {f.prix != null && (
                      <span className="inline-flex items-center gap-1 text-[11.5px] bg-bg-surface border border-accent-gold-dim/50 text-accent-gold px-2.5 py-1 rounded-full">
                        <Banknote size={12} /> {f.prix} {f.devise}
                      </span>
                    )}
                    {note && (
                      <span className="inline-flex items-center gap-1 text-[11.5px] bg-bg-surface border border-border-soft text-accent-gold px-2.5 py-1 rounded-full">
                        <Star size={12} /> {note.note_moyenne}/5 ({note.nombre_avis} avis)
                      </span>
                    )}
                  </div>

                  {total > 0 && (
                    <div className="flex flex-wrap gap-4 mb-3 text-[11.5px] text-text-muted">
                      <span className="flex items-center gap-1"><Users2 size={12} /> {total} inscrit(s)</span>
                      <span className="flex items-center gap-1">Taux de complétion : {Math.round((termine / total) * 100)}%</span>
                      <span className="flex items-center gap-1 text-danger/80"><TrendingDown size={12} /> Taux d'abandon : {Math.round((abandonne / total) * 100)}%</span>
                      <span className="flex items-center gap-1 text-accent-gold"><Wallet2 size={12} /> Revenu généré : {revenu} {f.devise}</span>
                    </div>
                  )}

                  {(() => {
                    const inactifs = inscriptionsF.filter((i) => i.statut === 'en_cours' && (derniereActiviteParInscription.get(i.id) ?? 0) < seuilMs)
                    if (inactifs.length === 0) return null
                    return (
                      <div className="bg-danger/5 border border-danger/25 rounded-xl p-3 mb-3">
                        <p className="text-[11px] text-danger font-medium mb-1.5">{inactifs.length} élève(s) sans progression depuis plus de {SEUIL_INACTIVITE_JOURS} jours</p>
                        <ul className="space-y-1">
                          {inactifs.map((i) => {
                            const profil = profilParId.get(i.acheteur_id)
                            const nom = profil?.nom ? `${profil.nom} ${profil.prenoms ?? ''}` : profil?.email ?? 'Élève'
                            return (
                              <li key={i.id} className="flex items-center justify-between text-[11.5px] text-text-muted">
                                <span>{nom}</span>
                                <RelancerEleve acheteurId={i.acheteur_id} nomFormation={f.titre} />
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })()}

                  <div className="mb-3">
                    <p className="text-[11px] text-text-muted uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Paperclip size={11} /> Ressources téléchargeables
                    </p>
                    {(ressourcesParFormation.get(f.id) ?? []).length > 0 && (
                      <ul className="space-y-1 mb-2">
                        {(ressourcesParFormation.get(f.id) ?? []).map((r: any) => (
                          <li key={r.id} className="flex items-center justify-between text-[12px] bg-bg-surface border border-border-soft rounded-lg px-3 py-1.5">
                            <a
                              href={signedUrlParChemin.get(r.chemin_storage) ?? '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 text-accent-teal hover:underline"
                            >
                              <FileDown size={12} /> {r.nom_fichier}
                            </a>
                            <form action={supprimerRessource.bind(null, r.id, r.chemin_storage)}>
                              <button type="submit" aria-label={`Supprimer ${r.nom_fichier}`} className="text-text-muted hover:text-danger">
                                <Trash2 size={12} />
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form action={televerserRessource.bind(null, f.id)} className="flex items-center gap-2">
                      <input type="file" name="fichier" required className="text-[11.5px] text-text-muted flex-1" />
                      <button type="submit" className="text-[11.5px] text-accent-gold border border-accent-gold-dim/50 rounded-full px-3 py-1">
                        Ajouter
                      </button>
                    </form>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(f.statut === 'brouillon' || f.statut === 'suspendue') && (
                      <form action={publierFormation.bind(null, f.id)}>
                        <button type="submit" className="flex items-center gap-1 text-[12px] border border-accent-gold-dim/50 text-accent-gold rounded-lg px-2.5 py-1.5">
                          <Upload size={13} /> Publier
                        </button>
                      </form>
                    )}
                    {f.statut === 'publiee' && (
                      <form action={suspendreFormation.bind(null, f.id)}>
                        <button type="submit" className="flex items-center gap-1 text-[12px] border border-danger/40 text-danger rounded-lg px-2.5 py-1.5">
                          <PauseCircle size={13} /> Suspendre
                        </button>
                      </form>
                    )}
                    {f.statut !== 'archivee' && (
                      <form action={archiverFormation.bind(null, f.id)}>
                        <button type="submit" className="flex items-center gap-1 text-[12px] border border-border-soft text-text-muted rounded-lg px-2.5 py-1.5">
                          <Archive size={13} /> Archiver
                        </button>
                      </form>
                    )}
                    <Link
                      href={`/solo/formations?edit=${f.id}`}
                      className="flex items-center gap-1 text-[12px] border border-border-soft text-text-muted rounded-lg px-2.5 py-1.5"
                    >
                      <Pencil size={13} /> Modifier
                    </Link>
                    <SupprimerAvecConfirmation
                      action={supprimerFormation.bind(null, f.id)}
                      titreConfirmation="Supprimer cette formation ?"
                      messageConfirmation="Cette action est définitive et différente d'un archivage : la fiche disparaîtra complètement, y compris son historique."
                      bloque={aDesInscriptions}
                      messageBloque={`${total} élève(s) déjà inscrit(s) à cette formation. Suppression impossible pour préserver leur accès et leur progression — utilisez « Archiver » à la place.`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </>
  )
}
