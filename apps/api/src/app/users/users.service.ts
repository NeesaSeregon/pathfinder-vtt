import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  findByUsername(username: string): Promise<User | null> {
    return this.repo.findOneBy({ username });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email });
  }

  create(username: string, email: string, passwordHash: string): Promise<User> {
    return this.repo.save(this.repo.create({ username, email, passwordHash }));
  }
}
