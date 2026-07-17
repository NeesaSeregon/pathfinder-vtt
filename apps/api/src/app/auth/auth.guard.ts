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

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    try {
      // Verifica la firma y la expiración; si algo falla, lanza.
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      // El payload queda disponible para los controladores (req.user)
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException('Token inválido o caducado');
    }
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
