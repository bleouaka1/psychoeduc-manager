import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { chargerPrixCourant } from '@/lib/pricing'
import { chargerHistoriqueCv } from '@/lib/cvServer'
import { parserContenuCv, formulaireCvVide } from '@/lib/cv'
import { CvApercu } from '@/app/_components/cv/CvApercu'
import { demarrerGenerationCv, finaliserGenerationCv, preremplirDepuisProfilAction } from './actions'
import { CvFormulaireWrapper } from './_components/CvFormulaireWrapper'
import { FinaliserCvButton } from './_components/FinaliserCvButton'

const LABEL_STATUT: Record<string, string> = {
  en_attente: 'en attente de paiement',
  echoue: 'échouée',
}

export default async function CvPage({ params }: { params: Promise<{ beneficiaireId: string }> }) {
  const { beneficiaireId } = await params
  const supabase = await createClient()

  const dossiers = await chargerDossiersBeneficiaire(supabase)
  const dossier = dossiers.find((d) => d.id === beneficiaireId)
  const estBeneficiaire = Boolean(dossier)
  if (!estBeneficiaire) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [prix, historique] = await Promise.all([chargerPrixCourant(supabase, 'generation_cv'), user ? chargerHistoriqueCv(supabase, user.id) : Promise.resolve([])])

  return (
    <div>
      <p className="font-data text-[11px] tracking-[0.15em] text-accent-gold uppercase mb-2.5">Mon espace</p>
      <h1 className="font-cinzel font-semibold text-3xl text-text-primary mb-1">Générer mon CV</h1>
      <p className="text-text-muted text-sm mb-7">
        Un générateur de CV standard, comme sur n’importe quelle plateforme — remplis ce que tu veux, l’IA met en forme.
        {prix ? ` ${prix.montant} ${prix.devise} par génération.` : ''}
      </p>

      {prix && (
        <div className="bg-bg-card border border-border-soft rounded-[10px] p-6 mb-6">
          <CvFormulaireWrapper
            formulaireInitial={formulaireCvVide(dossier?.prenoms ?? '', dossier?.nom ?? '')}
            peutPreremplir={estBeneficiaire}
            preremplir={preremplirDepuisProfilAction.bind(null, beneficiaireId)}
            soumettre={demarrerGenerationCv.bind(null, beneficiaireId)}
          />
        </div>
      )}

      {historique.length > 0 && (
        <div>
          <p className="font-data text-[11px] tracking-[0.18em] text-text-muted uppercase mb-3.5">Historique</p>
          <div className="space-y-4">
            {historique.map((g) => {
              const contenu = parserContenuCv(g.contenuJson)
              const dateAffichee = new Date(g.createdAt).toLocaleDateString('fr-FR')
              if (contenu) {
                return <CvApercu key={g.id} contenu={contenu} sousTitre={`Généré le ${dateAffichee}`} />
              }
              return (
                <div key={g.id} className="bg-bg-card border border-border-soft rounded-[10px] p-6">
                  <p className="text-text-muted text-[13px] mb-2">
                    Demande du {dateAffichee} — {g.statut === 'confirme' ? 'paiement confirmé, génération à finaliser' : LABEL_STATUT[g.statut]}
                  </p>
                  {g.statut === 'confirme' && <FinaliserCvButton beneficiaireId={beneficiaireId} generationId={g.id} finaliser={finaliserGenerationCv} />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
