import { createClient } from '@/lib/supabase/server'
import { InvitationForm } from './InvitationForm'
import { AccepterInvitationBouton } from './AccepterInvitationBouton'

const ROLE_LABEL: Record<string, string> = {
  directeur: 'Directeur',
  coordinateur: 'Coordinateur',
  educateur: 'Éducateur',
  formateur: 'Formateur',
  promoteur: 'Promoteur',
  parent: 'Parent',
  tuteur: 'Tuteur',
}

export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  const supabase = await createClient()

  const invitations = token ? (await supabase.rpc('consulter_invitation', { p_token: token })).data : null
  const invitation = (invitations as any)?.[0] as
    | { email: string; role_propose: string; organisation_nom: string; beneficiaire_nom: string | null; valide: boolean }
    | undefined

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg-base relative overflow-hidden py-10">
      <div className="ambient-halo" />
      {!token || !invitation || !invitation.valide ? (
        <div className="relative z-[1] w-[400px] bg-bg-card border border-border-soft rounded-2xl p-8 text-center">
          <h1 className="font-display text-text-primary text-[20px] mb-2">Lien invalide ou expiré</h1>
          <p className="text-text-muted text-sm">Demandez à la personne qui vous a invité(e) de générer un nouveau lien.</p>
        </div>
      ) : user ? (
        <div className="relative z-[1] w-[400px] bg-bg-card border border-border-soft rounded-2xl p-8 text-center">
          <h1 className="font-display text-text-primary text-[20px] mb-2">Rejoindre {invitation.organisation_nom}</h1>
          <p className="text-text-muted text-sm mb-6">
            Vous êtes connecté(e) — accepter cette invitation vous donnera accès en tant que{' '}
            {ROLE_LABEL[invitation.role_propose] ?? invitation.role_propose}
            {invitation.beneficiaire_nom ? ` de ${invitation.beneficiaire_nom}` : ''}.
          </p>
          <AccepterInvitationBouton token={token} />
        </div>
      ) : (
        <InvitationForm
          token={token}
          email={invitation.email}
          role_propose={invitation.role_propose}
          organisation_nom={invitation.organisation_nom}
          beneficiaire_nom={invitation.beneficiaire_nom}
        />
      )}
    </main>
  )
}
