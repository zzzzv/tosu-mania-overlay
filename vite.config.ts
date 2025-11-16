import { loadEnv, defineConfig } from 'vite';
import path from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const env = loadEnv('', __dirname, '');
const name = process.env.VITE_OVERLAY_NAME
if (!name) {
  throw new Error('VITE_OVERLAY_NAME is not defined');
}
const root = path.resolve(__dirname, 'overlays', name);
const outDir = path.resolve(__dirname, env.VITE_OUTPUT_DIR || 'dist', name);

export default defineConfig({
  root,
  base: `/${name}/`,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'shared'),
    }
  },
  plugins: [
    {
      name: 'watch-metadata',
      buildStart() {
        this.addWatchFile('metadata.txt');
        this.addWatchFile('settings.json');
      }
    },
    viteStaticCopy({
      targets: [
        {
          src: ['metadata.txt', 'settings.json'],
          dest: ''
        }
      ],
    }),
  ],
  build: {
    outDir,
    emptyOutDir: true,
    minify: false,
    chunkSizeWarningLimit: 1600,
  },
});