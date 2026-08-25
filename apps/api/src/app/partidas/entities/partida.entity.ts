import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { EstadoPartida, ZonaTablero } from '@pathfinder/shared';
import { User } from '../../users/entities/user.entity';
import { PersonajeEnPartida } from './personaje-en-partida.entity';

@Entity('partidas')
export class Partida {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  nombre: string;

  @Column({ type: 'text', default: '' })
  descripcion: string;

  /** Código de invitación corto que el máster comparte con su mesa. */
  @Column({ length: 8, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 20, default: 'preparacion' })
  estado: EstadoPartida;

  /** El creador de la partida es su máster. */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'masterId' })
  master: User;

  @Column({ type: 'uuid' })
  masterId: string;

  @OneToMany(() => PersonajeEnPartida, (pep) => pep.partida)
  personajes: PersonajeEnPartida[];

  /**
   * Las zonas dibujadas sobre el tablero (salas, pasillos, terreno). Van en
   * jsonb y no en una tabla propia porque se leen SIEMPRE juntas, con la
   * partida, y las escribe una sola persona: no hay nada que fusionar ni
   * que consultar por separado.
   */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  zonas: ZonaTablero[];

  /** Rastreador de combate (estado de sesión de la mesa). */
  @Column({ type: 'boolean', default: false })
  enCombate: boolean;

  @Column({ type: 'int', default: 0 })
  ronda: number;

  /** pepId con el turno; uuid suelto (sin FK) por simplicidad, null fuera de combate. */
  @Column({ type: 'uuid', nullable: true })
  turnoPepId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
