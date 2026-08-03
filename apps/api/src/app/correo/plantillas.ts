import { MensajeCorreo } from './enviador-correo';

/**
 * Los correos que manda la aplicación. Son funciones puras (datos → texto)
 * para poder comprobarlas en un test sin levantar nada.
 *
 * Todos llevan cuerpo en TEXTO PLANO además del HTML, y no por purismo:
 * un correo solo-HTML puntúa peor en los filtros antispam, y hay clientes
 * que siguen mostrando el texto.
 */

/** Envoltorio HTML mínimo. Estilos EN LÍNEA: los correos no tienen <style>. */
function maquetar(cuerpo: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:34rem">${cuerpo}</div>`;
}

/**
 * El correo con el enlace de recuperación.
 *
 * Dice EXPLÍCITAMENTE cuánto dura el enlace: sin eso, quien lo abre a la
 * mañana siguiente cree que la aplicación está rota en vez de entender que
 * el vale ha caducado.
 */
export function correoRecuperacion(
  para: string,
  username: string,
  enlace: string,
  minutosValidez: number,
): MensajeCorreo {
  const texto = `Hola, ${username}:

Alguien ha pedido restablecer la contraseña de tu cuenta de Pathfinder VTT.
Si has sido tú, abre este enlace:

${enlace}

El enlace caduca en ${minutosValidez} minutos y solo se puede usar una vez.

Si no has sido tú, no hagas nada: tu contraseña sigue como estaba y este
enlace caducará solo.`;

  return {
    para,
    asunto: 'Restablecer tu contraseña de Pathfinder VTT',
    texto,
    html: maquetar(
      `<p>Hola, <strong>${escapar(username)}</strong>:</p>
<p>Alguien ha pedido restablecer la contraseña de tu cuenta de Pathfinder VTT. Si has sido tú, abre este enlace:</p>
<p><a href="${escapar(enlace)}" style="display:inline-block;padding:0.7rem 1.2rem;background:#5b3fa8;color:#fff;text-decoration:none;border-radius:6px">Elegir una contraseña nueva</a></p>
<p style="color:#666;font-size:13px">El enlace caduca en ${minutosValidez} minutos y solo se puede usar una vez.</p>
<p style="color:#666;font-size:13px">Si no has sido tú, no hagas nada: tu contraseña sigue como estaba y este enlace caducará solo.</p>`,
    ),
  };
}

/**
 * El aviso de que la contraseña ACABA de cambiar.
 *
 * Es la única alarma que tiene el usuario si le han entrado en la cuenta,
 * así que se manda tanto al restablecer por correo como al cambiarla desde
 * /cuenta. Que no sirva para deshacer nada no lo hace inútil: convierte un
 * robo silencioso en algo que se nota el mismo día.
 */
export function correoPasswordCambiada(
  para: string,
  username: string,
): MensajeCorreo {
  const texto = `Hola, ${username}:

La contraseña de tu cuenta de Pathfinder VTT se acaba de cambiar, y se han
cerrado todas las sesiones abiertas.

Si has sido tú, ya está: no hay nada más que hacer.

Si NO has sido tú, alguien tiene acceso a tu correo o a tu cuenta. Entra en
Pathfinder VTT, pide restablecer la contraseña y elige una nueva cuanto
antes.`;

  return {
    para,
    asunto: 'Tu contraseña de Pathfinder VTT ha cambiado',
    texto,
    html: maquetar(
      `<p>Hola, <strong>${escapar(username)}</strong>:</p>
<p>La contraseña de tu cuenta de Pathfinder VTT se acaba de cambiar, y se han cerrado todas las sesiones abiertas.</p>
<p>Si has sido tú, ya está: no hay nada más que hacer.</p>
<p><strong>Si no has sido tú</strong>, alguien tiene acceso a tu correo o a tu cuenta. Entra en Pathfinder VTT, pide restablecer la contraseña y elige una nueva cuanto antes.</p>`,
    ),
  };
}

/**
 * El username lo elige el usuario, así que va escapado antes de entrar en
 * el HTML del correo: si no, un nombre con `<` podría torcer el mensaje que
 * le llega a otra persona.
 */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
