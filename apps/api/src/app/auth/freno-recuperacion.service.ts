import { Injectable } from '@nestjs/common';

/**
 * Freno para "he olvidado mi contraseña".
 *
 * OJO A LA DIFERENCIA con IntentosLoginService, que cuenta solo los FALLOS:
 * aquí se cuentan TODAS las peticiones, acierten o no. Y es que en este
 * endpoint no hay "fallo" que contar —responde 204 pase lo que pase— pero
 * cada acierto manda un correo A UN TERCERO. Sin tope, cualquiera podría
 * usar nuestro servidor para bombardear el buzón de otra persona, y de paso
 * quemarnos la cuota del proveedor y la reputación del dominio.
 *
 * Se limita por DOS claves a la vez, porque protegen de cosas distintas:
 *  · por EMAIL: que nadie inunde el buzón de una víctima concreta.
 *  · por IP: que nadie recorra una lista de correos desde el mismo sitio.
 *
 * Ventana deslizante simple: se guardan las marcas de tiempo de la ventana
 * y se cuentan. Con estos topes (unas pocas por hora) la lista por clave es
 * diminuta.
 *
 * Vive EN MEMORIA, igual que el freno del login y con el mismo límite: vale
 * para UNA instancia. El día que haya varias detrás de un balanceador, los
 * dos frenos deben mudarse a Redis a la vez.
 */
@Injectable()
export class FrenoRecuperacionService {
  private readonly peticiones = new Map<string, number[]>();

  /** Peticiones permitidas por email dentro de la ventana. */
  private get maxPorEmail(): number {
    return Number(process.env.RECUPERACION_MAX_POR_EMAIL ?? 3);
  }

  /** Peticiones permitidas por IP dentro de la ventana. */
  private get maxPorIp(): number {
    return Number(process.env.RECUPERACION_MAX_POR_IP ?? 10);
  }

  /** Longitud de la ventana, en segundos. */
  private get ventanaSegundos(): number {
    return Number(process.env.RECUPERACION_VENTANA_SEGUNDOS ?? 60 * 60);
  }

  /**
   * Anota una petición y dice si se ha pasado del tope. Anota SIEMPRE,
   * incluso cuando ya está bloqueado: insistir no debe salir gratis.
   */
  registrarYComprobar(email: string, ip: string): boolean {
    // Se evalúan las dos SIN cortocircuito (& y no &&): las dos claves han
    // de quedar anotadas aunque la primera ya haya dicho que no.
    const emailVale = this.anotar(
      `email|${email.trim().toLowerCase()}`,
      this.maxPorEmail,
    );
    const ipVale = this.anotar(`ip|${ip}`, this.maxPorIp);
    return emailVale && ipVale;
  }

  /** Anota una marca en esa clave y dice si sigue por debajo del tope. */
  private anotar(clave: string, maximo: number): boolean {
    const ahora = Date.now();
    const desde = ahora - this.ventanaSegundos * 1000;
    const recientes = (this.peticiones.get(clave) ?? []).filter(
      (marca) => marca > desde,
    );
    recientes.push(ahora);
    this.peticiones.set(clave, recientes);

    if (this.peticiones.size > CLAVES_ANTES_DE_PURGAR) {
      this.purgar(desde);
    }
    return recientes.length <= maximo;
  }

  /**
   * Tira las claves cuya ventana ya ha vencido. Sin esto el mapa sería un
   * agujero de memoria con forma de puerta trasera: cada correo distinto
   * que alguien probara dejaría su entrada para siempre, y probar correos
   * distintos es precisamente lo que hace un atacante.
   *
   * Se purga por tamaño y no por temporizador para no dejar un intervalo
   * corriendo de por vida: si nadie pide recuperaciones, no hay nada que
   * limpiar ni motivo para despertarse.
   */
  private purgar(desde: number): void {
    for (const [clave, marcas] of this.peticiones) {
      const vivas = marcas.filter((marca) => marca > desde);
      if (vivas.length === 0) {
        this.peticiones.delete(clave);
      } else {
        this.peticiones.set(clave, vivas);
      }
    }
  }
}

/** A partir de cuántas claves distintas merece la pena barrer el mapa. */
const CLAVES_ANTES_DE_PURGAR = 1000;
