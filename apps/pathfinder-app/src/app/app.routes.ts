import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'personajes',
    loadComponent: () =>
      import('./characters/characters-page').then((m) => m.CharactersPage),
  },
  // Maquetas sin funcionalidad todavía: partidas y cuentas de usuario
  {
    path: 'partidas/buscar',
    loadComponent: () =>
      import('./partidas/buscar-partida-page').then(
        (m) => m.BuscarPartidaPage,
      ),
  },
  {
    path: 'partidas/crear',
    loadComponent: () =>
      import('./partidas/crear-partida-page').then((m) => m.CrearPartidaPage),
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
