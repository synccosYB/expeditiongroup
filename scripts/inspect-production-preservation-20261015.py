"""Inspect unexplained production differences without restoring or writing to a database.

Decode three tables from the verified private archive in memory. Reconstruct their
typed rows using read-only PostgreSQL functions, verify their baseline hashes, and
compare original IDs and columns with a single current read-only snapshot.
Only counts, field names, fingerprints and Git metadata are printed or saved.
"""
import datetime
import getpass
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import urllib.parse
import uuid

ROOT = pathlib.Path('/home/runner/.expedition-production-recovery/production-20261015-8mept1rg')
TARGET = '34e9c787830ab78433de33065461a1a1cfb15601f600c4e43ade6f706c908d3b'
BASELINE = '9b06595e2498d2b6c89155529dc0dc2cb319c551b6e615f0a7d1f415ddcc065a'
ARCHIVE = '85052a87c8095517d484d548b886f6e5a6998640f4487a427a9ba7d2342824d0'
TABLES = ('bank_accounts', 'bank_transactions', 'bill_payments')


def decode_copy_cell(value):
    if value == r'\N':
        return None
    raw = value.encode('utf-8')
    result = bytearray()
    i = 0
    escapes = {ord('b'): 8, ord('f'): 12, ord('n'): 10, ord('r'): 13, ord('t'): 9, ord('v'): 11}
    while i < len(raw):
        if raw[i] != 92:
            result.append(raw[i])
            i += 1
            continue
        i += 1
        if i >= len(raw):
            raise ValueError('Incomplete COPY escape')
        if 48 <= raw[i] <= 55:
            end = i + 1
            while end < min(i + 3, len(raw)) and 48 <= raw[end] <= 55:
                end += 1
            result.append(int(raw[i:end], 8))
            i = end
        elif raw[i] == ord('x'):
            end = i + 1
            while end < min(i + 3, len(raw)) and chr(raw[end]) in '0123456789abcdefABCDEF':
                end += 1
            if end == i + 1:
                raise ValueError('Invalid COPY hex escape')
            result.append(int(raw[i + 1:end], 16))
            i = end
        else:
            result.append(escapes.get(raw[i], raw[i]))
            i += 1
    return result.decode('utf-8')


def parse_copy(script, table):
    pattern = re.compile(r'^COPY public\.' + re.escape(table) + r' \(([^)]+)\) FROM stdin;$')
    columns = None
    rows = []
    finished = False
    for line in script.split('\n'):
        if columns is None:
            match = pattern.fullmatch(line)
            if match:
                columns = [x.strip().strip('"') for x in match[1].split(',')]
                if not all(re.fullmatch(r'[a-z_][a-z0-9_]*', x) for x in columns):
                    raise ValueError('Unexpected COPY column')
            continue
        if line == r'\.':
            finished = True
            break
        values = line.split('\t')
        if len(values) != len(columns):
            raise ValueError('Unexpected COPY row width')
        rows.append(dict(zip(columns, map(decode_copy_cell, values))))
    if columns is None or not finished or len({r['id'] for r in rows}) != len(rows):
        raise ValueError('Incomplete or duplicate COPY rows')
    return rows


def sql_json(value):
    text = json.dumps(value, ensure_ascii=False)
    delimiter = '$expedition_' + uuid.uuid4().hex + '$'
    while delimiter in text:
        delimiter = '$expedition_' + uuid.uuid4().hex + '$'
    return delimiter + text + delimiter + '::jsonb'


