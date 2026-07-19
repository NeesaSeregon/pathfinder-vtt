import { IntentosLoginService } from './intentos-login.service';

describe('IntentosLoginService', () => {
  let intentos: IntentosLoginService;

  beforeEach(() => {
    intentos = new IntentosLoginService();
    process.env.LOGIN_MAX_FALLOS = '3';
    process.env.LOGIN_BLOQUEO_SEGUNDOS = '60';
  });

  afterEach(() => {
    delete process.env.LOGIN_MAX_FALLOS;
    delete process.env.LOGIN_BLOQUEO_SEGUNDOS;
    jest.useRealTimers();
  });

  it('de entrada no bloquea a nadie', () => {
    expect(intentos.segundosBloqueado('a@mesa.es', '1.1.1.1')).toBe(0);
  });

  it('bloquea al llegar al máximo de fallos, no antes', () => {
    intentos.registrarFallo('a@mesa.es', '1.1.1.1');
    intentos.registrarFallo('a@mesa.es', '1.1.1.1');
    expect(intentos.segundosBloqueado('a@mesa.es', '1.1.1.1')).toBe(0);

    intentos.registrarFallo('a@mesa.es', '1.1.1.1');
    expect(intentos.segundosBloqueado('a@mesa.es', '1.1.1.1')).toBeGreaterThan(0);
  });

  it('entrar bien borra los fallos acumulados', () => {
    intentos.registrarFallo('a@mesa.es', '1.1.1.1');
    intentos.registrarFallo('a@mesa.es', '1.1.1.1');
    intentos.limpiar('a@mesa.es', '1.1.1.1');

    intentos.registrarFallo('a@mesa.es', '1.1.1.1');
    expect(intentos.segundosBloqueado('a@mesa.es', '1.1.1.1')).toBe(0);
  });

  /**
   * La cuenta va por email + IP. Si fuera solo por email, cualquiera podría
   * dejar fuera a otro usuario fallando a propósito con su correo.
   */
  it('el bloqueo no salpica a la misma cuenta desde otra IP', () => {
    for (let i = 0; i < 3; i++) {
      intentos.registrarFallo('a@mesa.es', '1.1.1.1');
    }
    expect(intentos.segundosBloqueado('a@mesa.es', '1.1.1.1')).toBeGreaterThan(0);
    expect(intentos.segundosBloqueado('a@mesa.es', '9.9.9.9')).toBe(0);
  });

  it('ni a otra cuenta desde la misma IP', () => {
    for (let i = 0; i < 3; i++) {
      intentos.registrarFallo('a@mesa.es', '1.1.1.1');
    }
    expect(intentos.segundosBloqueado('b@mesa.es', '1.1.1.1')).toBe(0);
  });

  it('el email se normaliza: mayúsculas y espacios son el mismo intento', () => {
    for (let i = 0; i < 3; i++) {
      intentos.registrarFallo('  A@Mesa.ES ', '1.1.1.1');
    }
    expect(intentos.segundosBloqueado('a@mesa.es', '1.1.1.1')).toBeGreaterThan(0);
  });

  it('pasado el tiempo de bloqueo se puede volver a intentar', () => {
    jest.useFakeTimers();
    for (let i = 0; i < 3; i++) {
      intentos.registrarFallo('a@mesa.es', '1.1.1.1');
    }
    expect(intentos.segundosBloqueado('a@mesa.es', '1.1.1.1')).toBeGreaterThan(0);

    jest.advanceTimersByTime(61_000);
    expect(intentos.segundosBloqueado('a@mesa.es', '1.1.1.1')).toBe(0);
  });

  it('insistir durante el bloqueo alarga la espera', () => {
    jest.useFakeTimers();
    for (let i = 0; i < 3; i++) {
      intentos.registrarFallo('a@mesa.es', '1.1.1.1');
    }
    jest.advanceTimersByTime(50_000); // quedan ~10s
    intentos.registrarFallo('a@mesa.es', '1.1.1.1');

    // La ventana se renueva: vuelven a ser 60s desde el último fallo
    expect(
      intentos.segundosBloqueado('a@mesa.es', '1.1.1.1'),
    ).toBeGreaterThan(50);
  });
});
