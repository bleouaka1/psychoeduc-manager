import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  // Supabase Auth applique un rate-limit sur les connexions par mot de passe : plusieurs
  // workers en parallèle déclenchent des échecs de login qui n'ont rien à voir avec l'app
  // (constaté avec la suite complète à 6 workers, 0 échec à 1 worker). Un seul worker évite ces faux négatifs.
  workers: 1,
  // Latence élevée observée ponctuellement sur ce projet Supabase distant partagé
  // (contention avec d'autres sessions/outillage) : le défaut Playwright de 5s sur
  // `expect(...).toBeVisible()` etc. produisait des faux négatifs répétés alors que
  // les actions réussissaient bien côté serveur (vérifié directement en base).
  expect: {
    timeout: 30_000,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
})
