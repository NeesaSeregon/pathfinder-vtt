import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // globals: describe/it/expect disponibles sin importarlos
    globals: true,
    // La lib no toca el DOM: entorno node, más rápido que jsdom
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
