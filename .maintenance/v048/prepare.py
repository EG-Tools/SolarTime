"""One-use, checksum-guarded release preparation on an isolated branch only."""
from pathlib import Path
import hashlib,json,lzma,os,subprocess,sys
root=Path.cwd().resolve()
assert os.environ.get('GITHUB_REF_NAME')=='release/v0.48-camera','Candidate branch required'
folder=root/'.maintenance/v048'
parts=[folder/(str(i)+'.part') for i in range(4)]
packed=b''.join(p.read_bytes() for p in parts)
assert hashlib.sha256(packed).hexdigest()=='da9d76412ac2940d6e30e0cf9eb0cd17d7f67a7ede4721c6b5f8fee38465b9cb','Payload hash mismatch'
rows=json.loads(lzma.decompress(packed));assert len(rows)==28
paths=[r['path'] for r in rows];assert len(set(paths))==len(paths)
allowed={'CHANGELOG.md','index.html','package-lock.json','package.json','version.json'}
for name in paths:
 p=Path(name)
 assert not p.is_absolute() and '..' not in p.parts
 assert name in allowed or name.startswith(('src/','tests/'))
 assert (root/p).resolve().is_relative_to(root)
def digest(b):return hashlib.sha256(b).hexdigest()
if sys.argv[1]=='apply':
 assert json.loads((root/'version.json').read_text())=={'version':'0.47','revision':'r3'}
 prepared=[]
 for row in rows:
  file=root/row['path']
  if row['base'] is None:assert not file.exists(),row['path'];data=b''
  else:data=file.read_bytes();assert digest(data)==row['base'],('Unexpected base',row['path'])
  text=data.decode('utf8');end=0
  for a,b,value in row['ops']:
   assert isinstance(a,int) and isinstance(b,int) and end<=a<=b<=len(text);end=b
  for a,b,value in reversed(row['ops']):text=text[:a]+value+text[b:]
  output=text.encode('utf8');assert digest(output)==row['target'],row['path']
  prepared.append((file,output))
 for file,output in prepared:file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(output)
 print('Applied 28 reviewed files. Main and R2 untouched.')
elif sys.argv[1]=='record':
 for row in rows:assert digest((root/row['path']).read_bytes())==row['target'],('Changed after tests',row['path'])
 proof={'version':'0.48','revision':'r1','sourceBase':'799981e3ed8c35f456f27db09c244640592021ab','sha256':{r['path']:r['target'] for r in rows}}
 (root/'.cloudflare/candidate-verification.json').write_text(json.dumps(proof,indent=2)+'\n')
 temporary=parts+[Path(__file__).resolve(),root/'.github/workflows/v048-candidate.yml']
 for file in temporary:file.unlink()
 subprocess.run(['git','add','--',*paths,*[str(p.relative_to(root)) for p in temporary]],check=True)
 subprocess.run(['git','config','user.name','github-actions[bot]'],check=True)
 subprocess.run(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],check=True)
 subprocess.run(['git','commit','-m','Prepare v0.48: 250x country view and persistent random rotation with continuous manual control'],check=True)
 subprocess.run(['git','push','origin','HEAD:refs/heads/release/v0.48-camera'],check=True)
else:raise ValueError('Expected apply or record')
