-- Étape 18 (light) — Dashboard minimal (architecture v5)
-- Vue de synthèse réutilisant le nom prévu par la section 25 de l'architecture,
-- volontairement minimale ce soir. L'Étape 23 l'enrichira plus tard (CREATE OR
-- REPLACE VIEW, additif, jamais de renommage). security_invoker : respecte le
-- RLS de qui l'interroge, jamais un contournement.
create or replace view public.vue_dashboard_fondateur
with (security_invoker = true) as
select
  (select count(*) from public.organisations) as total_organisations,
  (select count(*) from public.beneficiaires) as total_beneficiaires,
  (select count(*) from public.evaluations_iga) as total_evaluations_iga,
  (select round(avg(score_global), 1) from public.evaluations_iga where score_global is not null) as score_iga_moyen,
  (select count(*) from public.licences where statut = 'actif') as licences_actives,
  (select count(*) from public.essais_gratuits where converti = false and date_fin >= current_date) as essais_gratuits_en_cours;
