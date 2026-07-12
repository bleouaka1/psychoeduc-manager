import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'

/** Un même profil peut avoir plusieurs dossiers bénéficiaire distincts (un par
 * formateur/organisation, chacun son propre historique IGA — cf. §4.2 de
 * CLAUDE-CODE-COMPTES-MULTIPROFILS.md). Un seul dossier → on y va directement ;
 * plusieurs → un choix explicite, jamais une fusion trompeuse des deux historiques. */
export default async function MonEspacePage() {
  const supabase = await createClient()
  const dossiers = await chargerDossiersBeneficiaire(supabase)

  if (dossiers.length === 1) {
    redirect(`/mon-espace/${dossiers[0].id}`)
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-text-primary mb-1">Vos dossiers d'accompagnement</h1>
      <p className="text-text-muted text-sm mb-6">Chaque dossier a son propre parcours et sa propre Boussole d'Autonomie.</p>
      {dossiers.length === 0 ? (
        <div className="bg-bg-card border border-border-soft rounded-2xl p-10 text-center">
          <p className="text-text-muted text-sm">Aucun dossier d'accompagnement actif pour le moment.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {dossiers.map((d) => (
            <li key={d.id}>
              <Link
                href={`/mon-espace/${d.id}`}
                className="flex items-center justify-between bg-bg-card border border-border-soft rounded-2xl px-5 py-4 hover:border-accent-gold-dim transition-colors"
              >
                <span className="text-text-primary font-medium">
                  {d.nom} {d.prenoms}
                </span>
                <span className="text-text-muted text-[12.5px]">{d.organisationNom}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
