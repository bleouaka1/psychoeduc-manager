'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Mail, CheckCircle2, ArrowLeft, Compass, Plus, X, Save } from 'lucide-react'
import {
  TYPES_ENTRETIEN_GENERAL,
  SOURCES_SIGNALEMENT,
  THEMATIQUES_PRESETS,
  INTERLOCUTEURS,
  INTERLOCUTEUR_LABEL,
  nouveauBlocThematique,
  type DonneesEntretienGeneral,
  type BlocThematique,
  type Interlocuteur,
  type ActionEnregistrerEntretien,
} from '@/lib/entretiens'
import { BoutonImprimer } from './BoutonImprimer'
import { EnteteImpression } from './EnteteImpression'

type Props = {
  beneficiaireId: string
  entretienId: string
  statutInitial: 'brouillon' | 'valide'
  donneesInitiales: DonneesEntretienGeneral
  interlocuteurInitial: Interlocuteur
  dateEntretien: string
  beneficiaireNom: string
  age: number | null
  praticienNom: string
  compteLabel: string
  dimensions: { id: string; nom: string }[]
  organisation: { nom: string; type_organisation: string; logo_url?: string | null }
  retourHref: string
  enregistrerEntretien: ActionEnregistrerEntretien
}

export function FicheEntretienGeneral({
  beneficiaireId,
  entretienId,
  statutInitial,
  donneesInitiales,
  interlocuteurInitial,
  dateEntretien,
  beneficiaireNom,
  age,
  praticienNom,
  compteLabel,
  dimensions,
  organisation,
  retourHref,
  enregistrerEntretien,
}: Props) {
  const [donnees, setDonnees] = useState<DonneesEntretienGeneral>(donneesInitiales)
  const [statut, setStatut] = useState(statutInitial)
  const [interlocuteur, setInterlocuteur] = useState<Interlocuteur>(interlocuteurInitial)
  const [erreur, setErreur] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const verrouillee = statut === 'valide'

  const toggleDimension = (id: string) => {
    if (verrouillee) return
    setDonnees((d) => ({
      ...d,
      dimensionsIds: d.dimensionsIds.includes(id) ? d.dimensionsIds.filter((x) => x !== id) : [...d.dimensionsIds, id],
    }))
  }

  const ajouterBloc = () => setDonnees((d) => ({ ...d, blocs: [...d.blocs, nouveauBlocThematique()] }))
  const retirerBloc = (id: string) => setDonnees((d) => ({ ...d, blocs: d.blocs.filter((b) => b.id !== id) }))
  const majBloc = (id: string, champ: keyof BlocThematique, valeur: string) =>
    setDonnees((d) => ({ ...d, blocs: d.blocs.map((b) => (b.id === id ? { ...b, [champ]: valeur } : b)) }))

  function sauvegarder(nouveauStatut: 'brouillon' | 'valide') {
    if (nouveauStatut === 'valide' && !window.confirm("Valider cet entretien ? Il s'ajoutera à la timeline du bénéficiaire.")) return
    setErreur(null)
    setMessage(null)
    startTransition(async () => {
      const res = await enregistrerEntretien(entretienId, beneficiaireId, donnees, nouveauStatut, interlocuteur)
      if (res.error) {
        setErreur(res.error)
        return
      }
      setStatut(nouveauStatut)
      setMessage(nouveauStatut === 'valide' ? 'Entretien validé.' : 'Brouillon enregistré.')
    })
  }

  const sujetMail = `Fiche d'entretien général — ${beneficiaireNom}`
  const corpsMail = `Synthèse : ${donnees.syntheseGenerale || '(non renseignée)'}\n\nRecommandations : ${donnees.recommandations || '(non renseignées)'}`
  const lienMailto = `mailto:?subject=${encodeURIComponent(sujetMail)}&body=${encodeURIComponent(corpsMail)}`

  return (
    <div className="min-h-screen w-full" style={{ background: '#F4F1EA', color: '#2B2620' }}>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <EnteteImpression organisation={organisation} />

        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link href={retourHref} className="flex items-center gap-2 text-sm" style={{ color: '#7A6F5E' }}>
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

        <div className="flex items-start justify-between mt-4 mb-2">
          <div>
            <h1 className="text-3xl leading-tight" style={{ fontFamily: 'Georgia, serif', color: '#3A2E22' }}>
              Fiche d&apos;entretien général
            </h1>
            <p className="text-sm mt-1" style={{ color: '#8A7A5C' }}>
              Bénéficiaire : <span style={{ color: '#3A2E22' }}>{beneficiaireNom}</span>
              {age !== null && ` · ${age} ans`} · Entretien du {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(dateEntretien))}
            </p>
          </div>
          <div className="w-12 h-12 rounded-full flex items-center justify-center border shrink-0" style={{ borderColor: '#C1652F', color: '#C1652F' }}>
            <Compass size={22} />
          </div>
        </div>

        <div className="flex gap-2 mb-2 print:hidden">
          {TYPES_ENTRETIEN_GENERAL.map((t) => {
            const active = donnees.categorie === t
            return (
              <button
                key={t}
                type="button"
                disabled={verrouillee}
                onClick={() => setDonnees((d) => ({ ...d, categorie: t }))}
                className="text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-60"
                style={{ borderColor: active ? '#C1652F' : '#DCD3BE', background: active ? '#C1652F' : 'transparent', color: active ? '#FFF8F0' : '#8A7A5C' }}
              >
                {t}
              </button>
            )
          })}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4 p-4 rounded-lg text-sm" style={{ background: '#FFFFFF', border: '1px solid #E4DCC8' }}>
          <div>
            <div style={{ color: '#8A7A5C' }}>Praticien</div>
            <div style={{ color: '#3A2E22' }}>{praticienNom}</div>
          </div>
          <div>
            <div style={{ color: '#8A7A5C' }}>Compte</div>
            <div style={{ color: '#3A2E22' }}>{compteLabel}</div>
          </div>
          <div>
            <div style={{ color: '#8A7A5C' }}>Interlocuteur</div>
            <select
              value={interlocuteur}
              disabled={verrouillee}
              onChange={(e) => setInterlocuteur(e.target.value as Interlocuteur)}
              className="mt-0.5 w-full bg-transparent border-b outline-none disabled:opacity-70"
              style={{ borderColor: '#C1652F', color: '#3A2E22' }}
            >
              {INTERLOCUTEURS.map((i) => (
                <option key={i} value={i}>
                  {INTERLOCUTEUR_LABEL[i]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ color: '#8A7A5C' }}>Étape du parcours</div>
            <select
              value={donnees.etapeParcours}
              disabled={verrouillee}
              onChange={(e) => setDonnees((d) => ({ ...d, etapeParcours: e.target.value }))}
              className="mt-0.5 w-full bg-transparent border-b outline-none disabled:opacity-70"
              style={{ borderColor: '#C1652F', color: '#3A2E22' }}
            >
              {['Projet de vie', 'Former', 'Accompagner', 'Évaluer', 'Insérer', 'Réussir'].map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </div>
        </div>

        {donnees.categorie === 'Signalement' && (
          <div className="mt-6 p-5 rounded-lg" style={{ background: '#FBF0E9', border: '1px solid #E9CBB4' }}>
            <h2 className="text-lg mb-3" style={{ fontFamily: 'Georgia, serif', color: '#A6491F' }}>
              Signalement — contexte de l&apos;entretien
            </h2>
            <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
              Origine du signalement
            </label>
            <select
              value={donnees.signalement.origine}
              disabled={verrouillee}
              onChange={(e) => setDonnees((d) => ({ ...d, signalement: { ...d.signalement, origine: e.target.value } }))}
              className="w-full p-2 rounded border text-sm mb-3 disabled:opacity-70"
              style={{ borderColor: '#E9CBB4', background: '#FFFFFF', color: '#3A2E22' }}
            >
              {SOURCES_SIGNALEMENT.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            {donnees.signalement.origine === 'Structure' && (
              <input
                value={donnees.signalement.nomStructure}
                disabled={verrouillee}
                onChange={(e) => setDonnees((d) => ({ ...d, signalement: { ...d.signalement, nomStructure: e.target.value } }))}
                placeholder="Nom de la structure"
                className="w-full p-2 rounded border text-sm mb-3 disabled:opacity-70"
                style={{ borderColor: '#E9CBB4', background: '#FFFFFF', color: '#3A2E22' }}
              />
            )}
            {donnees.signalement.origine === 'Autre' && (
              <input
                value={donnees.signalement.origineAutre}
                disabled={verrouillee}
                onChange={(e) => setDonnees((d) => ({ ...d, signalement: { ...d.signalement, origineAutre: e.target.value } }))}
                placeholder="Préciser l'origine…"
                className="w-full p-2 rounded border text-sm mb-3 disabled:opacity-70"
                style={{ borderColor: '#E9CBB4', background: '#FFFFFF', color: '#3A2E22' }}
              />
            )}

            <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
              Motif / description du contexte
            </label>
            <textarea
              rows={2}
              value={donnees.signalement.motif}
              disabled={verrouillee}
              onChange={(e) => setDonnees((d) => ({ ...d, signalement: { ...d.signalement, motif: e.target.value } }))}
              placeholder="Décrire le contexte déclencheur…"
              className="w-full p-3 rounded border text-sm resize-none disabled:opacity-70"
              style={{ borderColor: '#E9CBB4', background: '#FFFFFF', color: '#3A2E22' }}
            />
          </div>
        )}

        <div className="mt-6 p-5 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E4DCC8' }}>
          <label className="block text-xs mb-2" style={{ color: '#8A7A5C' }}>
            Dimensions de l&apos;IGA touchées par cet entretien
          </label>
          <div className="flex flex-wrap gap-2">
            {dimensions.map((d) => {
              const active = donnees.dimensionsIds.includes(d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={verrouillee}
                  onClick={() => toggleDimension(d.id)}
                  className="text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-60"
                  style={{ borderColor: active ? '#C1652F' : '#DCD3BE', background: active ? '#C1652F' : 'transparent', color: active ? '#FFF8F0' : '#8A7A5C' }}
                >
                  {d.nom}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg" style={{ fontFamily: 'Georgia, serif', color: '#3A2E22' }}>
              Thématiques de vie abordées
            </h2>
            <span className="text-xs" style={{ color: '#A69B85' }}>
              {donnees.blocs.length} thématique{donnees.blocs.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-4">
            {donnees.blocs.map((b, idx) => (
              <div key={b.id} className="p-4 rounded-lg relative" style={{ background: '#FFFFFF', border: '1px solid #E4DCC8' }}>
                {!verrouillee && (
                  <button
                    type="button"
                    onClick={() => retirerBloc(b.id)}
                    className="absolute top-3 right-3 opacity-60 hover:opacity-100 print:hidden"
                    style={{ color: '#8A7A5C' }}
                    title="Retirer cette thématique"
                  >
                    <X size={16} />
                  </button>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: '#F4F1EA', color: '#8A7A5C' }}>
                    {idx + 1}
                  </span>
                  <select
                    value={b.thematique}
                    disabled={verrouillee}
                    onChange={(e) => majBloc(b.id, 'thematique', e.target.value)}
                    className="text-sm font-medium bg-transparent border-b outline-none flex-1 disabled:opacity-70"
                    style={{ borderColor: '#C1652F', color: '#A6491F' }}
                  >
                    {THEMATIQUES_PRESETS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {b.thematique === 'Autre' && (
                  <input
                    value={b.thematiqueAutre}
                    disabled={verrouillee}
                    onChange={(e) => majBloc(b.id, 'thematiqueAutre', e.target.value)}
                    placeholder="Nommer la thématique…"
                    className="w-full p-2 rounded border text-sm mb-3 disabled:opacity-70"
                    style={{ borderColor: '#E4DCC8', color: '#3A2E22' }}
                  />
                )}

                <div className="grid gap-2">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
                      Constat
                    </label>
                    <textarea
                      rows={2}
                      value={b.constat}
                      disabled={verrouillee}
                      onChange={(e) => majBloc(b.id, 'constat', e.target.value)}
                      placeholder="Ce qui a été observé ou évoqué…"
                      className="w-full p-2 rounded border text-sm resize-none disabled:opacity-70"
                      style={{ borderColor: '#E4DCC8', background: '#FBFAF6', color: '#3A2E22' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
                      Besoin identifié
                    </label>
                    <textarea
                      rows={2}
                      value={b.besoin}
                      disabled={verrouillee}
                      onChange={(e) => majBloc(b.id, 'besoin', e.target.value)}
                      placeholder="Ce dont le bénéficiaire a besoin sur ce point…"
                      className="w-full p-2 rounded border text-sm resize-none disabled:opacity-70"
                      style={{ borderColor: '#E4DCC8', background: '#FBFAF6', color: '#3A2E22' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
                      Action / orientation proposée
                    </label>
                    <textarea
                      rows={2}
                      value={b.action}
                      disabled={verrouillee}
                      onChange={(e) => majBloc(b.id, 'action', e.target.value)}
                      placeholder="Ce qui est mis en place, par qui, d'ici quand…"
                      className="w-full p-2 rounded border text-sm resize-none disabled:opacity-70"
                      style={{ borderColor: '#E4DCC8', background: '#FBFAF6', color: '#3A2E22' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!verrouillee && (
            <button
              type="button"
              onClick={ajouterBloc}
              className="mt-3 flex items-center gap-2 text-sm px-4 py-2 rounded-md border w-full justify-center print:hidden"
              style={{ borderColor: '#C1652F', color: '#A6491F', background: '#FBF0E9' }}
            >
              <Plus size={16} />
              Ajouter une thématique
            </button>
          )}
        </div>

        <div className="mt-6 p-5 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E4DCC8' }}>
          <h2 className="text-lg mb-4" style={{ fontFamily: 'Georgia, serif', color: '#3A2E22' }}>
            Synthèse de l&apos;entretien
          </h2>

          <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
            Synthèse générale (vue d&apos;ensemble, ce qui relie les thématiques entre elles)
          </label>
          <textarea
            rows={3}
            value={donnees.syntheseGenerale}
            disabled={verrouillee}
            onChange={(e) => setDonnees((d) => ({ ...d, syntheseGenerale: e.target.value }))}
            className="w-full p-3 rounded border text-sm resize-none mb-5 disabled:opacity-70"
            style={{ borderColor: '#E4DCC8', background: '#FBFAF6', color: '#3A2E22' }}
          />

          <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
            Recommandations du praticien
          </label>
          <textarea
            rows={2}
            value={donnees.recommandations}
            disabled={verrouillee}
            onChange={(e) => setDonnees((d) => ({ ...d, recommandations: e.target.value }))}
            className="w-full p-3 rounded border text-sm resize-none mb-5 disabled:opacity-70"
            style={{ borderColor: '#E4DCC8', background: '#FBFAF6', color: '#3A2E22' }}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
                Prochain rendez-vous
              </label>
              <input
                type="date"
                value={donnees.prochainRdv}
                disabled={verrouillee}
                onChange={(e) => setDonnees((d) => ({ ...d, prochainRdv: e.target.value }))}
                className="w-full p-2 rounded border text-sm disabled:opacity-70"
                style={{ borderColor: '#E4DCC8', color: '#3A2E22' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8A7A5C' }}>
                Statut de la fiche
              </label>
              <div
                className="w-full p-2 rounded border text-sm"
                style={{ borderColor: '#E4DCC8', color: '#3A2E22', background: '#FBFAF6' }}
              >
                {statut === 'brouillon' ? 'Brouillon' : 'Validé'}
              </div>
            </div>
          </div>
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
          Une fois validée, la fiche s&apos;ajoute à la timeline chronologique du bénéficiaire, au même titre qu&apos;une fiche spécialisée.
        </p>
      </div>
    </div>
  )
}
