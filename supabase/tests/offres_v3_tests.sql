-- Look360 : tests des offres v3 (à coller dans Supabase, SQL Editor, puis Run).
--
-- AUCUNE donnée réelle n'est modifiée : le script crée un utilisateur fictif,
-- joue chaque scénario puis ANNULE tout (rollback). Seul un tableau de
-- résultats temporaire (effacé à la fermeture de la session) est affiché.
-- Les vérifications « API directe » se font sous le rôle `authenticated`
-- avec le jeton de l'utilisateur fictif : exactement ce que fait un appel
-- direct à l'API Supabase depuis un navigateur ou un script.

create temp table if not exists rapport (
  n serial, bloc text, test text, attendu text, obtenu text, resultat text
);
truncate rapport;

do $$
declare
  res jsonb := '[]';
  p public.plan_limits;
  u uuid;
  s timestamptz;
  got text;
  i int;
  k int;
  total_feed int;
  total_shops int;
  b jsonb;
  ref text;
begin
  select count(*) into total_feed from public.feed_ads;
  select count(*) into total_shops from public.shops;

  -- A. Chaque offre
  for p in select * from public.plan_limits order by monthly_searches loop
    begin
      -- Utilisateur fictif, e-mail vérifié (le trigger crée profil + abonnement gratuit)
      u := gen_random_uuid();
      insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                              email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'test-offres-' || u || '@look360.test', '', now(),
              '{"provider":"email"}', '{"nom":"Test offres"}', now(), now());
      if p.plan <> 'free' then
        update public.subscriptions set plan = p.plan, status = 'active',
          current_period_start = now() - interval '1 day', current_period_end = now() + interval '29 days'
        where user_id = u;
      end if;

      -- Catalogue : policies 0040 activées le temps du test (annulées ensuite)
      drop policy if exists feed_ads_read on public.feed_ads;
      create policy feed_ads_read on public.feed_ads for select to authenticated using ((select public.my_plan()) <> 'free');
      drop policy if exists shops_read on public.shops;
      create policy shops_read on public.shops for select to authenticated using ((select public.my_plan()) <> 'free');

      -- 1. Recherches : compteur juste sous le plafond, puis 2 recherches
      s := (public.usage_period(u)).p_start;
      insert into public.subscription_usage (user_id, period_start, period_end, searches_used, market_search_units_used)
        values (u, s, s + interval '1 month', p.monthly_searches - 1, p.monthly_searches - 1);
      begin perform public.reserve_usage(u, 1, 1); got := 'autorisée';
      exception when others then got := 'bloquée (' || sqlerrm || ')'; end;
      res := res || jsonb_build_object('bloc', p.plan, 'test', 'Recherche n°' || p.monthly_searches || ' (dernière autorisée)', 'attendu', 'autorisée', 'obtenu', got);
      begin perform public.reserve_usage(u, 1, 1); got := 'autorisée';
      exception when others then got := 'bloquée (' || sqlerrm || ')'; end;
      res := res || jsonb_build_object('bloc', p.plan, 'test', 'Recherche n°' || (p.monthly_searches + 1) || ' (au-delà du plafond)', 'attendu', 'bloquée', 'obtenu', got);

      -- Passage sous l'identité de l'utilisateur (= appel API direct)
      perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      set local role authenticated;

      -- 1b. Contournement : appeler soi-même la fonction de quota ou remettre son compteur à zéro
      begin perform public.release_usage(u, 1000, 1000); got := 'autorisé';
      exception when others then got := 'bloqué (' || sqlerrm || ')'; end;
      res := res || jsonb_build_object('bloc', p.plan, 'test', 'API directe : remettre son compteur à zéro (release_usage)', 'attendu', 'bloqué', 'obtenu', got);
      begin
        update public.subscription_usage set searches_used = 0 where user_id = u;
        get diagnostics i = row_count;
        got := case when i = 0 then 'bloqué (0 ligne modifiée)' else 'autorisé (' || i || ' ligne)' end;
      exception when others then got := 'bloqué (' || sqlerrm || ')'; end;
      res := res || jsonb_build_object('bloc', p.plan, 'test', 'API directe : UPDATE de son compteur', 'attendu', 'bloqué', 'obtenu', got);

      -- 2. Concurrents suivis (insert direct par l'API)
      got := 'autorisé';
      begin
        for i in 1..p.max_tracked_competitors loop
          insert into public.competitors_watch (user_id, page_id, page_name) values (u, 'test-page-' || i, 'Test');
        end loop;
      exception when others then got := 'bloqué (' || sqlerrm || ')'; end;
      res := res || jsonb_build_object('bloc', p.plan, 'test', 'Suivre ' || p.max_tracked_competitors || ' concurrent(s) (le plafond)', 'attendu', 'autorisé', 'obtenu', got);
      begin
        insert into public.competitors_watch (user_id, page_id, page_name) values (u, 'test-page-extra', 'Test');
        got := 'autorisé';
      exception when others then got := 'bloqué (' || sqlerrm || ')'; end;
      res := res || jsonb_build_object('bloc', p.plan, 'test', 'Suivre un ' || (p.max_tracked_competitors + 1) || 'e concurrent', 'attendu', 'bloqué', 'obtenu', got);

      -- 3. Winner Agent
      k := greatest(p.winner_agent_keywords, 1);
      begin
        insert into public.winner_agent_config (user_id, active, keywords, countries)
          values (u, true, array_fill('mot'::text, array[k]), array['CI']);
        got := 'autorisé';
      exception when others then got := 'bloqué (' || sqlerrm || ')'; end;
      res := res || jsonb_build_object('bloc', p.plan, 'test', 'Winner Agent avec ' || k || ' mot(s)-clé(s)',
        'attendu', case when p.winner_agent_enabled then 'autorisé' else 'bloqué' end, 'obtenu', got);
      if p.winner_agent_enabled then
        begin
          update public.winner_agent_config set keywords = array_fill('mot'::text, array[k + 1]) where user_id = u;
          got := 'autorisé';
        exception when others then got := 'bloqué (' || sqlerrm || ')'; end;
        res := res || jsonb_build_object('bloc', p.plan, 'test', 'Winner Agent avec ' || (k + 1) || ' mots-clés', 'attendu', 'bloqué', 'obtenu', got);
      end if;

      -- 4. Lecture directe du catalogue (Feed / Boutiques) par l'API
      select count(*) into i from public.feed_ads;
      res := res || jsonb_build_object('bloc', p.plan, 'test', 'API directe : lire tout le Feed (' || total_feed || ' pubs)',
        'attendu', case when p.plan = 'free' then '0' else total_feed::text end, 'obtenu', i::text);
      select count(*) into i from public.shops;
      res := res || jsonb_build_object('bloc', p.plan, 'test', 'API directe : lire toutes les boutiques (' || total_shops || ')',
        'attendu', case when p.plan = 'free' then '0' else total_shops::text end, 'obtenu', i::text);

      -- 5. Mes produits (Validation/Testing) : 50 en gratuit, illimité en payant
      got := 'autorisé';
      begin
        for i in 1..50 loop insert into public.produits (nom, soumis_par) values ('Test ' || i, u); end loop;
      exception when others then got := 'bloqué (' || sqlerrm || ')'; end;
      res := res || jsonb_build_object('bloc', p.plan, 'test', 'Ajouter 50 produits', 'attendu', 'autorisé', 'obtenu', got);
      begin
        insert into public.produits (nom, soumis_par) values ('Test 51', u);
        got := 'autorisé';
      exception when others then got := 'bloqué (' || sqlerrm || ')'; end;
      res := res || jsonb_build_object('bloc', p.plan, 'test', 'Ajouter un 51e produit',
        'attendu', case when p.mes_produits_max is null then 'autorisé' else 'bloqué' end, 'obtenu', got);

      -- 6. Pubs sauvegardées : pas d'insert direct possible par l'API
      begin
        insert into public.spy_saved_ads (user_id, ad_archive_id) values (u, 'test-direct');
        got := 'autorisé';
      exception when others then got := 'bloqué (' || sqlerrm || ')'; end;
      res := res || jsonb_build_object('bloc', p.plan, 'test', 'API directe : sauvegarder une pub sans passer par le serveur', 'attendu', 'bloqué', 'obtenu', got);

      -- Niveaux d'accès lus par le serveur pour CE compte (plan effectif)
      res := res || jsonb_build_object('bloc', p.plan, 'test', 'Plan effectif lu en base (my_plan)', 'attendu', p.plan, 'obtenu', public.my_plan());
      reset role;

      res := res || jsonb_build_object('bloc', p.plan, 'test', 'Top Trend', 'attendu',
        case p.plan when 'free' then 'locked' when 'starter' then 'preview (3)' else 'full' end,
        'obtenu', p.top_trend_access || coalesce(' (' || p.top_trend_preview || ')', ''));
      res := res || jsonb_build_object('bloc', p.plan, 'test', 'Feed / pages Produits-Boutiques', 'attendu',
        case when p.plan = 'free' then '20 / 5' else 'complet / complet' end,
        'obtenu', coalesce(p.feed_limit::text, 'complet') || ' / ' || coalesce(p.pages_limit::text, 'complet'));
      res := res || jsonb_build_object('bloc', p.plan, 'test', 'Alertes WhatsApp / Vitrine', 'attendu',
        case p.plan when 'business' then 'oui / oui' when 'pro' then 'oui / non' else 'non / non' end,
        'obtenu', case when p.whatsapp_winners_enabled then 'oui' else 'non' end || ' / ' || case when p.validated_winners_showcase then 'oui' else 'non' end);

      -- 6b. Pubs sauvegardées par le serveur : plafond gratuit 20
      got := 'autorisé';
      begin
        for i in 1..20 loop insert into public.spy_saved_ads (user_id, ad_archive_id) values (u, 'test-' || i); end loop;
        insert into public.spy_saved_ads (user_id, ad_archive_id) values (u, 'test-21');
      exception when others then got := 'bloqué (' || sqlerrm || ')'; end;
      res := res || jsonb_build_object('bloc', p.plan, 'test', 'Sauvegarder une 21e pub',
        'attendu', case when p.plan = 'free' then 'bloqué' else 'autorisé' end, 'obtenu', got);

      -- 7. Téléchargements : 100/jour pour toutes les offres
      got := 'autorisé';
      begin
        for i in 1..100 loop perform public.consume_download(u); end loop;
      exception when others then got := 'bloqué (' || sqlerrm || ')'; end;
      res := res || jsonb_build_object('bloc', p.plan, 'test', '100 téléchargements dans la journée', 'attendu', 'autorisé', 'obtenu', got);
      begin perform public.consume_download(u); got := 'autorisé';
      exception when others then got := 'bloqué (' || sqlerrm || ')'; end;
      res := res || jsonb_build_object('bloc', p.plan, 'test', '101e téléchargement (anti-abus)', 'attendu', 'bloqué', 'obtenu', got);

      raise exception 'rollback_ok';
    exception when others then
      if sqlerrm <> 'rollback_ok' then
        res := res || jsonb_build_object('bloc', p.plan, 'test', 'ERREUR DU SCÉNARIO', 'attendu', '-', 'obtenu', sqlerrm);
      end if;
    end;
  end loop;

  -- B. États d'abonnement
  begin
    u := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'test-etats-' || u || '@look360.test', '', now(),
            '{"provider":"email"}', '{"nom":"Test états"}', now(), now());

    -- B1. Jamais abonné
    b := public.billing_state(u);
    res := res || jsonb_build_object('bloc', 'non abonné', 'test', 'Plan effectif + bannière', 'attendu', 'free / aucune',
      'obtenu', (b->>'effective_plan') || ' / ' || coalesce(b->>'banner', 'aucune'));

    -- B2. Paiement en attente (Pro)
    ref := 'test-' || u;
    insert into public.payments (user_id, provider, provider_ref, purpose, plan, amount, currency, status)
      values (u, 'saspay', ref, 'subscription', 'pro', 10000, 'XOF', 'pending');
    b := public.billing_state(u);
    res := res || jsonb_build_object('bloc', 'paiement en attente', 'test', 'Plan effectif + bannière', 'attendu', 'free / pending (pro)',
      'obtenu', (b->>'effective_plan') || ' / ' || coalesce(b->>'banner', 'aucune') || ' (' || coalesce(b->>'banner_plan', '-') || ')');
    s := (public.usage_period(u)).p_start;
    insert into public.subscription_usage (user_id, period_start, period_end, searches_used, market_search_units_used)
      values (u, s, s + interval '1 month', 5, 5);
    begin perform public.reserve_usage(u, 1, 1); got := 'autorisée';
    exception when others then got := 'bloquée (' || sqlerrm || ')'; end;
    res := res || jsonb_build_object('bloc', 'paiement en attente', 'test', '6e recherche (accès gratuit seulement)', 'attendu', 'bloquée', 'obtenu', got);

    -- B3. Paiement échoué
    update public.payments set status = 'failed' where provider_ref = ref;
    b := public.billing_state(u);
    res := res || jsonb_build_object('bloc', 'paiement échoué', 'test', 'Plan effectif + bannière', 'attendu', 'free / failed (pro)',
      'obtenu', (b->>'effective_plan') || ' / ' || coalesce(b->>'banner', 'aucune') || ' (' || coalesce(b->>'banner_plan', '-') || ')');

    -- B4. Le paiement finit par passer : abonné Pro avec 60 produits, puis période terminée (cron pas encore passé)
    update public.payments set status = 'success' where provider_ref = ref;
    update public.subscriptions set plan = 'pro', status = 'active',
      current_period_start = now() - interval '31 days', current_period_end = now() + interval '1 day'
      where user_id = u;
    for i in 1..60 loop insert into public.produits (nom, soumis_par) values ('Pro ' || i, u); end loop;
    update public.subscriptions set current_period_end = now() - interval '1 hour' where user_id = u;
    b := public.billing_state(u);
    res := res || jsonb_build_object('bloc', 'Pro expiré', 'test', 'Plan effectif + bannière', 'attendu', 'free / expired (pro)',
      'obtenu', (b->>'effective_plan') || ' / ' || coalesce(b->>'banner', 'aucune') || ' (' || coalesce(b->>'banner_plan', '-') || ')');
    begin perform public.reserve_usage(u, 1, 1); got := 'autorisée';
    exception when others then got := 'bloquée (' || sqlerrm || ')'; end;
    res := res || jsonb_build_object('bloc', 'Pro expiré', 'test', 'Recherche avec 5/5 gratuites utilisées', 'attendu', 'bloquée', 'obtenu', got);

    drop policy if exists feed_ads_read on public.feed_ads;
    create policy feed_ads_read on public.feed_ads for select to authenticated using ((select public.my_plan()) <> 'free');
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into i from public.feed_ads;
    res := res || jsonb_build_object('bloc', 'Pro expiré', 'test', 'API directe : lire tout le Feed', 'attendu', '0', 'obtenu', i::text);
    select count(*) into i from public.produits where soumis_par = u;
    res := res || jsonb_build_object('bloc', 'Pro expiré', 'test', 'Ses 60 produits sont conservés et visibles', 'attendu', '60', 'obtenu', i::text);
    begin
      insert into public.produits (nom, soumis_par) values ('Après expiration', u);
      got := 'autorisé';
    exception when others then got := 'bloqué (' || sqlerrm || ')'; end;
    res := res || jsonb_build_object('bloc', 'Pro expiré', 'test', 'Ajouter un 61e produit', 'attendu', 'bloqué', 'obtenu', got);
    begin
      insert into public.competitors_watch (user_id, page_id, page_name) values (u, 'test-expire', 'Test');
      got := 'autorisé';
    exception when others then got := 'bloqué (' || sqlerrm || ')'; end;
    res := res || jsonb_build_object('bloc', 'Pro expiré', 'test', 'Suivre un concurrent', 'attendu', 'bloqué', 'obtenu', got);
    begin
      insert into public.winner_agent_config (user_id, active, keywords, countries) values (u, true, array['mot'], array['CI']);
      got := 'autorisé';
    exception when others then got := 'bloqué (' || sqlerrm || ')'; end;
    res := res || jsonb_build_object('bloc', 'Pro expiré', 'test', 'Activer le Winner Agent', 'attendu', 'bloqué', 'obtenu', got);
    res := res || jsonb_build_object('bloc', 'Pro expiré', 'test', 'Top Trend (niveau du plan effectif)', 'attendu', 'locked',
      'obtenu', (select top_trend_access from public.plan_limits where plan = public.my_plan()));
    reset role;

    -- B5. Passage du cron d'expiration : l'offre perdue reste connue pour la bannière
    perform public.expire_subscription(u);
    b := public.billing_state(u);
    res := res || jsonb_build_object('bloc', 'Pro expiré (après cron)', 'test', 'Bannière de renouvellement', 'attendu', 'expired (pro)',
      'obtenu', coalesce(b->>'banner', 'aucune') || ' (' || coalesce(b->>'banner_plan', '-') || ')');

    -- B6. Renouvellement : vrai chemin de paiement (apply_payment_success)
    ref := 'test-renew-' || u;
    insert into public.payments (user_id, provider, provider_ref, purpose, plan, amount, currency, status)
      values (u, 'saspay', ref, 'subscription', 'pro', 10000, 'XOF', 'pending');
    perform public.apply_payment_success('saspay', ref, 'txn-test');
    b := public.billing_state(u);
    res := res || jsonb_build_object('bloc', 'renouvellement', 'test', 'Plan effectif + bannière', 'attendu', 'pro / aucune',
      'obtenu', (b->>'effective_plan') || ' / ' || coalesce(b->>'banner', 'aucune'));
    begin perform public.reserve_usage(u, 1, 1); got := 'autorisée';
    exception when others then got := 'bloquée (' || sqlerrm || ')'; end;
    res := res || jsonb_build_object('bloc', 'renouvellement', 'test', 'Recherche (quota Pro restauré)', 'attendu', 'autorisée', 'obtenu', got);
    begin
      insert into public.produits (nom, soumis_par) values ('Après renouvellement', u);
      got := 'autorisé';
    exception when others then got := 'bloqué (' || sqlerrm || ')'; end;
    res := res || jsonb_build_object('bloc', 'renouvellement', 'test', 'Ajouter un 61e produit', 'attendu', 'autorisé', 'obtenu', got);

    raise exception 'rollback_ok';
  exception when others then
    if sqlerrm <> 'rollback_ok' then
      res := res || jsonb_build_object('bloc', 'états', 'test', 'ERREUR DU SCÉNARIO', 'attendu', '-', 'obtenu', sqlerrm);
    end if;
  end;

  -- B7. E-mail non vérifié
  begin
    u := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'test-email-' || u || '@look360.test', '', null,
            '{"provider":"email"}', '{"nom":"Test e-mail"}', now(), now());
    begin perform public.reserve_usage(u, 1, 1); got := 'autorisée';
    exception when others then got := 'bloquée (' || sqlerrm || ')'; end;
    res := res || jsonb_build_object('bloc', 'e-mail non vérifié', 'test', '1re recherche gratuite', 'attendu', 'bloquée', 'obtenu', got);
    raise exception 'rollback_ok';
  exception when others then
    if sqlerrm <> 'rollback_ok' then
      res := res || jsonb_build_object('bloc', 'e-mail', 'test', 'ERREUR DU SCÉNARIO', 'attendu', '-', 'obtenu', sqlerrm);
    end if;
  end;

  insert into rapport (bloc, test, attendu, obtenu, resultat)
  select e->>'bloc', e->>'test', e->>'attendu', e->>'obtenu',
         case when (e->>'obtenu') like (e->>'attendu') || '%' then '✅ OK' else '❌ KO' end
  from jsonb_array_elements(res) e;
end $$;

(select bloc, test, attendu, obtenu, resultat from rapport order by n)
union all
select 'TOTAL', count(*) filter (where resultat like '%OK') || ' OK / ' || count(*) filter (where resultat like '%KO') || ' KO', '', '', ''
from rapport;
