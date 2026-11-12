"""Fresh read-only data and tested hosted portrait-release verification.

No migration, restore, application startup, new backup or publishing is performed.
Uses only the explicitly fingerprinted production target and existing private backup.
"""
import hashlib,importlib.util,json,pathlib,re,urllib.request

EXPECTED='da8f5a8923827d4ee3bff74a6027c912109158d1'
HELPER_SHA='0951e78fc51eb98529565a1bb4dfff807efafd003478d6714df6d5258c934b1e'
HELPER=pathlib.Path(__file__).with_name('inspect-preservation-v3-20261015.py')
STARTUP_SQL="SELECT jsonb_build_object(\n 'read_only',current_setting('transaction_read_only'),\n 'startup_probes_exhaustive',false,\n'malformed_numeric_counts',(SELECT COALESCE(jsonb_agg(to_jsonb(report)),'[]'::jsonb) FROM (\nWITH values_to_check(table_name,column_name,value) AS (\n SELECT 'invoices',v.k,v.v FROM public.invoices t CROSS JOIN LATERAL\n (VALUES ('subtotal',to_jsonb(t)->>'subtotal'),('tax',to_jsonb(t)->>'tax'),('total',to_jsonb(t)->>'total')) v(k,v)\n UNION ALL SELECT 'invoice_items',v.k,v.v FROM public.invoice_items t CROSS JOIN LATERAL\n (VALUES ('quantity',to_jsonb(t)->>'quantity'),('unit_price',to_jsonb(t)->>'unit_price'),('amount',to_jsonb(t)->>'amount')) v(k,v)\n UNION ALL SELECT 'payments','amount',to_jsonb(t)->>'amount' FROM public.payments t\n UNION ALL SELECT 'bank_transactions','amount',to_jsonb(t)->>'amount' FROM public.bank_transactions t\n UNION ALL SELECT 'bank_accounts',v.k,v.v FROM public.bank_accounts t CROSS JOIN LATERAL\n (VALUES ('opening_balance',to_jsonb(t)->>'opening_balance'),('current_balance',to_jsonb(t)->>'current_balance')) v(k,v)\n)\nSELECT table_name,column_name,count(*) AS malformed_numeric_values\nFROM values_to_check WHERE value IS NOT NULL AND value !~ '^[+-]?[0-9]+([.][0-9]+)?$'\nGROUP BY table_name,column_name ORDER BY table_name,column_name\n) report),\n'startup_candidate_counts',(SELECT COALESCE(jsonb_agg(to_jsonb(report)),'[]'::jsonb) FROM (\nSELECT 'malformed_invoice_number_fix' AS startup_write,count(*) AS eligible_rows\n FROM public.invoices WHERE invoice_number='INV-1772133028576'\nUNION ALL SELECT 'make_historical_invoices_visible',count(*)\n FROM public.invoices WHERE to_jsonb(invoices)->>'is_visible_to_client'='false'\nUNION ALL SELECT 'delete_orphan_bill_payment_4',count(*) FROM public.bill_payments bp\n WHERE id=4 AND bill_id=2 AND amount='87.00' AND to_jsonb(bp)->>'bank_transaction_id'='4'\n AND NOT EXISTS (SELECT 1 FROM public.bank_transactions WHERE id=4)\nUNION ALL SELECT 'rewrite_bill_2_balance',count(*) FROM public.bills b\n WHERE id=2 AND to_jsonb(b)->>'amount_paid'='3608.14' AND to_jsonb(b)->>'amount_due'='949.98'\nUNION ALL SELECT 'recreate_expense_16_bank_transaction',count(*) FROM public.expenses e\n WHERE e.id=16 AND to_jsonb(e)->>'bank_transaction_id' IS NOT NULL\n AND NOT EXISTS (SELECT 1 FROM public.bank_transactions bt WHERE bt.id::text=to_jsonb(e)->>'bank_transaction_id')\nUNION ALL SELECT 'convert_check_expense_bank_transactions',count(*)\n FROM public.bank_transactions bt JOIN public.expenses e ON bt.id::text=to_jsonb(e)->>'bank_transaction_id'\n WHERE to_jsonb(e)->>'payment_type'='check' AND\n ((to_jsonb(bt)->>'transaction_type')<>'check' OR to_jsonb(bt)->>'check_number' IS NULL OR to_jsonb(bt)->>'check_number'='')\nUNION ALL SELECT 'delete_older_in_progress_reconciliations',count(*) FROM public.bank_reconciliations br\n WHERE status='in_progress' AND id NOT IN\n (SELECT max(id) FROM public.bank_reconciliations WHERE status='in_progress' GROUP BY bank_account_id)\nUNION ALL SELECT 'link_orphan_invoice_items_to_time_logs',count(DISTINCT ii.id)\n FROM public.invoice_items ii JOIN public.invoices i ON ii.invoice_id=i.id\n JOIN public.time_logs tl ON tl.project_id=i.project_id\n WHERE to_jsonb(ii)->>'time_log_id' IS NULL AND to_jsonb(ii)->>'time_entry_id' IS NULL\n AND tl.task_description IS NOT NULL AND length(trim(tl.task_description))>20\n AND ii.description LIKE '%'||trim(tl.task_description)||'%'\nUNION ALL SELECT 'set_time_log_invoice_id',count(DISTINCT tl.id)\n FROM public.time_logs tl JOIN public.invoice_items ii ON tl.id::text=to_jsonb(ii)->>'time_log_id'\n JOIN public.invoices i ON i.id=ii.invoice_id\n WHERE to_jsonb(tl)->>'invoice_id' IS NULL AND i.status<>'cancelled'\nUNION ALL SELECT 'seed_equity_accounts',\n CASE WHEN EXISTS (SELECT 1 FROM public.accounts WHERE account_type='equity') THEN 0 ELSE 4 END\nUNION ALL SELECT 'set_time_entry_invoice_id',count(DISTINCT te.id)\n FROM public.time_entries te JOIN public.invoice_items ii ON te.id::text=to_jsonb(ii)->>'time_entry_id'\n JOIN public.invoices i ON i.id=ii.invoice_id\n WHERE to_jsonb(ii)->>'time_log_id' IS NULL AND to_jsonb(te)->>'invoice_id' IS NULL AND i.status<>'cancelled'\nUNION ALL SELECT 'date_prefixed_unlinked_invoice_items_for_review',count(*)\n FROM public.invoice_items ii JOIN public.invoices i ON i.id=ii.invoice_id\n WHERE i.project_id IS NOT NULL AND to_jsonb(ii)->>'time_log_id' IS NULL\n AND to_jsonb(ii)->>'time_entry_id' IS NULL\n AND ii.description ~ '^[0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4}[[:space:]]*-[[:space:]]*.+'\n) report),\n'transfer_link_candidates',(SELECT COALESCE(jsonb_agg(to_jsonb(report)),'[]'::jsonb) FROM (\nWITH transfers AS (\n SELECT id,to_jsonb(bt) AS j FROM public.bank_transactions bt\n WHERE to_jsonb(bt)->>'transaction_type'='transfer'\n AND to_jsonb(bt)->>'transfer_to_bank_account_id' IS NOT NULL\n AND to_jsonb(bt)->>'linked_transaction_id' IS NULL\n), pairs AS (\n SELECT DISTINCT ON (t.id) t.id AS transfer_id,c.id AS counterpart_id\n FROM transfers t JOIN public.bank_transactions c\n ON to_jsonb(c)->>'bank_account_id'=t.j->>'transfer_to_bank_account_id'\n AND to_jsonb(c)->>'transaction_type'='deposit' AND to_jsonb(c)->>'amount'=t.j->>'amount'\n AND (to_jsonb(c)->>'transaction_date')::timestamp::date=(t.j->>'transaction_date')::timestamp::date\n AND to_jsonb(c)->>'linked_transaction_id' IS NULL ORDER BY t.id,c.id\n)\nSELECT 'link_transfer_counterparts' AS startup_write,count(*) AS eligible_transfer_pairs FROM pairs\n) report),\n'bank_balance_candidates',(SELECT COALESCE(jsonb_agg(to_jsonb(report)),'[]'::jsonb) FROM (\nWITH tx AS (\n SELECT bank_account_id,\n sum(CASE WHEN to_jsonb(bt)->>'amount' ~ '^[+-]?[0-9]+([.][0-9]+)?$' THEN\n (CASE WHEN to_jsonb(bt)->>'transaction_type' IN ('deposit','refund') THEN 1 ELSE -1 END)\n * (to_jsonb(bt)->>'amount')::numeric ELSE NULL END) AS net,\n count(*) FILTER (WHERE to_jsonb(bt)->>'amount' IS NULL OR to_jsonb(bt)->>'amount' !~ '^[+-]?[0-9]+([.][0-9]+)?$') AS malformed\n FROM public.bank_transactions bt GROUP BY bank_account_id\n), balances AS (\n SELECT ba.id,COALESCE(tx.malformed,0) AS malformed,\n CASE WHEN COALESCE(to_jsonb(ba)->>'opening_balance','0') ~ '^[+-]?[0-9]+([.][0-9]+)?$'\n THEN round(COALESCE((to_jsonb(ba)->>'opening_balance')::numeric,0)+COALESCE(tx.net,0),2)::text END AS computed,\n to_jsonb(ba)->>'current_balance' AS stored\n FROM public.bank_accounts ba LEFT JOIN tx ON tx.bank_account_id=ba.id\n)\nSELECT count(*) AS accounts_updated_on_every_startup,\n count(*) FILTER (WHERE malformed=0 AND computed IS NOT NULL AND computed IS DISTINCT FROM stored) AS accounts_with_balance_string_changes,\n count(*) FILTER (WHERE malformed>0 OR computed IS NULL) AS accounts_needing_numeric_review\nFROM balances\n) report)\n);\n"
SOURCE_SQL=r"""
WITH candidates AS (
 SELECT ii.id,ii.is_custom,i.status,i.project_id,
 regexp_replace((regexp_match(ii.description,
 '^[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{4}[[:space:]]*-[[:space:]]*(.+)$'))[1],
 '^[[:space:]]+|[[:space:]]+$','','g') AS description,
 ii.description ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}[[:space:]]*-[[:space:]]*.+' AS repair_pattern
 FROM public.invoice_items ii JOIN public.invoices i ON i.id=ii.invoice_id
 WHERE ii.time_log_id IS NULL AND ii.time_entry_id IS NULL AND i.project_id IS NOT NULL
 AND ii.description ~ '^[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{4}[[:space:]]*-[[:space:]]*.+'
), matches AS (
 SELECT c.*,
 EXISTS(SELECT 1 FROM public.time_logs t WHERE t.project_id=c.project_id AND t.task_description=c.description
 AND NOT EXISTS(SELECT 1 FROM public.invoice_items used WHERE used.time_log_id=t.id)) AS unused_log,
 EXISTS(SELECT 1 FROM public.time_entries t WHERE t.project_id=c.project_id
 AND (t.notes=c.description OR (t.notes IS NULL AND c.description='Task work'))
 AND NOT EXISTS(SELECT 1 FROM public.invoice_items used WHERE used.time_entry_id=t.id)) AS unused_entry,
 EXISTS(SELECT 1 FROM public.time_logs t WHERE t.project_id=c.project_id AND t.invoice_id IS NULL AND t.task_description=c.description) AS unbilled_log,
 EXISTS(SELECT 1 FROM public.time_entries t WHERE t.project_id=c.project_id AND t.invoice_id IS NULL
 AND (t.notes=c.description OR (t.notes IS NULL AND c.description='Task work'))) AS unbilled_entry
 FROM candidates c
)
SELECT jsonb_build_object('read_only',current_setting('transaction_read_only'),
 'date_independent_conservative_check',true,'date_prefixed_unlinked_items',count(*),
 'orphan_repair_possible_items',count(*) FILTER(WHERE repair_pattern AND (unused_log OR unused_entry)),
 'custom_source_backfill_possible_items',count(*) FILTER(WHERE is_custom AND status<>'cancelled' AND (unbilled_log OR unbilled_entry))) FROM matches;
"""
FIXTURES_SQL=r"""
SELECT jsonb_build_object('read_only',current_setting('transaction_read_only'),
 'historical_invoice_verified',EXISTS(SELECT 1 FROM public.invoices i WHERE id=296 AND invoice_number='INV-2026-0212'
 AND total='4555.20' AND status='paid' AND (SELECT count(*) FROM public.invoice_items WHERE invoice_id=i.id)=167
 AND (SELECT count(*) FROM public.payments WHERE invoice_id=i.id)=1
 AND (SELECT count(*) FROM public.payments WHERE invoice_id=i.id AND amount='4555.20')=1),
 'catalog_presets_restored',(SELECT count(*)=8 AND count(*) FILTER(WHERE unit='hour' AND default_rate='0' AND is_active=false)=8
 FROM public.billing_catalog_items WHERE name IN ('Site Visit','Phone Call','Permit Review','Document Preparation','Utility Coordination','Site Meeting','Engineering Review','SWPPP Work')),
 'synthetic_invoices_remain_drafts_without_payments',(SELECT count(*)=2 AND count(*) FILTER(WHERE status='draft')=2
 FROM public.invoices WHERE id IN (459,460)) AND NOT EXISTS(SELECT 1 FROM public.payments WHERE invoice_id IN (459,460)));
"""

