describe('pathfinder-app-e2e', () => {
  beforeEach(() => cy.visit('/'));

  it('should display the characters page', () => {
    cy.get('h1').contains('Personajes');
  });

  it('should create and delete a character', () => {
    const name = `Cypress-${Date.now()}`;

    cy.get('input[name="name"]').type(name);
    cy.get('input[name="level"]').clear();
    cy.get('input[name="level"]').type('7');
    cy.get('button[type="submit"]').click();

    cy.contains('li', name).should('contain', 'Nivel 7');

    cy.contains('li', name).find('button').click();
    cy.contains('li', name).should('not.exist');
  });
});
