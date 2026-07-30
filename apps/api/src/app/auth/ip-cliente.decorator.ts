import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * IP REAL del visitante, la que usa el freno de login para contar fallos.
 *
 * Detrás de Cloudflare (y de un proxy inverso como el Traefik de Coolify)
 * req.ip sería la IP
 * del último salto, no la de la persona: TODO el mundo compartiría IP y el
 * freno no distinguiría a un atacante de un jugador —o peor, los fallos de
 * uno arrastrarían a los demás—. Cloudflare manda siempre la IP verdadera en
 * la cabecera CF-Connecting-IP, así que se prefiere esa cuando está.
 *
 * OJO DE SEGURIDAD: esa cabecera es de fiar SOLO si al origen no se puede
 * llegar sin pasar por Cloudflare. Hay que cerrar el cortafuegos del VPS a
 * los rangos de Cloudflare (ver la guía de despliegue); de lo contrario
 * cualquiera podría falsificarla llamando directo a la IP del servidor y
 * saltarse el freno (o inculpar a una IP ajena).
 *
 * Sin la cabecera (desarrollo, LAN, o un proxy que no sea Cloudflare) cae en
 * req.ip, que Express deriva del X-Forwarded-For según 'trust proxy'.
 */
export function ipDeLaPeticion(
  req: Pick<Request, 'headers' | 'ip'>,
): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim().length > 0) {
    return cf.trim();
  }
  return req.ip ?? 'desconocida';
}

export const IpCliente = createParamDecorator(
  (_datos: unknown, contexto: ExecutionContext): string =>
    ipDeLaPeticion(contexto.switchToHttp().getRequest<Request>()),
);
