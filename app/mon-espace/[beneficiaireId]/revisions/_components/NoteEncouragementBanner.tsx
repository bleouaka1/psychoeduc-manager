'use client'

import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'

/** Mot de reconnaissance du formateur (§9, v3) : texte libre, affiché une seule fois
 * puis marqué vu — jamais une notification récurrente ou culpabilisante. */
export function NoteEncouragementBanner({ message, onVue }: { message: string; onVue: () => Promise<void> }) {
  const [visible, setVisible] = useState(true)
  if (!visible) return null

  return (
    <div className="bg-accent-gold/10 border border-accent-gold-dim/50 rounded-xl p-4 mb-6 flex items-start gap-3">
      <Sparkles size={16} className="text-accent-gold shrink-0 mt-0.5" />
      <p className="text-text-primary text-[13.5px] flex-1">{message}</p>
      <button
        type="button"
        onClick={() => {
          setVisible(false)
          onVue()
        }}
        className="text-text-muted hover:text-text-primary shrink-0"
        aria-label="Fermer"
      >
        <X size={15} />
      </button>
    </div>
  )
}
