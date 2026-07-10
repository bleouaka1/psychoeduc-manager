import Link from 'next/link'
import { Compass, ArrowLeft } from 'lucide-react'

/**
 * Placeholder honnête : l'auto-évaluation IGA publique (sans compte, ou avec inscription
 * légère) est un chantier à part entière — moteur de scoring déjà en place (lib/iga.ts)
 * mais entièrement pensé pour un bénéficiaire rattaché à une organisation, jamais pour un
 * visiteur anonyme. Construire ce parcours nécessite son propre modèle de données et sa
 * propre session de vérification ; documenté comme différé dans DECISIONS_LOG.md plutôt
 * que bâclé en silence. La route existe pour que le CTA de la page d'accueil ne soit
 * jamais un lien mort.
 */
export default function MesurerIgaPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-bg-base relative overflow-hidden px-6">
      <div className="ambient-halo" />
      <div className="relative z-[1] max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-gold to-accent-gold-dim flex items-center justify-center mx-auto mb-5">
          <Compass size={26} className="text-bg-base" />
        </div>
        <h1 className="font-display text-text-primary text-2xl mb-3">Mesurez votre autonomie — bientôt disponible</h1>
        <p className="text-text-muted text-sm mb-6">
          L&apos;auto-évaluation IGA en libre accès est en cours de construction. En attendant, si vous accompagnez déjà des
          bénéficiaires, connectez-vous pour réaliser une évaluation depuis votre espace.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-accent-gold hover:underline text-sm font-medium"
        >
          <ArrowLeft size={14} /> Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  )
}
