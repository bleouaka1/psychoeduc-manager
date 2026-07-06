'use client'

import { Printer } from 'lucide-react'

/** Export PDF = impression navigateur ("Enregistrer au format PDF") : aucune librairie
 * PDF n'est ajoutée au projet pour ce seul besoin, le navigateur sait déjà le faire. */
export function BoutonImprimer() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden flex items-center gap-1.5 bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2.5 rounded-full"
    >
      <Printer size={14} /> Imprimer / Exporter en PDF
    </button>
  )
}
