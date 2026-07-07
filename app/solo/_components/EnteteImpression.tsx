// En-tête d'impression/export PDF (spec §3) : Compte Solo = marque PsychoÉduc Manager seule ;
// Compte Structure = co-branding avec le nom (+ logo si renseigné) de l'organisation, jamais
// l'un à la place de l'autre. Visible uniquement à l'impression (`print:flex`), jamais à l'écran
// (le PageHeader de la page reste l'en-tête visible côté application).
export function EnteteImpression({ organisation }: { organisation: { nom: string; type_organisation: string; logo_url?: string | null } }) {
  const estStructure = organisation.type_organisation !== 'solo'

  return (
    <div className="hidden print:flex items-center justify-between border-b border-border-soft pb-3 mb-6">
      <span className="font-display font-semibold text-lg text-text-primary">PsychoÉduc Manager</span>
      {estStructure && (
        <div className="flex items-center gap-2">
          {organisation.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={organisation.logo_url} alt="" className="h-8 w-8 rounded object-cover" />
          )}
          <span className="text-text-primary text-sm font-medium">{organisation.nom}</span>
        </div>
      )}
    </div>
  )
}
