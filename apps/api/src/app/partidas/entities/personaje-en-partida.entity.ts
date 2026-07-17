import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Partida } from './partida.entity';
import { Character } from '../../characters/entities/character.entity';

/**
 * La tabla intermedia partida-personaje, con vida propia: aquí vive el
 * ESTADO DE SESIÓN (lo que cambia durante el juego), separado de la
 * ficha (sheetData) según la decisión de diseño del CLAUDE.md.
 */
@Entity('personajes_en_partida')
@Unique(['partidaId', 'characterId'])
export class PersonajeEnPartida {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Partida, (partida) => partida.personajes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'partidaId' })
  partida: Partida;

  @Column({ type: 'uuid' })
  partidaId: string;

  @ManyToOne(() => Character, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'characterId' })
  character: Character;

  @Column({ type: 'uuid' })
  characterId: string;

  /** PG que le quedan en ESTA partida; arranca en el total de la ficha. */
  @Column({ type: 'int', nullable: true })
  pgActuales: number | null;

  @Column({ type: 'int', default: 0 })
  danoNoLetal: number;

  /** Condiciones activas, texto libre por ahora ("aturdido, enredado"). */
  @Column({ type: 'text', default: '' })
  condiciones: string;

  /** Posición en el tablero (casillas); null = aún sin colocar. */
  @Column({ type: 'int', nullable: true })
  posX: number | null;

  @Column({ type: 'int', nullable: true })
  posY: number | null;
}
