import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrearPartidaPage } from './crear-partida-page';

describe('CrearPartidaPage', () => {
  let component: CrearPartidaPage;
  let fixture: ComponentFixture<CrearPartidaPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearPartidaPage],
    }).compileComponents();

    fixture = TestBed.createComponent(CrearPartidaPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
