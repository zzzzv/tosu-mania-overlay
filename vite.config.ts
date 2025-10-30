import { defineConfig, loadEnv, normalizePath } from 'vite';
import path from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import wasm from 'vite-plugin-wasm';

const env = loadEnv('', process.cwd(), '');
if (!env.VITE_OVERLAY) {
  throw new Error('VITE_OVERLAY must be set. Example: VITE_OVERLAY=mania-starrating');
}
const overlayRoot = path.resolve(__dirname, 'src/overlays', env.VITE_OVERLAY);

const outDir = path.resolve(__dirname, env.VITE_OUTPUT_DIR || 'dist', env.VITE_OVERLAY);

export default defineConfig({
  root: overlayRoot,
  base: `/${env.VITE_OVERLAY}/`,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  },
  plugins: [
    {
      name: 'watch-metadata',
      buildStart() {
        this.addWatchFile(path.resolve(overlayRoot, `metadata.txt`));
        this.addWatchFile(path.resolve(overlayRoot, `settings.json`));
      }
    },
    viteStaticCopy({
      targets: [
        {
          src: [
            normalizePath(path.resolve(overlayRoot, `metadata.txt`)),
            normalizePath(path.resolve(overlayRoot, `settings.json`))
          ],
          dest: ''
        }
      ],
    }),
    // wasm(),
  ],
  build: {
    outDir,
    emptyOutDir: true,
    minify: false,
    chunkSizeWarningLimit: 1600,
  },
  // server: {
  //   headers: {
  //     'Cross-Origin-Embedder-Policy': 'require-corp',
  //     'Cross-Origin-Opener-Policy': 'same-origin',
  //   },
  //   fs: {
  //     allow: ['..']
  //   }
  // },
  // optimizeDeps: {
  //   exclude: ['rosu-pp-js', 'xxysr-wasm']
  // },
});