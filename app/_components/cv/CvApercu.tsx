import { BoutonImprimer } from '@/app/solo/_components/BoutonImprimer'
import type { ContenuCv } from '@/lib/cv'

/** Rendu imprimable d'un CV généré — composant partagé (app/_components) pour que
 * Solo/Structure/Employeur puissent le réutiliser une fois leur flux câblé (§2.2, §4).
 * Export = impression navigateur, jamais un fichier PDF stocké (cf. BoutonImprimer.tsx). */
export function CvApercu({ contenu, sousTitre }: { contenu: ContenuCv; sousTitre: string }) {
  return (
    <div className="bg-bg-card border border-border-soft rounded-[10px] p-8">
      <div className="print:hidden flex justify-end mb-4">
        <BoutonImprimer />
      </div>
      <p className="font-data text-[11px] tracking-[0.15em] text-accent-gold uppercase mb-2">{sousTitre}</p>
      <h2 className="font-cinzel font-semibold text-2xl text-text-primary mb-5">{contenu.titreDocument}</h2>

      <p className="text-text-primary text-[14px] leading-relaxed mb-6">{contenu.resume}</p>

      {contenu.competencesCles.length > 0 && (
        <div className="mb-6">
          <h3 className="font-cinzel text-[13px] text-text-primary uppercase tracking-wide mb-2">Compétences clés</h3>
          <div className="flex flex-wrap gap-1.5">
            {contenu.competencesCles.map((c) => (
              <span key={c} className="text-[12px] text-accent-gold border border-accent-gold-dim/40 rounded-full px-2.5 py-1">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {contenu.experiencesFormations.length > 0 && (
        <div className="mb-6">
          <h3 className="font-cinzel text-[13px] text-text-primary uppercase tracking-wide mb-2">Formations</h3>
          <ul className="space-y-3">
            {contenu.experiencesFormations.map((e, i) => (
              <li key={i}>
                <p className="text-text-primary text-[13.5px] font-medium">{e.titre}</p>
                <p className="text-text-muted text-[12.5px]">{e.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {contenu.qualitesSavoirEtre.length > 0 && (
        <div className="mb-6">
          <h3 className="font-cinzel text-[13px] text-text-primary uppercase tracking-wide mb-2">Savoir-être</h3>
          <div className="flex flex-wrap gap-1.5">
            {contenu.qualitesSavoirEtre.map((q) => (
              <span key={q} className="text-[12px] text-sage border border-sage/35 rounded-full px-2.5 py-1">
                {q}
              </span>
            ))}
          </div>
        </div>
      )}

      {contenu.objectifProfessionnel && (
        <div>
          <h3 className="font-cinzel text-[13px] text-text-primary uppercase tracking-wide mb-2">Objectif professionnel</h3>
          <p className="text-text-muted text-[13.5px]">{contenu.objectifProfessionnel}</p>
        </div>
      )}
    </div>
  )
}
