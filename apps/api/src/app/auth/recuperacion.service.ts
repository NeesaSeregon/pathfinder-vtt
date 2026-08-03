import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { TokenRecuperacion } from './entities/token-recuperacion.entity';
import { EnviadorCorreo } from '../correo/enviador-correo';
import {
  correoPasswordCambiada,
  correoRecuperacion,
} from '../correo/plantillas';

/**
 * Cuánto vive un enlace de recuperación. OWASP pide "lo más corto que
 * resulte práctico"; 30 minutos da margen para ir a buscar el correo al
 * móvil sin dejar el vale tirado toda la tarde.
 */
const MINUTOS_VALIDEZ = 30;

/**
 * Bytes de aleatoriedad del token. 32 bytes = 256 bits, el mismo orden que
 * una clave AES-256: adivinarlo no es "difícil", es imposible.
 */
const BYTES_TOKEN = 32;

/**
 * "He olvidado mi contraseña", de punta a punta.
 *
 * LA REGLA QUE MANDA SOBRE TODAS: este servicio NUNCA revela si un correo
 * está registrado. solicitar() se comporta igual —mismo código, mismo
 * cuerpo, sin excepciones— exista la cuenta o no. Si respondiera distinto,
 * el formulario de "he olvidado mi contraseña" se convertiría en un
 * comprobador de qué correos tienen cuenta aquí, que es justo el primer
 * paso de cualquiera que quiera entrar en una.
 */
@Injectable()
export class RecuperacionService {
  private readonly log = new Logger(RecuperacionService.name);

  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly correo: EnviadorCorreo,
    private readonly config: ConfigService,
    @InjectRepository(TokenRecuperacion)
    private readonly tokens: Repository<TokenRecuperacion>,
  ) {}

  /**
   * Paso 1: alguien dice que ha olvidado su contraseña.
   *
   * No devuelve nada y no lanza nunca por "ese correo no existe": quien
   * llama responde 204 siempre.
   */
  async solicitar(email: string): Promise<void> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (!user) {
      // Ni correo ni fila ni pista. Se registra para poder distinguir en el
      // log "nadie pidió nada" de "se pidió y el correo no salió".
      this.log.log('Recuperación pedida para un correo sin cuenta');
      return;
    }

    // Los vales anteriores de este usuario dejan de valer. Si has pedido el
    // enlace dos veces porque el primero no llegaba, solo debe abrir el
    // último: el viejo se queda en tu bandeja y no queremos que siga siendo
    // una llave.
    await this.invalidarPendientes(user.id);

    const token = randomBytes(BYTES_TOKEN).toString('base64url');
    await this.tokens.save(
      this.tokens.create({
        userId: user.id,
        tokenHash: hashDeToken(token),
        expiraEn: new Date(Date.now() + MINUTOS_VALIDEZ * 60 * 1000),
        usadoEn: null,
      }),
    );

    await this.correo.enviar(
      correoRecuperacion(
        user.email,
        user.username,
        this.enlaceDe(token),
        MINUTOS_VALIDEZ,
      ),
    );
  }

  /**
   * Paso 2: canjear el vale por una contraseña nueva.
   *
   * Aquí SÍ se responde con un error si el token no sirve, y no hay
   * contradicción con lo de arriba: un token inválido no dice nada sobre
   * qué cuentas existen, y callárselo dejaría al usuario mirando una
   * pantalla que no reacciona cuando lo que pasa es que tardó media hora.
   */
  async restablecer(token: string, passwordNueva: string): Promise<void> {
    const vale = await this.tokens.findOne({
      where: { tokenHash: hashDeToken(token) },
    });

    // Un solo mensaje para las tres formas de no servir (inventado,
    // caducado, ya usado): al usuario legítimo le vale el mismo consejo y
    // no hay por qué detallarle a nadie en qué estado está un token.
    if (!vale || vale.usadoEn || vale.expiraEn.getTime() <= Date.now()) {
      throw new BadRequestException(
        'Este enlace ya no sirve: puede haber caducado o haberse usado. Pide uno nuevo.',
      );
    }

    // Marcar ANTES de cambiar la contraseña, y con la condición de que
    // siga sin usar. Si dos peticiones llegan a la vez con el mismo token,
    // el UPDATE solo afecta a una fila una vez: la segunda ve affected 0 y
    // se cae. Comprobar y luego escribir, sin más, dejaría la puerta a que
    // ambas pasaran el if antes de que ninguna hubiese escrito.
    const marcado = await this.tokens.update(
      { id: vale.id, usadoEn: IsNull() },
      { usadoEn: new Date() },
    );
    if (!marcado.affected) {
      throw new BadRequestException(
        'Este enlace ya no sirve: puede haber caducado o haberse usado. Pide uno nuevo.',
      );
    }

    // cambiarPassword sube tokenVersion, así que esto además ECHA a quien
    // tuviera una sesión abierta con la contraseña vieja. Es el punto del
    // flujo entero: quien restablece porque le han entrado espera que el
    // otro se caiga, no que aguante ocho horas más.
    await this.auth.cambiarPassword(vale.userId, passwordNueva);

    const user = await this.users.findById(vale.userId);
    if (user) {
      await this.correo.enviar(
        correoPasswordCambiada(user.email, user.username),
      );
    }
  }

  /**
   * Marca como usados los vales vivos de un usuario y, de paso, borra los
   * que ya caducaron hace tiempo.
   *
   * La limpieza va aquí, colgada de una petición real, en vez de en una
   * tarea programada: no hace falta traerse @nestjs/schedule para barrer
   * una tabla que crece a unas pocas filas por semana.
   */
  private async invalidarPendientes(userId: string): Promise<void> {
    await this.tokens.update(
      { userId, usadoEn: IsNull() },
      { usadoEn: new Date() },
    );
    await this.tokens.delete({ expiraEn: LessThan(haceUnaSemana()) });
  }

  /**
   * El enlace se construye desde APP_URL, NUNCA desde la cabecera Host de
   * la petición. Es la diferencia entre un sistema seguro y uno regalado:
   * con el Host, un atacante pide la recuperación de TU cuenta mandando
   * `Host: servidor-suyo.com`, el correo te llega a ti con un enlace hacia
   * él, y en cuanto lo pulsas se queda con tu token. Se llama host header
   * injection y es de los fallos más recurrentes en este flujo.
   */
  private enlaceDe(token: string): string {
    const base = this.config
      .get<string>('APP_URL', 'http://localhost:4200')
      .replace(/\/+$/, '');
    return `${base}/restablecer?token=${encodeURIComponent(token)}`;
  }
}

/**
 * SHA-256 en hexadecimal, que es lo que se guarda en la tabla. Determinista
 * a propósito: hay que poder BUSCAR la fila por él (ver el comentario largo
 * en la entidad sobre por qué aquí no toca bcrypt).
 */
export function hashDeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function haceUnaSemana(): Date {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}
