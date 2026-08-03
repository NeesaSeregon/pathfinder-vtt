import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { EnviadorCorreo, MensajeCorreo } from './enviador-correo';

/**
 * El transporte de desarrollo y de pruebas: no manda nada a ninguna parte.
 *
 * Escupe el correo entero por el log, así que en local basta con mirar la
 * consola de `nx serve api` y copiar el enlace de recuperación.
 *
 * Si además está definido CORREO_BUZON_DIR, deja cada mensaje en un .json
 * dentro de esa carpeta. Eso es lo que permite que el e2e de la API
 * complete el flujo de verdad: el test lee el buzón, saca el token del
 * cuerpo y lo canjea, sin cuenta de correo ni secretos en el CI.
 */
@Injectable()
export class EnviadorConsola extends EnviadorCorreo {
  private readonly log = new Logger('Correo');

  async enviar(mensaje: MensajeCorreo): Promise<void> {
    this.log.log(
      `\n--- CORREO (no enviado: transporte de consola) ---\n` +
        `Para:   ${mensaje.para}\n` +
        `Asunto: ${mensaje.asunto}\n\n` +
        `${mensaje.texto}\n` +
        `--- fin del correo ---`,
    );

    const buzon = process.env.CORREO_BUZON_DIR;
    if (!buzon) {
      return;
    }
    try {
      await mkdir(buzon, { recursive: true });
      await writeFile(
        join(buzon, `${Date.now()}-${randomUUID()}.json`),
        JSON.stringify(mensaje, null, 2),
        'utf8',
      );
    } catch (error) {
      // El buzón es una comodidad para las pruebas: que falle no puede
      // tumbar la petición que lo provocó.
      this.log.warn(`No se pudo escribir en el buzón: ${error}`);
    }
  }
}
