import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 30, unique: true })
  username: string;

  @Column({ length: 254, unique: true })
  email: string;

  // Nunca se guarda la contraseña: solo su hash bcrypt.
  @Column()
  passwordHash: string;

  /**
   * Sube en uno cada vez que cambian las credenciales (cambio desde
   * /cuenta o restablecimiento por correo). Viaja dentro del JWT como "tv"
   * y el AuthGuard la compara con esta: los tokens emitidos antes del
   * cambio dejan de valer al instante, en vez de sobrevivir sus 8 horas.
   */
  @Column({ type: 'int', default: 0 })
  tokenVersion: number;

  @CreateDateColumn()
  createdAt: Date;
}
