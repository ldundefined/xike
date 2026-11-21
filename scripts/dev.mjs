import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { build } from 'esbuild';
import electron from 'electron';
await build({ entryPoints: ['src/main/main.ts', 'src/preload/preload.ts'], outdir: 'dist',
  outbase: 'src', bundle: true, platform: 'node', format: 'cjs',
  outExtension: { '.js': '.cjs' }, external: ['electron', 'koffi'], target: 'node24' });
const server = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: true } });
await server.listen();
const env = { ...process.env, XIKE_DEV_URL: 'http://127.0.0.1:5173' };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.'], { stdio: 'inherit', env });
child.on('exit', async (code) => { await server.close(); process.exit(code ?? 0); });
process.on('SIGINT', () => child.kill());