def history_sql(rows):
    names={r['table_name'] for r in rows}
    allowed={'invoices','invoice_items','invoice_item_catalog_links','payments','bank_accounts','bank_transactions','bank_reconciliations','bills','bill_items','bill_payments','expenses','deposits','accounts','journal_entries','journal_entry_lines','time_logs','time_entries'}
    if names!=allowed or len(rows)!=17: raise ValueError('Wrong baseline categories')
    reports=[]
    for r in rows:
        n=r['table_name'];table='invoice_items' if n=='invoice_item_catalog_links' else n
        count=int(r['row_count'])
        if count<0: raise ValueError('Invalid baseline count')
        where=' WHERE id NOT IN (459,460)' if n=='invoices' else ' WHERE invoice_id NOT IN (459,460)' if table=='invoice_items' else ''
        value="to_jsonb(t)-'catalog_item_id'" if n=='invoice_items' else "jsonb_build_object('id',id,'catalog_item_id',to_jsonb(t)->'catalog_item_id')" if n=='invoice_item_catalog_links' else 'to_jsonb(t)'
        for a,c in [('bank_accounts','check_signature'),('bank_transactions','check_details'),('bill_payments','check_details')]:
            if n==a: value="to_jsonb(t)||jsonb_build_object('"+c+"',to_jsonb(t)->'"+c+"')"
        reports.append("SELECT '"+n+"'::text AS table_name,(SELECT count(*) FROM public."+table+where+") AS current_rows,count(*) AS row_count,md5(COALESCE(string_agg(md5(("+value+")::text),'' ORDER BY id),'')) AS all_columns_digest FROM (SELECT * FROM public."+table+where+' ORDER BY id LIMIT '+str(count)+') t')
    return "SELECT jsonb_build_object('read_only',current_setting('transaction_read_only'),'original_partitions',jsonb_agg(to_jsonb(x) ORDER BY table_name)) FROM ("+' UNION ALL '.join(reports)+') x;'

