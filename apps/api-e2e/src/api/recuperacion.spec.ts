import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import axios from 'axios';

/**
 * El flujo COMPLETO de recuperación, incluido el canje del token, contra la
 * API y el Postgres de verdad.
 *
 * Puede hacerlo porque el transporte de correo de desarrollo deja cada
 * mensaje en un .json dentro de CORREO_BUZON_DIR (ver EnviadorConsola): el
 * test lee el buzón y saca el enlace, que es lo más parecido a "abrir el
 * correo" sin una cuenta real ni secretos en el CI.
 *
 * SI NO HAY BUZÓN CONFIGURADO, los tests que necesitan el token se saltan
 * en vez de fallar: quien levante la API a mano sin esa variable no debe
 * encontrarse un rojo que no significa nada. La parte que no lo necesita
 * (que no se filtre qué correos existen) se comprueba siempre.
 */
const BUZON = process.env.CORREO_BUZON_DIR;

/** El token del último correo que haya caído en el buzón. */
async function ultimoTokenDelBuzon(): Promise<string> {
  const ficheros = (await readdir(BUZON as string))
    .filter((f) => f.endsWith('.json'))
    .sort();
  const ultimo = ficheros[ficheros.length - 1];
  const mensaje = JSON.parse(
    await readFile(join(BUZON as string, ultimo), 'utf8'),
  ) as { texto: string };
  const token = /token=([\w%-]+)/.exec(mensaje.texto)?.[1];
  if (!token) {
    throw new Error(`El último correo no traía token: ${mensaje.texto}`);
  }
  return decodeURIComponent(token);
}

describe('recuperación de contraseña', () => {
  const sufijo = Date.now();
  const email = `recu-api-${sufijo}@mesa.es`;
  const passwordOriginal = 'contraseña-original';

  beforeAll(async () => {
    await axios.post('/api/auth/register', {
      username: `recu-api-${sufijo}`,
      email,
      password: passwordOriginal,
    });
  });

  it('responde 204 tanto si la cuenta existe como si no', async () => {
    const conCuenta = await axios.post('/api/auth/password/olvidada', {
      email,
    });
    const sinCuenta = await axios.post('/api/auth/password/olvidada', {
      email: `no-existe-${sufijo}@mesa.es`,
    });

    expect(conCuenta.status).toBe(204);
    expect(sinCuenta.status).toBe(204);
    expect(conCuenta.data).toEqual(sinCuenta.data);
  });

  it('rechaza un token inventado con 400', async () => {
    const res = await axios.post(
      '/api/auth/password/restablecer',
      {
        token: 'inventado-pero-suficientemente-largo-para-el-dto',
        passwordNueva: 'contraseña-nueva-larga',
      },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(400);
  });

  it('no acepta una contraseña más corta que el mínimo', async () => {
    const res = await axios.post(
      '/api/auth/password/restablecer',
      {
        token: 'inventado-pero-suficientemente-largo-para-el-dto',
        passwordNueva: 'corta',
      },
      { validateStatus: () => true },
    );
    // 400 del ValidationPipe, ANTES de mirar siquiera el token
    expect(res.status).toBe(400);
  });

  // Este bloque necesita leer el correo: solo corre si hay buzón
  (BUZON ? describe : describe.skip)('canjeando el token del correo', () => {
    const passwordNueva = 'contraseña-recuperada';

    it('el ciclo entero: pedir, canjear, entrar con la nueva', async () => {
      await axios.post('/api/auth/password/olvidada', { email });
      const token = await ultimoTokenDelBuzon();

      const restablecida = await axios.post(
        '/api/auth/password/restablecer',
        { token, passwordNueva },
        { validateStatus: () => true },
      );
      expect(restablecida.status).toBe(204);

      // La nueva entra
      const conNueva = await axios.post(
        '/api/auth/login',
        { email, password: passwordNueva },
        { validateStatus: () => true },
      );
      expect(conNueva.status).toBe(200);

      // Y la vieja ya no
      const conVieja = await axios.post(
        '/api/auth/login',
        { email, password: passwordOriginal },
        { validateStatus: () => true },
      );
      expect(conVieja.status).toBe(401);
    });

    it('el mismo token no vale una segunda vez', async () => {
      await axios.post('/api/auth/password/olvidada', { email });
      const token = await ultimoTokenDelBuzon();

      const primera = await axios.post(
        '/api/auth/password/restablecer',
        { token, passwordNueva: 'otra-contraseña-larga' },
        { validateStatus: () => true },
      );
      const segunda = await axios.post(
        '/api/auth/password/restablecer',
        { token, passwordNueva: 'y-otra-mas-larga' },
        { validateStatus: () => true },
      );

      expect(primera.status).toBe(204);
      expect(segunda.status).toBe(400);
    });
  });
});
