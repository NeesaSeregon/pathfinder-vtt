/// <reference types="cypress" />

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Cypress {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Chainable<Subject> {
    /**
     * Crea (o reutiliza) una cuenta vía API. El servidor responde con la
     * cookie httpOnly de sesión y Cypress la guarda solo, como haría el
     * navegador: no hay que tocar nada más.
     */
    login(username: string, email: string, password: string): void;
  }
}

Cypress.Commands.add('login', (username, email, password) => {
  cy.request({
    method: 'POST',
    url: '/api/auth/register',
    body: { username, email, password },
    failOnStatusCode: false, // si ya existe (409), hacemos login
  }).then((respuesta) => {
    if (respuesta.status !== 201) {
      cy.request('POST', '/api/auth/login', { email, password });
    }
  });
});
