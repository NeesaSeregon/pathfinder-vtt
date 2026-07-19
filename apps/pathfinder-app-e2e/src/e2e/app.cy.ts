describe('autenticación', () => {
  it('sin sesión, /personajes redirige a /entrar', () => {
    cy.visit('/personajes');
    cy.location('pathname').should('eq', '/entrar');
    cy.get('h1').contains('Iniciar sesión');
  });

  it('registro por la interfaz: crea cuenta, entra y puede salir', () => {
    const sufijo = Date.now();
    cy.visit('/registro');
    cy.get('input[name="usuario"]').type(`tester-${sufijo}`);
    cy.get('input[name="email"]').type(`tester-${sufijo}@mesa.es`);
    cy.get('input[name="password"]').type('contraseña-larga');
    cy.get('input[name="password2"]').type('contraseña-larga');
    cy.contains('button', 'Crear cuenta').click();

    // Registrarse deja dentro: aterriza en personajes con su nombre arriba
    cy.get('h1').contains('Personajes');
    cy.get('.navbar__usuario').should('contain', `tester-${sufijo}`);

    cy.contains('button', 'Salir').click();
    cy.contains('a', 'Iniciar sesión');
  });

  it('el login rechaza una contraseña incorrecta explicando el motivo', () => {
    cy.login('tester-fijo', 'tester-fijo@mesa.es', 'contraseña-larga');
    cy.visit('/entrar');
    cy.get('input[name="email"]').type('tester-fijo@mesa.es');
    cy.get('input[name="password"]').type('equivocada-aposta');
    cy.contains('button', 'Entrar').click();
    cy.get('.acceso__error').should('contain', 'incorrectos');
  });
});

