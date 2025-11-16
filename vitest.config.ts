import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import path from 'path';

const env = loadEnv('test', process.cwd(), '');

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'shared'),
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'overlays/**/*.{test,spec}.{js,ts}',
      'tests/**/*.{test,spec}.{js,ts}',
    ],
    env: {
      FIXTURE_DIR: path.resolve(__dirname, 'tests', 'fixtures'),
      ...env
    },
  },
})