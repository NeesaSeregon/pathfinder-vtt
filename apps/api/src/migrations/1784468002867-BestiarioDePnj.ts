import { MigrationInterface, QueryRunner } from "typeorm";

export class BestiarioDePnj1784468002867 implements MigrationInterface {
    name = 'BestiarioDePnj1784468002867'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "characters" ADD "plantillaId" uuid`);
        await queryRunner.query(`ALTER TABLE "characters" ADD CONSTRAINT "FK_7898b0431cf16c3b67d8fb61c0e" FOREIGN KEY ("plantillaId") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "characters" DROP CONSTRAINT "FK_7898b0431cf16c3b67d8fb61c0e"`);
        await queryRunner.query(`ALTER TABLE "characters" DROP COLUMN "plantillaId"`);
    }

}
