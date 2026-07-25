import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { chargerPreferences } from '@/lib/preferencesUtilisateur'
import { ThemePicker } from './_components/ThemePicker'
import { PreferencesToggles } from './_components/PreferencesToggles'
import { mettreAJourPreferences } from './actions'

export default async function ParametresPage({ params }: { params: Promise<{ beneficiaireId: string }> }) {
  const { beneficiaireId } = await params
  const supabase = await createClient()

  const dossiers = await chargerDossiersBeneficiaire(supabase)
  const dossier = dossiers.find((d) => d.id === beneficiaireId)
  if (!dossier) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const preferences = user ? await chargerPreferences(supabase, user.id) : { themeId: 'sombre_dore' as const, modeAccessibilite: false, modeInteraction: 'mixte' as const }

  const mettreAJour = mettreAJourPreferences.bind(null, beneficiaireId)

  return (
    <div>
      <p className="font-data text-[11px] tracking-[0.15em] text-accent-gold uppercase mb-2.5">Mon espace</p>
      <h1 className="font-cinzel font-semibold text-3xl text-text-primary mb-1">Paramètres · Apparence</h1>
      <p className="text-text-muted text-sm mb-7">Choisis ta palette et adapte l’interface à ce qui te convient le mieux.</p>

      <p className="font-data text-[11px] tracking-[0.18em] text-text-muted uppercase mb-3.5">Choisis ta palette</p>
      <ThemePicker themeActuel={preferences.themeId} mettreAJour={mettreAJour} />

      <p className="font-data text-[11px] tracking-[0.18em] text-text-muted uppercase mt-10 mb-3.5">Accessibilité et interaction</p>
      <div className="bg-bg-card border border-border-soft rounded-[10px] p-6">
        <PreferencesToggles modeAccessibiliteActuel={preferences.modeAccessibilite} modeInteractionActuel={preferences.modeInteraction} mettreAJour={mettreAJour} />
      </div>
    </div>
  )
}
