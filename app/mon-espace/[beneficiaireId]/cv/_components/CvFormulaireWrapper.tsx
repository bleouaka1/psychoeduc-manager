'use client'

import { useState } from 'react'
import type { FormulaireCv } from '@/lib/cv'
import { fusionnerFormulaireCv } from '@/lib/cv'
import { PreremplirButton } from './PreremplirButton'
import { FormulaireCvForm } from './FormulaireCvForm'

export function CvFormulaireWrapper({
  formulaireInitial,
  peutPreremplir,
  preremplir,
  soumettre,
}: {
  formulaireInitial: FormulaireCv
  peutPreremplir: boolean
  preremplir: () => Promise<{ error: string | null; formulaire?: FormulaireCv }>
  soumettre: (formulaire: FormulaireCv) => Promise<{ error: string | null }>
}) {
  const [formulaire, setFormulaire] = useState(formulaireInitial)

  return (
    <div>
      {peutPreremplir && <PreremplirButton preremplir={preremplir} onPreremplir={(f) => setFormulaire((actuel) => fusionnerFormulaireCv(actuel, f))} />}
      <FormulaireCvForm formulaire={formulaire} onChange={setFormulaire} soumettre={soumettre} />
    </div>
  )
}
