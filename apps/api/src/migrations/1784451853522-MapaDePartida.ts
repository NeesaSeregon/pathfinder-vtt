import { MigrationInterface, QueryRunner } from "typeorm";

export class MapaDePartida1784451853522 implements MigrationInterface {
    name = 'MapaDePartida1784451853522'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "partidas" ADD "mapaFichero" character varying(200)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "partidas" DROP COLUMN "mapaFichero"`);
    }

}
