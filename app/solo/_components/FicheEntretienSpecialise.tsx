'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Mail, CheckCircle2, ArrowLeft, Compass, Save } from 'lucide-react'
import { ORIGINES_SPECIALISE, COMPORTEMENTS_PRESETS, type DonneesEntretienSpecialise } from '@/lib/entretiens'
import { enregistrerEntretien, mettreAJourScolarisation } from '../beneficiaires/[id]/entretiens/actions'
import { BoutonImprimer } from './BoutonImprimer'
import { EnteteImpression } from './EnteteImpression'

type Props = {
  beneficiaireId: string
  entretienId: string
  statutInitial: 'brouillon' | 'valide'
  donneesInitiales: DonneesEntretienSpecialise
  dateEntretien: string
  beneficiaireNom: string
  age: number | null
  sexeLabel: string
  scolarise: boolean
  classe: string | null
  praticienNom: string
  organisation: { nom: string; type_organisation: string; logo_url?: string | null }
}

export function FicheEntretienSpecialise({
  beneficiaireId,
  entretienId,
  statutInitial,
  donneesInitiales,
  dateEntretien,
  beneficiaireNom,
  age,
  sexeLabel,
  scolarise: scolariseInitial,
  classe: classeInitiale,
  praticienNom,
  organisation,
}: Props) {
  const [donnees, setDonnees] = useState<DonneesEntretienSpecialise>(donneesInitiales)
  const [statut, setStatut] = useState(statutInitial)
  const [scolarise, setScolarise] = useState(scolariseInitial)
  const [classe, setClasse] = useState(classeInitiale ?? '')
  const [nouveauComportement, setNouveauComportement] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const verrouillee = statut === 'valide'

  const toggleComportement = (c: string) => {
    if (verrouillee) return
    setDonnees((d) => ({
      ...d,
      comportements: d.comportements.includes(c) ? d.comportements.filter((x) => x !== c) : [...d.comportements, c],
    }))
  }

  const ajouterComportementPersonnalise = () => {
    const valeur = nouveauComportement.trim()
    if (valeur && !donnees.comportements.includes(valeur)) {
      setDonnees((d) => ({ ...d, comportements: [...d.comportements, valeur] }))
      setNouveauComportement('')
    }
  }

  function sauvegarder(nouveauStatut: 'brouillon' | 'valide') {
    if (nouveauStatut === 'valide' && !window.confirm("Valider cet entretien ? Il s'ajoutera à la timeline du bénéficiaire.")) return
    setErreur(null)
    setMessage(null)
    startTransition(async () => {
      const res = await enregistrerEntretien(entretienId, beneficiaireId, donnees, nouveauStatut)
      if (res.error) {
        setErreur(res.error)
        return
      }
      setStatut(nouveauStatut)
      setMessage(nouveauStatut === 'valide' ? 'Entretien validé.' : 'Brouillon enregistré.')
    })
  }

  function majScolarisation(nouveauScolarise: boolean, nouvelleClasse: string) {
    setScolarise(nouveauScolarise)
    setClasse(nouvelleClasse)
    startTransition(async () => {
      await mettreAJourScolarisation(beneficiaireId, nouveauScolarise, nouvelleClasse)
    })
  }

  const sujetMail = `Fiche d'entretien spécialisé — ${beneficiaireNom}`
  const corpsMail = `Analyse : ${donnees.analyse || '(non renseignée)'}\n\nStratégies proposées : ${donnees.strategies || '(non renseignées)'}`
  const lienMailto = `mailto:?subject=${encodeURIComponent(sujetMail)}&body=${encodeURIComponent(corpsMail)}`

  return (
    <div className="min-h-screen w-full" style={{ background: '#F4F1EA', color: '#2B2620' }}>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <EnteteImpression organisation={organisation} />

        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link href={`/solo/beneficiaires/${beneficiaireId}`} className="flex items-center gap-2 text-sm" style={{ color: '#7A6F5E' }}>
            <ArrowLeft size={16} />
            Retour à la fiche bénéficiaire
          </Link>
          <span
            className="text-xs tracking-wide px-3 py-1 rounded-full border"
            style={{
              borderColor: statut === 'brouillon' ? '#C9BFA8' : '#8A9A82',
              color: statut === 'brouillon' ? '#8A7A5C' : '#5C7052',
              background: statut === 'brouillon' ? '#EDE7D8' : '#E7EBE2',
            }}
          >
            {statut === 'brouillon' ? 'Brouillon' : 'Validé'}
          </span>
        </div>

        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-3xl leading-tight" style={{ fontFamily: 'Georgia, serif', color: '#3A2E22' }}>
              Fiche d&apos;entretien spécialisé
            </h1>
            <p className="text-sm mt-1" style={{ color: '#8A7A5C' }}>
              Suivi psychoéducatif ciblé
            </p>
          </div>
          <div className="w-12 h-12 rounded-full flex items-center justify-center border shrink-0" style={{ borderColor: '#C1652F', color: '#C1652F' }}>
            <Compass size={22} />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 p-4 rounded-lg text-sm" style={{ background: '#FFFFFF', border: '1px solid #E4DCC8' }}>
          <div>
            <div style={{ color: '#8A7A5C' }}>Bénéficiaire</div>
            <div style={{ color: '#3A2E22' }}>{beneficiaireNom}</div>
          </div>
          <div>
            <div style={{ color: '#8A7A5C' }}>Âge</div>
            <div style={{ color: '#3A2E22' }}>
              {age !== null ? `${age} ans` : '—'} <span className="text-xs" style={{ color: '#A69B85' }}>(calculé)</span>
            </div>
          </div>
          <div>
            <div style={{ color: '#8A7A5C' }}>Sexe</div>
            <div style={{ color: '#3A2E22' }}>{sexeLabel}</div>
          </div>
          <div className="col-span-2 print:hidden">
            <label className="flex items-center gap-1.5 text-[12.5px]" style={{ color: '#8A7A5C' }}>
              <input type="checkbox" checked={scolarise} onChange={(e) => majScolarisation(e.target.checked, classe)} />
              Scolarisé(e)
            </label>
          </div>
          {scolarise && (
            <div>
              <div style={{ color: '#8A7A5C' }}>Classe</div>
              <input
                value={classe}
                onChange={(e) => setClasse(e.target.value)}
                onBlur={() => majScolarisation(scolarise, classe)}
                placeholder="ex. 6e"
                className="mt-0.5 w-full bg-transparent border-b outline-none"
                style={{ borderColor: '#C1652F', color: '#3A2E22' }}
              />
            </div>
          )}
          <div>
            <div style={{ color: '#8A7A5C' }}>Date de l&apos;entretien</div>
            <div style={{ color: '#3A2E22' }}>{new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateEntretien))}</div>
          </div>
          <div>
            <div style={{ color: '#8A7A5C' }}>Intervenant</div>
            <div style={{ color: '#3A2E22' }}>{praticienNom}</div>
          </div>
        </div>

        <div className="mt-6 p-5 rounded-lg" style={{ background: '#FBF0E9', border: '1px solid #E9CBB4' }}>
          <h2 className="text-lg mb-3" style={{ fontFamily: 'Georgia, serif', color: '#A6491F' }}>
            Motif de l&apos;entretien
          </h2>
          <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
            Origine
          </label>
          <select
            value={donnees.origine}
            disabled={verrouillee}
            onChange={(e) => setDonnees((d) => ({ ...d, origine: e.target.value }))}
            className="w-full p-2 rounded border text-sm mb-3 disabled:opacity-70"
            style={{ borderColor: '#E9CBB4', background: '#FFFFFF', color: '#3A2E22' }}
          >
            {ORIGINES_SPECIALISE.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>

          {donnees.origine === 'Autre' && (
            <input
              value={donnees.origineAutre}
              disabled={verrouillee}
              onChange={(e) => setDonnees((d) => ({ ...d, origineAutre: e.target.value }))}
              placeholder="Préciser l'origine…"
              className="w-full p-2 rounded border text-sm mb-3 disabled:opacity-70"
              style={{ borderColor: '#E9CBB4', background: '#FFFFFF', color: '#3A2E22' }}
            />
          )}
          <textarea
            rows={2}
            value={donnees.motifDescription}
            disabled={verrouillee}
            onChange={(e) => setDonnees((d) => ({ ...d, motifDescription: e.target.value }))}
            placeholder="Décrire le motif déclencheur…"
            className="w-full p-3 rounded border text-sm resize-none disabled:opacity-70"
            style={{ borderColor: '#E9CBB4', background: '#FFFFFF', color: '#3A2E22' }}
          />
        </div>

        <div className="mt-6 p-5 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E4DCC8' }}>
          <h2 className="text-lg mb-4" style={{ fontFamily: 'Georgia, serif', color: '#3A2E22' }}>
            Observation clinique
          </h2>

          <label className="block text-xs mb-2" style={{ color: '#8A7A5C' }}>
            Comportements observés (sélectionner tout ce qui s&apos;applique)
          </label>
          <div className="flex flex-wrap gap-2 mb-4">
            {COMPORTEMENTS_PRESETS.map((c) => {
              const active = donnees.comportements.includes(c)
              return (
                <button
                  key={c}
                  type="button"
                  disabled={verrouillee}
                  onClick={() => toggleComportement(c)}
                  className="text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-60"
                  style={{ borderColor: active ? '#C1652F' : '#DCD3BE', background: active ? '#C1652F' : 'transparent', color: active ? '#FFF8F0' : '#8A7A5C' }}
                >
                  {c}
                </button>
              )
            })}
            {donnees.comportements
              .filter((c) => !(COMPORTEMENTS_PRESETS as readonly string[]).includes(c))
              .map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={verrouillee}
                  onClick={() => toggleComportement(c)}
                  className="text-xs px-3 py-1.5 rounded-full border disabled:opacity-60"
                  style={{ borderColor: '#C1652F', background: '#C1652F', color: '#FFF8F0' }}
                  title="Comportement ajouté manuellement — cliquer pour retirer"
                >
                  {c} ×
                </button>
              ))}
          </div>
          {!verrouillee && (
            <>
              <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
                Autre comportement (non listé)
              </label>
              <div className="flex gap-2 mb-5 print:hidden">
                <input
                  value={nouveauComportement}
                  onChange={(e) => setNouveauComportement(e.target.value)}
                  placeholder="Décrire un comportement observé…"
                  className="flex-1 p-2 rounded border text-sm"
                  style={{ borderColor: '#E4DCC8', color: '#3A2E22' }}
                />
                <button type="button" onClick={ajouterComportementPersonnalise} className="px-3 rounded border text-sm" style={{ borderColor: '#DCD3BE', color: '#3A2E22' }}>
                  Ajouter
                </button>
              </div>
            </>
          )}

          <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
            Expression du jeune (verbatim)
          </label>
          <textarea
            rows={2}
            value={donnees.verbatim}
            disabled={verrouillee}
            onChange={(e) => setDonnees((d) => ({ ...d, verbatim: e.target.value }))}
            className="w-full p-3 rounded border text-sm italic resize-none mb-5 disabled:opacity-70"
            style={{ borderColor: '#E4DCC8', background: '#FBFAF6', color: '#5C5040' }}
          />

          <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
            Analyse de la situation
          </label>
          <textarea
            rows={3}
            value={donnees.analyse}
            disabled={verrouillee}
            onChange={(e) => setDonnees((d) => ({ ...d, analyse: e.target.value }))}
            className="w-full p-3 rounded border text-sm resize-none mb-5 disabled:opacity-70"
            style={{ borderColor: '#E4DCC8', background: '#FBFAF6', color: '#3A2E22' }}
          />

          <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
            Objectifs éducatifs
          </label>
          <textarea
            rows={3}
            value={donnees.objectifs}
            disabled={verrouillee}
            onChange={(e) => setDonnees((d) => ({ ...d, objectifs: e.target.value }))}
            className="w-full p-3 rounded border text-sm resize-none mb-5 disabled:opacity-70"
            style={{ borderColor: '#E4DCC8', background: '#FBFAF6', color: '#3A2E22' }}
          />

          <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
            Stratégies proposées
          </label>
          <textarea
            rows={3}
            value={donnees.strategies}
            disabled={verrouillee}
            onChange={(e) => setDonnees((d) => ({ ...d, strategies: e.target.value }))}
            className="w-full p-3 rounded border text-sm resize-none mb-5 disabled:opacity-70"
            style={{ borderColor: '#E4DCC8', background: '#FBFAF6', color: '#3A2E22' }}
          />

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
                Suivi prévu
              </label>
              <input
                type="date"
                value={donnees.suiviPrevu}
                disabled={verrouillee}
                onChange={(e) => setDonnees((d) => ({ ...d, suiviPrevu: e.target.value }))}
                className="w-full p-2 rounded border text-sm disabled:opacity-70"
                style={{ borderColor: '#E4DCC8', color: '#3A2E22' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
                Statut de la fiche
              </label>
              <div className="w-full p-2 rounded border text-sm" style={{ borderColor: '#E4DCC8', color: '#3A2E22', background: '#FBFAF6' }}>
                {statut === 'brouillon' ? 'Brouillon' : 'Validé'}
              </div>
            </div>
          </div>

          <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
            Commentaires
          </label>
          <textarea
            rows={2}
            value={donnees.commentaires}
            disabled={verrouillee}
            onChange={(e) => setDonnees((d) => ({ ...d, commentaires: e.target.value }))}
            className="w-full p-3 rounded border text-sm resize-none disabled:opacity-70"
            style={{ borderColor: '#E4DCC8', background: '#FBFAF6', color: '#3A2E22' }}
          />
        </div>

        {erreur && <p className="text-sm mt-4" style={{ color: '#A6491F' }}>{erreur}</p>}
        {message && <p className="text-sm mt-4" style={{ color: '#5C7052' }}>{message}</p>}

        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          {!verrouillee && (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={() => sauvegarder('brouillon')}
                className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-md border disabled:opacity-60"
                style={{ borderColor: '#DCD3BE', color: '#3A2E22' }}
              >
                <Save size={16} /> Enregistrer le brouillon
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => sauvegarder('valide')}
                className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-md disabled:opacity-60"
                style={{ background: '#C1652F', color: '#FFF8F0' }}
              >
                <CheckCircle2 size={16} /> Valider l&apos;entretien
              </button>
            </>
          )}
          <a href={lienMailto} className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-md border" style={{ borderColor: '#DCD3BE', color: '#3A2E22' }}>
            <Mail size={16} /> Envoyer par email
          </a>
          <BoutonImprimer />
        </div>

        <p className="text-xs mt-4 print:hidden" style={{ color: '#A69B85' }}>
          Comme pour l&apos;entretien général, une fois validée la fiche s&apos;ajoute à la timeline chronologique du bénéficiaire.
        </p>
      </div>
    </div>
  )
}