def extra_queries(rows):
    return history_sql(rows)+'\n'+STARTUP_SQL+'\n'+SOURCE_SQL+'\n'+FIXTURES_SQL

def release_evidence(source):
    if not source.get('success') or source['head']!=EXPECTED or source['fresh_origin_main']!=EXPECTED or not source['checkout_clean']:
        return {'success':False,'message':'Hosted clean HEAD and latest main must match the reviewed portrait release.'}
    candidates=[]
    for path in pathlib.Path('/home/runner/.expedition-production-recovery').glob('print-release-20261015-*/release-verification.json'):
        if path.is_symlink(): continue
        data=json.loads(path.read_text())
        if data.get('success') and data.get('final_head')==EXPECTED:
            candidates.append((data.get('verified_at_utc',''),path,data))
    if not candidates: return {'success':False,'message':'Successful hosted portrait-release preparation is required.'}
    _,path,data=max(candidates,key=lambda x:x[0])
    checks=data['checks']
    if any(checks[n]['exit_code']!=0 for n in ('dependencies','checkwriter','regression','build')) or checks['typecheck']['print_file_errors']:
        return {'success':False,'message':'Required hosted checks failed.'}
    if not data['build_assets']: return {'success':False,'message':'Build assets missing.'}
    for item in data['build_artifacts']+data['build_assets']:
        name=item.get('path')
        if name not in ('dist/index.cjs','dist/public/index.html'):
            url=item.get('url','')
            if not re.fullmatch(r'/assets/[A-Za-z0-9._-]+\.(?:js|css)',url): raise ValueError('Unexpected build path')
            name='dist/public'+url
        with pathlib.Path(name).open('rb') as stream:
            if hashlib.file_digest(stream,'sha256').hexdigest()!=item['sha256']:
                return {'success':False,'message':'Tested build artifact changed.'}
    server=next(x['sha256'] for x in data['build_artifacts'] if x.get('path')=='dist/index.cjs')
    if server!='a1540b3edbf0e8e2d4e7f16a905a073e0a3fac7e61f60d612d2bbda01ab8775e':
        return {'success':False,'message':'Server build differs from reviewed original release.'}
    return {'success':True,'tested_commit':EXPECTED,'verification_path':str(path),'checks':checks,'build_assets':data['build_assets'],'build_artifacts':data['build_artifacts']}

