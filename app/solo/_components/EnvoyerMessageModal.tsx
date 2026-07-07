'use client'

import { useMemo, useState } from 'react'
import { MessageCircle, Mail } from 'lucide-react'
import { genererLienWhatsApp, genererLienMailto, type ContactMessagerie } from '@/lib/messagerieDirecte'

type Categorie = 'beneficiaire' | 'parent_tuteur' | 'formateur_responsable'

const CATEGORIE_LABEL: Record<Categorie, string> = {
  beneficiaire: 'Bénéficiaire',
  parent_tuteur: 'Parent / Tuteur',
  formateur_responsable: 'Formateur / Responsable',
}

/**
 * Modal "Envoyer un message" (spec messagerie directe, V1 = lien wa.me/mailto
 * uniquement — aucun envoi ni historique côté serveur, cf. SPEC-Messagerie-Beneficiaires.md §3-4).
 * `modeWhatsApp` vient du réglage Compte Solo (`organisations.mode_whatsapp_defaut`) ; seul
 * 'lien_simple' est implémenté en V1, la prop existe pour accueillir le mode API Business
 * plus tard sans réécrire ce composant.
 */
export function EnvoyerMessageModal({
  beneficiaire,
  parentsTuteurs,
  formateursResponsables,
  modeWhatsApp = 'lien_simple',
}: {
  beneficiaire: ContactMessagerie | null
  parentsTuteurs: ContactMessagerie[]
  formateursResponsables: ContactMessagerie[]
  modeWhatsApp?: string
}) {
  const [ouvert, setOuvert] = useState(false)
  const [categorie, setCategorie] = useState<Categorie>('beneficiaire')
  const [contactId, setContactId] = useState<string>('')
  const [message, setMessage] = useState('')

  const contactsParCategorie: Record<Categorie, ContactMessagerie[]> = {
    beneficiaire: beneficiaire ? [beneficiaire] : [],
    parent_tuteur: parentsTuteurs,
    formateur_responsable: formateursResponsables,
  }

  const contactsDisponibles = contactsParCategorie[categorie]
  const contact = useMemo(
    () => contactsDisponibles.find((c) => c.id === contactId) ?? contactsDisponibles[0] ?? null,
    [contactsDisponibles, contactId],
  )

  function ouvrir() {
    setOuvert(true)
    setCategorie('beneficiaire')
    setContactId('')
    setMessage('')
  }

  function changerCategorie(c: Categorie) {
    setCategorie(c)
    setContactId('')
  }

  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-bg-base bg-accent-gold rounded-full px-4 py-2"
      >
        <MessageCircle size={14} /> Envoyer un message
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-bg-card border border-border-soft rounded-2xl p-6 max-w-md w-full shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <h3 className="font-display text-lg text-text-primary mb-4">Envoyer un message</h3>

            <div className="flex flex-col gap-2 mb-4">
              {(Object.keys(CATEGORIE_LABEL) as Categorie[]).map((c) => (
                <label key={c} className="flex items-center gap-2 text-[13.5px] text-text-primary cursor-pointer">
                  <input
                    type="radio"
                    name="categorie"
                    checked={categorie === c}
                    onChange={() => changerCategorie(c)}
                    disabled={contactsParCategorie[c].length === 0}
                  />
                  {CATEGORIE_LABEL[c]}
                  {contactsParCategorie[c].length === 0 && <span className="text-text-muted text-[12px]">(aucun contact)</span>}
                </label>
              ))}
            </div>

            {contactsDisponibles.length > 1 && (
              <select
                value={contact?.id ?? ''}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary mb-4"
              >
                {contactsDisponibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            )}

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Votre message…"
              rows={4}
              className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim mb-4 resize-none"
            />

            <div className="flex justify-between items-center">
              <button type="button" onClick={() => setOuvert(false)} className="text-[13px] text-text-muted hover:text-text-primary px-3.5 py-2">
                Fermer
              </button>
              <div className="flex gap-2.5">
                {contact?.telephone && modeWhatsApp === 'lien_simple' ? (
                  <a
                    href={genererLienWhatsApp(contact.telephone, message)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[13px] font-semibold rounded-full px-4 py-2 text-bg-base bg-status-ok"
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Aucun contact WhatsApp/Email renseigné"
                    className="flex items-center gap-1.5 text-[13px] font-semibold rounded-full px-4 py-2 text-text-muted bg-bg-surface border border-border-soft cursor-not-allowed opacity-60"
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </button>
                )}
                {contact?.email ? (
                  <a
                    href={genererLienMailto(contact.email, `Message — ${contact.nom}`, message)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold rounded-full px-4 py-2 text-bg-base bg-accent-gold"
                  >
                    <Mail size={14} /> Email
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Aucun contact WhatsApp/Email renseigné"
                    className="flex items-center gap-1.5 text-[13px] font-semibold rounded-full px-4 py-2 text-text-muted bg-bg-surface border border-border-soft cursor-not-allowed opacity-60"
                  >
                    <Mail size={14} /> Email
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
