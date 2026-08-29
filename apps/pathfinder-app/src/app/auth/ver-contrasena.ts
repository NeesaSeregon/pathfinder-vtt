import {
  Component,
  computed,
  ElementRef,
  inject,
  signal,
} from '@angular/core';

/**
 * El ojo que enseña la contraseña escrita.
 *
 * Envuelve al campo POR PROYECCIÓN en vez de sustituirlo: el <input> se
 * queda escrito en su formulario, con su name, su autocomplete, su required
 * y su ngModel, y aquí solo se le cambia el `type`. Es lo que permite
 * ponerlo en los nueve campos de las cuatro pantallas sin que ninguna ceda
 * el control de su campo, sin un ControlValueAccessor de por medio y sin
 * tocar los selectores del e2e, que buscan por input[name="…"].
 *
 * Por qué hace falta: hasta ahora no había forma de comprobar lo que se
 * había tecleado. En un móvil, con una contraseña larga y sin ver nada, el
 * error de tecleo es la norma — y en /registro o /restablecer, donde hay
 * que escribirla DOS veces a ciegas, el usuario no sabe cuál de las dos ha
 * bailado.
 *
 * Arranca SIEMPRE oculta. Enseñarla es una decisión de quien está delante
 * de la pantalla, nunca el estado por defecto: detrás puede haber alguien
 * mirando.
 */
@Component({
  selector: 'app-ver-contrasena',
  host: { class: 'ver-contrasena' },
  templateUrl: './ver-contrasena.html',
})
export class VerContrasena {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly visible = signal(false);

  /** Dice lo que va a PASAR al pulsarlo, no en qué estado está. */
  protected readonly etiqueta = computed(() =>
    this.visible() ? 'Ocultar la contraseña' : 'Mostrar la contraseña',
  );

  /**
   * Cambia el type del campo proyectado y devuelve el foco donde estaba.
   *
   * Lo del cursor no es un detalle de lujo: el ojo se pulsa A MITAD de
   * escribir ("¿he puesto bien esto?"), y sin restaurar la selección el
   * navegador deja el campo desenfocado y hay que volver a hacer clic para
   * seguir. Se lee ANTES de tocar el type porque el cambio la descoloca.
   */
  protected alternar(): void {
    const campo = this.host.nativeElement.querySelector('input');
    if (!campo) {
      return;
    }
    const inicio = campo.selectionStart;
    const fin = campo.selectionEnd;

    const visible = !this.visible();
    this.visible.set(visible);
    campo.type = visible ? 'text' : 'password';

    campo.focus();
    if (inicio !== null && fin !== null) {
      campo.setSelectionRange(inicio, fin);
    }
  }
}
