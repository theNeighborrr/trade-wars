create policy tw_no_client_access on public.tw_players as restrictive for all to anon, authenticated using(false) with check(false);
create policy tw_no_client_access on public.tw_scores as restrictive for all to anon, authenticated using(false) with check(false);
create policy tw_no_client_access on public.tw_rate_limits as restrictive for all to anon, authenticated using(false) with check(false);
