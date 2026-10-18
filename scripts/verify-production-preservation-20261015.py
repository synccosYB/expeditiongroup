"""Read-only Expedition Group preservation verification for the October 15, 2026 release.

Uses the previously verified private baseline and explicit production target.
Excludes only synthetic invoices 459/460 and compares the original 5,273 time logs.
Run as a separate interactive command; no database writes, startup, or publishing.
Connection input remains hidden and empty input keeps waiting instead of exiting.
"""
import datetime,getpass,hashlib,json,os,pathlib,re,shutil,subprocess,urllib.parse
os.umask(0o077)
root=pathlib.Path('/home/runner/.expedition-production-recovery/production-20261015-8mept1rg')
target_hash='34e9c787830ab78433de33065461a1a1cfb15601f600c4e43ade6f706c908d3b'
baseline_hash='9b06595e2498d2b6c89155529dc0dc2cb319c551b6e615f0a7d1f415ddcc065a'
stage='load-saved-baseline'
attempted=False
def stop(message,**details):
    print(json.dumps(dict(success=False,stage=stage,message=message,database_connection_attempted=attempted,production_writes_performed=False,**details),indent=2))
    raise SystemExit(1)
def require(ok,message):
    if not ok: stop(message)
try:
    baseline=json.loads((root/'preservation-preflight.json').read_text())
    rows=sorted(baseline['preflight']['financial_fingerprints'],key=lambda r:r['table_name'])
    stage='validate-saved-baseline'
    require(baseline.get('production_target_fingerprint')==target_hash,'Saved production identity mismatch.')
    require(hashlib.sha256(json.dumps(rows,sort_keys=True,separators=(',',':')).encode()).hexdigest()==baseline_hash,'Saved financial baseline mismatch.')
    stage='check-hidden-input'
    import termios
    fd=os.open('/dev/tty',os.O_RDWR)
    try: termios.tcgetattr(fd)
    finally: os.close(fd)
    stage='read-hidden-production-url'
    raw=''
    while not raw:
        raw=getpass.getpass('Paste FULL verified Production Database Settings URL (hidden), then Enter: ').strip()
        if not raw:
            print('No input received. Still waiting; pasted characters will stay hidden. Ctrl+C cancels.')
    stage='validate-production-url-format'
    u=urllib.parse.urlsplit(raw)
    require(u.scheme in ('postgres','postgresql') and u.hostname and u.username and u.password is not None and u.path.strip('/'),'Expected the full PostgreSQL connection URL, including its existing authentication fields.')
    target=(u.hostname.lower().replace('-pooler.','.'),u.port or 5432,urllib.parse.unquote(u.path))
    stage='match-verified-production-target'
    require(hashlib.sha256(json.dumps(target).encode()).hexdigest()==target_hash,'Connection does not match verified production; no database connection made.')
    stage='validate-connection-options'
    allowed={'sslmode':'PGSSLMODE','channel_binding':'PGCHANNELBINDING','sslrootcert':'PGSSLROOTCERT','sslcert':'PGSSLCERT','sslkey':'PGSSLKEY','sslcrl':'PGSSLCRL','sslcrldir':'PGSSLCRLDIR','connect_timeout':'PGCONNECT_TIMEOUT','options':'PGOPTIONS','application_name':'PGAPPNAME'}
    parameters=dict(urllib.parse.parse_qsl(u.query,keep_blank_values=True))
    require(not(set(parameters)-set(allowed)),'Unsupported connection option; no database connection made.')
    env={k:v for k,v in os.environ.items() if not k.startswith('PG') and k not in ('DATABASE_URL','NEON_DATABASE_URL')}
    env.update(PGHOST=u.hostname,PGPORT=str(u.port or 5432),PGDATABASE=urllib.parse.unquote(u.path.lstrip('/')),PGUSER=urllib.parse.unquote(u.username),PGPASSWORD=urllib.parse.unquote(u.password),PGCONNECT_TIMEOUT='15')
    for k,v in parameters.items(): env[allowed[k]]=v
    env['PGOPTIONS']=env.get('PGOPTIONS','')+' -c default_transaction_read_only=on -c timezone=UTC'
    env['PGAPPNAME']='expedition_readonly_final_verification'
    stage='check-psql-client'
    require(shutil.which('psql') is not None,'psql client unavailable.')
    stage='prepare-read-only-query'
    names=[r['table_name'] for r in rows]
    transforms={'invoice_items':"to_jsonb(t)-'catalog_item_id'",'invoice_item_catalog_links':"jsonb_build_object('id',id,'catalog_item_id',to_jsonb(t)->'catalog_item_id')"}
    for n,c in [('bank_accounts','check_signature'),('bank_transactions','check_details'),('bill_payments','check_details')]:
        transforms[n]="to_jsonb(t)||jsonb_build_object('"+c+"',to_jsonb(t)->'"+c+"')"
    parts=[]
    for n in names:
        table='invoice_items' if n=='invoice_item_catalog_links' else n
        source='(SELECT * FROM public.time_logs ORDER BY id LIMIT 5273)' if n=='time_logs' else 'public.'+table
        where=' WHERE id NOT IN (459,460)' if n=='invoices' else ' WHERE invoice_id NOT IN (459,460)' if table=='invoice_items' else ''
        parts.append("SELECT '"+n+"',id,"+transforms.get(n,'to_jsonb(t)')+' FROM '+source+' t'+where)
    sql="BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'; SET LOCAL timezone='UTC'; WITH rows(table_name,id,row_data) AS ("+' UNION ALL '.join(parts)+"), names(table_name) AS (VALUES "+','.join("('"+n+"')" for n in names)+") SELECT jsonb_build_object('read_only',current_setting('transaction_read_only'),'fingerprints',jsonb_agg(to_jsonb(x))) FROM (SELECT n.table_name,count(r.id) AS row_count,md5(COALESCE(string_agg(md5(r.row_data::text),'' ORDER BY r.id),'')) AS all_columns_digest,md5(COALESCE(string_agg(md5((r.row_data-'updated_at')::text),'' ORDER BY r.id),'')) AS excluding_updated_at_digest FROM names n LEFT JOIN rows r USING(table_name) GROUP BY n.table_name) x; ROLLBACK;"
    stage='execute-read-only-query'
    attempted=True
    p=subprocess.run(['psql','--no-psqlrc','--no-password','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-c',sql],env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120)
    if p.returncode or p.stderr.strip():
        m=re.search(rb'(?:ERROR|FATAL|PANIC):\s+([0-9A-Z]{5}):',p.stderr)
        stop('Database connection/query failed or warned; raw errors withheld.',exit_code=p.returncode,sqlstate=m.group(1).decode() if m else None)
    stage='validate-read-only-results'
    data=json.loads(p.stdout.decode().strip())
    require(data.get('read_only')=='on','Read-only transaction was not confirmed.')
    current={r['table_name']:r for r in data['fingerprints']}
    require(set(current)==set(names) and len(names)==17,'Result categories differ from the verified baseline.')
    stage='compare-original-records'
    changes=[]
    for old in rows:
        new=current[old['table_name']]
        if old!=new:
            allowed_timestamp=old['table_name']=='bank_accounts' and old['row_count']==new['row_count'] and old['excluding_updated_at_digest']==new['excluding_updated_at_digest']
            changes.append({'table':old['table_name'],'row_count_same':old['row_count']==new['row_count'],'excluding_updated_at_same':old['excluding_updated_at_digest']==new['excluding_updated_at_digest'],'allowed_bank_timestamp_only':allowed_timestamp})
    result={'success':True,'original_protected_financial_rows_preserved':all(c['allowed_bank_timestamp_only'] for c in changes),'differences':changes,'categories_compared':17,'excluded_test_invoice_ids':[459,460],'original_time_log_rows_compared':5273,'production_writes_performed':False}
