/* One cross-platform list of current tests. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),files=fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.test.cjs')).sort().map(n=>'tests/'+n);
if(!files.length)throw Error('No current tests found.');
const result=spawnSync(process.execPath,['--test',...files],{cwd:root,stdio:'inherit'});if(result.error)throw result.error;process.exitCode=result.status??1;
