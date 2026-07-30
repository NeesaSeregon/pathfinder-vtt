import { Request } from 'express';
import { ipDeLaPeticion } from './ip-cliente.decorator';

/** Petición mínima: solo lo que la función mira. */
const pet = (
  headers: Record<string, string | string[] | undefined>,
  ip?: string,
) => ({ headers, ip }) as unknown as Pick<Request, 'headers' | 'ip'>;

describe('ipDeLaPeticion', () => {
  it('usa CF-Connecting-IP cuando Cloudflare la manda', () => {
    expect(
      ipDeLaPeticion(pet({ 'cf-connecting-ip': '203.0.113.7' }, '172.16.0.1')),
    ).toBe('203.0.113.7');
  });

  it('cae en req.ip si no hay cabecera de Cloudflare (dev, LAN)', () => {
    expect(ipDeLaPeticion(pet({}, '192.168.1.50'))).toBe('192.168.1.50');
  });

  it('ignora una cabecera vacía y usa req.ip', () => {
    expect(ipDeLaPeticion(pet({ 'cf-connecting-ip': '   ' }, '10.0.0.9'))).toBe(
      '10.0.0.9',
    );
  });

  it('ignora una cabecera repetida (array) y usa req.ip', () => {
    // Una cabecera duplicada llega como array; no es lo que manda Cloudflare,
    // así que no nos fiamos y caemos en req.ip.
    expect(
      ipDeLaPeticion(pet({ 'cf-connecting-ip': ['1.1.1.1', '2.2.2.2'] }, '10.0.0.1')),
    ).toBe('10.0.0.1');
  });

  it('nunca devuelve undefined aunque falte todo', () => {
    expect(ipDeLaPeticion(pet({}, undefined))).toBe('desconocida');
  });
});
