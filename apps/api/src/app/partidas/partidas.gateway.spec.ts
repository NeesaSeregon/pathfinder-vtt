import { extraerTokenDeCookie } from './partidas.gateway';

describe('extraerTokenDeCookie', () => {
  it('saca el JWT del header Cookie del handshake', () => {
    expect(
      extraerTokenDeCookie('otra=valor; pf_sesion=un.jwt.firmado; mas=cosas'),
    ).toBe('un.jwt.firmado');
  });

  it('devuelve undefined sin header o sin nuestra cookie', () => {
    expect(extraerTokenDeCookie(undefined)).toBeUndefined();
    expect(extraerTokenDeCookie('otra=valor')).toBeUndefined();
  });

  it('no confunde una cookie cuyo nombre CONTIENE al nuestro', () => {
    expect(extraerTokenDeCookie('xpf_sesion=impostor')).toBeUndefined();
  });
});
