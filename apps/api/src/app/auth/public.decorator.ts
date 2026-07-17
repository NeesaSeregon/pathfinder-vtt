import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICO = 'esPublico';

/**
 * Marca un endpoint como accesible SIN token. Todo lo demás queda
 * protegido por el AuthGuard global: seguro por defecto.
 */
export const Public = () => SetMetadata(ES_PUBLICO, true);
