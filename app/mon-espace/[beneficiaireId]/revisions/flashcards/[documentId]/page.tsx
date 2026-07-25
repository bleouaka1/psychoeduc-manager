import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { chargerFlashcardsParDocument } from '@/lib/flashcardsServer'
import { chargerSoldeCredits } from '@/lib/quizRevisionServer'
import { BoutonImprimer } from '@/app/solo/_components/BoutonImprimer'
import { genererFlashcardsAction, genererMnemotechniqueAction } from './actions'
import { GenererFlashcardsButton, GenererMnemotechniqueButton } from './_components/ActionsFlashcards'
import { FlipCard } from './_components/FlipCard'

export default async function FlashcardsPage({ params }: { params: Promise<{ beneficiaireId: string; documentId: string }> }) {
  const { beneficiaireId, documentId } = await params
  const supabase = await createClient()

  const dossiers = await chargerDossiersBeneficiaire(supabase)
  const dossier = dossiers.find((d) => d.id === beneficiaireId)
  if (!dossier) notFound()

  const { data: document } = await supabase.from('documents_beneficiaires').select('id, nom_fichier').eq('id', documentId).eq('beneficiaire_id', beneficiaireId).maybeSingle()
  if (!document) notFound()

  const [flashcards, solde] = await Promise.all([chargerFlashcardsParDocument(supabase, documentId), chargerSoldeCredits(supabase, beneficiaireId)])

  const generer = genererFlashcardsAction.bind(null, beneficiaireId, documentId)
  const genererMnemo = genererMnemotechniqueAction.bind(null, beneficiaireId, documentId)
  const toutesOntUneAide = flashcards.length > 0 && flashcards.every((f) => f.mnemotechnique)

  return (
    <div>
      <p className="font-data text-[11px] tracking-[0.15em] text-accent-gold uppercase mb-2.5">Bibliothèque · Flashcards</p>
      <h1 className="font-cinzel font-semibold text-2xl text-text-primary mb-1">{document.nom_fichier}</h1>
      <p className="text-text-muted text-sm mb-7">Recto = question, verso = réponse. Touche une carte pour la retourner.</p>

      {flashcards.length === 0 ? (
        <div className="bg-bg-card border border-border-soft rounded-[10px] p-6 print:hidden">
          <GenererFlashcardsButton generer={generer} />
        </div>
      ) : (
        <>
          <div className="print:hidden flex flex-wrap items-center gap-3 mb-6">
            <BoutonImprimer />
            {!toutesOntUneAide && <GenererMnemotechniqueButton soldeCredits={solde} generer={genererMnemo} />}
          </div>

          {/* Vue écran — cartes interactives */}
          <div className="print:hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {flashcards.map((f) => (
              <FlipCard key={f.id} recto={f.recto} verso={f.verso} />
            ))}
          </div>

          {flashcards.some((f) => f.mnemotechnique) && (
            <div className="print:hidden space-y-3">
              <p className="font-data text-[11px] tracking-[0.18em] text-text-muted uppercase mb-2">Aides mnémotechniques</p>
              {flashcards
                .filter((f) => f.mnemotechnique)
                .map((f) => (
                  <div key={f.id} className="bg-bg-card border-l-2 border-accent-gold-dim rounded-r-xl p-4">
                    <p className="text-text-primary text-[12.5px] font-medium mb-1">{f.recto}</p>
                    <p className="text-text-muted text-[12px]">{f.mnemotechnique}</p>
                  </div>
                ))}
            </div>
          )}

          {/* Vue imprimable — grille recto+verso sur la même carte, visible uniquement à l'impression */}
          <div className="hidden print:grid grid-cols-2 gap-4">
            {flashcards.map((f) => (
              <div key={f.id} className="border border-gray-300 rounded-lg p-3.5 break-inside-avoid">
                <p className="text-[12.5px] font-semibold mb-2">{f.recto}</p>
                <p className="text-[12px] pt-2 border-t border-dashed border-gray-300">{f.verso}</p>
                {f.mnemotechnique && <p className="text-[11px] mt-2 pt-2 border-t border-dashed border-gray-300 italic">💡 {f.mnemotechnique}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
