import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CuentaService } from './cuenta.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { Character } from '../characters/entities/character.entity';
import { Partida } from '../partidas/entities/partida.entity';
import { PersonajeEnPartida } from '../partidas/entities/personaje-en-partida.entity';
import { EnviadorCorreo, MensajeCorreo } from '../correo/enviador-correo';

const USER = {
  id: 'user-1',
  username: 'neesa',
  email: 'neesa@example.com',
  createdAt: new Date('2026-02-14T10:00:00.000Z'),
};

describe('CuentaService', () => {
  let service: CuentaService;
  let users: { findById: jest.Mock; eliminar: jest.Mock };
  let auth: {
    verificarPassword: jest.Mock;
    cambiarPassword: jest.Mock;
    renovarSesion: jest.Mock;
  };
  let enviados: MensajeCorreo[];

  beforeEach(async () => {
    enviados = [];
    users = {
      findById: jest.fn().mockResolvedValue(USER),
      eliminar: jest.fn().mockResolvedValue(undefined),
    };
    auth = {
      verificarPassword: jest.fn().mockResolvedValue(true),
      cambiarPassword: jest.fn().mockResolvedValue(undefined),
      renovarSesion: jest
        .fn()
        .mockResolvedValue({ token: 'token-nuevo', username: USER.username }),
    };

    const modulo = await Test.createTestingModule({
      providers: [
        CuentaService,
        { provide: UsersService, useValue: users },
        { provide: AuthService, useValue: auth },
        {
          provide: EnviadorCorreo,
          useValue: {
            enviar: (mensaje: MensajeCorreo) => {
              enviados.push(mensaje);
              return Promise.resolve();
            },
          },
        },
        {
          provide: getRepositoryToken(Character),
          useValue: { countBy: jest.fn().mockResolvedValue(3) },
        },
        {
          provide: getRepositoryToken(Partida),
          useValue: { countBy: jest.fn().mockResolvedValue(1) },
        },
        {
          provide: getRepositoryToken(PersonajeEnPartida),
          useValue: { count: jest.fn().mockResolvedValue(2) },
        },
      ],
    }).compile();

    service = modulo.get(CuentaService);
  });

  it('detalle: devuelve los datos y los contadores', async () => {
    await expect(service.detalle('user-1')).resolves.toEqual({
      username: 'neesa',
      email: 'neesa@example.com',
      creadaEl: '2026-02-14T10:00:00.000Z',
      numPersonajes: 3,
      numPartidasComoMaster: 1,
      numPartidasComoJugador: 2,
    });
  });

  it('detalle: 404 si el usuario de la cookie ya no existe', async () => {
    users.findById.mockResolvedValue(null);
    await expect(service.detalle('user-1')).rejects.toThrow(NotFoundException);
  });

  it('cambiarPassword: comprueba la actual antes de guardar la nueva', async () => {
    await service.cambiarPassword('user-1', 'la-de-ahora', 'la-nueva-larga');

    expect(auth.verificarPassword).toHaveBeenCalledWith(
      'user-1',
      'la-de-ahora',
    );
    expect(auth.cambiarPassword).toHaveBeenCalledWith(
      'user-1',
      'la-nueva-larga',
    );
  });

  it('cambiarPassword: si la actual falla, no cambia nada', async () => {
    auth.verificarPassword.mockResolvedValue(false);

    await expect(
      service.cambiarPassword('user-1', 'la-que-no-es', 'la-nueva-larga'),
    ).rejects.toThrow(ForbiddenException);
    expect(auth.cambiarPassword).not.toHaveBeenCalled();
    // Y desde luego no se avisa de un cambio que no ha ocurrido
    expect(enviados).toHaveLength(0);
  });

  /**
   * El aviso es la única alarma de quien tiene la sesión robada: si alguien
   * te cambia la contraseña desde dentro, este correo es lo que te lo dice.
   */
  it('cambiarPassword: avisa por correo de que la contraseña ha cambiado', async () => {
    await service.cambiarPassword('user-1', 'la-de-ahora', 'la-nueva-larga');

    expect(enviados).toHaveLength(1);
    expect(enviados[0].para).toBe(USER.email);
    expect(enviados[0].asunto).toContain('ha cambiado');
  });

  /**
   * Subir el tokenVersion invalida TODAS las sesiones, incluida la del
   * navegador que está haciendo el cambio. Devolver un token nuevo es lo
   * que evita que el usuario se expulse a sí mismo a /entrar por haber
   * hecho justo lo que le pedíamos.
   */
  it('cambiarPassword: devuelve un token nuevo para no echar a quien lo cambia', async () => {
    await expect(
      service.cambiarPassword('user-1', 'la-de-ahora', 'la-nueva-larga'),
    ).resolves.toBe('token-nuevo');
    expect(auth.renovarSesion).toHaveBeenCalledWith('user-1');
  });

  it('borrar: con la contraseña buena, borra el usuario', async () => {
    await service.borrar('user-1', 'secreta-123');

    expect(users.eliminar).toHaveBeenCalledWith('user-1');
  });

  // 403 y no 401: la sesión sigue siendo buena, falla la reconfirmación.
  // Con un 401 el interceptor del front lo tomaría por sesión caducada.
  it('borrar: con la contraseña mal, no toca NADA', async () => {
    auth.verificarPassword.mockResolvedValue(false);

    await expect(service.borrar('user-1', 'la-que-no-es')).rejects.toThrow(
      ForbiddenException,
    );
    expect(users.eliminar).not.toHaveBeenCalled();
  });
});
