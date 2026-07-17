import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from '@pathfinder/shared';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

const LUIS = {
  username: 'luis',
  email: 'luis@mesa.es',
  password: 'contraseña-secreta',
};

describe('AuthService', () => {
  let service: AuthService;
  let jwt: JwtService;
  // UsersService falso: un array en memoria en vez de PostgreSQL
  let usuarios: User[];

  beforeEach(async () => {
    usuarios = [];
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-test' })],
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByUsername: (username: string) =>
              Promise.resolve(
                usuarios.find((u) => u.username === username) ?? null,
              ),
            findByEmail: (email: string) =>
              Promise.resolve(usuarios.find((u) => u.email === email) ?? null),
            create: (username: string, email: string, passwordHash: string) => {
              const user = {
                id: `id-${usuarios.length}`,
                username,
                email,
                passwordHash,
              } as User;
              usuarios.push(user);
              return Promise.resolve(user);
            },
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    jwt = module.get(JwtService);
  });

  it('register guarda un hash, nunca la contraseña en claro', async () => {
    await service.register(LUIS);
    expect(usuarios[0].passwordHash).not.toContain(LUIS.password);
    expect(usuarios[0].passwordHash).toMatch(/^\$2/); // formato bcrypt
  });

  it('register devuelve un token verificable con el id y el username', async () => {
    const sesion = await service.register(LUIS);
    const payload = await jwt.verifyAsync<JwtPayload>(sesion.token);
    expect(payload.username).toBe('luis');
    expect(payload.sub).toBe(usuarios[0].id);
  });

  it('register rechaza username o email ya usados (409)', async () => {
    await service.register(LUIS);
    await expect(
      service.register({ ...LUIS, email: 'otro@mesa.es' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.register({ ...LUIS, username: 'otro' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('login acepta la contraseña correcta y rechaza la incorrecta', async () => {
    await service.register(LUIS);

    const sesion = await service.login(LUIS.email, LUIS.password);
    expect(sesion.username).toBe('luis');

    await expect(
      service.login(LUIS.email, 'equivocada'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login de un email inexistente da el MISMO error que contraseña mala', async () => {
    // Si los errores fueran distintos, un atacante podría averiguar qué
    // cuentas existen probando emails.
    await expect(
      service.login('nadie@mesa.es', 'loquesea'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
