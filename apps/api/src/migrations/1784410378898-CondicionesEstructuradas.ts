import { MigrationInterface, QueryRunner } from "typeorm";

export class CondicionesEstructuradas1784410378898 implements MigrationInterface {
    name = 'CondicionesEstructuradas1784410378898'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // De texto libre a jsonb (lista de ids). Se descarta el contenido
        // anterior a propósito: era estado de sesión de prueba, no traducible
        // fiablemente a ids del catálogo.
        await queryRunner.query(`ALTER TABLE "personajes_en_partida" DROP COLUMN "condiciones"`);
        await queryRunner.query(`ALTER TABLE "personajes_en_partida" ADD "condiciones" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "personajes_en_partida" DROP COLUMN "condiciones"`);
        await queryRunner.query(`ALTER TABLE "personajes_en_partida" ADD "condiciones" text NOT NULL DEFAULT ''`);
    }

}
