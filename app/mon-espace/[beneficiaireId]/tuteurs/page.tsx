import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { chargerPersonas } from '@/lib/tuteurIaServer'
import { chargerDocumentsQuiz } from '@/lib/quizRevisionServer'
import { chargerSoldeCredits } from '@/lib/quizRevisionServer'
import { DemarrerSessionForm } from './_components/DemarrerSessionForm'
import { demarrerSessionTuteur } from './actions'

export default async function TuteursPage({ params }: { params: Promise<{ beneficiaireId: string }> }) {
  const { beneficiaireId } = await params
  const supabase = await createClient()

  const dossiers = await chargerDossiersBeneficiaire(supabase)
  const dossier = dossiers.find((d) => d.id === beneficiaireId)
  if (!dossier) notFound()

  const [personasTutorat, personasEntretien, documents, solde] = await Promise.all([
    chargerPersonas(supabase, 'tutorat'),
    chargerPersonas(supabase, 'entretien'),
    chargerDocumentsQuiz(supabase, beneficiaireId),
    chargerSoldeCredits(supabase, beneficiaireId),
  ])

  const documentsValides = documents.filter((d) => d.valideAt)

  return (
    <div>
      <p className="font-data text-[11px] tracking-[0.15em] text-accent-gold uppercase mb-2.5">Mon espace</p>
      <h1 className="font-cinzel font-semibold text-3xl text-text-primary mb-1">Espace Tuteurs</h1>
      <p className="text-text-muted text-sm mb-7">
        Dialogue avec un tuteur IA pour apprendre, ou entraîne-toi avec une simulation d’entretien — solde de crédits :{' '}
        <span className="font-data text-accent-gold">{solde}</span>
      </p>

      <DemarrerSessionForm
        personasTutorat={personasTutorat}
        personasEntretien={personasEntretien}
        documents={documentsValides.map((d) => ({ id: d.id, nomFichier: d.nomFichier }))}
        soldeCredits={solde}
        demarrer={demarrerSessionTuteur.bind(null, beneficiaireId)}
        beneficiaireId={beneficiaireId}
      />
    </div>
  )
}
