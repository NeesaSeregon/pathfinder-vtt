import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BuscarPartidaPage } from './buscar-partida-page';

describe('BuscarPartidaPage', () => {
  let component: BuscarPartidaPage;
  let fixture: ComponentFixture<BuscarPartidaPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuscarPartidaPage],
    }).compileComponents();

    fixture = TestBed.createComponent(BuscarPartidaPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
