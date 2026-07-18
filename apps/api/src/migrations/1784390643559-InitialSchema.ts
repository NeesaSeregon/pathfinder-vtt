import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1784390643559 implements MigrationInterface {
    name = 'InitialSchema1784390643559'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Las columnas id usan uuid_generate_v4(); esa función la aporta la
        // extensión uuid-ossp. synchronize la creaba sola, pero el CLI no la
        // añade: sin esto la migración falla en una base nueva (p. ej. CI).
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(30) NOT NULL, "email" character varying(254) NOT NULL, "passwordHash" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "characters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid, "name" character varying(100) NOT NULL, "level" integer NOT NULL DEFAULT '1', "sheetData" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9d731e05758f26b9315dac5e378" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "personajes_en_partida" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "partidaId" uuid NOT NULL, "characterId" uuid NOT NULL, "pgActuales" integer, "danoNoLetal" integer NOT NULL DEFAULT '0', "condiciones" text NOT NULL DEFAULT '', "posX" integer, "posY" integer, CONSTRAINT "UQ_d3a920aad676524438022056488" UNIQUE ("partidaId", "characterId"), CONSTRAINT "PK_d5920d9549cc41671d8c1fc66f9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "partidas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(100) NOT NULL, "descripcion" text NOT NULL DEFAULT '', "codigo" character varying(8) NOT NULL, "estado" character varying(20) NOT NULL DEFAULT 'preparacion', "masterId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9f627522a260c0306cae2c6c191" UNIQUE ("codigo"), CONSTRAINT "PK_6e9cc7455a900d190278156517c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "characters" ADD CONSTRAINT "FK_2ba195b65ec694f7417721261e6" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "personajes_en_partida" ADD CONSTRAINT "FK_81a9af7c30bd8db2e44dd83f88c" FOREIGN KEY ("partidaId") REFERENCES "partidas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "personajes_en_partida" ADD CONSTRAINT "FK_5ad3197b8840db95335823a610c" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "partidas" ADD CONSTRAINT "FK_1812160d26ff2c757a8ad87f5ca" FOREIGN KEY ("masterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "partidas" DROP CONSTRAINT "FK_1812160d26ff2c757a8ad87f5ca"`);
        await queryRunner.query(`ALTER TABLE "personajes_en_partida" DROP CONSTRAINT "FK_5ad3197b8840db95335823a610c"`);
        await queryRunner.query(`ALTER TABLE "personajes_en_partida" DROP CONSTRAINT "FK_81a9af7c30bd8db2e44dd83f88c"`);
        await queryRunner.query(`ALTER TABLE "characters" DROP CONSTRAINT "FK_2ba195b65ec694f7417721261e6"`);
        await queryRunner.query(`DROP TABLE "partidas"`);
        await queryRunner.query(`DROP TABLE "personajes_en_partida"`);
        await queryRunner.query(`DROP TABLE "characters"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
