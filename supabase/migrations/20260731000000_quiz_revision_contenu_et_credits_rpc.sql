-- Module "Quiz de révision" — T1 (suite) : champ texte source + RPC de gestion des
-- crédits (T6, schéma). Aucun appel de paiement réel ici — uniquement les fonctions
-- SECURITY DEFINER qui seront invoquées par le webhook (à câbler quand un prestataire
-- sera disponible) et par l'endpoint de génération payante (T7).

-- ============================================================================
-- Texte source pour la génération — écart documenté : aucun parsing PDF/DOCX
-- serveur n'existe dans ce projet (vérifié, aucune dépendance de ce type). En
-- attendant l'ajout d'une dépendance dédiée (pdf-parse/mammoth), le texte est
-- collé/déjà extrait au moment du dépôt plutôt que parsé côté serveur.
-- ============================================================================
alter table public.documents_beneficiaires
  add column if not exists contenu_texte text;

-- ============================================================================
-- Crédit du solde après confirmation d'un paiement (jamais avant). SECURITY DEFINER
-- car credits_revision/credits_transactions n'ont aucune policy d'écriture directe
-- pour authenticated (même principe que log_audit()/audit_logs, Étape 1).
-- **Jamais accordée à `authenticated`** : la confirmation de paiement doit provenir
-- exclusivement du webhook serveur (clé service_role, qui bypass RLS/grants de toute
-- façon), jamais d'un client authentifié — sinon n'importe quel utilisateur pourrait
-- s'auto-confirmer des crédits sans avoir payé. REVOKE explicite de PUBLIC (accordé
-- par défaut aux fonctions SECURITY DEFINER sinon).
-- ============================================================================
create or replace function public.confirmer_transaction_credits(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction record;
begin
  select * into v_transaction from public.credits_transactions where id = p_transaction_id and statut = 'en_attente';
  if not found then
    raise exception 'Transaction introuvable ou déjà traitée';
  end if;

  update public.credits_transactions set statut = 'confirme' where id = p_transaction_id;

  insert into public.credits_revision (beneficiaire_id, solde)
    values (v_transaction.beneficiaire_id, v_transaction.montant_credits)
    on conflict (beneficiaire_id) do update
      set solde = public.credits_revision.solde + v_transaction.montant_credits, updated_at = now();
end;
$$;

revoke execute on function public.confirmer_transaction_credits(uuid) from public;

-- ============================================================================
-- Débit d'un crédit pour une génération payante — refuse si solde insuffisant,
-- jamais de solde négatif. Appelée par l'endpoint de génération (T7) uniquement
-- après succès de l'appel IA (jamais avant, cf. garde-fou du document §5.2).
-- **Vérification d'autorisation interne obligatoire** : SECURITY DEFINER + accordée à
-- `authenticated` sans ce contrôle permettrait à n'importe quel utilisateur connecté
-- de débiter le solde d'un bénéficiaire arbitraire (les RPC Supabase sont appelables
-- directement par tout client authentifié, pas seulement depuis le code serveur).
-- Seul le bénéficiaire propriétaire ou un membre habilité de son organisation peut
-- déclencher son propre débit.
-- ============================================================================
create or replace function public.debiter_credit_revision(p_beneficiaire_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solde int;
  v_autorise boolean;
begin
  select exists (
    select 1 from public.beneficiaires b
    where b.id = p_beneficiaire_id
      and (b.profile_id = auth.uid() or public.is_fondateur() or public.peut_modifier('credits_revision', b.organisation_id))
  ) into v_autorise;
  if not v_autorise then
    raise exception 'Non autorisé à débiter ce compte de crédits';
  end if;

  select solde into v_solde from public.credits_revision where beneficiaire_id = p_beneficiaire_id for update;
  if v_solde is null or v_solde < 1 then
    return false;
  end if;
  update public.credits_revision set solde = solde - 1, updated_at = now() where beneficiaire_id = p_beneficiaire_id;
  return true;
end;
$$;

grant execute on function public.debiter_credit_revision(uuid) to authenticated;
