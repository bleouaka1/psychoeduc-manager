import { Settings, MessageCircle } from 'lucide-react'
import { PageHeader, Panel } from '../../(dashboard)/_components/ui'
import { getSoloOrganisation } from '../_lib/getSoloOrg'
import { definirModeWhatsAppDefaut } from './actions'

export default async function ParametresPage() {
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  return (
    <>
      <PageHeader eyebrowIcon={Settings} eyebrowText="Mon espace Solo" title="Paramètres" subtitle="Réglages de communication et de compte." />

      <Panel title="Communication">
        <div className="flex items-center gap-2 mb-3 text-text-primary text-[13.5px] font-medium">
          <MessageCircle size={15} className="text-accent-gold" /> Mode WhatsApp par défaut
        </div>
        <p className="text-text-muted text-[13px] mb-4">
          Détermine le mode proposé par défaut au moment d'envoyer un message depuis une fiche bénéficiaire — modifiable à la volée à chaque envoi.
        </p>

        <form action={definirModeWhatsAppDefaut.bind(null, 'lien_simple')} className="flex flex-col gap-3">
          <label className="flex items-start gap-2.5 text-[13.5px] text-text-primary cursor-pointer">
            <input type="radio" name="mode" checked={organisation.mode_whatsapp_defaut === 'lien_simple'} readOnly className="mt-1" />
            <span>
              <span className="font-medium">Lien simple (wa.me)</span>
              <br />
              <span className="text-text-muted text-[12.5px]">Gratuit, aucune configuration. Ouvre WhatsApp avec le message pré-rempli. Aucun historique dans PsychoÉduc Manager.</span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 text-[13.5px] text-text-muted cursor-not-allowed opacity-60">
            <input type="radio" name="mode" disabled className="mt-1" />
            <span>
              <span className="font-medium">API WhatsApp Business</span>{' '}
              <span className="text-[11px] bg-bg-surface border border-border-soft px-2 py-0.5 rounded-full">Bientôt disponible</span>
              <br />
              <span className="text-[12.5px]">Historique et statut de livraison dans l'app. Nécessite un compte Meta Business vérifié et un abonnement BSP.</span>
            </span>
          </label>

          {organisation.mode_whatsapp_defaut !== 'lien_simple' && (
            <button type="submit" className="self-start text-[13px] font-semibold text-bg-base bg-accent-gold rounded-full px-4 py-2 mt-1">
              Utiliser le lien simple
            </button>
          )}
        </form>
      </Panel>
    </>
  )
}
