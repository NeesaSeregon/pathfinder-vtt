import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  Character as CharacterModel,
  CharacterSheetData,
} from '@pathfinder/shared';

@Entity('characters')
export class Character implements CharacterModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'int', default: 1 })
  level: number;

  // JSONB: la ficha completa (atributos, inventario, dotes...) vive aquí
  // como documento, sin necesidad de una columna por campo.
  @Column({ type: 'jsonb', default: {} })
  sheetData: CharacterSheetData;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
