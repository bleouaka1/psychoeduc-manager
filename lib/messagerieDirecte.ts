export type ContactMessagerie = {
  id: string
  nom: string
  telephone: string | null
  email: string | null
}

/** Ne garde que les chiffres et le préfixe `+` — un numéro saisi avec espaces/tirets/
 * parenthèses reste utilisable pour wa.me, qui n'accepte qu'un format international brut. */
function nettoyerTelephone(telephone: string): string {
  return telephone.replace(/[^\d+]/g, '')
}

export function genererLienWhatsApp(telephone: string, message: string): string {
  const numero = nettoyerTelephone(telephone)
  return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`
}

export function genererLienMailto(email: string, sujet: string, corps: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`
}