except SystemExit: raise
except subprocess.TimeoutExpired: stop('Database operation timed out; no raw errors printed.')
except Exception: stop('This stage could not complete; no raw errors or credentials printed.')
try:
    def git(*args):
        p=subprocess.run(['git','-c','core.hooksPath=/dev/null',*args],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=90)
        if p.returncode: raise RuntimeError()
        return p.stdout.strip()
    remote=urllib.parse.urlsplit(git('config','--get','remote.origin.url'))
    if remote.hostname!='github.com' or remote.path.removesuffix('.git')!='/synccosYB/expeditiongroup': raise RuntimeError()
    git('fetch','origin','main')
    head,main=git('rev-parse','HEAD'),git('rev-parse','origin/main')
    result['hosted_source']={'success':True,'head':head,'fresh_origin_main':main,'head_matches_latest_main':head==main,'checkout_clean':not bool(git('status','--porcelain'))}
except Exception: result['hosted_source']={'success':False,'message':'Git check failed; raw authentication errors withheld.'}
now=datetime.datetime.now(datetime.timezone.utc)
result.update(verified_at_utc=now.isoformat(),production_target_fingerprint=target_hash,financial_baseline_sha256=baseline_hash)
try:
    (root/('final-check-diagnostic-'+now.strftime('%Y%m%dT%H%M%SZ')+'.json')).write_text(json.dumps(result,indent=2))
    result['report_saved']=True
except Exception: result['report_saved']=False
print(json.dumps(result,indent=2))
