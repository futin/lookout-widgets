// Builds dist/esm (with .d.ts) and dist/cjs from src/. dist/ is committed: consumers install this package from a git tag, and pnpm blocks a dependency's
// lifecycle scripts by default, so nothing may need building at install time.
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';

const tsc = (project) => execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', project], { stdio: 'inherit' });

rmSync('dist', { recursive: true, force: true });
tsc('tsconfig.esm.json');
tsc('tsconfig.cjs.json');
// The package is "type": "module"; this marker makes Node read dist/cjs/*.js as CommonJS.
writeFileSync('dist/cjs/package.json', '{"type":"commonjs"}\n');
