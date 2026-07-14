import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { CharactersApi } from './characters-api';

describe('CharactersApi', () => {
  let service: CharactersApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CharactersApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should list characters from the API', () => {
    const characters = [
      { id: '1', name: 'Ezren', level: 5, sheetData: {} },
    ];

    let result: unknown;
    service.list().subscribe((r) => (result = r));

    const req = httpMock.expectOne('/api/characters');
    expect(req.request.method).toBe('GET');
    req.flush(characters);

    expect(result).toEqual(characters);
  });
});
