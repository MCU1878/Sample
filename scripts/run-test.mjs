// _test-logic.ts を esbuild でバンドルし、実コードの挙動を実行検証する。
import { build } from '../node_modules/esbuild/lib/main.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFileSync, rmSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, '_test-bundle.mjs');
const entry = process.argv[2] ?? '_test-logic.ts';

const res = await build({
  entryPoints: [resolve(__dirname, entry)],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
writeFileSync(out, res.outputFiles[0].text, 'utf8');
try {
  await import(pathToFileURL(out).href);
} finally {
  rmSync(out, { force: true });
}
