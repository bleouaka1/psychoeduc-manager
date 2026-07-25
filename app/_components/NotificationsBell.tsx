'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Notification = {
  id: string
  titre: string | null
  contenu: string | null
  type_notification: string | null
  est_lue: boolean
  created_at: string
}

/**
 * Centre de notifications unique (nouvelle inscription, paiement reçu, avis laissé,
 * rappel de séance…) : un seul point d'entrée plutôt que des alertes éparpillées.
 * Réutilise la table `notifications` déjà en place (Étape 20), alimentée par les
 * triggers ajoutés dans la migration Compte Solo — aucune nouvelle table ici.
 */
export function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [ouvert, setOuvert] = useState(false)
  const supabase = createClient()

  async function charger() {
    const { data } = await supabase.from('notifications').select('id, titre, contenu, type_notification, est_lue, created_at').order('created_at', { ascending: false }).limit(20)
    setNotifications(data ?? [])
  }

  useEffect(() => {
    charger()
  }, [])

  const nonLues = notifications.filter((n) => !n.est_lue).length

  async function toutMarquerLu() {
    const idsNonLus = notifications.filter((n) => !n.est_lue).map((n) => n.id)
    if (idsNonLus.length === 0) return
    await supabase.from('notifications').update({ est_lue: true }).in('id', idsNonLus)
    setNotifications((prev) => prev.map((n) => ({ ...n, est_lue: true })))
  }

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        className="relative w-9 h-9 rounded-[10px] bg-bg-card border border-border-soft flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {nonLues > 0 && (
          <span className="absolute -top-1 -right-1 bg-danger text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {nonLues > 9 ? '9+' : nonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-bg-card border border-border-soft rounded-2xl shadow-lg z-50 p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-text-primary text-[13px] font-medium">Notifications</p>
            {nonLues > 0 && (
              <button type="button" onClick={toutMarquerLu} className="text-[11px] text-accent-gold">
                Tout marquer comme lu
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-text-muted text-xs text-center py-6">Aucune notification pour le moment.</p>
          ) : (
            <ul className="space-y-1.5">
              {notifications.map((n) => (
                <li key={n.id} className={`rounded-xl px-3 py-2 text-xs ${n.est_lue ? 'bg-transparent' : 'bg-bg-surface'}`}>
                  <p className="text-text-primary font-medium">{n.titre}</p>
                  <p className="text-text-muted mt-0.5">{n.contenu}</p>
                  <p className="text-text-muted/70 text-[10px] mt-1">{formatter.format(new Date(n.created_at))}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
