-- Messagerie directe WhatsApp/Email (PLAN_MESSAGERIE_BENEFICIAIRES.md, tâche T1).
-- V1 = lien wa.me/mailto uniquement (spec §3, mode A). `api_business` accepté en base
-- pour ne pas re-migrer plus tard, mais refusé côté applicatif tant que ce mode n'est
-- pas implémenté (cf. lib/messagerieDirecte.ts). Migration additive uniquement.
alter table public.organisations
  add column if not exists mode_whatsapp_defaut text not null default 'lien_simple'
  check (mode_whatsapp_defaut in ('lien_simple', 'api_business'));
