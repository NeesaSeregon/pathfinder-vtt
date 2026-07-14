import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./characters/characters-page').then((m) => m.CharactersPage),
  },
];
