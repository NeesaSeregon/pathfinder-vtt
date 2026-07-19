import { Body, Controller, Delete, Get, HttpCode, Res } from '@nestjs/common';
import { Response } from 'express';
import { CuentaDetalle, JwtPayload } from '@pathfinder/shared';
import { CuentaService } from './cuenta.service';
import { BorrarCuentaDto } from './dto/borrar-cuenta.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { COOKIE_SESION } from '../auth/auth.constants';

/**
 * Siempre sobre la cuenta del usuario de la sesión: no hay ninguna ruta
 * con :id, así que nadie puede tocar la cuenta de otro ni por error.
 */
@Controller('cuenta')
export class CuentaController {
  constructor(private readonly cuenta: CuentaService) {}

  @Get()
  detalle(@CurrentUser() user: JwtPayload): Promise<CuentaDetalle> {
    return this.cuenta.detalle(user.sub);
  }

  @HttpCode(204)
  @Delete()
  async borrar(
    @Body() dto: BorrarCuentaDto,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.cuenta.borrar(user.sub, dto.password);
    // La cuenta ya no existe: la cookie que quedaba solo daría 401 raros
    res.clearCookie(COOKIE_SESION, { path: '/' });
  }
}
