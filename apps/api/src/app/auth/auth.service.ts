import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { JwtPayload, RegistroDatos } from '@pathfinder/shared';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

/** Coste del hash bcrypt: 2^12 iteraciones, el estándar actual. */
const RONDAS_BCRYPT = 12;

/** Interno del servidor: el controlador mete el token en la cookie. */
export interface SesionConToken {
  token: string;
  username: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(datos: RegistroDatos): Promise<SesionConToken> {
    if (await this.users.findByUsername(datos.username)) {
      throw new ConflictException('Ese nombre de usuario ya está en uso');
    }
    if (await this.users.findByEmail(datos.email)) {
      throw new ConflictException('Ya existe una cuenta con ese email');
    }
    const passwordHash = await hash(datos.password, RONDAS_BCRYPT);
    const user = await this.users.create(
      datos.username,
      datos.email,
      passwordHash,
    );
    return this.emitirSesion(user);
  }

  async login(email: string, password: string): Promise<SesionConToken> {
    const user = await this.users.findByEmail(email);
    // Mismo error si el email no existe o la contraseña falla: no damos
    // pistas a un atacante de qué cuentas existen.
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }
    return this.emitirSesion(user);
  }

  private async emitirSesion(user: User): Promise<SesionConToken> {
    const payload: JwtPayload = { sub: user.id, username: user.username };
    return {
      token: await this.jwt.signAsync(payload),
      username: user.username,
    };
  }
}
