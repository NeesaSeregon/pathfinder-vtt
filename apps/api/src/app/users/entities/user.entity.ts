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

  @CreateDateColumn()
  createdAt: Date;
}
