import { access, writeFile } from 'node:fs/promises';

await access(new URL('../package.json', import.meta.url));
await writeFile(new URL('../.flightcheck-installed', import.meta.url), 'verified\n', 'utf8');
console.log('install claim verified');
