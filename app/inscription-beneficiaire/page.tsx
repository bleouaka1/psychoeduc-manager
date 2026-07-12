import { createClient } from '@/lib/supabase/server'
import { InscriptionBeneficiaireForm } from './InscriptionBeneficiaireForm'

export default async function InscriptionBeneficiairePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  const supabase = await createClient()

  const invitations = token ? (await supabase.rpc('consulter_invitation_beneficiaire', { p_token: token })).data : null
  const invitation = (invitations as any)?.[0] as { email: string; prenom: string | null; valide: boolean } | undefined

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg-base relative overflow-hidden py-10">
      <div className="ambient-halo" />
      {!token || !invitation || !invitation.valide ? (
        <div className="relative z-[1] w-[400px] bg-bg-card border border-border-soft rounded-2xl p-8 text-center">
          <h1 className="font-display text-text-primary text-[20px] mb-2">Lien invalide ou expiré</h1>
          <p className="text-text-muted text-sm">
            Ce lien d'invitation n'est plus valable. Demandez à votre formateur/éducateur référent de vous en générer un nouveau depuis votre dossier.
          </p>
        </div>
      ) : (
        <InscriptionBeneficiaireForm token={token} email={invitation.email} prenom={invitation.prenom} />
      )}
    </main>
  )
}