def build_sql(snapshots):
    ctes = []
    reports = []
    for table in TABLES:
        old, current, added = ('old_' + table, 'current_' + table, 'added_' + table)
        ctes.extend([
            f'{old} AS (SELECT id,to_jsonb(x) AS j FROM jsonb_populate_recordset(NULL::public.{table},{sql_json(snapshots[table])}) x)',
            f'{current} AS (SELECT id,to_jsonb(x) AS j FROM public.{table} x)',
            f'{added} AS (SELECT c.* FROM {current} c WHERE NOT EXISTS (SELECT 1 FROM {old} o WHERE o.id=c.id))',
        ])
        reports.append(f"""SELECT '{table}'::text AS table_name,jsonb_build_object(
 'archive_rows',(SELECT count(*) FROM {old}),
 'archive_all_columns_digest',(SELECT md5(COALESCE(string_agg(md5(j::text),'' ORDER BY id),'')) FROM {old}),
 'archive_excluding_updated_at_digest',(SELECT md5(COALESCE(string_agg(md5((j-'updated_at')::text),'' ORDER BY id),'')) FROM {old}),
 'current_rows',(SELECT count(*) FROM {current}),
 'original_rows_missing',(SELECT count(*) FROM {old} o WHERE NOT EXISTS (SELECT 1 FROM {current} c WHERE c.id=o.id)),
 'original_rows_changed',(SELECT count(*) FROM {old} o JOIN {current} c USING(id) WHERE o.j IS DISTINCT FROM c.j),
 'original_rows_changed_excluding_updated_at',(SELECT count(*) FROM {old} o JOIN {current} c USING(id) WHERE o.j-'updated_at' IS DISTINCT FROM c.j-'updated_at'),
 'changed_columns',COALESCE((SELECT jsonb_agg(k ORDER BY k) FROM (
   SELECT DISTINCT k FROM {old} o JOIN {current} c USING(id)
   CROSS JOIN LATERAL jsonb_object_keys(o.j||c.j) k WHERE o.j->k IS DISTINCT FROM c.j->k) keys),'[]'::jsonb),
 'added_rows',(SELECT count(*) FROM {added}),
 'additions_created_after_baseline',(SELECT count(*) FROM {added} WHERE (j->>'created_at')::timestamptz>'2026-10-15T16:57:33.410805Z'),
 'additions_created_before_first_publish',(SELECT count(*) FROM {added} WHERE (j->>'created_at')::timestamptz<'2026-10-15T18:06:33Z')
 ) AS report""")
    ctes.append('table_reports AS (' + ' UNION ALL '.join(reports) + ')')
    ctes.append(r"""new_net AS (
 SELECT j->>'bank_account_id' AS bank_id,
 count(*) FILTER (WHERE j->>'amount' IS NULL OR j->>'amount' !~ '^[+-]?[0-9]+([.][0-9]+)?$') AS malformed,
 sum(CASE WHEN j->>'amount' ~ '^[+-]?[0-9]+([.][0-9]+)?$'
 THEN (CASE WHEN j->>'transaction_type' IN ('deposit','refund') THEN 1 ELSE -1 END)*(j->>'amount')::numeric END) AS net
 FROM added_bank_transactions GROUP BY j->>'bank_account_id'
), balance_deltas AS (
 SELECT CASE WHEN o.j->>'current_balance' ~ '^[+-]?[0-9]+([.][0-9]+)?$'
 AND c.j->>'current_balance' ~ '^[+-]?[0-9]+([.][0-9]+)?$' AND COALESCE(n.malformed,0)=0
 THEN round((c.j->>'current_balance')::numeric-(o.j->>'current_balance')::numeric-COALESCE(n.net,0),2)=0 ELSE false END AS explained
 FROM old_bank_accounts o JOIN current_bank_accounts c USING(id)
 LEFT JOIN new_net n ON n.bank_id=o.id::text
)""")
    body = "WITH " + ',\n'.join(ctes) + r"""
SELECT jsonb_build_object(
 'read_only',current_setting('transaction_read_only'),
 'tables',(SELECT jsonb_object_agg(table_name,report) FROM table_reports),
 'bank_balance_delta_accounts_checked',(SELECT count(*) FROM balance_deltas),
 'bank_balance_deltas_unexplained',(SELECT count(*) FROM balance_deltas WHERE NOT explained),
 'added_transactions_with_malformed_amounts',(SELECT COALESCE(sum(malformed),0) FROM new_net),
 'new_bill_payments_linked_to_added_transactions',(SELECT count(*) FROM added_bill_payments bp WHERE EXISTS (
   SELECT 1 FROM added_bank_transactions bt WHERE bt.id::text=bp.j->>'bank_transaction_id')),
 'new_bill_payments_with_missing_linked_transaction',(SELECT count(*) FROM added_bill_payments bp
   WHERE bp.j->>'bank_transaction_id' IS NOT NULL AND NOT EXISTS (
     SELECT 1 FROM current_bank_transactions bt WHERE bt.id::text=bp.j->>'bank_transaction_id'))
);
"""
    return "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'; SET LOCAL timezone='UTC'; SET LOCAL search_path=pg_catalog,public;\n" + body + 'ROLLBACK;'


