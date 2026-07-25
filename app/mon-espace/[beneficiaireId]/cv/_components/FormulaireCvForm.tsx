'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { FormulaireCv, ExperienceCv, FormationCv } from '@/lib/cv'

function ChampListe({ valeurs, onChange, placeholder }: { valeurs: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [texte, setTexte] = useState('')

  function ajouter() {
    const v = texte.trim()
    if (!v) return
    onChange([...valeurs, v])
    setTexte('')
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ajouter()
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-bg-surface border border-border-soft rounded-lg px-3 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent-gold-dim"
        />
        <button type="button" onClick={ajouter} className="w-8 h-8 rounded-lg bg-bg-surface border border-border-soft flex items-center justify-center text-text-muted hover:text-accent-gold shrink-0">
          <Plus size={14} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {valeurs.map((v, i) => (
          <span key={i} className="text-[11.5px] text-text-primary bg-bg-surface border border-border-soft rounded-full pl-2.5 pr-1.5 py-1 flex items-center gap-1.5">
            {v}
            <button type="button" onClick={() => onChange(valeurs.filter((_, j) => j !== i))} className="text-text-muted hover:text-danger">
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Formulaire de CV par sections — standard et autonome (§2.2, révision) : fonctionne
 * pleinement sans jamais dépendre de l'ICC/IGA. Contrôlé par le parent (`formulaire`/
 * `onChange`) plutôt qu'un état interne — nécessaire pour que le pré-remplissage
 * optionnel puisse FUSIONNER dans la saisie déjà en cours sans jamais l'écraser
 * (bug réel trouvé en testant : un remount sur état interne effaçait la saisie
 * manuelle déjà commencée au moment du clic sur "Pré-remplir depuis mon profil").
 */
export function FormulaireCvForm({
  formulaire,
  onChange,
  soumettre,
}: {
  formulaire: FormulaireCv
  onChange: (f: FormulaireCv) => void
  soumettre: (formulaire: FormulaireCv) => Promise<{ error: string | null }>
}) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState(false)

  function ajouterExperience() {
    onChange({ ...formulaire, experiences: [...formulaire.experiences, { titre: '', structure: '', periode: '', description: '' }] })
  }
  function modifierExperience(i: number, champ: keyof ExperienceCv, valeur: string) {
    onChange({ ...formulaire, experiences: formulaire.experiences.map((e, j) => (j === i ? { ...e, [champ]: valeur } : e)) })
  }
  function retirerExperience(i: number) {
    onChange({ ...formulaire, experiences: formulaire.experiences.filter((_, j) => j !== i) })
  }

  function ajouterFormation() {
    onChange({ ...formulaire, formations: [...formulaire.formations, { titre: '', etablissement: '', periode: '' }] })
  }
  function modifierFormation(i: number, champ: keyof FormationCv, valeur: string) {
    onChange({ ...formulaire, formations: formulaire.formations.map((fo, j) => (j === i ? { ...fo, [champ]: valeur } : fo)) })
  }
  function retirerFormation(i: number) {
    onChange({ ...formulaire, formations: formulaire.formations.filter((_, j) => j !== i) })
  }

  async function envoyer() {
    setEnCours(true)
    setErreur(null)
    const res = await soumettre(formulaire)
    setEnCours(false)
    if (res.error) {
      setErreur(res.error)
      return
    }
    setSucces(true)
  }

  if (succes) {
    return <p className="text-status-ok text-[13.5px]">Demande créée — en attente de confirmation du paiement.</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-cinzel text-[14px] text-text-primary mb-3">Identité</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input
            value={formulaire.prenoms}
            onChange={(e) => onChange({ ...formulaire, prenoms: e.target.value })}
            placeholder="Prénoms"
            className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent-gold-dim"
          />
          <input
            value={formulaire.nom}
            onChange={(e) => onChange({ ...formulaire, nom: e.target.value })}
            placeholder="Nom"
            className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent-gold-dim"
          />
          <input
            value={formulaire.email}
            onChange={(e) => onChange({ ...formulaire, email: e.target.value })}
            placeholder="Email (optionnel)"
            className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent-gold-dim"
          />
          <input
            value={formulaire.telephone}
            onChange={(e) => onChange({ ...formulaire, telephone: e.target.value })}
            placeholder="Téléphone (optionnel)"
            className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent-gold-dim"
          />
          <input
            value={formulaire.ville}
            onChange={(e) => onChange({ ...formulaire, ville: e.target.value })}
            placeholder="Ville (optionnel)"
            className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent-gold-dim sm:col-span-2"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel text-[14px] text-text-primary">Expériences</h3>
          <button type="button" onClick={ajouterExperience} className="text-[12px] text-accent-gold flex items-center gap-1">
            <Plus size={13} /> Ajouter
          </button>
        </div>
        <div className="space-y-3">
          {formulaire.experiences.map((exp, i) => (
            <div key={i} className="bg-bg-surface border border-border-soft rounded-xl p-3.5 relative">
              <button type="button" onClick={() => retirerExperience(i)} className="absolute top-2.5 right-2.5 text-text-muted hover:text-danger">
                <X size={14} />
              </button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 pr-6">
                <input
                  value={exp.titre}
                  onChange={(e) => modifierExperience(i, 'titre', e.target.value)}
                  placeholder="Titre du poste"
                  className="bg-bg-card border border-border-soft rounded-lg px-2.5 py-1.5 text-[12.5px] text-text-primary outline-none"
                />
                <input
                  value={exp.structure}
                  onChange={(e) => modifierExperience(i, 'structure', e.target.value)}
                  placeholder="Structure"
                  className="bg-bg-card border border-border-soft rounded-lg px-2.5 py-1.5 text-[12.5px] text-text-primary outline-none"
                />
                <input
                  value={exp.periode}
                  onChange={(e) => modifierExperience(i, 'periode', e.target.value)}
                  placeholder="Période (ex. 2023-2024)"
                  className="bg-bg-card border border-border-soft rounded-lg px-2.5 py-1.5 text-[12.5px] text-text-primary outline-none sm:col-span-2"
                />
              </div>
              <textarea
                value={exp.description}
                onChange={(e) => modifierExperience(i, 'description', e.target.value)}
                placeholder="Description des missions"
                rows={2}
                className="w-full bg-bg-card border border-border-soft rounded-lg px-2.5 py-1.5 text-[12.5px] text-text-primary outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel text-[14px] text-text-primary">Formations</h3>
          <button type="button" onClick={ajouterFormation} className="text-[12px] text-accent-gold flex items-center gap-1">
            <Plus size={13} /> Ajouter
          </button>
        </div>
        <div className="space-y-3">
          {formulaire.formations.map((fo, i) => (
            <div key={i} className="bg-bg-surface border border-border-soft rounded-xl p-3.5 relative grid grid-cols-1 sm:grid-cols-3 gap-2 pr-6">
              <button type="button" onClick={() => retirerFormation(i)} className="absolute top-2.5 right-2.5 text-text-muted hover:text-danger">
                <X size={14} />
              </button>
              <input
                value={fo.titre}
                onChange={(e) => modifierFormation(i, 'titre', e.target.value)}
                placeholder="Intitulé"
                className="bg-bg-card border border-border-soft rounded-lg px-2.5 py-1.5 text-[12.5px] text-text-primary outline-none"
              />
              <input
                value={fo.etablissement}
                onChange={(e) => modifierFormation(i, 'etablissement', e.target.value)}
                placeholder="Établissement"
                className="bg-bg-card border border-border-soft rounded-lg px-2.5 py-1.5 text-[12.5px] text-text-primary outline-none"
              />
              <input
                value={fo.periode}
                onChange={(e) => modifierFormation(i, 'periode', e.target.value)}
                placeholder="Période"
                className="bg-bg-card border border-border-soft rounded-lg px-2.5 py-1.5 text-[12.5px] text-text-primary outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-cinzel text-[14px] text-text-primary mb-2">Compétences</h3>
        <ChampListe valeurs={formulaire.competences} onChange={(v) => onChange({ ...formulaire, competences: v })} placeholder="Ajouter une compétence" />
      </div>

      <div>
        <h3 className="font-cinzel text-[14px] text-text-primary mb-2">Langues</h3>
        <ChampListe valeurs={formulaire.langues} onChange={(v) => onChange({ ...formulaire, langues: v })} placeholder="Ajouter une langue" />
      </div>

      <div>
        <h3 className="font-cinzel text-[14px] text-text-primary mb-2">Centres d’intérêt</h3>
        <ChampListe valeurs={formulaire.centresInteret} onChange={(v) => onChange({ ...formulaire, centresInteret: v })} placeholder="Ajouter un centre d’intérêt" />
      </div>

      {erreur && <p className="text-danger text-[13px]">{erreur}</p>}

      <button type="button" disabled={enCours} onClick={envoyer} className="text-[13px] font-semibold text-bg-base bg-accent-gold rounded-full px-5 py-2.5 disabled:opacity-50">
        {enCours ? 'Envoi…' : 'Générer mon CV'}
      </button>
    </div>
  )
}
