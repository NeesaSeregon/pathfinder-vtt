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
   * Borra el usuario. Sus personajes y sus partidas caen con él por las
   * FK ON DELETE CASCADE de las entidades; los ficheros de los mapas hay
   * que limpiarlos aparte (lo hace CuentaService antes de llamar aquí).
   */
  async eliminar(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
