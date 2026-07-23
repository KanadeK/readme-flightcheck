import { greeting } from './lib.mjs';

const nameIndex = process.argv.indexOf('--name');
const name = nameIndex >= 0 ? (process.argv[nameIndex + 1] ?? '') : '';

try {
  console.log(JSON.stringify({ message: greeting(name), status: 'ok' }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
