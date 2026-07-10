import { Suspense } from 'react'
import { InscriptionForm } from './InscriptionForm'

export default function InscriptionPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-bg-base relative overflow-hidden py-10">
      <div className="ambient-halo" />
      <Suspense fallback={null}>
        <InscriptionForm />
      </Suspense>
    </main>
  )
}
