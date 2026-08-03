import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOperator } from 'typeorm';
import { RecuperacionService, hashDeToken } from './recuperacion.service';
import { TokenRecuperacion } from './entities/token-recuperacion.entity';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { EnviadorCorreo, MensajeCorreo } from '../correo/enviador-correo';

const LUIS = {
  id: 'user-1',
  username: 'luis',
  email: 'luis@mesa.es',
  passwordHash: '$2b$12$loquesea',
  tokenVersion: 0,
} as User;

/**
 * Repositorio falso en memoria. Solo entiende las consultas que hace
 * RecuperacionService (buscar por tokenHash, marcar por id o por userId con
 * usadoEn IS NULL, borrar por expiraEn <): es un doble a medida, no una
 * reimplementación de TypeORM.
 */
function repoFalso(filas: TokenRecuperacion[]) {
  const casa = (fila: TokenRecuperacion, criterio: Record<string, unknown>) =>
    Object.entries(criterio).every(([campo, esperado]) => {
      const valor = (fila as unknown as Record<string, unknown>)[campo];
      if (esperado instanceof FindOperator) {
        return esperado.type === 'isNull'
          ? valor === null || valor === undefined
          : (valor as Date) < (esperado.value as Date);
      }
      return valor === esperado;
    });

  return {
    create: (datos: Partial<TokenRecuperacion>) => ({ ...datos }),
    save: (fila: TokenRecuperacion) => {
      fila.id = `token-${filas.length}`;
      filas.push(fila);
      return Promise.resolve(fila);
    },
    findOne: ({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(filas.find((f) => casa(f, where)) ?? null),
    update: (
      criterio: Record<string, unknown>,
      cambios: Partial<TokenRecuperacion>,
    ) => {
      const afectadas = filas.filter((f) => casa(f, criterio));
      afectadas.forEach((f) => Object.assign(f, cambios));
      return Promise.resolve({ affected: afectadas.length });
    },
    delete: (criterio: Record<string, unknown>) => {
      const quedan = filas.filter((f) => !casa(f, criterio));
      const borradas = filas.length - quedan.length;
      filas.splice(0, filas.length, ...quedan);
      return Promise.resolve({ affected: borradas });
    },
  };
}

describe('RecuperacionService', () => {
  let service: RecuperacionService;
  let filas: TokenRecuperacion[];
  let enviados: MensajeCorreo[];
  let usuarios: User[];
  let cambiarPassword: jest.Mock;

  /** El token en claro solo existe dentro del correo: se saca de ahí. */
  const tokenDelUltimoCorreo = (): string => {
    const enlace = /token=([\w-]+)/.exec(
      enviados[enviados.length - 1].texto,
    )?.[1];
    if (!enlace) {
      throw new Error('El correo no traía enlace con token');
    }
    return decodeURIComponent(enlace);
  };

  beforeEach(async () => {
    filas = [];
    enviados = [];
    usuarios = [{ ...LUIS }];
    cambiarPassword = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecuperacionService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: (email: string) =>
              Promise.resolve(usuarios.find((u) => u.email === email) ?? null),
            findById: (id: string) =>
              Promise.resolve(usuarios.find((u) => u.id === id) ?? null),
          },
        },
        { provide: AuthService, useValue: { cambiarPassword } },
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
          provide: ConfigService,
          useValue: { get: () => 'https://rolnees.com' },
        },
        {
          provide: getRepositoryToken(TokenRecuperacion),
          useValue: repoFalso(filas),
        },
      ],
    }).compile();

    service = module.get(RecuperacionService);
  });

  describe('solicitar', () => {
    it('con un correo SIN cuenta no manda nada ni deja rastro, y no lanza', async () => {
      // El silencio es el rasgo de seguridad: si aquí pasara cualquier otra
      // cosa, el formulario diría qué correos están registrados.
      await expect(service.solicitar('nadie@mesa.es')).resolves.toBeUndefined();
      expect(enviados).toHaveLength(0);
      expect(filas).toHaveLength(0);
    });

    it('guarda el HASH del token, nunca el token en claro', async () => {
      await service.solicitar(LUIS.email);
      const token = tokenDelUltimoCorreo();

      expect(filas).toHaveLength(1);
      expect(filas[0].tokenHash).toBe(hashDeToken(token));
      expect(filas[0].tokenHash).not.toBe(token);
      // El token en claro no aparece en NINGÚN campo de la fila
      expect(JSON.stringify(filas[0])).not.toContain(token);
    });

    it('el enlace sale de APP_URL, no de la cabecera Host', async () => {
      await service.solicitar(LUIS.email);
      expect(enviados[0].texto).toContain(
        'https://rolnees.com/restablecer?token=',
      );
    });

    it('normaliza el correo: mayúsculas y espacios encuentran la cuenta', async () => {
      await service.solicitar('  LUIS@MESA.ES  ');
      expect(enviados).toHaveLength(1);
    });

    it('pedir un segundo enlace invalida el primero', async () => {
      await service.solicitar(LUIS.email);
      const primero = tokenDelUltimoCorreo();
      await service.solicitar(LUIS.email);
      const segundo = tokenDelUltimoCorreo();

      // El viejo se queda en la bandeja de entrada, pero ya no es una llave
      await expect(
        service.restablecer(primero, 'contraseña-nueva'),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.restablecer(segundo, 'contraseña-nueva'),
      ).resolves.toBeUndefined();
    });
  });

  describe('restablecer', () => {
    it('con un token válido cambia la contraseña y avisa por correo', async () => {
      await service.solicitar(LUIS.email);
      const token = tokenDelUltimoCorreo();
      enviados.length = 0;

      await service.restablecer(token, 'contraseña-nueva');

      expect(cambiarPassword).toHaveBeenCalledWith(LUIS.id, 'contraseña-nueva');
      expect(enviados).toHaveLength(1);
      expect(enviados[0].asunto).toContain('ha cambiado');
      expect(enviados[0].para).toBe(LUIS.email);
    });

    it('el token es de UN SOLO USO', async () => {
      await service.solicitar(LUIS.email);
      const token = tokenDelUltimoCorreo();

      await service.restablecer(token, 'contraseña-nueva');
      await expect(
        service.restablecer(token, 'otra-contraseña'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(cambiarPassword).toHaveBeenCalledTimes(1);
    });

    it('un token caducado no sirve', async () => {
      await service.solicitar(LUIS.email);
      const token = tokenDelUltimoCorreo();
      // Se le echan las horas encima a mano
      filas[0].expiraEn = new Date(Date.now() - 1000);

      await expect(
        service.restablecer(token, 'contraseña-nueva'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(cambiarPassword).not.toHaveBeenCalled();
    });

    it('un token inventado no sirve', async () => {
      await expect(
        service.restablecer('me-lo-acabo-de-inventar', 'contraseña-nueva'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('inventado, caducado y ya usado dan EXACTAMENTE el mismo mensaje', async () => {
      await service.solicitar(LUIS.email);
      const usado = tokenDelUltimoCorreo();
      await service.restablecer(usado, 'contraseña-nueva');

      await service.solicitar(LUIS.email);
      const caducado = tokenDelUltimoCorreo();
      filas[filas.length - 1].expiraEn = new Date(Date.now() - 1000);

      const mensajes = await Promise.all(
        [usado, caducado, 'inventado-del-todo'].map((token) =>
          service
            .restablecer(token, 'contraseña-nueva')
            .then(() => 'no falló', (e: Error) => e.message),
        ),
      );

      expect(new Set(mensajes).size).toBe(1);
    });
  });
});
