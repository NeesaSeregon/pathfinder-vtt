import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IntentosLoginService } from './intentos-login.service';

describe('AuthController', () => {
  let controller: AuthController;
  let auth: { register: jest.Mock; login: jest.Mock };
  let intentos: IntentosLoginService;

  /** Respuesta falsa: solo nos importa que se pueda poner la cookie. */
  const respuesta = () =>
    ({ cookie: jest.fn(), clearCookie: jest.fn() }) as unknown as Response;

  beforeEach(async () => {
    process.env.LOGIN_MAX_FALLOS = '3';
    process.env.LOGIN_BLOQUEO_SEGUNDOS = '60';
    auth = { register: jest.fn(), login: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        IntentosLoginService,
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    intentos = module.get(IntentosLoginService);
  });

  afterEach(() => {
    delete process.env.LOGIN_MAX_FALLOS;
    delete process.env.LOGIN_BLOQUEO_SEGUNDOS;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('login correcto devuelve el usuario y limpia los fallos previos', async () => {
    intentos.registrarFallo('a@mesa.es', '1.1.1.1');
    auth.login.mockResolvedValue({ token: 't', username: 'neesa' });

    const sesion = await controller.login(
      { email: 'a@mesa.es', password: 'contraseña-larga' },
      respuesta(),
      '1.1.1.1',
    );

    expect(sesion).toEqual({ username: 'neesa' });
    expect(intentos.segundosBloqueado('a@mesa.es', '1.1.1.1')).toBe(0);
  });

  /**
   * Lo que de verdad protege: tras N fallos ni siquiera se comprueba la
   * contraseña — el 429 llega antes de tocar AuthService, así que no hay
   * hash que calcular ni consulta que hacer.
   */
  it('tras varios fallos responde 429 sin comprobar la contraseña', async () => {
    auth.login.mockRejectedValue(new Error('credenciales malas'));

    for (let i = 0; i < 3; i++) {
      await expect(
        controller.login(
          { email: 'a@mesa.es', password: 'la-que-no-es' },
          respuesta(),
          '1.1.1.1',
        ),
      ).rejects.toBeTruthy();
    }
    expect(auth.login).toHaveBeenCalledTimes(3);

    // El cuarto intento ya ni llega al servicio
    await expect(
      controller.login(
        { email: 'a@mesa.es', password: 'da-igual' },
        respuesta(),
        '1.1.1.1',
      ),
    ).rejects.toBeInstanceOf(HttpException);
    expect(auth.login).toHaveBeenCalledTimes(3);
  });

  it('el bloqueo no afecta a otro usuario desde la misma IP', async () => {
    auth.login.mockRejectedValue(new Error('credenciales malas'));
    for (let i = 0; i < 3; i++) {
      await expect(
        controller.login(
          { email: 'a@mesa.es', password: 'x' },
          respuesta(),
          '1.1.1.1',
        ),
      ).rejects.toBeTruthy();
    }

    auth.login.mockResolvedValue({ token: 't', username: 'otro' });
    await expect(
      controller.login(
        { email: 'b@mesa.es', password: 'contraseña-larga' },
        respuesta(),
        '1.1.1.1',
      ),
    ).resolves.toEqual({ username: 'otro' });
  });
});
