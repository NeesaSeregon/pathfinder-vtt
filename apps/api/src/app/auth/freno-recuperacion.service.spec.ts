import { FrenoRecuperacionService } from './freno-recuperacion.service';

describe('FrenoRecuperacionService', () => {
  let freno: FrenoRecuperacionService;

  beforeEach(() => {
    process.env.RECUPERACION_MAX_POR_EMAIL = '2';
    process.env.RECUPERACION_MAX_POR_IP = '3';
    process.env.RECUPERACION_VENTANA_SEGUNDOS = '3600';
    freno = new FrenoRecuperacionService();
  });

  afterEach(() => {
    delete process.env.RECUPERACION_MAX_POR_EMAIL;
    delete process.env.RECUPERACION_MAX_POR_IP;
    delete process.env.RECUPERACION_VENTANA_SEGUNDOS;
  });

  it('deja pasar hasta el tope por email y corta después', () => {
    expect(freno.registrarYComprobar('a@mesa.es', '1.1.1.1')).toBe(true);
    expect(freno.registrarYComprobar('a@mesa.es', '1.1.1.1')).toBe(true);
    expect(freno.registrarYComprobar('a@mesa.es', '1.1.1.1')).toBe(false);
  });

  it('cuenta TODAS las peticiones, no solo los fallos', () => {
    // A diferencia del freno del login: aquí cada acierto manda un correo a
    // un tercero, así que acertar también tiene que contar.
    freno.registrarYComprobar('a@mesa.es', '1.1.1.1');
    freno.registrarYComprobar('a@mesa.es', '1.1.1.1');
    expect(freno.registrarYComprobar('a@mesa.es', '9.9.9.9')).toBe(false);
  });

  it('corta por IP aunque cada petición lleve un correo distinto', () => {
    // El caso de recorrer una lista de correos desde el mismo sitio
    expect(freno.registrarYComprobar('a@mesa.es', '1.1.1.1')).toBe(true);
    expect(freno.registrarYComprobar('b@mesa.es', '1.1.1.1')).toBe(true);
    expect(freno.registrarYComprobar('c@mesa.es', '1.1.1.1')).toBe(true);
    expect(freno.registrarYComprobar('d@mesa.es', '1.1.1.1')).toBe(false);
  });

  it('el email se normaliza: no se esquiva con mayúsculas ni espacios', () => {
    expect(freno.registrarYComprobar('a@mesa.es', '1.1.1.1')).toBe(true);
    expect(freno.registrarYComprobar(' A@MESA.ES ', '2.2.2.2')).toBe(true);
    expect(freno.registrarYComprobar('a@Mesa.es', '3.3.3.3')).toBe(false);
  });

  it('un email bloqueado no bloquea a otro desde otra IP', () => {
    freno.registrarYComprobar('a@mesa.es', '1.1.1.1');
    freno.registrarYComprobar('a@mesa.es', '1.1.1.1');
    expect(freno.registrarYComprobar('b@mesa.es', '2.2.2.2')).toBe(true);
  });

  it('pasada la ventana se vuelve a poder pedir', () => {
    process.env.RECUPERACION_VENTANA_SEGUNDOS = '0';
    const efimero = new FrenoRecuperacionService();
    expect(efimero.registrarYComprobar('a@mesa.es', '1.1.1.1')).toBe(true);
    expect(efimero.registrarYComprobar('a@mesa.es', '1.1.1.1')).toBe(true);
  });
});
