import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CuentaService } from './cuenta.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { PartidasService } from '../partidas/partidas.service';
import { Character } from '../characters/entities/character.entity';
import { Partida } from '../partidas/entities/partida.entity';
import { PersonajeEnPartida } from '../partidas/entities/personaje-en-partida.entity';

const USER = {
  id: 'user-1',
  username: 'neesa',
  email: 'neesa@example.com',
  createdAt: new Date('2026-02-14T10:00:00.000Z'),
};

describe('CuentaService', () => {
  let service: CuentaService;
  let users: { findById: jest.Mock; eliminar: jest.Mock };
  let auth: { verificarPassword: jest.Mock };
  let partidas: { borrarMapasDeMaster: jest.Mock };

  beforeEach(async () => {
    users = {
      findById: jest.fn().mockResolvedValue(USER),
      eliminar: jest.fn().mockResolvedValue(undefined),
    };
    auth = { verificarPassword: jest.fn().mockResolvedValue(true) };
    partidas = { borrarMapasDeMaster: jest.fn().mockResolvedValue(undefined) };

    const modulo = await Test.createTestingModule({
      providers: [
        CuentaService,
        { provide: UsersService, useValue: users },
        { provide: AuthService, useValue: auth },
        { provide: PartidasService, useValue: partidas },
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

  it('borrar: limpia los mapas de disco y luego el usuario', async () => {
    await service.borrar('user-1', 'secreta-123');

    expect(partidas.borrarMapasDeMaster).toHaveBeenCalledWith('user-1');
    expect(users.eliminar).toHaveBeenCalledWith('user-1');
  });

  // 403 y no 401: la sesión sigue siendo buena, falla la reconfirmación.
  // Con un 401 el interceptor del front lo tomaría por sesión caducada.
  it('borrar: con la contraseña mal, no toca NADA', async () => {
    auth.verificarPassword.mockResolvedValue(false);

    await expect(service.borrar('user-1', 'la-que-no-es')).rejects.toThrow(
      ForbiddenException,
    );
    expect(partidas.borrarMapasDeMaster).not.toHaveBeenCalled();
    expect(users.eliminar).not.toHaveBeenCalled();
  });
});
