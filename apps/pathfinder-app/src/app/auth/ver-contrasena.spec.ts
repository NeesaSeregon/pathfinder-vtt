import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerContrasena } from './ver-contrasena';

/**
 * El componente proyecta el campo, así que hay que montarlo con un campo
 * dentro: probarlo suelto no probaría lo único que hace.
 */
@Component({
  imports: [VerContrasena],
  template: `
    <app-ver-contrasena>
      <input type="password" name="password" value="secreto" />
    </app-ver-contrasena>
  `,
})
class Anfitrion {}

describe('VerContrasena', () => {
  let fixture: ComponentFixture<Anfitrion>;

  function campo(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input');
  }

  function ojo(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.ver-contrasena__ojo');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  // Detrás de quien escribe puede haber alguien mirando: enseñarla es una
  // decisión, nunca el estado de partida.
  it('arranca oculta', () => {
    expect(campo().type).toBe('password');
    expect(ojo().getAttribute('aria-pressed')).toBe('false');
  });

  it('el ojo enseña la contraseña y la vuelve a esconder', async () => {
    ojo().click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(campo().type).toBe('text');

    ojo().click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(campo().type).toBe('password');
  });

  // El estado no puede vivir solo en el dibujo del icono.
  it('el estado se dice también en el DOM', async () => {
    expect(ojo().getAttribute('aria-label')).toBe('Mostrar la contraseña');

    ojo().click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(ojo().getAttribute('aria-pressed')).toBe('true');
    expect(ojo().getAttribute('aria-label')).toBe('Ocultar la contraseña');
  });

  // Se pulsa a mitad de escribir: si el foco se queda en el botón hay que
  // volver a hacer clic en el campo para seguir tecleando.
  it('devuelve el foco al campo, con el cursor donde estaba', async () => {
    campo().focus();
    campo().setSelectionRange(3, 3);

    ojo().click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(campo());
    expect(campo().selectionStart).toBe(3);
  });

  // El campo sigue siendo del formulario que lo escribe: si el envoltorio
  // le tocara el name, el ngModel o el value, rompería los cuatro
  // formularios a la vez (y los selectores del e2e, que buscan por name).
  it('no toca nada más del campo', async () => {
    ojo().click();
    await fixture.whenStable();

    expect(campo().name).toBe('password');
    expect(campo().value).toBe('secreto');
  });

  it('el botón no envía el formulario', () => {
    expect(ojo().type).toBe('button');
  });
});
