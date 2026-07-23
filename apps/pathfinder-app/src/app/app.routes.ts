import { Route } from '@angular/router';
import { authGuard } from './auth/auth.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'personajes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./characters/characters-page').then((m) => m.CharactersPage),
  },
  // Buscar/unirse ya no tiene página propia: vive en el escritorio de la
  // home (UnirsePanel). Crear sí es un formulario aparte, al que enlaza el
  // escritorio.
  {
    path: 'partidas/crear',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./partidas/crear-partida-page').then((m) => m.CrearPartidaPage),
  },
  // Tras la ruta fija: 'partidas/crear' debe ganar a 'partidas/:id'
  {
    path: 'partidas/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./partidas/partida-detalle-page').then(
        (m) => m.PartidaDetallePage,
      ),
  },
  {
    path: 'cuenta',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./cuenta/cuenta-page').then((m) => m.CuentaPage),
  },
  {
    path: 'entrar',
    loadComponent: () => import('./auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./auth/registro-page').then((m) => m.RegistroPage),
  },
  { path: '**', redirectTo: '' },
];
