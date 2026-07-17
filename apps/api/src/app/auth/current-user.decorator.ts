import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '@pathfinder/shared';

/**
 * Inyecta en el controlador el payload del JWT que el AuthGuard dejó
 * en la request. Uso: metodo(@CurrentUser() user: JwtPayload).
 */
export const CurrentUser = createParamDecorator(
  (_datos: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest();
    return request['user'];
  },
);
