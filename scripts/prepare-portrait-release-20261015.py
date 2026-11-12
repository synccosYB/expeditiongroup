"""Prepare the verified portrait-print release without application startup or real DB access."""
import datetime,hashlib,json,os,pathlib,re,subprocess,tempfile,urllib.parse
os.umask(0o077)
expected='da8f5a8923827d4ee3bff74a6027c912109158d1'
previous='c217ddc61d2390dbf8b6bc2d77e04ad2756b7fe9'
root=pathlib.Path('/home/runner/.expedition-production-recovery')
archive=root/'production-20261015-8mept1rg/expedition-production.dump'
report={'success':False,'publishing_performed':False,'application_started':False,'database_operations_performed':False}
stage='verify-checkout-and-existing-backup'
def stop(message):
    report.update(stage=stage,message=message)
    print(json.dumps(report,indent=2))
    raise SystemExit(1)
def git(*args):
    p=subprocess.run(['git','-c','core.hooksPath=/dev/null',*args],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=90)
    if p.returncode: stop('Git check failed; raw authentication errors withheld.')
    return p.stdout.strip()
def digest(path):
    with pathlib.Path(path).open('rb') as f: return hashlib.file_digest(f,'sha256').hexdigest()
try:
    remote=urllib.parse.urlsplit(git('config','--get','remote.origin.url'))
    if remote.hostname!='github.com' or remote.path.removesuffix('.git')!='/synccosYB/expeditiongroup': stop('Wrong repository.')
    if git('status','--porcelain'): stop('Checkout has changes; preserve and inspect them first.')
    head=git('rev-parse','HEAD')
    if head not in (previous,expected): stop('Hosted HEAD changed unexpectedly; inspect it first.')
    if head==previous and git('diff','--name-only','5a8d1814934f6719eda1581287f5b220a6839156',head): stop('Hosted publish source differs from reviewed original release.')
    if archive.is_symlink() or digest(archive)!='85052a87c8095517d484d548b886f6e5a6998640f4487a427a9ba7d2342824d0': stop('Existing backup checksum mismatch.')
    backup='codex/backup-production-20261015-c217ddc61d23'
    if subprocess.run(['git','show-ref','--verify','--quiet','refs/heads/'+backup]).returncode==0:
        if git('rev-parse',backup)!=previous: stop('Backup branch differs; inspect it first.')
    else: git('branch',backup,previous)
    stage='fetch-and-synchronize'
    git('fetch','origin','main')
    if git('rev-parse','origin/main')!=expected: stop('Main advanced; review new changes before proceeding.')
    release_dir=pathlib.Path(tempfile.mkdtemp(prefix='print-release-20261015-',dir=root))
    (release_dir/'pre-sync.replit').write_text(pathlib.Path('.replit').read_text())
    report.update(original_head=head,backup_branch=backup,private_release_directory=str(release_dir))
    if head!=expected: git('switch','--detach',expected)
    env={k:v for k,v in os.environ.items() if not k.startswith('PG') and k not in ('DATABASE_URL','NEON_DATABASE_URL')}
    env['DATABASE_URL']='postgresql://unused:unused@127.0.0.1:1/unused'
    checks={}
    def check(name,args,required=True):
        global stage
        stage=name
        print('Release check: '+name,flush=True)
        p=subprocess.run(args,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=900)
        (release_dir/(name+'.log')).write_text(p.stdout)
        checks[name]={'exit_code':p.returncode}
        if name in ('checkwriter','regression'): checks[name]['summary']=[s for s in p.stdout.splitlines() if re.match(r'^# (tests|pass|fail|skipped) ',s)]
        if name=='typecheck':
            checks[name]['typescript_errors']=len(re.findall(r'error TS\d+:',p.stdout))
            checks[name]['print_file_errors']=len(re.findall(r'^client/src/(?:lib/print(?:Assets|Utils)\.ts|pages/invoice-detail\.tsx)\(',p.stdout,re.M))
        report['checks']=checks
        if required and p.returncode: stop('Required release check failed; do not publish.')
    check('dependencies',['npm','ci'])
    check('checkwriter',['npm','run','test:checks'])
    check('regression',['node','--import','tsx','--test','client/src/lib/printAssets.test.ts','server/__tests__/invoice-validation.test.ts','client/src/components/invoice-compact-items.test.ts','server/__tests__/ai-document-context.test.ts','server/__tests__/pdf-text-quality.test.ts','client/src/lib/task-hierarchy.test.ts'])
    check('build',['npm','run','build'])
    check('typecheck',['npm','run','check'],False)
    if checks['typecheck']['print_file_errors']: stop('Print files have TypeScript errors; do not publish.')
    git('fetch','origin','main')
    if git('rev-parse','origin/main')!=expected: stop('Main advanced during checks; review new changes first.')
    if git('rev-parse','HEAD')!=expected or git('status','--porcelain'): stop('Checkout changed during checks; do not publish.')
    report.update(success=True,final_head=expected,origin_main=git('rev-parse','origin/main'),checkout_clean=True,verified_at_utc=datetime.datetime.now(datetime.timezone.utc).isoformat())
    report['build_artifacts']=[{'path':p,'sha256':digest(p)} for p in ['dist/index.cjs','dist/public/index.html']]
    report['build_assets']=[{'url':u,'sha256':digest('dist/public'+u)} for u in re.findall(r'(?:src|href)="(/assets/[^"?#]+\.(?:js|css))"',pathlib.Path('dist/public/index.html').read_text())]
    (release_dir/'release-verification.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
except SystemExit: raise
except Exception: stop('Release preparation failed; raw errors withheld. Do not publish.')