describe('partidas', () => {
  it('crear una mesa, encontrarla por nombre y unirse con un personaje', () => {
    const nombre = `Mesa-${Date.now()}`;
    cy.login('tester-fijo', 'tester-fijo@mesa.es', 'contraseña-larga');

    // Un personaje con PG para comprobar el estado de sesión inicial
    cy.request('POST', '/api/characters', {
      name: `Heroe-${Date.now()}`,
      level: 3,
      sheetData: { pg: { total: 31 } },
    });

    // El máster crea la mesa y recibe su código de invitación
    cy.visit('/partidas/crear');
    cy.get('input[name="nombre"]').type(nombre);
    cy.contains('button', 'Crear partida').click();
    cy.get('.partida__codigo')
      .invoke('text')
      .should('match', /^[A-HJ-KM-NP-Z2-9]{6}$/);

    // El jugador la encuentra por nombre y se une con su personaje
    cy.visit('/partidas/buscar');
    cy.get('input[name="busqueda"]').type(nombre);
    cy.contains('button', 'Buscar').click();
    cy.contains('.partida__resultados li', nombre).should(
      'contain',
      '0 personajes',
    );

    cy.get('select[name="personaje"]').select(1); // el primero de la lista
    cy.contains('.partida__resultados li', nombre)
      .contains('button', 'Unirse')
      .click();
    cy.get('.partida__exito').should('contain', nombre);
    cy.contains('.partida__resultados li', nombre).should(
      'contain',
      '1 personaje',
    );

    // Entrar a la mesa: el personaje espera en el banquillo con sus PG
    cy.contains('.partida__resultados li', nombre)
      .contains('a', 'Entrar')
      .click();
    cy.get('h1').should('contain', nombre);
    cy.get('.tablero__banquillo').should('exist');
    cy.get('.mesa__pg input').should('have.value', '31');

    // Colocar el token: clic en el token del banquillo + clic en casilla
    cy.get('.tablero__banquillo .tablero__token').click();
    cy.get('.tablero__celda').first().click();
    cy.get('.tablero__banquillo').should('not.exist');
    cy.get('.tablero .tablero__token').should('exist');

    // El máster ajusta los PG tras un golpe
    cy.get('.mesa__pg input').clear();
    cy.get('.mesa__pg input').type('24');
    cy.get('.mesa__pg input').blur();

    // Recarga: posición y PG vienen de PostgreSQL, no de la memoria
    cy.reload();
    cy.get('.tablero .tablero__token').should('exist');
    cy.get('.tablero__banquillo').should('not.exist');
    cy.get('.mesa__pg input').should('have.value', '24');

    // TIEMPO REAL: un cambio hecho "desde fuera" (cy.request simula a
    // otro jugador) aparece en pantalla SIN recargar, empujado por el socket
    cy.location('pathname').then((ruta) => {
      const partidaId = ruta.split('/').pop();
      cy.get('.mesa__pg input')
        .invoke('attr', 'data-pep')
        .then((pepId) => {
          cy.request(
            'PATCH',
            `/api/partidas/${partidaId}/personajes/${pepId}`,
            { pgActuales: 7, condiciones: ['aturdido'] },
          );
        });
    });
    cy.get('.mesa__pg input').should('have.value', '7');
    // La condición estructurada aparece con su nombre y su efecto (−2 CA)
    cy.get('.mesa__condiciones').should('contain', 'Aturdido');
    cy.get('.mesa__cond').should('contain', 'CA');
    // SISTEMA DE EFECTOS: aturdido baja la CA (base 10 → 8) en tiempo real
    cy.get('.mesa__personaje').should('contain', 'CA 8');
    cy.get('.mesa__personaje').should('contain', 'base 10');

    // Reparto de columnas: las fichas a la izquierda, el turno a la derecha
    cy.get('.mesa__panel--personajes .mesa__personaje').should('exist');
    cy.get('.mesa__panel--juego .mesa__combate').should('exist');
    cy.get('.mesa__panel--juego .mesa__dados').should('exist');
    cy.get('.mesa__panel--juego .mesa__personaje').should('not.exist');
  });

  it('en escritorio la mesa ocupa el monitor: columnas a los extremos', () => {
    cy.viewport(1920, 1080);
    cy.login('tester-fijo', 'tester-fijo@mesa.es', 'contraseña-larga');
    cy.request('POST', '/api/partidas', { nombre: `Ancho-${Date.now()}` }).then(
      (res) => {
        cy.visit(`/partidas/${res.body.id}`);

        // La columna izquierda arranca pegada al borde (solo el padding)
        cy.get('.mesa__panel--personajes').then(($izq) => {
          expect($izq[0].getBoundingClientRect().left).to.be.lessThan(30);
        });
        // Y la derecha termina pegada al otro extremo
        cy.get('.mesa__panel--juego').then(($der) => {
          expect(1920 - $der[0].getBoundingClientRect().right).to.be.lessThan(30);
        });

        // El tablero queda centrado entre ambas: márgenes similares
        cy.get('.tablero').then(($t) => {
          const caja = $t[0].getBoundingClientRect();
          const izquierda = caja.left;
          const derecha = 1920 - caja.right;
          expect(Math.abs(izquierda - derecha)).to.be.lessThan(40);
        });
      },
    );
  });

  it('un participante tira los dados y el total aparece en el registro', () => {
    cy.login('tester-fijo', 'tester-fijo@mesa.es', 'contraseña-larga');
    // El máster de la mesa ya es participante: puede tirar sin unir ficha
    cy.request('POST', '/api/partidas', { nombre: `Dados-${Date.now()}` })
      .its('body.id')
      .then((id) => {
        cy.visit(`/partidas/${id}`);
        // 2d1+3 siempre suma 5: assert determinista sin depender del azar
        cy.get('.mesa__dados-libre input').type('2d1+3');
        cy.get('.mesa__dados-libre').contains('button', 'Tirar').click();
        cy.get('.mesa__tiradas')
          .should('contain', '2d1+3')
          .and('contain', 'tester-fijo');
        cy.get('.mesa__tirada-total').first().should('contain', '5');
      });
  });

  it('el máster consulta la ficha completa de un personaje de su mesa', () => {
    cy.login('tester-fijo', 'tester-fijo@mesa.es', 'contraseña-larga');
    // Ficha con datos reconocibles para comprobar que se abre completa
    cy.request('POST', '/api/characters', {
      name: `Ficha-${Date.now()}`,
      level: 4,
      sheetData: { clase: 'Explorador', pg: { total: 28 } },
    })
      .its('body.id')
      .then((characterId) => {
        cy.request('POST', '/api/partidas', { nombre: `VerFicha-${Date.now()}` })
          .its('body.id')
          .then((partidaId) => {
            cy.request('POST', `/api/partidas/${partidaId}/personajes`, {
              characterId,
            });
            cy.visit(`/partidas/${partidaId}`);
            cy.get('.mesa__personaje')
              .contains('button', 'Ver ficha')
              .click();
            cy.get('.mesa__modal')
              .should('contain', 'Explorador')
              .and('contain', 'PG 28');
          });
      });
  });

  it('el máster lleva el rastreador de iniciativa y turnos', () => {
    cy.login('tester-fijo', 'tester-fijo@mesa.es', 'contraseña-larga');
    cy.request('POST', '/api/characters', {
      name: `Comb-${Date.now()}`,
      level: 3,
      sheetData: {},
    })
      .its('body.id')
      .then((characterId) => {
        cy.request('POST', '/api/partidas', { nombre: `Combate-${Date.now()}` })
          .its('body.id')
          .then((partidaId) => {
            cy.request('POST', `/api/partidas/${partidaId}/personajes`, {
              characterId,
            })
              .its('body.id')
              .then((pepId) => {
                // Fijamos la iniciativa por API: el flujo de turnos es determinista
                cy.request(
                  'PATCH',
                  `/api/partidas/${partidaId}/personajes/${pepId}`,
                  { iniciativa: 15 },
                );
                cy.visit(`/partidas/${partidaId}`);

                cy.contains('button', 'Iniciar combate').click();
                cy.get('.mesa__ronda').should('contain', 'Ronda 1');
                cy.get('.mesa__orden--turno').should('contain', 'Comb-');

                // Un solo combatiente: al pasar turno se da la vuelta → ronda 2
                cy.contains('button', 'Siguiente turno').click();
                cy.get('.mesa__ronda').should('contain', 'Ronda 2');

                cy.contains('button', 'Terminar combate').click();
                cy.get('.mesa__combate').should('contain', 'Sin combate activo');
              });
          });
      });
  });

  it('arrastrar un token del banquillo lo coloca en la casilla destino', () => {
    cy.login('tester-fijo', 'tester-fijo@mesa.es', 'contraseña-larga');
    cy.request('POST', '/api/characters', {
      name: `Arrastre-${Date.now()}`,
      level: 1,
      sheetData: {},
    })
      .its('body.id')
      .then((characterId) => {
        cy.request('POST', '/api/partidas', {
          nombre: `Arrastre-${Date.now()}`,
        })
          .its('body.id')
          .then((partidaId) => {
            cy.request('POST', `/api/partidas/${partidaId}/personajes`, {
              characterId,
            });
            cy.visit(`/partidas/${partidaId}`);

            cy.get('.tablero__banquillo .tablero__token').trigger('dragstart');
            cy.get('.tablero__celda').eq(0).trigger('drop');

            // Ya no está en el banquillo: está sobre el tablero
            cy.get('.tablero__banquillo').should('not.exist');
            cy.get('.tablero .tablero__token').should('exist');
          });
      });
  });

  it('el máster sube un mapa de fondo al tablero y puede quitarlo', () => {
    cy.login('tester-fijo', 'tester-fijo@mesa.es', 'contraseña-larga');
    cy.request('POST', '/api/partidas', { nombre: `Mapa-${Date.now()}` })
      .its('body.id')
      .then((partidaId) => {
        cy.visit(`/partidas/${partidaId}`);
        cy.fixture('mapa.png', 'base64').then((base64) => {
          cy.get('input[name="mapa"]').selectFile(
            {
              contents: Cypress.Buffer.from(base64, 'base64'),
              fileName: 'mapa.png',
              mimeType: 'image/png',
            },
            { force: true },
          );
        });
        cy.get('.tablero').should('have.class', 'tablero--con-mapa');

        cy.contains('button', 'Quitar mapa').click();
        cy.get('.tablero').should('not.have.class', 'tablero--con-mapa');
      });
  });

  it('un personaje Grande ocupa 2×2 y no cabe pegado al borde', () => {
    cy.login('tester-fijo', 'tester-fijo@mesa.es', 'contraseña-larga');
    cy.request('POST', '/api/characters', {
      name: `Ogro-${Date.now()}`,
      level: 5,
      sheetData: { tamano: 'grande' },
    })
      .its('body.id')
      .then((characterId) => {
        cy.request('POST', '/api/partidas', { nombre: `Grande-${Date.now()}` })
          .its('body.id')
          .then((partidaId) => {
            cy.request('POST', `/api/partidas/${partidaId}/personajes`, {
              characterId,
            })
              .its('body.id')
              .then((pepId) => {
                const url = `/api/partidas/${partidaId}/personajes/${pepId}`;
                // En x=19 su huella 2×2 se saldría del tablero (ancho 20)
                cy.request({
                  method: 'PATCH',
                  url,
                  body: { posX: 19, posY: 5 },
                  failOnStatusCode: false,
                })
                  .its('status')
                  .should('eq', 400);

                // Donde cabe, el token declara su huella de 2 casillas
                cy.request('PATCH', url, { posX: 2, posY: 2 });
                cy.visit(`/partidas/${partidaId}`);
                cy.get('.tablero .tablero__token').should(
                  'have.attr',
                  'data-casillas',
                  '2',
                );
              });
          });
      });
  });

  it('añade y quita una condición estructurada del catálogo', () => {
    cy.login('tester-fijo', 'tester-fijo@mesa.es', 'contraseña-larga');
    cy.request('POST', '/api/characters', {
      name: `Cond-${Date.now()}`,
      level: 1,
      sheetData: {},
    })
      .its('body.id')
      .then((characterId) => {
        cy.request('POST', '/api/partidas', { nombre: `Cond-${Date.now()}` })
          .its('body.id')
          .then((partidaId) => {
            cy.request('POST', `/api/partidas/${partidaId}/personajes`, {
              characterId,
            });
            cy.visit(`/partidas/${partidaId}`);

            // Añadir "Enredado" desde el desplegable → aparece con su efecto
            cy.get('.mesa__cond-anadir').select('enredado');
            cy.get('.mesa__cond')
              .should('contain', 'Enredado')
              .and('contain', 'media velocidad');

            // Quitarla con la ✕ → vuelve a "Ninguna"
            cy.get('.mesa__cond').contains('button', '✕').click();
            cy.get('.mesa__condiciones').should('contain', 'Ninguna');
          });
      });
  });
});

