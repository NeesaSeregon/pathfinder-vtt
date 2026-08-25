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
import { cuentasUsadas } from './commands';

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

/**
 * Barre lo que ha dejado la pasada.
 *
 * Sin esto, cada ejecución dejaba unas dos docenas de mesas, sus asientos y
 * los personajes de los tests tirados en la base de datos de desarrollo: en
 * cinco semanas se juntaron 649 partidas de las que solo 4 eran de verdad, y
 * el escritorio de tester-fijo llegó a pintar 457 tarjetas.
 *
 * Se borra por CUENTA y no mesa a mesa a propósito. Primero porque el
 * ON DELETE CASCADE se lleva de un golpe las partidas, los asientos y los
 * personajes, sin tener que ir apuntando ids por el camino. Y segundo
 * porque borrar hay que hacerlo SIENDO el dueño, y al final de la pasada la
 * sesión abierta es la del último test: hay que volver a entrar en cada
 * cuenta de todos modos.
 *
 * tester-fijo entra en el barrido como las demás. Se llama "fijo" porque se
 * reutiliza DENTRO de una pasada; que la siguiente empiece con la cuenta
 * recién hecha no rompe nada (cy.login la registra otra vez) y de paso hace
 * los tests más deterministas.
 *
 * Nada de esto puede tumbar la suite: si un borrado falla se sigue, porque
 * un fallo limpiando no es un fallo del producto.
 */
after(() => {
  for (const [email, password] of cuentasUsadas()) {
    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: { email, password },
      failOnStatusCode: false,
    }).then((entrada) => {
      if (entrada.status >= 400) {
        return;
      }
      cy.request({
        method: 'DELETE',
        url: '/api/cuenta',
        body: { password },
        failOnStatusCode: false,
      });
    });
  }
});
