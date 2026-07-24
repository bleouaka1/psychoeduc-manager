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

// Ordre de la hiérarchie du document Compte Structure (§1) — Promoteur au sommet, Formateur
// au plus près du terrain. Détermine l'ordre d'affichage des groupes de rôle sur cette page.
const ORDRE_ROLES = ['promoteur', 'directeur', 'coordinateur', 'educateur', 'formateur', 'administrateur']
const ROLE_LABEL: Record<string, string> = {
  promoteur: 'Promoteur',
  directeur: 'Directeur',
  coordinateur: 'Coordinateur',
  educateur: 'Éducateur',
  formateur: 'Formateur',
  administrateur: 'Administrateur',
}

export default async function ApercuPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams
  const supabase = await createClient()
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  if (!estFondateur) redirect('/dashboard')

  const [{ data: organisations }, { data: beneficiairesAvecCompte }, { data: liensParents }, { data: membresStructure }] = await Promise.all([
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
    // profiles!membres_organisations_profile_id_fkey : membres_organisations a 3 FK vers
    // profiles (created_by/profile_id/updated_by) — sans ce hint explicite, PostgREST refuse
    // la requête (PGRST201, relation ambiguë) et data reste `undefined` sans exception JS
    // visible (déjà rencontré à l'étape 2/10 du Compte Structure, leçon désormais établie).
    supabase
      .from('membres_organisations')
      .select('profile_id, profiles!membres_organisations_profile_id_fkey(email, nom, prenoms), organisations(nom, type_organisation), roles_utilisateurs(role, actif)')
      .eq('statut', 'actif')
      .limit(200),
  ])

  const solo = (organisations ?? []).filter((o) => o.type_organisation === 'solo')
  const employeur = (organisations ?? []).filter((o) => o.type_organisation === 'employeur')
  const structures = (organisations ?? []).filter((o) => !['solo', 'employeur'].includes(o.type_organisation))

  // Impersonation réelle du personnel Structure (Directeur/Coordinateur/Éducateur/Formateur/
  // Promoteur) — contrairement au bouton "Voir" ci-dessus (rôle forcé au plus large pour
  // tout montrer), ici tu vis EXACTEMENT ce que cette personne voit, boutons compris.
  const staffParRole = new Map<string, { profileId: string; email: string; nom: string; org: string }[]>()
  for (const m of membresStructure ?? []) {
    const org = (m as any).organisations
    if (!org || ['solo', 'employeur'].includes(org.type_organisation)) continue
    const profil = (m as any).profiles
    for (const r of (m as any).roles_utilisateurs ?? []) {
      if (!r.actif) continue
      const liste = staffParRole.get(r.role) ?? []
      liste.push({ profileId: m.profile_id, email: profil?.email ?? '', nom: `${profil?.prenoms ?? ''} ${profil?.nom ?? ''}`.trim(), org: org.nom })
      staffParRole.set(r.role, liste)
    }
  }
  const rolesOrdonnes = [...staffParRole.keys()].sort((a, b) => {
    const ia = ORDRE_ROLES.indexOf(a)
    const ib = ORDRE_ROLES.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

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

      <Panel title="Personnel Structure — par rôle" icon={Users} className="mb-5">
        <p className="text-text-muted text-xs mb-3">
          Connexion réelle (impersonation) à un compte précis — contrairement à "Voir" ci-dessus (qui montre tous les rôles à la fois pour tout explorer vite), ici tu vis exactement ce que CETTE personne voit : mêmes boutons, mêmes restrictions, conforme à sa mission réelle.
        </p>
        {rolesOrdonnes.length === 0 ? (
          <EmptyState text="Aucun membre d'équipe Structure pour le moment." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {rolesOrdonnes.map((role) => (
              <div key={role}>
                <p className="text-text-muted text-[11px] uppercase tracking-wide mb-2">{ROLE_LABEL[role] ?? role}</p>
                <ul className="divide-y divide-border-soft/60">
                  {staffParRole.get(role)!.map((personne) => (
                    <li key={`${role}-${personne.profileId}`} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-text-primary text-[13px]">{personne.nom || personne.email}</p>
                        <p className="text-text-muted text-[11px]">{personne.org}</p>
                      </div>
                      <form action={demarrerImpersonation.bind(null, personne.profileId, '/dashboard')}>
                        <button type="submit" className="text-[11px] px-2.5 py-1 rounded-full border border-border-soft text-text-primary hover:bg-bg-surface whitespace-nowrap">
                          Se connecter
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Panel>

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