describe('home y navegación', () => {
  it('sin sesión la home enseña la portada con sus accesos', () => {
    cy.visit('/');
    cy.get('.home__tarjeta').should('have.length', 3);
    cy.contains('a', 'Iniciar sesión');
    cy.contains('.escritorio').should('not.exist');
  });

  it('con sesión la home es el escritorio: tus mesas y unirse al lado', () => {
    const nombre = `Escritorio-${Date.now()}`;
    cy.login('tester-fijo', 'tester-fijo@mesa.es', 'contraseña-larga');

    // Una mesa propia para que el escritorio tenga algo que enseñar
    cy.request('POST', '/api/partidas', { nombre });

    cy.visit('/');
    cy.contains('.escritorio__saludo', 'tester-fijo');
    cy.contains('.mesa-tarjeta', nombre).should('contain', 'diriges');
    // El panel de unirse vive aquí mismo, no hay que ir a otra página
    cy.get('.escritorio input[name="busqueda"]').should('exist');

    // Y desde la tarjeta se entra a la mesa de un clic
    cy.contains('.mesa-tarjeta', nombre).contains('a', 'Entrar').click();
    cy.location('pathname').should('match', /^\/partidas\//);
  });

  it('el escritorio distingue las mesas que diriges de aquellas en que juegas', () => {
    const sufijo = Date.now();
    const nombre = `Ajena-${sufijo}`;

    // Otro usuario crea la mesa y comparte su código
    cy.login(`master-${sufijo}`, `master-${sufijo}@mesa.es`, 'contraseña-larga');
    cy.request('POST', '/api/partidas', { nombre }).then((res) => {
      const partidaId = res.body.id;

      // Ahora entra el jugador, con su personaje, y se sienta en ella
      cy.login(`jugador-${sufijo}`, `jugador-${sufijo}@mesa.es`, 'contraseña-larga');
      cy.request('POST', '/api/characters', {
        name: `Valeros-${sufijo}`,
        level: 1,
        sheetData: {},
      }).then((personaje) => {
        cy.request('POST', `/api/partidas/${partidaId}/personajes`, {
          characterId: personaje.body.id,
        });
      });

      cy.visit('/');
      // No la dirige: el escritorio dice con qué personaje se sienta
      cy.contains('.mesa-tarjeta', nombre).should(
        'contain',
        `juegas con Valeros-${sufijo}`,
      );
      // Y no ve el código de invitación, que es cosa del máster
      cy.contains('.mesa-tarjeta', nombre).should('not.contain', 'código');
    });
  });

  it('desde el escritorio se llega a la cuenta y se cierra sesión', () => {
    cy.login('tester-fijo', 'tester-fijo@mesa.es', 'contraseña-larga');
    cy.visit('/');

    cy.contains('.escritorio__saludo', 'tester-fijo');
    cy.get('.escritorio__accesos').contains('a', 'Tu cuenta').click();

    cy.location('pathname').should('eq', '/cuenta');
    cy.contains('tester-fijo@mesa.es');

    cy.contains('button', 'Cerrar sesión').click();
    cy.location('pathname').should('eq', '/');
    cy.contains('a', 'Iniciar sesión');
  });

  it('cambiar la contraseña: la nueva entra y la vieja deja de valer', () => {
    // Cuenta de usar y tirar: este test le cambia las credenciales
    const sufijo = Date.now();
    const email = `cambio-${sufijo}@mesa.es`;
    cy.login(`cambio-${sufijo}`, email, 'contraseña-larga');
    cy.visit('/cuenta');

    cy.contains('button', 'Cambiar contraseña').click();
    cy.get('input[name="passwordActual"]').type('contraseña-larga');
    cy.get('input[name="passwordNueva"]').type('contraseña-nueva-2');
    cy.get('input[name="passwordRepetida"]').type('contraseña-nueva-2');
    cy.contains('button', 'Guardar').click();
    cy.contains('Contraseña cambiada');

    // La vieja ya no vale...
    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: { email, password: 'contraseña-larga' },
      failOnStatusCode: false,
    })
      .its('status')
      .should('eq', 401);

    // ...y la nueva sí
    cy.request('POST', '/api/auth/login', {
      email,
      password: 'contraseña-nueva-2',
    })
      .its('status')
      .should('eq', 200);
  });

  it('borrar la cuenta pide la contraseña y la deja inservible', () => {
    // Cuenta de usar y tirar: este test la destruye a propósito
    const sufijo = Date.now();
    const email = `adios-${sufijo}@mesa.es`;
    cy.login(`adios-${sufijo}`, email, 'contraseña-larga');
    cy.visit('/cuenta');

    cy.contains('button', 'Quiero borrar mi cuenta').click();
    // Con la contraseña equivocada no se borra nada
    cy.get('input[name="password"]').type('equivocada-aposta');
    cy.contains('button', 'Borrar definitivamente').click();
    cy.get('.cuenta__error').should('contain', 'contraseña');
    cy.location('pathname').should('eq', '/cuenta');

    cy.get('input[name="password"]').clear();
    cy.get('input[name="password"]').type('contraseña-larga');
    cy.contains('button', 'Borrar definitivamente').click();

    // Fuera: vuelve a la home sin sesión
    cy.location('pathname').should('eq', '/');
    cy.contains('a', 'Iniciar sesión');

    // Y la cuenta ya no existe: no se puede volver a entrar con ella
    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: { email, password: 'contraseña-larga' },
      failOnStatusCode: false,
    })
      .its('status')
      .should('eq', 401);
  });

  it('el menú Partidas de la navbar lleva a las maquetas', () => {
    cy.login('tester-fijo', 'tester-fijo@mesa.es', 'contraseña-larga');
    cy.visit('/');
    cy.contains('summary', 'Partidas').click();
    cy.contains('a', 'Buscar partida').click();
    cy.get('h1').contains('Buscar partida');
  });
});

