/** Un correo saliente, ya redactado. */
export interface MensajeCorreo {
  para: string;
  asunto: string;
  /** Cuerpo en texto plano. SIEMPRE se envía, aunque haya HTML. */
  texto: string;
  /** Cuerpo en HTML. Opcional: el texto plano es el que manda. */
  html?: string;
}

/**
 * Cómo salen los correos de la aplicación.
 *
 * Es una CLASE ABSTRACTA y no una interfaz a propósito: las interfaces de
 * TypeScript desaparecen al compilar y Nest no podría usarlas como token de
 * inyección. Así se puede pedir `EnviadorCorreo` en un constructor y que el
 * módulo decida qué implementación entra (ver correo.module.ts).
 *
 * Existe esta capa para que el flujo de recuperación sea probable sin una
 * cuenta de correo real: en desarrollo y en CI entra EnviadorConsola y el
 * enlace se lee del log o del buzón en disco, sin secretos en el runner.
 */
export abstract class EnviadorCorreo {
  abstract enviar(mensaje: MensajeCorreo): Promise<void>;
}
