import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src'), '@content': path.resolve(__dirname, 'content'), '@data': path.resolve(__dirname, 'public/data') } },
  test: { include: ['tests/unit/**/*.test.ts'], testTimeout: 120000, hookTimeout: 120000 },
});
