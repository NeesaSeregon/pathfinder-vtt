describe('home y navegación', () => {
  it('la home muestra las tres secciones y navega a personajes', () => {
    cy.visit('/');
    cy.get('.home__tarjeta').should('have.length', 3);
    cy.contains('.home__tarjeta', 'Personajes').click();
    cy.get('h1').contains('Personajes');
  });

  it('el menú Partidas de la navbar lleva a las maquetas', () => {
    cy.visit('/');
    cy.contains('summary', 'Partidas').click();
    cy.contains('a', 'Buscar partida').click();
    cy.get('h1').contains('Buscar partida');
    cy.contains('a', 'Iniciar sesión').click();
    cy.get('h1').contains('Iniciar sesión');
  });
});

describe('pathfinder-app-e2e', () => {
  beforeEach(() => cy.visit('/personajes'));

  it('should display the characters page', () => {
    cy.get('h1').contains('Personajes');
  });

  it('should create, view, edit and delete a character', () => {
    const name = `Cypress-${Date.now()}`;

    // Alta con varios campos de ficha
    cy.get('input[name="name"]').type(name);
    cy.get('input[name="jugador"]').type('Luis');
    cy.get('select[name="clase"]').select('Pícaro');
    cy.get('select[name="alineamiento"]').select('legal bueno');
    cy.get('select[name="tamano"]').select('Mediano');
    cy.get('select[name="raza"]').select('Elfo');
    cy.get('input[name="level"]').clear();
    cy.get('input[name="level"]').type('7');

    // Atributos: el modificador se calcula en vivo al escribir
    cy.get('input[name="fuerza-puntuacion"]').type('18');
    cy.get('.character-form__atributos-grid').should('contain', '+4');
    // Fuerza de toro: ajuste +4 → efectiva 22 → modif. temporal +6
    cy.get('input[name="fuerza-ajuste"]').type('4');
    cy.get('input[name="destreza-puntuacion"]').type('9');

    // Combate con Des final 11 (9 base +2 de elfo → mod +0):
    // CA = 10+5+2+0 = 17; toque 10; desprevenido 17; iniciativa 0+2 = +2
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
    cy.get('input[name="velocidad-base"]').type('30');
    cy.get('.character-form__velocidad').should('contain', '6 cas. / 9 m');

    // Puntos de golpe y reducción de daño
    cy.get('input[name="pg-total"]').type('45');
    cy.get('input[name="pg-rd"]').type('5/hierro frío');

    // Salvaciones: Reflejos base 4 + (+0 de Des final 11) = +4, en vivo
    cy.get('input[name="reflejos-base"]').type('4');
    cy.contains('.character-form__salvacion-nombre', 'Reflejos').should(
      'contain',
      '+4',
    );

    // Armas: fila dinámica
    cy.contains('button', 'Añadir arma').click();
    cy.get('input[name="arma0-nombre"]').type('Espada larga');
    cy.get('input[name="arma0-ataque"]').type('+9/+4');
    cy.get('input[name="arma0-dano"]').type('1d8+4');

    // Equipo: con FUE efectiva 22 (fuerza de toro) la carga pesada es 520
    cy.contains('button', 'Añadir equipo').click();
    cy.get('input[name="equipo0-nombre"]').type('Mochila');
    cy.get('input[name="equipo0-peso"]').type('2');
    cy.contains('.character-form__formula-total', 'Peso total').should(
      'contain',
      '2',
    );
    cy.get('.character-form__carga').should('contain', '520');

    // Dotes: lista dinámica, como armas y equipo
    cy.contains('button', 'Añadir dote').click();
    cy.get('input[name="dote0-nombre"]').type('Soltura con el arma');
    cy.get('input[name="dote0-descripcion"]').type('+1 ataque con el arma elegida');
    cy.contains('button', 'Añadir dote').click();
    cy.get('input[name="dote1-nombre"]').type('Esquiva');

    // Conjuros: INT 16 base (+2 de elfo → 18, +4) como atributo de lanzamiento
    cy.get('input[name="inteligencia-puntuacion"]').type('16');
    cy.get('select[name="atributo-lanzamiento"]').select('Inteligencia');
    cy.get('input[name="conjuros1-pordia"]').type('2');
    cy.get('input[name="conjuros1-anotados"]').type('proyectil mágico');

    // Dinero y experiencia con derivados en vivo
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
    cy.get('input[name="acrobacias-clase"]').check();
    cy.get('input[name="acrobacias-rangos"]').type('3');
    cy.contains('.character-form__habilidades-grid output', '+6');
    cy.get('input[name="artesania1-especialidad"]').type('Herrería');
    cy.get('input[name="artesania1-rangos"]').type('1');
    cy.get('input[name="idiomas"]').type('común, élfico');

    // Ofensivo: FUE final 22 (+6) → BMC 3+6 = +9; DMC 10+3+6+0 = 19
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
});
