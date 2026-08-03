import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtPayload, SesionRespuesta } from '@pathfinder/shared';
import { AuthService } from './auth.service';
import { CredencialesDto, RegistroDto } from './dto/credenciales.dto';
import {
  OlvidePasswordDto,
  RestablecerPasswordDto,
} from './dto/recuperacion.dto';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import { IpCliente } from './ip-cliente.decorator';
import { COOKIE_SESION } from './auth.constants';
import { ponerCookieSesion } from './auth.cookie';
import { IntentosLoginService } from './intentos-login.service';
import { RecuperacionService } from './recuperacion.service';
import { FrenoRecuperacionService } from './freno-recuperacion.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly intentos: IntentosLoginService,
    private readonly recuperacion: RecuperacionService,
    private readonly freno: FrenoRecuperacionService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() datos: RegistroDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SesionRespuesta> {
    const sesion = await this.auth.register(datos);
    this.ponerCookie(res, sesion.token);
    return { username: sesion.username };
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() credenciales: CredencialesDto,
    @Res({ passthrough: true }) res: Response,
    @IpCliente() ip: string,
  ): Promise<SesionRespuesta> {
    const { email, password } = credenciales;

    // Freno de fuerza bruta: tras varios fallos seguidos, esta pareja de
    // email e IP descansa un rato. 429 y no 401, para que quede claro que
    // no es "la contraseña está mal" sino "deja de insistir".
    const espera = this.intentos.segundosBloqueado(email, ip);
    if (espera > 0) {
      throw new HttpException(
        `Demasiados intentos fallidos. Prueba de nuevo en ${Math.ceil(
          espera / 60,
        )} minutos.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      const sesion = await this.auth.login(email, password);
      this.intentos.limpiar(email, ip);
      this.ponerCookie(res, sesion.token);
      return { username: sesion.username };
    } catch (error) {
      this.intentos.registrarFallo(email, ip);
      throw error;
    }
  }

  /** ¿Quién soy? El front lo usa para restaurar la sesión al recargar. */
  @Get('me')
  me(@CurrentUser() user: JwtPayload): SesionRespuesta {
    return { username: user.username };
  }

  /** Público a propósito: hasta una sesión caducada debe poder limpiarse. */
  @Public()
  @HttpCode(204)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(COOKIE_SESION, { path: '/' });
  }

  /**
   * "He olvidado mi contraseña". SIEMPRE 204, exista o no esa cuenta: si
   * respondiera distinto, este formulario sería un comprobador gratuito de
   * qué correos están registrados aquí.
   */
  @Public()
  @HttpCode(204)
  @Post('password/olvidada')
  async olvidada(
    @Body() dto: OlvidePasswordDto,
    @IpCliente() ip: string,
  ): Promise<void> {
    // El 429 no delata nada (se cuentan las peticiones, no los aciertos) y
    // sin él cualquiera podría usar nuestro servidor para llenarle el buzón
    // a otro y quemarnos la cuota del proveedor de correo.
    if (!this.freno.registrarYComprobar(dto.email, ip)) {
      throw new HttpException(
        'Has pedido demasiados correos de recuperación. Espera un rato antes de volver a intentarlo.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.recuperacion.solicitar(dto.email);
  }

  /**
   * Canjear el enlace del correo por una contraseña nueva.
   *
   * NO se inicia sesión al terminar (nada de poner la cookie aquí): se
   * manda al usuario a /entrar para que estrene la contraseña. Lo pide
   * OWASP y de paso confirma que se ha quedado con la que acaba de elegir.
   */
  @Public()
  @HttpCode(204)
  @Post('password/restablecer')
  async restablecer(@Body() dto: RestablecerPasswordDto): Promise<void> {
    await this.recuperacion.restablecer(dto.token, dto.passwordNueva);
  }

  private ponerCookie(res: Response, token: string): void {
    ponerCookieSesion(res, token);
  }
}
