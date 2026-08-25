/// <reference types="cypress" />

// OJO con el declare global: este fichero EXPORTA (cuentasUsadas), así que
// para TypeScript es un módulo, y un "declare namespace" suelto dentro de un
// módulo deja de ser global — cy.login desaparecería de los tipos en todos
// los tests. Con declare global vuelve a ampliar el Cypress de verdad.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Chainable<Subject> {
      /**
       * Crea (o reutiliza) una cuenta vía API. El servidor responde con la
       * cookie httpOnly de sesión y Cypress la guarda solo, como haría el
       * navegador: no hay que tocar nada más.
       */
      login(username: string, email: string, password: string): void;
      /**
       * Apunta una cuenta para el barrido final. Hace falta en los dos
       * casos que cy.login no ve: cuando la cuenta se crea por la INTERFAZ
       * (el test de registro) y cuando un test le CAMBIA la contraseña,
       * porque el barrido entra con la que tenga apuntada.
       */
      apuntarCuenta(email: string, password: string): void;
    }
  }
}

/**
 * Las cuentas que ha tocado ESTA pasada, con su contraseña, para poder
 * barrerlas al terminar (ver el after() de e2e.ts). Se apuntan aquí y no en
 * cada test porque cy.login es la ÚNICA puerta: todo lo que crea un test
 * —mesas, personajes, asientos— cuelga de la cuenta que lo creó, así que
 * apuntar la cuenta es apuntarlo todo.
 *
 * OJO con cómo llegan aquí los dos casos que cy.login no ve: van por el
 * COMANDO cy.apuntarCuenta, no importando esta función desde el spec. Si el
 * spec importara este fichero, Cypress lo empaquetaría aparte del de
 * soporte y habría DOS instancias del módulo: cy.login escribiría en un Map
 * y el barrido leería el otro, vacío. Pasó, y la pasada entera se quedó sin
 * limpiar. Un comando se registra una sola vez y no tiene ese problema.
 */
const cuentasDeLaPasada = new Map<string, string>();

export function cuentasUsadas(): [string, string][] {
  return [...cuentasDeLaPasada];
}

Cypress.Commands.add('apuntarCuenta', (email, password) => {
  cuentasDeLaPasada.set(email, password);
});

Cypress.Commands.add('login', (username, email, password) => {
  cuentasDeLaPasada.set(email, password);
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
