import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import path from 'path';

const env = loadEnv('test', process.cwd(), '');

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/**/*.{test,spec}.{js,ts}',
    ],
    env: {
      FIXTURE_DIR: path.resolve(__dirname, 'tests', 'fixtures'),
      ...env
    },
  },
})