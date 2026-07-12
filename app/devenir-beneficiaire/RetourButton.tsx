'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export function RetourButton() {
  const router = useRouter()
  return (
    <button type="button" onClick={() => router.back()} className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-[13px] mb-6">
      <ArrowLeft size={14} /> Retour
    </button>
  )
}
