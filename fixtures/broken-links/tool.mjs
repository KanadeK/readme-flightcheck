const mode = process.argv[2];
if (!['install', 'run', 'test', 'example'].includes(mode ?? '')) {
  console.error('unsupported fixture mode');
  process.exitCode = 2;
} else {
  console.log(JSON.stringify({ mode, status: 'ok' }));
}
