import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.repo.findOneBy({ username });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email });
  }

  create(username: string, email: string, passwordHash: string): Promise<User> {
    return this.repo.save(this.repo.create({ username, email, passwordHash }));
  }

  /**
   * Recibe el hash ya calculado: aquí nunca entra una contraseña en claro.
   *
   * Sube tokenVersion EN EL MISMO UPDATE, no en dos pasos, para que no
   * exista un instante en el que la contraseña ya ha cambiado pero las
   * sesiones viejas siguen valiendo. Es un incremento en SQL (`+ 1`) y no
   * un leer-sumar-escribir para que dos cambios simultáneos no se pisen.
   */
  async actualizarPassword(id: string, passwordHash: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(User)
      .set({ passwordHash, tokenVersion: () => '"tokenVersion" + 1' })
      .where('id = :id', { id })
      .execute();
  }

  /**
   * Borra el usuario. Sus personajes y sus partidas caen con él por las
   * FK ON DELETE CASCADE de las entidades; los ficheros de los mapas hay
   * que limpiarlos aparte (lo hace CuentaService antes de llamar aquí).
   */
  async eliminar(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
