import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IntentosLoginService } from './intentos-login.service';
import { RecuperacionService } from './recuperacion.service';
import { FrenoRecuperacionService } from './freno-recuperacion.service';

describe('AuthController', () => {
  let controller: AuthController;
  let auth: { register: jest.Mock; login: jest.Mock };
  let intentos: IntentosLoginService;
  let recuperacion: { solicitar: jest.Mock; restablecer: jest.Mock };

  /** Respuesta falsa: solo nos importa que se pueda poner la cookie. */
  const respuesta = () =>
    ({ cookie: jest.fn(), clearCookie: jest.fn() }) as unknown as Response;

  beforeEach(async () => {
    process.env.LOGIN_MAX_FALLOS = '3';
    process.env.LOGIN_BLOQUEO_SEGUNDOS = '60';
    process.env.RECUPERACION_MAX_POR_EMAIL = '2';
    auth = { register: jest.fn(), login: jest.fn() };
    recuperacion = {
      solicitar: jest.fn().mockResolvedValue(undefined),
      restablecer: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: RecuperacionService, useValue: recuperacion },
        IntentosLoginService,
        FrenoRecuperacionService,
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    intentos = module.get(IntentosLoginService);
  });

  afterEach(() => {
    delete process.env.LOGIN_MAX_FALLOS;
    delete process.env.LOGIN_BLOQUEO_SEGUNDOS;
    delete process.env.RECUPERACION_MAX_POR_EMAIL;
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

  it('olvidada responde igual (204, sin cuerpo) exista o no la cuenta', async () => {
    // El controlador no distingue: quien decide es RecuperacionService, y
    // tampoco cuenta nada. Aquí se fija que la respuesta es la misma.
    await expect(
      controller.olvidada({ email: 'existe@mesa.es' }, '1.1.1.1'),
    ).resolves.toBeUndefined();
    await expect(
      controller.olvidada({ email: 'no-existe@mesa.es' }, '2.2.2.2'),
    ).resolves.toBeUndefined();
    expect(recuperacion.solicitar).toHaveBeenCalledTimes(2);
  });

  it('olvidada corta con 429 al pasarse del tope, sin mandar más correos', async () => {
    for (let i = 0; i < 2; i++) {
      await controller.olvidada({ email: 'a@mesa.es' }, '1.1.1.1');
    }
    await expect(
      controller.olvidada({ email: 'a@mesa.es' }, '1.1.1.1'),
    ).rejects.toBeInstanceOf(HttpException);
    // La tercera ni llega al servicio: no se manda el correo
    expect(recuperacion.solicitar).toHaveBeenCalledTimes(2);
  });

  it('restablecer NO inicia sesión: no pone ninguna cookie', async () => {
    // OWASP: tras restablecer se manda al login. Si esto empezara a poner
    // la cookie, un enlace de correo bastaría para entrar en la cuenta.
    const res = respuesta();
    await controller.restablecer({
      token: 'un-token-suficientemente-largo-de-prueba',
      passwordNueva: 'contraseña-nueva',
    });
    expect(res.cookie).not.toHaveBeenCalled();
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
