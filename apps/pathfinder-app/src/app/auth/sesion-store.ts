import { computed, Service, signal } from '@angular/core';

/**
 * Estado de sesión del front. Solo guarda el USERNAME para pintar la
 * interfaz: el token vive en una cookie httpOnly que JavaScript no puede
 * leer (por diseño). La fuente de verdad de "quién soy" es /api/auth/me.
 */
@Service()
export class SesionStore {
  private readonly usernameSignal = signal<string | null>(null);
  // ¿Ya hemos preguntado a /me tras cargar la página?
  private readonly inicializadaSignal = signal(false);

  readonly username = this.usernameSignal.asReadonly();
  readonly inicializada = this.inicializadaSignal.asReadonly();
  readonly conectado = computed(() => this.usernameSignal() !== null);

  establecer(username: string): void {
    this.usernameSignal.set(username);
    this.inicializadaSignal.set(true);
  }

  limpiar(): void {
    this.usernameSignal.set(null);
    this.inicializadaSignal.set(true);
  }
}
