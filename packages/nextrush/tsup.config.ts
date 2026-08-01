import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/class.ts', 'src/dev-cli-launcher.ts', 'src/nextjs.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node22',
});
