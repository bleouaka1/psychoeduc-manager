import { Eye } from 'lucide-react'
import { quitterApercuAction } from '../apercu/actions'

export function ApercuBanner({ organisation }: { organisation: { nom: string; type_organisation: string } }) {
  return (
    <div className="print:hidden flex items-center justify-between gap-3 bg-gradient-to-r from-accent-gold/20 to-transparent border border-accent-gold/40 rounded-xl px-4 py-2.5 mb-6 text-[13px]">
      <span className="flex items-center gap-2 text-text-primary">
        <Eye size={15} className="text-accent-gold" />
        Mode Aperçu — vous consultez <strong>{organisation.nom}</strong> en tant que Fondateur, données réelles.
      </span>
      <form action={quitterApercuAction}>
        <button type="submit" className="text-accent-gold hover:underline font-medium whitespace-nowrap">
          Quitter l'aperçu
        </button>
      </form>
    </div>
  )
}
