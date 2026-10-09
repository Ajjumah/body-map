// Copies the standalone Tickbox Tracker (plain static files) into dist/tickbox/
// so the Pages deploy serves it at /<repo>/tickbox/.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';

const skip = new Set(['tests', 'package.json', 'README.md']);
mkdirSync('dist/tickbox', { recursive: true });
for (const name of readdirSync('tickbox')) {
  if (!skip.has(name)) cpSync(`tickbox/${name}`, `dist/tickbox/${name}`, { recursive: true });
}
