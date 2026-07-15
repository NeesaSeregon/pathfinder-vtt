describe('pathfinder-app-e2e', () => {
  beforeEach(() => cy.visit('/'));

  it('should display the characters page', () => {
    cy.get('h1').contains('Personajes');
  });

  it('should create, view, edit and delete a character', () => {
    const name = `Cypress-${Date.now()}`;

    // Alta con varios campos de ficha
    cy.get('input[name="name"]').type(name);
    cy.get('input[name="jugador"]').type('Luis');
    cy.get('input[name="clase"]').type('Pícaro');
    cy.get('select[name="alineamiento"]').select('legal bueno');
    cy.get('select[name="tamano"]').select('Mediano');
    cy.get('input[name="raza"]').type('Elfo');
    cy.get('input[name="level"]').clear();
    cy.get('input[name="level"]').type('7');

    // Atributos: el modificador se calcula en vivo al escribir
    cy.get('input[name="fuerza-puntuacion"]').type('18');
    cy.get('.character-form__atributos-grid').should('contain', '+4');
    // Fuerza de toro: ajuste +4 → efectiva 22 → modif. temporal +6
    cy.get('input[name="fuerza-ajuste"]').type('4');
    cy.get('input[name="destreza-puntuacion"]').type('9');

    // Combate: CA = 10 + 5 + 2 + (-1 de Des 9) = 16; iniciativa = -1 + 2 = +1
    cy.get('input[name="ca-bonif-armadura"]').type('5');
    cy.get('input[name="ca-bonif-escudo"]').type('2');
    cy.get('input[name="iniciativa-vario"]').type('2');
    cy.contains('.character-form__formula-total', 'CA').should('contain', '16');
    // Toque ignora armadura y escudo: 10 + (-1 Des) = 9.
    // Desprevenido conserva el mod NEGATIVO de Des: 10+5+2-1 = 16.
    cy.contains('.character-form__formula-total', 'Toque').should(
      'contain',
      '9',
    );
    cy.contains('.character-form__formula-total', 'Desprevenido').should(
      'contain',
      '16',
    );
    cy.contains('.character-form__formula-total', 'Iniciativa').should(
      'contain',
      '+1',
    );

    // Velocidad: 30 pies → 6 casillas / 9 m, derivado en vivo
    cy.get('input[name="velocidad-base"]').type('30');
    cy.get('.character-form__velocidad').should('contain', '6 cas. / 9 m');

    // Puntos de golpe y reducción de daño
    cy.get('input[name="pg-total"]').type('45');
    cy.get('input[name="pg-rd"]').type('5/hierro frío');

    // Salvaciones: Reflejos base 4 + (-1 de Des 9) = +3, en vivo
    cy.get('input[name="reflejos-base"]').type('4');
    cy.contains('.character-form__salvacion-nombre', 'Reflejos').should(
      'contain',
      '+3',
    );

    // Habilidades: Acrobacias clase + 3 rangos + (-1 Des) + 3 = +5
    cy.get('input[name="acrobacias-clase"]').check();
    cy.get('input[name="acrobacias-rangos"]').type('3');
    cy.contains('.character-form__habilidades-grid output', '+5');
    cy.get('input[name="artesania1-especialidad"]').type('Herrería');
    cy.get('input[name="artesania1-rangos"]').type('1');
    cy.get('input[name="idiomas"]').type('común, élfico');

    // Ofensivo: FUE efectiva 22 (+6) → BMC 3+6 = +9; DMC 10+3+6-1 = 18
    cy.get('input[name="ataque-base"]').type('3');
    cy.contains('.character-form__formula-total', 'BMC').should(
      'contain',
      '+9',
    );
    cy.contains('.character-form__formula-total', 'DMC').should(
      'contain',
      '18',
    );

    cy.get('button[type="submit"]').click();
    cy.contains('li', name).should('contain', 'Nivel 7');

    // Recargamos: lo que se muestre ahora viene de PostgreSQL
    cy.reload();
    cy.contains('li', name).contains('button', 'Ver ficha').click();
    cy.get('.characters__modal').should('contain', 'legal bueno');
    cy.get('.characters__modal').should('contain', 'Elfo');
    cy.get('.characters__modal').should('contain', 'Mediano');

    // Atributos: FUE 18 (+4) con ajuste +4 → modif. temporal +6
    cy.contains('.characters__modal-atributos tr', 'Fuerza')
      .should('contain', '18')
      .should('contain', '+4')
      .should('contain', '+6');
    cy.contains('.characters__modal-atributos tr', 'Destreza')
      .should('contain', '9')
      .should('contain', '-1');

    // Totales de combate derivados de lo guardado, más PG y RD
    cy.get('.characters__modal-combate')
      .should('contain', 'CA 16')
      .should('contain', 'toque 9')
      .should('contain', 'desprevenido 16')
      .should('contain', 'Iniciativa +1')
      .should('contain', 'PG 45')
      .should('contain', 'RD 5/hierro frío');

    // Velocidad guardada en pies, mostrada con sus derivados
    cy.get('.characters__modal-velocidad').should(
      'contain',
      'Base 30 pies (6 cas. / 9 m)',
    );

    // Salvaciones derivadas de lo guardado
    cy.get('.characters__modal').should('contain', 'Reflejos +3');

    // Bloque ofensivo derivado de lo guardado
    cy.get('.characters__modal')
      .should('contain', 'Ataque base +3')
      .should('contain', 'BMC +9')
      .should('contain', 'DMC 18');

    // Habilidades derivadas de lo guardado, con especialidad e idiomas
    cy.get('.characters__modal')
      .should('contain', 'Acrobacias +5')
      .should('contain', 'Artesanía (Herrería) +1')
      .should('contain', 'Idiomas: común, élfico');

    // Edición: cambiamos raza y nivel, el resto no se toca
    cy.get('.characters__modal').contains('button', 'Editar').click();
    cy.get('.characters__modal input[name="raza"]').clear();
    cy.get('.characters__modal input[name="raza"]').type('Enano');
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
});