def run():
    os.umask(0o077)
    stage = 'validate-existing-recovery-evidence'
    attempted = False

    def stop(message, **details):
        print(json.dumps(dict(success=False,stage=stage,message=message,database_connection_attempted=attempted,production_writes_performed=False,restore_performed=False,**details),indent=2))
        raise SystemExit(1)

    def require(ok, message):
        if not ok:
            stop(message)

    try:
        baseline = json.loads((ROOT/'preservation-preflight.json').read_text())
        rows = sorted(baseline['preflight']['financial_fingerprints'],key=lambda r:r['table_name'])
        require(baseline.get('production_target_fingerprint') == TARGET, 'Saved production identity differs.')
        require(hashlib.sha256(json.dumps(rows,sort_keys=True,separators=(',',':')).encode()).hexdigest() == BASELINE, 'Saved financial baseline differs.')
        archive = ROOT/'expedition-production.dump'
        require(not archive.is_symlink(), 'Archive is a symbolic link.')
        with archive.open('rb') as stream:
            require(hashlib.file_digest(stream,'sha256').hexdigest() == ARCHIVE, 'Archive checksum differs.')
        require(all(shutil.which(tool) for tool in ('psql','pg_restore')), 'Required PostgreSQL client unavailable.')
        stage = 'decode-existing-archive-in-memory'
        clean_env = {k:v for k,v in os.environ.items() if not k.startswith('PG') and k not in ('DATABASE_URL','NEON_DATABASE_URL')}
        snapshots = {}
        for table in TABLES:
            # --file=- and no --dbname: output only; no database restore or connection.
            p = subprocess.run(['pg_restore','--data-only','--no-owner','--no-privileges','--schema=public','--table='+table,'--file=-',str(archive)],env=clean_env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120)
            require(p.returncode == 0 and not p.stderr.strip(), 'Archive decoding failed; raw contents/errors withheld.')
            snapshots[table] = parse_copy(p.stdout.decode('utf-8'),table)
        stage = 'hidden-production-input'
        import termios
        fd = os.open('/dev/tty',os.O_RDWR)
        try:
            termios.tcgetattr(fd)
        finally:
            os.close(fd)
        raw = ''
        while not raw:
            raw = getpass.getpass('Verified FULL production connection URL (hidden), then Enter: ').strip()
            if not raw:
                print('Still waiting for connection input. Pasted characters stay hidden. Ctrl+C cancels.')
        stage = 'validate-production-target'
        u = urllib.parse.urlsplit(raw)
        require(u.scheme in ('postgres','postgresql') and u.hostname and u.username and u.password is not None and u.path.strip('/'), 'Invalid full production connection format.')
        target = (u.hostname.lower().replace('-pooler.','.'),u.port or 5432,urllib.parse.unquote(u.path))
        require(hashlib.sha256(json.dumps(target).encode()).hexdigest() == TARGET, 'Production target mismatch; no connection made.')
        options = {'sslmode':'PGSSLMODE','channel_binding':'PGCHANNELBINDING','sslrootcert':'PGSSLROOTCERT','sslcert':'PGSSLCERT','sslkey':'PGSSLKEY','sslcrl':'PGSSLCRL','sslcrldir':'PGSSLCRLDIR','connect_timeout':'PGCONNECT_TIMEOUT','options':'PGOPTIONS','application_name':'PGAPPNAME'}
        parameters = dict(urllib.parse.parse_qsl(u.query,keep_blank_values=True))
        require(not(set(parameters)-set(options)), 'Unsupported connection option; no connection made.')
        env = dict(clean_env,PGHOST=u.hostname,PGPORT=str(u.port or 5432),PGDATABASE=urllib.parse.unquote(u.path.lstrip('/')),PGUSER=urllib.parse.unquote(u.username),PGPASSWORD=urllib.parse.unquote(u.password),PGCONNECT_TIMEOUT='15')
        for k,v in parameters.items():
            env[options[k]] = v
        env['PGOPTIONS'] = env.get('PGOPTIONS','')+' -c default_transaction_read_only=on -c timezone=UTC'
        env['PGAPPNAME'] = 'expedition_readonly_bank_preservation_diagnosis'
        stage = 'read-only-original-row-comparison'
        attempted = True
        p = subprocess.run(['psql','--no-psqlrc','--no-password','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],env=env,input=build_sql(snapshots).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120)
        if p.returncode or p.stderr.strip():
            match = re.search(rb'(?:ERROR|FATAL|PANIC):\s+([0-9A-Z]{5}):',p.stderr)
            stop('Read-only query failed or warned; raw errors withheld.',exit_code=p.returncode,sqlstate=match.group(1).decode() if match else None)
        report = json.loads(p.stdout.decode().strip())
        require(report.get('read_only') == 'on', 'Read-only transaction not confirmed.')
        stage = 'validate-archive-against-prepublish-baseline'
        prior = {r['table_name']:r for r in rows}
        for table in TABLES:
            old, data = prior[table], report['tables'][table]
            key = 'excluding_updated_at_digest' if table == 'bank_accounts' else 'all_columns_digest'
            require(data['archive_rows'] == old['row_count'] and data['archive_'+key] == old[key], 'Decoded archive does not match the saved baseline for '+table+'; no conclusion about original rows.')
        originals_unchanged = all(report['tables'][t]['original_rows_missing'] == 0 and report['tables'][t]['original_rows_changed'] == 0 for t in ('bank_transactions','bill_payments'))
        bank = report['tables']['bank_accounts']
        balances_explained = originals_unchanged and bank['original_rows_missing'] == 0 and bank['added_rows'] == 0 and set(bank['changed_columns']) <= {'current_balance','updated_at'} and report['bank_balance_delta_accounts_checked'] == bank['archive_rows'] and report['bank_balance_deltas_unexplained'] == 0 and report['added_transactions_with_malformed_amounts'] == 0
        result = dict(success=True,archive_business_rows_match_saved_baseline=True,original_bank_transactions_and_bill_payments_unchanged=originals_unchanged,bank_changes_explained_only_by_added_transactions_and_timestamps=balances_explained,comparison=report,production_target_fingerprint=TARGET,financial_baseline_sha256=BASELINE,verified_archive_sha256=ARCHIVE,production_writes_performed=False,restore_performed=False,publishing_performed=False,activity_attribution='unconfirmed; user reports no known relevant activity')
    except SystemExit:
        raise
    except Exception:
        stop('This stage failed; private archive data and raw errors withheld.')
    stage = 'preserve-and-inspect-hosted-source'
    try:
        def git(*args):
            p = subprocess.run(['git','-c','core.hooksPath=/dev/null',*args],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=90)
            if p.returncode:
                raise RuntimeError()
            return p.stdout.strip()
        remote = urllib.parse.urlsplit(git('config','--get','remote.origin.url'))
        if remote.hostname != 'github.com' or remote.path.removesuffix('.git') != '/synccosYB/expeditiongroup':
            raise RuntimeError()
        head = git('rev-parse','HEAD')
        backup = 'codex/backup-production-20261015-'+head[:12]
        exists = subprocess.run(['git','show-ref','--verify','--quiet','refs/heads/'+backup]).returncode == 0
        if exists:
            if git('rev-parse',backup) != head:
                raise RuntimeError()
        else:
            git('branch',backup,head)
        git('fetch','origin','main')
        metadata = git('show','--no-patch','--format=%H%n%P%n%s%n%cI','HEAD').splitlines()
        result['hosted_source'] = dict(success=True,head=head,parents=metadata[1].split(),subject_is_replit_publish=metadata[2].casefold()=='published your app',commit_time=metadata[3],fresh_origin_main=git('rev-parse','origin/main'),backup_branch=backup,checkout_clean=not bool(git('status','--porcelain')),divergence_head_vs_main=git('rev-list','--left-right','--count','HEAD...origin/main').split(),different_paths_from_main=git('diff','--name-status','origin/main','HEAD').splitlines(),source_paths_differing_from_original_release=git('diff','--name-only','5a8d1814934f6719eda1581287f5b220a6839156','HEAD').splitlines(),checkout_switched=False)
    except Exception:
        result['hosted_source'] = dict(success=False,message='Hosted source inspection/preservation failed; raw authentication errors withheld.',checkout_switched=False)
    now = datetime.datetime.now(datetime.timezone.utc)
    result['verified_at_utc'] = now.isoformat()
    try:
        (ROOT/('bank-preservation-diagnosis-'+now.strftime('%Y%m%dT%H%M%SZ')+'.json')).write_text(json.dumps(result,indent=2))
        result['report_saved'] = True
    except Exception:
        result['report_saved'] = False
    print(json.dumps(result,indent=2))


if __name__ == '__main__':
    run()
