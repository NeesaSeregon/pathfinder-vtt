import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CuentaDetalle, JwtPayload } from '@pathfinder/shared';
import { CuentaService } from './cuenta.service';
import { BorrarCuentaDto, CambiarPasswordDto } from './dto/cuenta.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { COOKIE_SESION } from '../auth/auth.constants';
import { ponerCookieSesion } from '../auth/auth.cookie';

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

  /**
   * Cambiar la contraseña cierra las sesiones de los DEMÁS dispositivos
   * (sube el tokenVersion) pero NO esta: aquí se repone la cookie con un
   * token de la generación nueva. Sin este paso, el usuario se expulsaría
   * a sí mismo a /entrar justo después de hacer lo que le hemos pedido.
   */
  @HttpCode(204)
  @Patch('password')
  async cambiarPassword(
    @Body() dto: CambiarPasswordDto,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = await this.cuenta.cambiarPassword(
      user.sub,
      dto.passwordActual,
      dto.passwordNueva,
    );
    if (token) {
      ponerCookieSesion(res, token);
    }
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
