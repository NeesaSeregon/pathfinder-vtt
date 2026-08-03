import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from '@pathfinder/shared';
import { AuthGuard } from './auth.guard';
import { COOKIE_SESION } from './auth.constants';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

const LUIS = {
  id: 'user-1',
  username: 'luis',
  tokenVersion: 0,
} as User;

/**
 * Contexto HTTP mínimo con la cookie de sesión puesta. getHandler y
 * getClass devuelven cosas REALES (no undefined) porque el Reflector va a
 * leerles metadatos: con undefined revienta antes de llegar al guard.
 */
function contextoCon(token: string | undefined): ExecutionContext {
  // headers va vacío pero PRESENTE: el guard cae en el respaldo
  // Authorization: Bearer cuando no hay cookie, y Express siempre lo trae.
  const request = {
    cookies: token ? { [COOKIE_SESION]: token } : {},
    headers: {},
  };
  class ControladorFalso {}
  const manejadorFalso = () => undefined;
  return {
    getType: () => 'http',
    getHandler: () => manejadorFalso,
    getClass: () => ControladorFalso,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwt: JwtService;
  let usuario: User | null;

  beforeEach(async () => {
    usuario = { ...LUIS };
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-test' })],
      providers: [
        AuthGuard,
        Reflector,
        {
          provide: UsersService,
          useValue: { findById: () => Promise.resolve(usuario) },
        },
      ],
    }).compile();

    guard = module.get(AuthGuard);
    jwt = module.get(JwtService);
  });

  const tokenCon = (tv: number) =>
    jwt.signAsync({ sub: LUIS.id, username: LUIS.username, tv } as JwtPayload);

  it('deja pasar un token de la generación vigente', async () => {
    await expect(
      guard.canActivate(contextoCon(await tokenCon(0))),
    ).resolves.toBe(true);
  });

  /**
   * EL TEST QUE IMPORTA. Es la regresión que convierte "he cambiado la
   * contraseña" en "he echado a quien estuviera dentro": si alguien vuelve
   * a hacer el JWT autocontenido, esto se pone rojo.
   */
  it('rechaza un token emitido ANTES de cambiar la contraseña', async () => {
    const viejo = await tokenCon(0);
    // Cambiar la contraseña sube el tokenVersion del usuario
    usuario = { ...LUIS, tokenVersion: 1 };

    await expect(guard.canActivate(contextoCon(viejo))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza el token de un usuario que ya no existe', async () => {
    const token = await tokenCon(0);
    usuario = null;

    await expect(guard.canActivate(contextoCon(token))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza si no hay cookie', async () => {
    await expect(
      guard.canActivate(contextoCon(undefined)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza un token firmado con otro secreto', async () => {
    const otro = new JwtService({ secret: 'no-es-el-nuestro' });
    const falso = await otro.signAsync({ sub: LUIS.id, username: 'x', tv: 0 });

    await expect(guard.canActivate(contextoCon(falso))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('los mensajes WebSocket no pasan por aquí (el gateway hace su propia auth)', async () => {
    const ws = {
      getType: () => 'ws',
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ws)).resolves.toBe(true);
  });
});
