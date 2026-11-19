select * from (
select '0031' as m, to_regclass('public.win_loss_trends') is not null as ok
union all select '0033' as m, to_regclass('public.api_keys') is not null as ok
union all select '0034' as m, to_regclass('public.system_alerts') is not null as ok
union all select '0035' as m, to_regclass('public.admin_impersonation_log') is not null as ok
union all select '0036' as m, to_regclass('public.blog_posts') is not null as ok
union all select '0039' as m, to_regclass('public.promo_campaigns') is not null as ok
union all select '0042', exists(select 1 from information_schema.columns where table_name='leads' and column_name='capture_point')
union all select '0043', exists(select 1 from information_schema.columns where table_name='leads' and column_name='drip_email_1_sent_at')
union all select '0044' as m, to_regclass('public.industry_trends') is not null as ok
union all select '0046', exists(select 1 from information_schema.columns where table_name='accounts' and column_name='trends_digest')
union all select '0048' as m, to_regclass('public.competitor_hiring') is not null as ok
union all select '0049', exists(select 1 from information_schema.columns where table_name='competitor_hiring' and column_name='source')
union all select '0050', exists(select 1 from information_schema.columns where table_name='profiles' and column_name='has_seen_product_tour')
union all select '0051', exists(select 1 from information_schema.columns where table_name='accounts' and column_name='status')
union all select '0052', exists(select 1 from information_schema.columns where table_name='signals' and column_name='sentiment')
union all select '0053' as m, to_regclass('public.referrals') is not null as ok
union all select '0054', exists(select 1 from information_schema.columns where table_name='accounts' and column_name='demo_mode')
union all select '0055' as m, to_regclass('public.competitor_state_history') is not null as ok
union all select '0056', exists(select 1 from information_schema.columns where table_name='competitors' and column_name='github_repo')
union all select '0057' as m, to_regclass('public.competitor_reviews') is not null as ok
union all select '0058', exists(select 1 from information_schema.columns where table_name='accounts' and column_name='timezone')
union all select '0059', exists(select 1 from information_schema.columns where table_name='competitors' and column_name='careers_fetch_failures')
union all select '0060' as m, to_regclass('public.feedback_submissions') is not null as ok
union all select '0061', exists(select 1 from information_schema.columns where table_name='competitor_win_loss' and column_name='account_id')
union all select '0062' as m, to_regclass('public.competitor_screenshots') is not null as ok
union all select '0063', exists(select 1 from information_schema.columns where table_name='affiliate_applications' and column_name='program')
union all select '0065' as m, to_regclass('public.crawl_runs') is not null as ok
union all select '0066', exists(select 1 from information_schema.columns where table_name='leads' and column_name='metadata')
union all select '0068', exists(select 1 from information_schema.columns where table_name='leads' and column_name='drip_paused_at')
union all select '0069', exists(select 1 from information_schema.columns where table_name='leads' and column_name='drip_email_4_sent_at')
) t where not ok order by m;