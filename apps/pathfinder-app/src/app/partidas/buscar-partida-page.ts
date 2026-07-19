import { Component } from '@angular/core';
import { UnirsePanel } from './unirse-panel';

/**
 * Página completa de búsqueda. Toda la lógica vive en UnirsePanel, que se
 * comparte con el escritorio de la home: aquí solo va el encabezado.
 */
@Component({
  selector: 'app-buscar-partida-page',
  imports: [UnirsePanel],
  templateUrl: './buscar-partida-page.html',
  styleUrl: './buscar-partida-page.scss',
})
export class BuscarPartidaPage {}
