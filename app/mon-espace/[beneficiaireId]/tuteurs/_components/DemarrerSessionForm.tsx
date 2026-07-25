'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ObjectifTuteur, PersonaTuteur } from '@/lib/tuteurIa'

type Document = { id: string; nomFichier: string }

/**
 * Écran de sélection : objectif (tutorat vs simulation d'entretien) → persona → document
 * source (obligatoire pour le tutorat, absent pour un entretien) → démarrage de la
 * session. Le crédit n'est PAS débité ici (voir actions.ts) — seulement au premier
 * message échangé.
 */
export function DemarrerSessionForm({
  personasTutorat,
  personasEntretien,
  documents,
  soldeCredits,
  demarrer,
  beneficiaireId,
}: {
  personasTutorat: PersonaTuteur[]
  personasEntretien: PersonaTuteur[]
  documents: Document[]
  soldeCredits: number
  demarrer: (personaId: string, documentId: string | null) => Promise<{ error: string | null; sessionId?: string }>
  beneficiaireId: string
}) {
  const router = useRouter()
  const [objectif, setObjectif] = useState<ObjectifTuteur | null>(null)
  const [personaId, setPersonaId] = useState<string | null>(null)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const personas = objectif === 'entretien' ? personasEntretien : personasTutorat
  const persona = personas.find((p) => p.id === personaId) ?? null

  async function lancer() {
    if (!personaId) return
    if (objectif === 'tutorat' && !documentId) {
      setErreur('Choisis un document pour cette session.')
      return
    }
    setEnCours(true)
    setErreur(null)
    const res = await demarrer(personaId, objectif === 'entretien' ? null : documentId)
    setEnCours(false)
    if (res.error) {
      setErreur(res.error)
      return
    }
    router.push(`/mon-espace/${beneficiaireId}/tuteurs/${res.sessionId}`)
  }

  if (!objectif) {
    return (
      <div className="bg-bg-card border border-border-soft rounded-[10px] p-6">
        <p className="text-text-primary text-[14px] font-medium mb-4">Qu’est-ce que tu veux faire aujourd’hui ?</p>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setObjectif('tutorat')}
            className="text-[13px] text-text-primary border border-border-soft rounded-full px-4 py-2.5 hover:border-accent-gold-dim"
          >
            Réviser avec un tuteur
          </button>
          <button
            type="button"
            onClick={() => setObjectif('entretien')}
            className="text-[13px] text-text-primary border border-border-soft rounded-full px-4 py-2.5 hover:border-accent-gold-dim"
          >
            Simuler un entretien
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-bg-card border border-border-soft rounded-[10px] p-6">
      <button type="button" onClick={() => setObjectif(null)} className="text-text-muted text-[12px] hover:text-text-primary mb-4">
        ← Changer d’objectif
      </button>

      {personas.length === 0 ? (
        <p className="text-text-muted text-sm">Aucun tuteur disponible pour l’instant.</p>
      ) : (
        <>
          <p className="text-text-muted text-[12.5px] mb-2">Choisis un tuteur :</p>
          <div className="flex flex-wrap gap-2.5 mb-5">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPersonaId(p.id)}
                className={`text-[13px] rounded-full px-4 py-2 border ${
                  personaId === p.id ? 'border-accent-gold text-accent-gold' : 'border-border-soft text-text-primary hover:border-accent-gold-dim'
                }`}
              >
                {p.nom} · {p.domaine}
              </button>
            ))}
          </div>

          {persona && persona.description && <p className="text-text-muted text-[12.5px] mb-5">{persona.description}</p>}

          {objectif === 'tutorat' && (
            <>
              <p className="text-text-muted text-[12.5px] mb-2">Document source :</p>
              {documents.length === 0 ? (
                <p className="text-text-muted text-[12.5px] mb-5">Aucun document validé pour l’instant — dépose et fais valider un support dans la Bibliothèque de révision.</p>
              ) : (
                <div className="flex flex-wrap gap-2.5 mb-5">
                  {documents.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDocumentId(d.id)}
                      className={`text-[13px] rounded-full px-4 py-2 border ${
                        documentId === d.id ? 'border-accent-gold text-accent-gold' : 'border-border-soft text-text-primary hover:border-accent-gold-dim'
                      }`}
                    >
                      {d.nomFichier}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {persona && (
            <p className="text-text-muted text-[12px] mb-3">
              Coût : {persona.coutCredits} crédit(s) au premier message — solde actuel : {soldeCredits}
              {soldeCredits < persona.coutCredits && <span className="text-danger"> (insuffisant)</span>}
            </p>
          )}

          {erreur && <p className="text-danger text-[13px] mb-3">{erreur}</p>}

          <button
            type="button"
            disabled={enCours || !personaId || (objectif === 'tutorat' && !documentId)}
            onClick={lancer}
            className="text-[13px] font-semibold text-bg-base bg-accent-gold rounded-full px-4 py-2.5 disabled:opacity-50"
          >
            {enCours ? 'Démarrage…' : 'Démarrer la session'}
          </button>
        </>
      )}
    </div>
  )
}
