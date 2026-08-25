import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El tablero deja de admitir una imagen de fondo y pasa a tener ZONAS: el
 * máster dibuja rectángulos (una sala, un pasillo, un charco) en vez de
 * subir un plano.
 *
 * La columna del mapa se va entera. Sale sin red a propósito: se comprobó
 * antes de escribir esto que ninguna partida tenía mapa
 * (`select count(*) from partidas where "mapaFichero" is not null` → 0),
 * así que no hay ficheros que quedarse huérfanos en uploads/. Si alguna vez
 * se repite un borrado así con datos dentro, el orden importa: PRIMERO los
 * ficheros del disco (que SQL no puede tocar) y DESPUÉS la columna, porque
 * al perder la columna se pierde el único rastro de qué fichero era de quién.
 */
export class ZonasEnLugarDelMapa1785900000000 implements MigrationInterface {
  name = 'ZonasEnLugarDelMapa1785900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partidas" DROP COLUMN "mapaFichero"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partidas" ADD "zonas" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "partidas" DROP COLUMN "zonas"`);
    await queryRunner.query(
      `ALTER TABLE "partidas" ADD "mapaFichero" character varying(200)`,
    );
  }
}
