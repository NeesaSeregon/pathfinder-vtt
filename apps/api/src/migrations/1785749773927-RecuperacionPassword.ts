import { MigrationInterface, QueryRunner } from "typeorm";

export class RecuperacionPassword1785749773927 implements MigrationInterface {
    name = 'RecuperacionPassword1785749773927'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tokens_recuperacion" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character(64) NOT NULL, "expiraEn" TIMESTAMP WITH TIME ZONE NOT NULL, "usadoEn" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9d24066372f13dcb00517cfa4d7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f05cdb6abe16e8461889db2e5e" ON "tokens_recuperacion"  ("tokenHash") `);
        await queryRunner.query(`CREATE INDEX "IDX_a1b2c3d4e5f60718293a4b5c6d" ON "tokens_recuperacion"  ("userId") `);
        // tokenVersion lleva DEFAULT: las filas que ya existen quedan a 0 y
        // sus sesiones abiertas siguen siendo válidas. No hace falta el baile
        // de tres pasos (nullable → poblar → NOT NULL) de una columna sin
        // valor por defecto.
        await queryRunner.query(`ALTER TABLE "users" ADD "tokenVersion" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "tokens_recuperacion" ADD CONSTRAINT "FK_dea562d102502435db48479bfa4" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tokens_recuperacion" DROP CONSTRAINT "FK_dea562d102502435db48479bfa4"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "tokenVersion"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a1b2c3d4e5f60718293a4b5c6d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f05cdb6abe16e8461889db2e5e"`);
        await queryRunner.query(`DROP TABLE "tokens_recuperacion"`);
    }

}
