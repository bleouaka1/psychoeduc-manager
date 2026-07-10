'use client'

import { useEffect } from 'react'

/** Anime l'apparition des blocs `.reveal` au scroll (IntersectionObserver), fidèle à
 * l'animation de la maquette d'origine. Composant client isolé pour que le reste de la
 * page d'accueil reste un Server Component. Aucune dépendance ajoutée : IntersectionObserver
 * est une API navigateur native, pas besoin de framer-motion/react-intersection-observer. */
export function LandingReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.landing-page .reveal')
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            io.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return null
}
