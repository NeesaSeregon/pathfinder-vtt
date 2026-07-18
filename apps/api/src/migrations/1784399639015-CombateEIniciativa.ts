import { MigrationInterface, QueryRunner } from "typeorm";

export class CombateEIniciativa1784399639015 implements MigrationInterface {
    name = 'CombateEIniciativa1784399639015'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "personajes_en_partida" ADD "iniciativa" integer`);
        await queryRunner.query(`ALTER TABLE "partidas" ADD "enCombate" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "partidas" ADD "ronda" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "partidas" ADD "turnoPepId" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "partidas" DROP COLUMN "turnoPepId"`);
        await queryRunner.query(`ALTER TABLE "partidas" DROP COLUMN "ronda"`);
        await queryRunner.query(`ALTER TABLE "partidas" DROP COLUMN "enCombate"`);
        await queryRunner.query(`ALTER TABLE "personajes_en_partida" DROP COLUMN "iniciativa"`);
    }

}
