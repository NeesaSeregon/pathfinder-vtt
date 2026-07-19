// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.ts using ES2015 syntax:
import './commands';

/**
 * En arranque en frío el front (vite) puede estar listo antes que la API
 * (Nest + TypeORM conectando a Postgres). El primer test que llama a la API
 * fallaría con un error de proxy. Esperamos a que la API responda: mientras
 * no está, el proxy devuelve 5xx; en cuanto vive, /api/auth/me da 401.
 */
function esperarApi(intentos = 40): void {
  cy.request({ url: '/api/auth/me', failOnStatusCode: false }).then((res) => {
    if (res.status >= 500 && intentos > 0) {
      // Backoff legítimo entre sondeos a la API mientras arranca
      // eslint-disable-next-line cypress/no-unnecessary-waiting
      cy.wait(300);
      esperarApi(intentos - 1);
    }
  });
}

before(() => esperarApi());
