import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  Character as CharacterModel,
  CharacterSheetData,
  TipoPersonaje,
} from '@pathfinder/shared';
import { User } from '../../users/entities/user.entity';

@Entity('characters')
export class Character implements CharacterModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Dueño del personaje. MUCHOS personajes pertenecen a UN usuario:
   * la clave foránea ownerId vive en esta tabla. nullable por los
   * personajes antiguos; si se borra el usuario, caen sus personajes.
   */
  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User | null;

  @Column({ type: 'uuid', nullable: true })
  ownerId: string | null;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'int', default: 1 })
  level: number;

  /**
   * 'pnj' = criatura del máster (enemigo, aliado o figurante). Comparte
   * tabla y cálculos con los PJ; solo sirve para no mezclarlos en las
   * listas. Las fichas anteriores a esta columna son todas 'pj'.
   */
  @Column({ type: 'varchar', length: 3, default: 'pj' })
  tipo: TipoPersonaje;

  /**
   * Solo en PNJ. Distingue las dos clases de ficha que conviven aquí:
   *  - PLANTILLA (plantillaId null): el monstruo de tu bestiario. Persiste
   *    y se reutiliza tantas veces como quieras.
   *  - INSTANCIA (plantillaId = id de su plantilla): la copia concreta que
   *    se sienta en una mesa, con sus PG y condiciones propios. Es
   *    desechable: al sacarla de la mesa se borra.
   * SET NULL y no CASCADE: borrar una plantilla del bestiario NO debe
   * hacer desaparecer los monstruos que ya están puestos en una mesa.
   */
  @ManyToOne(() => Character, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'plantillaId' })
  plantilla: Character | null;

  @Column({ type: 'uuid', nullable: true })
  plantillaId: string | null;

  // JSONB: la ficha completa (atributos, inventario, dotes...) vive aquí
  // como documento, sin necesidad de una columna por campo.
  @Column({ type: 'jsonb', default: {} })
  sheetData: CharacterSheetData;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
