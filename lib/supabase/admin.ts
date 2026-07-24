import { createClient } from '@supabase/supabase-js'

/**
 * Client Supabase avec la clé service_role — contourne RLS entièrement, à n'utiliser QUE
 * pour des opérations d'administration explicitement contrôlées côté serveur (ici : générer
 * un lien de connexion pour le mode Impersonation du Fondateur, `app/(dashboard)/apercu/`).
 * Jamais importé côté client, jamais exposé via NEXT_PUBLIC_*. Chaque appelant DOIT revérifier
 * is_fondateur() avant d'utiliser ce client — il n'y a plus aucun garde-fou RLS une fois ici.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY manquante dans .env.local — nécessaire pour le mode Impersonation (voir app/(dashboard)/apercu). ' +
        'Récupérable dans Supabase Dashboard > Project Settings > API > service_role. Ne jamais commiter cette clé.',
    )
  }
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}
