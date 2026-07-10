import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { resoudreDestinationConnexion } from '@/lib/comptes'

// '/' est la page d'accueil publique (vitrine) — avant l'ajout de la landing page,
// '/' était le Cockpit Fondateur et donc protégée ; ce dashboard vit maintenant à
// /dashboard (voir DECISIONS_LOG.md). Match exact pour '/' : un `startsWith('/')`
// rendrait TOUTES les routes publiques par accident.
const PUBLIC_EXACT_PATHS = ['/']
const PUBLIC_PREFIX_PATHS = ['/login', '/inscription', '/mesurer-iga']
// Un utilisateur déjà connecté n'a aucune raison de revoir un formulaire de connexion/inscription.
const AUTH_FORM_PATHS = ['/login', '/inscription']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT : ne jamais retirer ce getUser() — il rafraîchit le token de
  // session à chaque requête. Sans lui, les utilisateurs seraient déconnectés
  // de façon aléatoire.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublicPath = PUBLIC_EXACT_PATHS.includes(pathname) || PUBLIC_PREFIX_PATHS.some((p) => pathname.startsWith(p))

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && AUTH_FORM_PATHS.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = await resoudreDestinationConnexion(supabase)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
