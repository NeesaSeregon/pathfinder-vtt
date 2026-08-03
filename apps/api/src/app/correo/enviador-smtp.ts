import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { EnviadorCorreo, MensajeCorreo } from './enviador-correo';

/**
 * El transporte real, por SMTP.
 *
 * Va por SMTP y no por el SDK de ningún proveedor A PROPÓSITO: cambiar de
 * Resend a Brevo, a Postmark o a SES es cambiar cuatro variables de
 * entorno, sin tocar una línea de código ni añadir una dependencia nueva.
 *
 * Para Resend, que es lo que usamos:
 *   MAIL_HOST=smtp.resend.com
 *   MAIL_PORT=465
 *   MAIL_USER=resend
 *   MAIL_PASSWORD=<la API key>
 *   MAIL_FROM="Pathfinder VTT <no-responder@rolnees.com>"
 */
@Injectable()
export class EnviadorSmtp extends EnviadorCorreo {
  private readonly log = new Logger('Correo');
  private readonly transporte: Transporter;
  private readonly remitente: string;

  constructor(config: ConfigService) {
    super();
    const puerto = Number(config.get('MAIL_PORT', 465));
    this.remitente = exigir(config, 'MAIL_FROM');
    this.transporte = createTransport({
      host: exigir(config, 'MAIL_HOST'),
      port: puerto,
      // El 465 es TLS desde el primer byte; el 587 arranca en claro y sube
      // a TLS con STARTTLS. nodemailer lo deduce de este booleano.
      secure: puerto === 465,
      auth: {
        user: exigir(config, 'MAIL_USER'),
        pass: exigir(config, 'MAIL_PASSWORD'),
      },
    });
  }

  async enviar(mensaje: MensajeCorreo): Promise<void> {
    try {
      await this.transporte.sendMail({
        from: this.remitente,
        to: mensaje.para,
        subject: mensaje.asunto,
        text: mensaje.texto,
        html: mensaje.html,
      });
    } catch (error) {
      // Se registra y se traga. Quien llama (RecuperacionService) responde
      // 204 pase lo que pase para no delatar qué correos existen, así que
      // propagar esto solo serviría para convertir un fallo del proveedor
      // en un 500 que además sería una pista. Este log es el único sitio
      // donde se ve que el correo no salió: hay que vigilarlo.
      this.log.error(
        `No se pudo enviar el correo "${mensaje.asunto}": ${error}`,
      );
    }
  }
}

/**
 * Lee una variable exigiendo que traiga algo. No vale getOrThrow: ese solo
 * se queja si la variable está SIN DEFINIR, y por docker-compose llegan
 * siempre definidas — vacías cuando el campo del panel se dejó en blanco,
 * que es el despiste probable. Con getOrThrow se arrancaría tan feliz y se
 * intentaría enviar sin remitente ni contraseña, fallando en cada correo.
 * Aquí revienta el arranque, que es cuando se mira el log.
 */
function exigir(config: ConfigService, clave: string): string {
  const valor = config.get<string>(clave)?.trim();
  if (!valor) {
    throw new Error(
      `Falta ${clave}: hay MAIL_HOST configurado, así que las cinco MAIL_* son obligatorias.`,
    );
  }
  return valor;
}
