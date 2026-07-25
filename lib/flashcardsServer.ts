import type { SupabaseClient } from '@supabase/supabase-js'

export type FlashcardAffichee = { id: string; recto: string; verso: string; mnemotechnique: string | null }

export async function chargerFlashcardsParDocument(supabase: SupabaseClient, documentId: string): Promise<FlashcardAffichee[]> {
  const { data } = await supabase
    .from('flashcards_revision')
    .select('id, recto, verso, mnemotechnique')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true })

  return (data ?? []).map((f: any) => ({ id: f.id, recto: f.recto, verso: f.verso, mnemotechnique: f.mnemotechnique }))
}
