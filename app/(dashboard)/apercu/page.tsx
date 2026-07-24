import { redirect } from 'next/navigation'
import { Eye, Building2, User, Briefcase, HeartHandshake, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, EmptyState } from '../_components/ui'
import { activerApercuEtRedirection, demarrerImpersonation } from './actions'

const MESSAGE_ERREUR: Record<string, string> = {
  service_role_manquante:
    'SUPABASE_SERVICE_ROLE_KEY manquante dans .env.local — nécessaire pour se connecter en tant qu\'un bénéficiaire ou un parent précis (Supabase Dashboard > Project Settings > API > service_role, jamais commitée).',
  lien_impersonation_echoue: "Impossible de générer la session — le compte visé n'a peut-être pas d'e-mail confirmé.",
}

const TYPE_LABEL: Record<string, string> = {
  solo: 'Compte Solo',
  structure: 'Structure',
  ecole: 'Structure — École',
  ong: 'Structure — ONG',
  centre: 'Structure — Centre de formation',
  association: 'Structure — Association',
  fondation: 'Structure — Fondation',
  employeur: 'Employeur',
  entreprise: 'Employeur — Entreprise',
}

export default async function ApercuPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams
  const supabase = await createClient()
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  if (!estFondateur) redirect('/dashboard')

  const [{ data: organisations }, { data: beneficiairesAvecCompte }, { data: liensParents }] = await Promise.all([
    supabase.from('organisations').select('id, nom, type_organisation, created_at').order('nom'),
    supabase
      .from('beneficiaires')
      .select('id, nom, prenoms, profile_id, profiles(email)')
      .not('profile_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('liens_parent_beneficiaire')
      .select('parent_profile_id, profiles(email), beneficiaires(nom, prenoms)')
      .eq('statut', 'actif')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const solo = (organisations ?? []).filter((o) => o.type_organisation === 'solo')
  const employeur = (organisations ?? []).filter((o) => o.type_organisation === 'employeur')
  const structures = (organisations ?? []).filter((o) => !['solo', 'employeur'].includes(o.type_organisation))

  // Un même parent peut avoir plusieurs enfants (plusieurs lignes) — un seul bouton par
  // parent_profile_id distinct, avec la liste de ses enfants en label.
  const parentsUniques = new Map<string, { email: string; enfants: string[] }>()
  for (const l of liensParents ?? []) {
    const email = (l as any).profiles?.email ?? 'parent'
    const nomEnfant = `${(l as any).beneficiaires?.prenoms ?? ''} ${(l as any).beneficiaires?.nom ?? ''}`.trim()
    const entree = parentsUniques.get(l.parent_profile_id) ?? { email, enfants: [] as string[] }
    if (nomEnfant) entree.enfants.push(nomEnfant)
    parentsUniques.set(l.parent_profile_id, entree)
  }

  return (
    <>
      <PageHeader
        eyebrowIcon={Eye}
        eyebrowText="Mode Test"
        title="Aperçu — voir en tant que"
        subtitle="Réservé au Fondateur. Consulte n'importe quel tableau de bord avec de vraies données, en lecture ET écriture (RLS te laisse déjà tout faire) — toute action reste attribuée à ton propre profil, jamais usurpée."
      />

      {erreur && (
        <Panel className="mb-6 border-danger/40">
          <p className="text-danger text-sm">{MESSAGE_ERREUR[erreur] ?? 'Une erreur est survenue.'}</p>
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <Panel title="Comptes Solo" icon={User}>
          {solo.length === 0 ? (
            <EmptyState text="Aucun compte Solo." />
          ) : (
            <ListeOrganisations organisations={solo} />
          )}
        </Panel>

        <Panel title="Structures" icon={Building2}>
          {structures.length === 0 ? (
            <EmptyState text="Aucune structure." />
          ) : (
            <ListeOrganisations organisations={structures} />
          )}
        </Panel>

        <Panel title="Employeurs" icon={Briefcase}>
          {employeur.length === 0 ? (
            <EmptyState text="Aucun employeur." />
          ) : (
            <ListeOrganisations organisations={employeur} />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Mon Espace — bénéficiaires" icon={HeartHandshake}>
          <p className="text-text-muted text-xs mb-3">
            Connexion réelle (impersonation), pas une simple lecture — se déconnecte de ton propre compte le temps de l'aperçu. "Quitter l'impersonation" te reconnecte automatiquement.
          </p>
          {!beneficiairesAvecCompte || beneficiairesAvecCompte.length === 0 ? (
            <EmptyState text="Aucun bénéficiaire avec un compte actif (Mon Espace)." />
          ) : (
            <ul className="divide-y divide-border-soft/60">
              {beneficiairesAvecCompte.map((b: any) => (
                <li key={b.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-text-primary text-[13.5px]">
                      {b.nom} {b.prenoms}
                    </p>
                    <p className="text-text-muted text-[11px]">{b.profiles?.email}</p>
                  </div>
                  <form action={demarrerImpersonation.bind(null, b.profile_id, '/mon-espace')}>
                    <button type="submit" className="text-[11.5px] px-3 py-1.5 rounded-full border border-border-soft text-text-primary hover:bg-bg-surface whitespace-nowrap">
                      Se connecter en tant que
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Espace Parent" icon={Users}>
          <p className="text-text-muted text-xs mb-3">Même mécanisme d'impersonation que ci-dessus.</p>
          {parentsUniques.size === 0 ? (
            <EmptyState text="Aucun lien parent-bénéficiaire actif." />
          ) : (
            <ul className="divide-y divide-border-soft/60">
              {[...parentsUniques.entries()].map(([parentProfileId, info]) => (
                <li key={parentProfileId} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-text-primary text-[13.5px]">{info.email}</p>
                    <p className="text-text-muted text-[11px]">Parent de {info.enfants.join(', ')}</p>
                  </div>
                  <form action={demarrerImpersonation.bind(null, parentProfileId, '/espace-parent')}>
                    <button type="submit" className="text-[11.5px] px-3 py-1.5 rounded-full border border-border-soft text-text-primary hover:bg-bg-surface whitespace-nowrap">
                      Se connecter en tant que
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}

function ListeOrganisations({ organisations }: { organisations: { id: string; nom: string; type_organisation: string }[] }) {
  return (
    <ul className="divide-y divide-border-soft/60">
      {organisations.map((o) => (
        <li key={o.id} className="py-2.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-text-primary text-[13.5px]">{o.nom}</p>
            <p className="text-text-muted text-[11px]">{TYPE_LABEL[o.type_organisation] ?? o.type_organisation}</p>
          </div>
          <form action={activerApercuEtRedirection}>
            <input type="hidden" name="organisation_id" value={o.id} />
            <button type="submit" className="text-[11.5px] px-3 py-1.5 rounded-full border border-border-soft text-text-primary hover:bg-bg-surface whitespace-nowrap">
              Voir
            </button>
          </form>
        </li>
      ))}
    </ul>
  )
}