def finalize(result,reports,prior):
    if len(reports)!=4 or any(r.get('read_only')!='on' for r in reports): raise ValueError('Incomplete snapshot')
    history,startup,source,fixtures=reports
    current={r['table_name']:r for r in history['original_partitions']}
    if set(current)!=set(prior) or len(current)!=17: raise ValueError('Wrong result categories')
    differences=[];additions={}
    for name,old in prior.items():
        new=current[name]
        if new['row_count']!=old['row_count'] or new['all_columns_digest']!=old['all_columns_digest']:
            differences.append(name)
        if new['current_rows']>old['row_count']: additions[name]=new['current_rows']-old['row_count']
    bank=result['bank_state_preserved_with_explained_balance_and_check_counter'] is True
    protected=bank and set(differences)<={'bank_accounts'}
    ignored={'date_prefixed_unlinked_invoice_items_for_review'}
    startup_safe=not startup['malformed_numeric_counts'] and all(r['eligible_rows']==0 for r in startup['startup_candidate_counts'] if r['startup_write'] not in ignored)
    startup_safe=startup_safe and all(r['eligible_transfer_pairs']==0 for r in startup['transfer_link_candidates'])
    startup_safe=startup_safe and all(r['accounts_with_balance_string_changes']==0 and r['accounts_needing_numeric_review']==0 for r in startup['bank_balance_candidates'])
    startup_safe=startup_safe and source['orphan_repair_possible_items']==0 and source['custom_source_backfill_possible_items']==0
    release=release_evidence(result['hosted_source'])
    result.update(original_protected_financial_rows_preserved=protected,
        original_history_comparison={'categories_compared':17,'differing_categories':differences,'additional_rows_outside_proven_original_sets':additions,'excluded_synthetic_invoice_ids':[459,460],'original_time_logs_compared':5273},
        startup_preflight=startup,source_link_preflight=source,startup_financial_candidates_clear=startup_safe,
        historical_and_test_records=fixtures,hosted_release_verification=release,
        publishing_ready=protected and startup_safe and release['success'] and fixtures['historical_invoice_verified'] and fixtures['catalog_presets_restored'] and fixtures['synthetic_invoices_remain_drafts_without_payments'])
    return result

def main():
    try:
        if HELPER.is_symlink() or hashlib.sha256(HELPER.read_bytes()).hexdigest()!=HELPER_SHA: raise ValueError()
        spec=importlib.util.spec_from_file_location('inspection',HELPER)
        helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
    except Exception:
        print(json.dumps({'success':False,'publishing_ready':False,'message':'Pinned read-only inspection helper unavailable or changed.','production_writes_performed':False}));raise SystemExit(1)
    helper.run(extra_queries=extra_queries,finalize=finalize)

if __name__=='__main__': main()
