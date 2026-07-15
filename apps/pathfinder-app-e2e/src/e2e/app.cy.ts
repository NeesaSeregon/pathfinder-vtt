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
    cy.get('input[name="raza"]').type('Elfo');
    cy.get('input[name="level"]').clear();
    cy.get('input[name="level"]').type('7');

    // Atributos: el modificador se calcula en vivo al escribir
    cy.get('input[name="fuerza-puntuacion"]').type('18');
    cy.get('.character-form__atributos-grid').should('contain', '+4');
    cy.get('input[name="fuerza-ajuste"]').type('20');
    cy.get('input[name="destreza-puntuacion"]').type('9');

    cy.get('button[type="submit"]').click();
    cy.contains('li', name).should('contain', 'Nivel 7');

    // Recargamos: lo que se muestre ahora viene de PostgreSQL
    cy.reload();
    cy.contains('li', name).contains('button', 'Ver ficha').click();
    cy.get('.characters__modal').should('contain', 'legal bueno');
    cy.get('.characters__modal').should('contain', 'Elfo');

    // Atributos guardados: puntuación 18 → +4, ajuste 20 → +5, 9 → -1
    cy.contains('.characters__modal-atributos tr', 'Fuerza')
      .should('contain', '18')
      .should('contain', '+4')
      .should('contain', '20')
      .should('contain', '+5');
    cy.contains('.characters__modal-atributos tr', 'Destreza')
      .should('contain', '9')
      .should('contain', '-1');

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
