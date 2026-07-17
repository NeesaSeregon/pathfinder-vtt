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
import type { EstadoPartida } from '@pathfinder/shared';
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