describe('pathfinder-app-e2e', () => {
  beforeEach(() => {
    cy.login('tester-fijo', 'tester-fijo@mesa.es', 'contraseña-larga');
    cy.visit('/personajes');
  });

  it('should display the characters page', () => {
    cy.get('h1').contains('Personajes');
  });

  it('should create, view, edit and delete a character', () => {
    const name = `Cypress-${Date.now()}`;

    // El alta vive en una modal, tras el botón "Nuevo personaje"
    cy.contains('button', 'Nuevo personaje').click();

    // Alta con varios campos de ficha (sección "Datos" abierta por defecto)
    cy.get('input[name="name"]').type(name);
    cy.get('input[name="jugador"]').type('Luis');
    cy.get('select[name="clase"]').select('Pícaro');
    cy.get('select[name="alineamiento"]').select('legal bueno');
    cy.get('select[name="tamano"]').select('Mediano');
    cy.get('select[name="raza"]').select('Elfo');
    cy.get('input[name="level"]').clear();
    cy.get('input[name="level"]').type('7');

    // Atributos: el modificador se calcula en vivo al escribir
    cy.contains('summary', 'Atributos').click();
    cy.get('input[name="fuerza-puntuacion"]').type('18');
    cy.get('.character-form__atributos-grid').should('contain', '+4');
    // Fuerza de toro: ajuste +4 → efectiva 22 → modif. temporal +6
    cy.get('input[name="fuerza-ajuste"]').type('4');
    cy.get('input[name="destreza-puntuacion"]').type('9');

    // Combate con Des final 11 (9 base +2 de elfo → mod +0):
    // CA = 10+5+2+0 = 17; toque 10; desprevenido 17; iniciativa 0+2 = +2
    cy.contains('summary', 'Combate').click();
    cy.get('input[name="ca-bonif-armadura"]').type('5');
    cy.get('input[name="ca-bonif-escudo"]').type('2');
    cy.get('input[name="iniciativa-vario"]').type('2');
    cy.contains('.character-form__formula-total', 'CA').should('contain', '17');
    cy.contains('.character-form__formula-total', 'Toque').should(
      'contain',
      '10',
    );
    cy.contains('.character-form__formula-total', 'Desprevenido').should(
      'contain',
      '17',
    );
    cy.contains('.character-form__formula-total', 'Iniciativa').should(
      'contain',
      '+2',
    );

    // Velocidad: 30 pies → 6 casillas / 9 m, derivado en vivo
    cy.contains('summary', 'Velocidad').click();
    cy.get('input[name="velocidad-base"]').type('30');
    cy.get('.character-form__velocidad').should('contain', '6 cas. / 9 m');

    // Puntos de golpe y reducción de daño
    cy.contains('summary', 'Puntos de golpe').click();
    cy.get('input[name="pg-total"]').type('45');
    cy.get('input[name="pg-rd"]').type('5/hierro frío');

    // Salvaciones: Reflejos base 4 + (+0 de Des final 11) = +4, en vivo
    cy.contains('summary', 'Tiradas de salvación').click();
    cy.get('input[name="reflejos-base"]').type('4');
    cy.contains('.character-form__salvacion-nombre', 'Reflejos').should(
      'contain',
      '+4',
    );

    // Armas: fila dinámica
    cy.contains('summary', 'Armas').click();
    cy.contains('button', 'Añadir arma').click();
    cy.get('input[name="arma0-nombre"]').type('Espada larga');
    cy.get('input[name="arma0-ataque"]').type('+9/+4');
    cy.get('input[name="arma0-dano"]').type('1d8+4');

    // Equipo: con FUE efectiva 22 (fuerza de toro) la carga pesada es 520
    cy.contains('summary', 'Equipo').click();
    cy.contains('button', 'Añadir equipo').click();
    cy.get('input[name="equipo0-nombre"]').type('Mochila');
    cy.get('input[name="equipo0-peso"]').type('2');
    cy.contains('.character-form__formula-total', 'Peso total').should(
      'contain',
      '2',
    );
    cy.get('.character-form__carga').should('contain', '520');

    // Dotes: lista dinámica, como armas y equipo
    cy.contains('summary', 'Dotes y aptitudes especiales').click();
    cy.contains('button', 'Añadir dote').click();
    cy.get('input[name="dote0-nombre"]').type('Soltura con el arma');
    cy.get('input[name="dote0-descripcion"]').type('+1 ataque con el arma elegida');
    cy.contains('button', 'Añadir dote').click();
    cy.get('input[name="dote1-nombre"]').type('Esquiva');

    // Conjuros: INT 16 base (+2 de elfo → 18, +4) como atributo de lanzamiento
    cy.get('input[name="inteligencia-puntuacion"]').type('16');
    cy.contains('summary', 'Conjuros').click();
    cy.get('select[name="atributo-lanzamiento"]').select('Inteligencia');
    cy.get('input[name="conjuros1-pordia"]').type('2');
    cy.get('input[name="conjuros1-anotados"]').type('proyectil mágico');

    // Dinero y experiencia con derivados en vivo
    cy.contains('summary', 'Dinero y experiencia').click();
    cy.get('input[name="dinero-po"]').type('12');
    cy.get('input[name="dinero-pp"]').type('30');
    cy.contains('.character-form__formula-fija', 'valor total').should(
      'contain',
      '15 po',
    );
    cy.get('input[name="px-actual"]').type('3400');
    cy.get('input[name="px-siguiente"]').type('5000');
    cy.contains('.character-form__formula-fija', 'faltan').should(
      'contain',
      '1600',
    );

    // Habilidades: Acrobacias 3 rangos + (+0 Des) + 3 de clase = +6
    cy.contains('summary', 'Habilidades').click();
    cy.get('input[name="acrobacias-clase"]').check();
    cy.get('input[name="acrobacias-rangos"]').type('3');
    cy.contains('.character-form__habilidades-grid output', '+6');
    cy.get('input[name="artesania1-especialidad"]').type('Herrería');
    cy.get('input[name="artesania1-rangos"]').type('1');
    cy.get('input[name="idiomas"]').type('común, élfico');

    // Ofensivo: FUE final 22 (+6) → BMC 3+6 = +9; DMC 10+3+6+0 = 19
    cy.contains('summary', 'Ofensivo').click();
    cy.get('input[name="ataque-base"]').type('3');
    cy.contains('.character-form__formula-total', 'BMC').should(
      'contain',
      '+9',
    );
    cy.contains('.character-form__formula-total', 'DMC').should(
      'contain',
      '19',
    );

    cy.get('button[type="submit"]').click();
    cy.contains('li', name).should('contain', 'Nivel 7');

    // Recargamos: lo que se muestre ahora viene de PostgreSQL
    cy.reload();
    cy.contains('li', name).contains('button', 'Ver ficha').click();
    cy.get('.characters__modal').should('contain', 'legal bueno');
    cy.get('.characters__modal').should('contain', 'Elfo');
    cy.get('.characters__modal').should('contain', 'Mediano');

    // Atributos: FUE 18 (+4) con ajuste +4 → modif. temporal +6;
    // Destreza élfica: 9 base +2 racial → +0
    cy.contains('.characters__modal-atributos tr', 'Fuerza')
      .should('contain', '18')
      .should('contain', '+4')
      .should('contain', '+6');
    cy.contains('.characters__modal-atributos tr', 'Destreza')
      .should('contain', '9')
      .should('contain', '+2')
      .should('contain', '+0');

    // Totales de combate derivados de lo guardado, más PG y RD
    cy.get('.characters__modal-combate')
      .should('contain', 'CA 17')
      .should('contain', 'toque 10')
      .should('contain', 'desprevenido 17')
      .should('contain', 'Iniciativa +2')
      .should('contain', 'PG 45')
      .should('contain', 'RD 5/hierro frío');

    // Velocidad guardada en pies, mostrada con sus derivados
    cy.get('.characters__modal-velocidad').should(
      'contain',
      'Base 30 pies (6 cas. / 9 m)',
    );

    // Salvaciones derivadas de lo guardado
    cy.get('.characters__modal').should('contain', 'Reflejos +4');

    // Bloque ofensivo derivado de lo guardado
    cy.get('.characters__modal')
      .should('contain', 'Ataque base +3')
      .should('contain', 'BMC +9')
      .should('contain', 'DMC 19');

    // Habilidades derivadas de lo guardado, con especialidad e idiomas
    // Artesanía es +5: 1 rango + 4 de INT final 18 (16 + 2 de elfo)
    cy.get('.characters__modal')
      .should('contain', 'Acrobacias +6')
      .should('contain', 'Artesanía (Herrería) +5')
      .should('contain', 'Idiomas: común, élfico');

    // El arma guardada como array en el JSONB
    cy.get('.characters__modal-armas')
      .should('contain', 'Espada larga')
      .should('contain', 'ataque +9/+4')
      .should('contain', 'daño 1d8+4');

    // Equipo con carga derivada, y dotes
    cy.get('.characters__modal')
      .should('contain', 'peso total 2')
      .should('contain', 'carga ligera')
      .should('contain', 'Soltura con el arma');

    // Dinero y experiencia derivados de lo guardado
    cy.get('.characters__modal')
      .should('contain', 'total 15 po')
      .should('contain', 'PX 3400 / 5000 (faltan 1600)');

    // Conjuros: CD derivada de INT final 18 (16 + 2 racial) → 10+1+4 = 15
    cy.get('.characters__modal')
      .should('contain', 'Nivel 1: CD 15 · 2/día · +1 adicionales')
      .should('contain', 'proyectil mágico');

    // Edición: cambiamos raza y nivel, el resto no se toca
    cy.get('.characters__modal').contains('button', 'Editar').click();
    cy.get('.characters__modal select[name="raza"]').select('Enano');
    cy.get('.characters__modal input[name="level"]').clear();
    cy.get('.characters__modal input[name="level"]').type('8');
    cy.get('.characters__modal').contains('button', 'Guardar').click();

    // Vuelve al modo vista con los datos nuevos
    cy.get('.characters__modal').should('contain', 'Enano');
    cy.get('.characters__modal').should('contain', 'Nivel 8');

    // Tras recargar, el cambio persiste y los campos NO editados siguen ahí
    cy.reload();
    cy.contains('li', name).contains('button', 'Ver ficha').click();
    cy.get('.characters__modal').should('contain', 'Enano');
    cy.get('.characters__modal').should('contain', 'legal bueno');
    cy.get('.characters__modal').should('contain', 'Luis');

    // Cerrar modal y borrar
    cy.get('.characters__modal header button').click();
    cy.contains('li', name).contains('button', 'Borrar').click();
    cy.contains('li', name).should('not.exist');
  });

  it('avisa antes de descartar cambios sin guardar al cerrar la edición', () => {
    const name = `Guarda-${Date.now()}`;
    cy.request('POST', '/api/characters', { name, level: 1, sheetData: {} });
    cy.visit('/personajes');

    cy.contains('li', name).contains('button', 'Ver ficha').click();
    cy.get('.characters__modal').contains('button', 'Editar').click();
    cy.get('.characters__modal input[name="level"]').clear();
    cy.get('.characters__modal input[name="level"]').type('5');

    // El usuario cancela el aviso → la ventana sigue abierta y no se pierde nada.
    // Clic en el borde izquierdo del fondo (fuera del modal y del navbar).
    cy.on('window:confirm', () => false);
    cy.get('.characters__overlay').click('left');
    cy.get('.characters__modal').should('exist');
    cy.get('.characters__modal input[name="level"]').should('have.value', '5');
  });
});
