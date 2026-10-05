// Refresh spec/openapi.yaml, then generate src/generated/openapi.ts from it.
// Spec source, first that works:
//   1. release asset `openapi.yaml` of montek-io/montek-api at tag $MONTEK_API_TAG (default: latest), via `gh`
//   2. `openapi.yaml` at git ref $MONTEK_API_REF (default origin/develop) of the montek-api clone in
//      $MONTEK_API_DIR (default ../montek-api); run `git fetch` there first. Read from git, not from disk,
//      so whatever branch that checkout is on does not matter.
//   3. the committed spec/openapi.yaml as is
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const spec = 'spec/openapi.yaml';
const tag = process.env.MONTEK_API_TAG;
const apiDir = resolve(process.env.MONTEK_API_DIR ?? '../montek-api');
const apiRef = process.env.MONTEK_API_REF ?? 'origin/develop';

function fromRelease() {
  const args = ['release', 'download', ...(tag ? [tag] : []), '-R', 'montek-io/montek-api',
    '-p', 'openapi.yaml', '-O', spec, '--clobber'];
  try {
    execFileSync('gh', args, { stdio: 'pipe' });
    return true;
  } catch (e) {
    console.warn(`gen: no release asset (${String(e.stderr || e.message).trim()})`);
    return false;
  }
}

function fromGitRef() {
  try {
    writeFileSync(spec, execFileSync('git', ['-C', apiDir, 'show', `${apiRef}:openapi.yaml`], { stdio: 'pipe' }));
    return true;
  } catch (e) {
    console.warn(`gen: no ${apiRef}:openapi.yaml in ${apiDir} (${String(e.stderr || e.message).trim()})`);
    return false;
  }
}

if (fromRelease()) console.log(`gen: spec from montek-api release ${tag ?? 'latest'}`);
else if (fromGitRef()) console.log(`gen: spec from ${apiDir} at ${apiRef}`);
else console.log(`gen: keeping committed ${spec}`);

execFileSync('npx', ['openapi-typescript', spec, '-o', 'src/generated/openapi.ts'], { stdio: 'inherit' });
