import { build } from 'esbuild';
import { build as viteBuild } from 'vite';
await build({
  entryPoints: ['src/main/main.ts', 'src/preload/preload.ts'],
  outdir: 'dist', outbase: 'src', bundle: true, platform: 'node',
  format: 'cjs', outExtension: { '.js': '.cjs' }, external: ['electron', 'koffi'],
  sourcemap: true, target: 'node24',
});
await viteBuild();
