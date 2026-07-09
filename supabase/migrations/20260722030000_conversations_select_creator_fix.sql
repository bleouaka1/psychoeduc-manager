-- Correctif : `INSERT ... RETURNING id` sur `conversations` échouait systématiquement
-- avec "new row violates row-level security policy", même avec une policy INSERT
-- permissive (with check(true)) — RETURNING exige implicitement que la ligne
-- satisfasse la policy SELECT de la table. Or au moment de l'INSERT, aucune ligne
-- `conversation_participants` n'existe encore pour le créateur (ajoutée dans une
-- étape séparée juste après) : `est_participant_conversation(id)` renvoie donc
-- systématiquement faux pour sa propre conversation fraîchement créée. Le créateur
-- doit toujours pouvoir voir sa propre conversation, participant ou non encore.
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select using (public.is_fondateur() or created_by = auth.uid() or public.est_participant_conversation(id));

-- Remettre la policy insert à sa définition prévue (le "with check(true)" du
-- diagnostic était temporaire).
drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert with check (auth.uid() is not null);
