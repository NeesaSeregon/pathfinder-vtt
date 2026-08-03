import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Un vale de un solo uso para restablecer la contraseña sin saberla.
 *
 * LO QUE SE GUARDA ES EL HASH DEL TOKEN, NUNCA EL TOKEN. El valor en claro
 * existe una sola vez, dentro del correo que sale hacia el usuario: si
 * alguien se lleva un volcado de esta tabla, no obtiene ni un acceso.
 *
 * El hash es SHA-256 y no bcrypt, al revés que con las contraseñas, y por
 * dos motivos:
 *  · El token son 256 bits de aleatoriedad pura. bcrypt existe para
 *    compensar la poca entropía de lo que elige un humano; aquí no hay
 *    nada que compensar, la fuerza bruta es imposible de todos modos.
 *  · Con bcrypt no se podría BUSCAR la fila (cada hash lleva su propia
 *    sal, así que habría que recorrer la tabla entera comparando una a
 *    una). Con SHA-256 el hash es determinista y se consulta por índice.
 */
@Entity('tokens_recuperacion')
export class TokenRecuperacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Indexado a mano: en Postgres una FK NO crea índice, y por userId van
  // tanto la invalidación de los vales pendientes como la limpieza.
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  // Si el usuario borra su cuenta, sus vales pendientes se van con él.
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** SHA-256 del token en hexadecimal: 64 caracteres exactos. */
  @Index({ unique: true })
  @Column({ type: 'char', length: 64 })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiraEn: Date;

  /**
   * Cuándo se canjeó. Null = sigue vivo. Se marca en vez de borrar la fila
   * para que un segundo intento con el mismo enlace se distinga de un
   * token inventado (aunque al usuario se le responda lo mismo).
   */
  @Column({ type: 'timestamptz', nullable: true })
  usadoEn: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
