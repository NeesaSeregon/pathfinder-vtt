import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices para las dos claves ajenas por las que se pregunta a diario.
 *
 * En PostgreSQL una FK NO crea índice sola: lo crea en la tabla a la que
 * apunta, no en la que apunta. Así que "las mesas de este máster" y "los
 * personajes de este usuario" eran un Seq Scan de la tabla entera. Medido
 * con EXPLAIN ANALYZE sobre 649 partidas: 1 ms, irrelevante — pero es un
 * coste que crece en línea recta con los datos, y son justo las dos
 * consultas del escritorio, la primera pantalla tras iniciar sesión.
 *
 * Hay un segundo efecto menos visible: el ON DELETE CASCADE también los
 * usa. Borrar un usuario tiene que encontrar sus partidas y sus personajes,
 * y sin índice eso es recorrer las tablas enteras una vez por borrado.
 *
 * personajes_en_partida no necesita nada: su índice único (partidaId,
 * characterId) ya sirve para buscar por partidaId, que es la columna de la
 * izquierda. Por characterId sola no se busca nunca.
 */
export class IndicesDeClavesAjenas1785910000000 implements MigrationInterface {
  name = 'IndicesDeClavesAjenas1785910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_partidas_masterId" ON "partidas" ("masterId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_characters_ownerId" ON "characters" ("ownerId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_characters_ownerId"`);
    await queryRunner.query(`DROP INDEX "IDX_partidas_masterId"`);
  }
}
