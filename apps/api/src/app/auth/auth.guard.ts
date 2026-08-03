import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtPayload } from '@pathfinder/shared';
import { ES_PUBLICO } from './public.decorator';
import { COOKIE_SESION } from './auth.constants';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Los mensajes WebSocket no pasan por aquí: el gateway autentica su
    // propio handshake (la cookie viaja en él) y este guard es HTTP.
    if (context.getType() === 'ws') {
      return true;
    }
    // ¿El handler (o su controlador) está marcado con @Public()?
    const esPublico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublico) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extraerToken(request);
    if (!token) {
      throw new UnauthorizedException('Falta el token de sesión');
    }
    let payload: JwtPayload;
    try {
      // Verifica la firma y la expiración; si algo falla, lanza.
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o caducado');
    }

    // Una firma válida ya no basta: el token tiene que ser de la GENERACIÓN
    // vigente de credenciales. Cambiar o restablecer la contraseña sube
    // users.tokenVersion, y aquí se caen de golpe todos los tokens
    // emitidos antes, en vez de sobrevivir sus 8 horas.
    //
    // Sí, esto añade UNA LECTURA de usuario por petición autenticada. Es el
    // precio de poder echar a alguien de verdad, y es una consulta por
    // clave primaria. La alternativa (una lista de revocados en memoria) no
    // sobreviviría a un reinicio ni a una segunda instancia.
    const user = await this.users.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.tv) {
      // Mismo 401 que un token caduco, y a propósito: para el front es el
      // mismo caso (el interceptor limpia y manda a /entrar), y para el
      // usuario también — su sesión ya no vale.
      throw new UnauthorizedException('Token inválido o caducado');
    }

    // El payload queda disponible para los controladores (req.user)
    request['user'] = payload;
    return true;
  }

  private extraerToken(request: Request): string | undefined {
    // Vía normal: la cookie httpOnly que puso el login
    const deCookie = request.cookies?.[COOKIE_SESION];
    if (deCookie) {
      return deCookie;
    }
    // Respaldo: Authorization Bearer (scripts, pruebas con curl)
    const [tipo, token] = request.headers.authorization?.split(' ') ?? [];
    return tipo === 'Bearer' ? token : undefined;
  }
}
