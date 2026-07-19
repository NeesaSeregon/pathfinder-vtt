import { MigrationInterface, QueryRunner } from "typeorm";

export class PnjEnLaMesa1784463701331 implements MigrationInterface {
    name = 'PnjEnLaMesa1784463701331'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "characters" ADD "tipo" character varying(3) NOT NULL DEFAULT 'pj'`);
        await queryRunner.query(`ALTER TABLE "personajes_en_partida" ADD "actitud" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "personajes_en_partida" ADD "oculto" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "personajes_en_partida" DROP COLUMN "oculto"`);
        await queryRunner.query(`ALTER TABLE "personajes_en_partida" DROP COLUMN "actitud"`);
        await queryRunner.query(`ALTER TABLE "characters" DROP COLUMN "tipo"`);
    }

}
