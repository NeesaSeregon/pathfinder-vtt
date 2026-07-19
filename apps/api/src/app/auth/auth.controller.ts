import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Ip,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtPayload, SesionRespuesta } from '@pathfinder/shared';
import { AuthService } from './auth.service';
import { CredencialesDto, RegistroDto } from './dto/credenciales.dto';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import { COOKIE_SESION } from './auth.constants';
import { IntentosLoginService } from './intentos-login.service';

const OCHO_HORAS_MS = 8 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly intentos: IntentosLoginService,
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
    @Ip() ip: string,
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

  private ponerCookie(res: Response, token: string): void {
    res.cookie(COOKIE_SESION, token, {
      // httpOnly: JavaScript no puede leerla → un XSS no puede robarla
      httpOnly: true,
      // strict: el navegador solo la envía en peticiones desde NUESTRA
      // página → la protección anti-CSRF nos sale casi gratis
      sameSite: 'strict',
      // secure exige HTTPS; en desarrollo (y jugando por LAN) vamos por http
      secure: process.env.NODE_ENV === 'production',
      maxAge: OCHO_HORAS_MS,
      path: '/',
    });
  }
}
