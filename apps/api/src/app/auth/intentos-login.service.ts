import { Injectable } from '@nestjs/common';

/**
 * Freno de fuerza bruta para el login. Cuenta SOLO LOS FALLOS: un ataque es
 * fallar en bucle, mientras que entrar bien mil veces es un uso legítimo.
 * Limitar todas las peticiones por IP obligaría a poner un tope tan alto
 * que no protegería de nada (o a romper el e2e, que entra decenas de veces
 * desde la misma máquina).
 *
 * La cuenta va por EMAIL + IP, no por email solo: si fuera solo el email,
 * cualquiera podría dejar fuera a otro usuario a base de fallar con su
 * correo a propósito.
 *
 * Vive EN MEMORIA. Es suficiente para una instancia —que es lo que hay— y
 * se reinicia al reiniciar el proceso. El día que haya varias instancias
 * detrás de un balanceador, esto debe pasar a Redis o a la base de datos.
 */
@Injectable()
export class IntentosLoginService {
  private readonly fallos = new Map<string, { cuenta: number; hasta: number }>();

  /** Fallos seguidos antes de bloquear. */
  private get maximo(): number {
    return Number(process.env.LOGIN_MAX_FALLOS ?? 5);
  }

  /** Cuánto dura el bloqueo, en segundos. */
  private get bloqueoSegundos(): number {
    return Number(process.env.LOGIN_BLOQUEO_SEGUNDOS ?? 15 * 60);
  }

  private clave(email: string, ip: string): string {
    return `${email.trim().toLowerCase()}|${ip}`;
  }

  /**
   * Segundos que quedan de bloqueo, o 0 si puede intentarlo. Aprovecha para
   * limpiar la entrada cuando el bloqueo ya ha vencido.
   */
  segundosBloqueado(email: string, ip: string): number {
    const clave = this.clave(email, ip);
    const registro = this.fallos.get(clave);
    if (!registro) {
      return 0;
    }
    const restante = registro.hasta - Date.now();
    if (restante <= 0) {
      this.fallos.delete(clave);
      return 0;
    }
    return registro.cuenta >= this.maximo ? Math.ceil(restante / 1000) : 0;
  }

  /** Un intento fallido más. Al llegar al máximo, empieza el bloqueo. */
  registrarFallo(email: string, ip: string): void {
    const clave = this.clave(email, ip);
    const previo = this.fallos.get(clave);
    const cuenta = (previo?.cuenta ?? 0) + 1;
    this.fallos.set(clave, {
      cuenta,
      // La ventana se renueva con cada fallo: insistir alarga el castigo
      hasta: Date.now() + this.bloqueoSegundos * 1000,
    });
  }

  /** Entró bien: se olvida todo lo anterior. */
  limpiar(email: string, ip: string): void {
    this.fallos.delete(this.clave(email, ip));
  }
}
