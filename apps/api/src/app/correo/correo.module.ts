import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnviadorCorreo } from './enviador-correo';
import { EnviadorConsola } from './enviador-consola';
import { EnviadorSmtp } from './enviador-smtp';

/**
 * Decide POR SÍ SOLO qué transporte entra, mirando si hay configuración de
 * SMTP. Sin MAIL_HOST no hay a dónde enviar, así que cae en la consola:
 * eso hace que `nx serve api` recién clonado funcione sin configurar nada.
 *
 * Se puede forzar con MAIL_TRANSPORTE=consola|smtp. Sirve sobre todo para
 * el caso contrario: tener las variables de SMTP puestas y aun así querer
 * que los correos NO salgan (probando contra la base de datos de verdad,
 * por ejemplo).
 *
 * En producción NO se avisa por debajo: si alguien despliega sin MAIL_HOST,
 * el arranque deja un error bien visible en el log — la recuperación
 * seguiría respondiendo 204 (no puede delatar nada) y el correo no
 * llegaría nunca, que es el fallo más difícil de diagnosticar de todos.
 */
@Global()
@Module({
  providers: [
    {
      provide: EnviadorCorreo,
      inject: [ConfigService],
      useFactory: (config: ConfigService): EnviadorCorreo => {
        const forzado = config.get<string>('MAIL_TRANSPORTE')?.trim();
        // trim + vacío: por docker-compose las variables llegan DEFINIDAS
        // aunque el campo del panel esté en blanco, así que "existe" no
        // basta para dar por configurado el SMTP.
        const haySmtp = !!config.get<string>('MAIL_HOST')?.trim();
        const usarSmtp = forzado ? forzado === 'smtp' : haySmtp;

        if (usarSmtp) {
          return new EnviadorSmtp(config);
        }
        const mensaje =
          'Correo en modo CONSOLA: los mensajes NO se envían, se escriben en el log.';
        if (config.get('NODE_ENV') === 'production') {
          Logger.error(`${mensaje} Falta configurar MAIL_HOST.`, 'Correo');
        } else {
          Logger.log(mensaje, 'Correo');
        }
        return new EnviadorConsola();
      },
    },
  ],
  exports: [EnviadorCorreo],
})
export class CorreoModule {}
