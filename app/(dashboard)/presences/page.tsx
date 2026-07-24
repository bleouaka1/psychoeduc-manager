import Link from 'next/link'
import { CalendarCheck, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, EmptyState, StatusPill } from '../_components/ui'
import { getMonOrganisation } from '../_lib/getMonOrganisation'
import { creerClasse, inscrireBeneficiaire, enregistrerPresence, basculerCohorte } from './actions'

const SEUIL_ALERTE_ABSENCES = 3

export default async function PresencesPage({ searchParams }: { searchParams: Promise<{ classe?: string }> }) {
  const { classe: classeId } = await searchParams
  const organisation = await getMonOrganisation()
  if (!organisation) {
    return (
      <>
        <PageHeader eyebrowIcon={CalendarCheck} eyebrowText="Gestion Administrative" title="Présences" />
        <Panel>
          <EmptyState text="Aucune organisation Structure rattachée à ce compte." />
        </Panel>
      </>
    )
  }

  const supabase = await createClient()

  // Le lien de nav n'apparaît que si le module est actif (Sidebar), mais l'URL reste
  // devinable : on revérifie ici pour qu'une désactivation retire aussi l'accès direct.
  const { data: org } = await supabase.from('organisations').select('module_admin_actif').eq('id', organisation.id).single()
  if (!org?.module_admin_actif) {
    return (
      <>
        <PageHeader eyebrowIcon={CalendarCheck} eyebrowText="Gestion Administrative" title="Présences" />
        <Panel>
          <EmptyState text="Le module Gestion Administrative n'est pas activé pour cette organisation. Un Directeur ou Promoteur peut l'activer depuis Paramètres organisation." />
        </Panel>
      </>
    )
  }

  const aujourdHui = new Date().toISOString().slice(0, 10)

  const { data: classes } = await supabase.from('classes_groupes').select('id, nom').eq('organisation_id', organisation.id).order('nom')
  const classeActive = classeId ?? classes?.[0]?.id ?? null

  const peutGerer = organisation.roles.some((r) => ['directeur', 'coordinateur', 'promoteur', 'administrateur', 'educateur', 'formateur'].includes(r))
  // Bascule de cohorte (§4.7) : action structurante sur des classes entières, réservée aux
  // rôles qui peuvent déjà créer une classe (peut_creer('classes_groupes', ...)) — pas Formateur.
  const peutBasculerCohorte = organisation.roles.some((r) => ['directeur', 'coordinateur', 'promoteur', 'administrateur'].includes(r))

  let roster: any[] = []
  let presencesDuJour = new Map<string, string>()
  let comptesAbsencesNonJustifiees = new Map<string, number>()
  let beneficiairesNonInscrits: any[] = []

  if (classeActive) {
    const [{ data: inscriptions }, { data: presences }, { data: absences }, { data: beneficiaires }] = await Promise.all([
      supabase.from('inscriptions_classes').select('beneficiaire_id, beneficiaires(id, nom, prenoms)').eq('classe_id', classeActive).eq('statut', 'active'),
      supabase.from('presences').select('beneficiaire_id, statut').eq('classe_id', classeActive).eq('date_seance', aujourdHui),
      supabase.from('presences').select('beneficiaire_id').eq('classe_id', classeActive).eq('statut', 'absent').eq('justifie', false),
      supabase.from('beneficiaires').select('id, nom, prenoms').eq('organisation_id', organisation.id).eq('statut_beneficiaire', 'actif'),
    ])

    roster = (inscriptions ?? []).map((i: any) => i.beneficiaires).filter(Boolean)
    presencesDuJour = new Map((presences ?? []).map((p: any) => [p.beneficiaire_id, p.statut]))
    for (const a of absences ?? []) comptesAbsencesNonJustifiees.set(a.beneficiaire_id, (comptesAbsencesNonJustifiees.get(a.beneficiaire_id) ?? 0) + 1)
    const inscritIds = new Set(roster.map((b) => b.id))
    beneficiairesNonInscrits = (beneficiaires ?? []).filter((b: any) => !inscritIds.has(b.id))
  }

  return (
    <>
      <PageHeader eyebrowIcon={CalendarCheck} eyebrowText="Gestion Administrative" title="Présences" subtitle={`Feuille du jour — ${new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())}`} />

      <Panel title="Classes / cohortes" className="mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {(classes ?? []).map((c: any) => (
            <Link
              key={c.id}
              href={`/presences?classe=${c.id}`}
              className={`text-[12.5px] px-3.5 py-1.5 rounded-full border ${c.id === classeActive ? 'bg-accent-gold text-bg-base border-accent-gold font-semibold' : 'border-border-soft text-text-muted hover:text-text-primary'}`}
            >
              {c.nom}
            </Link>
          ))}
        </div>
        {peutGerer && (
          <form action={creerClasse} className="flex flex-wrap items-center gap-2.5">
            <input name="nom" required placeholder="Nouvelle classe / cohorte" className="flex-1 min-w-[200px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary" />
            <button type="submit" className="bg-bg-card border border-border-soft text-text-primary text-[13px] font-medium px-4 py-2 rounded-full">
              Créer
            </button>
          </form>
        )}
      </Panel>

      {!classeActive ? (
        <Panel>
          <EmptyState text="Créez une première classe/cohorte pour commencer à prendre les présences." />
        </Panel>
      ) : (
        <>
          <Panel title="Feuille du jour" icon={CalendarCheck} className="mb-6">
            {roster.length === 0 ? (
              <EmptyState text="Aucun bénéficiaire inscrit dans cette classe." />
            ) : (
              <ul className="divide-y divide-border-soft/60">
                {roster.map((b: any) => {
                  const statutActuel = presencesDuJour.get(b.id)
                  const nbAbsencesNonJustifiees = comptesAbsencesNonJustifiees.get(b.id) ?? 0
                  return (
                    <li key={b.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-text-primary text-[13.5px]">
                          {b.nom} {b.prenoms}
                        </span>
                        {nbAbsencesNonJustifiees >= SEUIL_ALERTE_ABSENCES && (
                          <span title={`${nbAbsencesNonJustifiees} absences non justifiées`} className="flex items-center gap-1 text-[11px] text-danger">
                            <AlertTriangle size={12} /> {nbAbsencesNonJustifiees}
                          </span>
                        )}
                      </div>
                      {peutGerer ? (
                        <div className="flex gap-2">
                          {(['present', 'absent', 'retard'] as const).map((s) => (
                            <form key={s} action={enregistrerPresence.bind(null, classeActive, b.id, aujourdHui, s)}>
                              <button
                                type="submit"
                                className={`text-[11.5px] px-3 py-1.5 rounded-full border ${
                                  statutActuel === s
                                    ? s === 'present'
                                      ? 'bg-accent-teal text-bg-base border-accent-teal'
                                      : s === 'absent'
                                        ? 'bg-danger text-white border-danger'
                                        : 'bg-accent-gold text-bg-base border-accent-gold'
                                    : 'border-border-soft text-text-muted hover:text-text-primary'
                                }`}
                              >
                                {s === 'present' ? 'Présent' : s === 'absent' ? 'Absent' : 'Retard'}
                              </button>
                            </form>
                          ))}
                        </div>
                      ) : (
                        statutActuel && <StatusPill status={statutActuel === 'present' ? 'ok' : statutActuel === 'absent' ? 'down' : 'warn'}>{statutActuel}</StatusPill>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          {peutGerer && (
            <Panel title="Inscrire un bénéficiaire">
              {beneficiairesNonInscrits.length === 0 ? (
                <p className="text-text-muted text-sm">Tous les bénéficiaires actifs sont déjà inscrits dans cette classe.</p>
              ) : (
                <form action={inscrireBeneficiaire.bind(null, classeActive)} className="flex flex-wrap items-center gap-2.5">
                  <select name="beneficiaire_id" required className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary min-w-[220px]">
                    {beneficiairesNonInscrits.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.nom} {b.prenoms}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
                    Inscrire
                  </button>
                </form>
              )}
            </Panel>
          )}

          {peutBasculerCohorte && (
            <Panel title="Bascule de cohorte" className="mt-6">
              <p className="text-text-muted text-sm mb-4">
                Fait passer tous les bénéficiaires actuellement inscrits dans cette classe vers une nouvelle classe/cohorte, en un clic. L'ancienne classe et son historique de présences restent intacts, jamais supprimés.
              </p>
              <form action={basculerCohorte.bind(null, classeActive)} className="flex flex-wrap items-center gap-2.5">
                <input name="nouveau_nom" required placeholder="Nom de la nouvelle classe" className="flex-1 min-w-[200px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary" />
                <input name="niveau" placeholder="Niveau (ex: CE2)" className="w-40 bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary" />
                <input name="annee_scolaire" placeholder="Année scolaire (ex: 2026-2027)" className="w-48 bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary" />
                <button type="submit" className="bg-bg-card border border-border-soft text-text-primary text-[13px] font-medium px-4 py-2 rounded-full">
                  Basculer la cohorte
                </button>
              </form>
            </Panel>
          )}
        </>
      )}
    </>
  )
}
