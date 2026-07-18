import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PartidasService } from './partidas.service';
import { Partida } from './entities/partida.entity';
import { PersonajeEnPartida } from './entities/personaje-en-partida.entity';
import { CharactersService } from '../characters/characters.service';
import { PartidasGateway } from './partidas.gateway';

describe('PartidasService', () => {
  let service: PartidasService;
  const gateway = {
    emitirEstadoPersonaje: jest.fn(),
    emitirMesaCambiada: jest.fn(),
  };
  const partidasRepo = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({
      id: 'partida-1',
      estado: 'preparacion',
      ...x,
    })),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };
  const pepsRepo = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({
      id: 'pep-1',
      danoNoLetal: 0,
      condiciones: '',
      posX: null,
      posY: null,
      ...x,
    })),
    findOneBy: jest.fn(),
    remove: jest.fn(),
  };
  const characters = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartidasService,
        { provide: getRepositoryToken(Partida), useValue: partidasRepo },
        { provide: getRepositoryToken(PersonajeEnPartida), useValue: pepsRepo },
        { provide: CharactersService, useValue: characters },
        { provide: PartidasGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get(PartidasService);
  });

  it('crear asigna como máster al usuario del token y genera un código', async () => {
    const resumen = await service.crear(
      { nombre: 'La corona carmesí' },
      'user-1',
    );
    expect(partidasRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ masterId: 'user-1' }),
    );
    // Código de 6 caracteres sin ambiguos, apto para dictarlo en mesa
    expect(resumen.codigo).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);
  });

  it('actualizar y eliminar son solo del máster (403 para el resto)', async () => {
    partidasRepo.findOne.mockResolvedValue({
      id: 'partida-1',
      masterId: 'user-1',
      personajes: [],
    });
    await expect(
      service.actualizar('partida-1', { estado: 'activa' }, 'user-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.eliminar('partida-1', 'user-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('unir inicializa los PG actuales desde la ficha', async () => {
    partidasRepo.findOne.mockResolvedValue({
      id: 'partida-1',
      masterId: 'master',
      personajes: [],
    });
    pepsRepo.findOneBy.mockResolvedValue(null);
    characters.findOne.mockResolvedValue({
      id: 'char-1',
      name: 'Valeros',
      level: 3,
      ownerId: 'user-1',
      sheetData: { pg: { total: 45 } },
    });

    const pep = await service.unir('partida-1', 'char-1', 'user-1');
    expect(pep.pgActuales).toBe(45);
    expect(pep.pgTotal).toBe(45);
  });

  it('unir el mismo personaje dos veces da conflicto (409)', async () => {
    partidasRepo.findOne.mockResolvedValue({
      id: 'partida-1',
      masterId: 'master',
      personajes: [],
    });
    characters.findOne.mockResolvedValue({ id: 'char-1', sheetData: {} });
    pepsRepo.findOneBy.mockResolvedValue({ id: 'pep-existente' });

    await expect(
      service.unir('partida-1', 'char-1', 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('sacar: lo puede hacer el máster o el dueño, nadie más', async () => {
    const partida = {
      id: 'partida-1',
      masterId: 'master',
      personajes: [{ id: 'pep-1', character: { ownerId: 'dueno' } }],
    };
    partidasRepo.findOne.mockResolvedValue(partida);

    await expect(
      service.sacar('partida-1', 'pep-1', 'un-tercero'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await service.sacar('partida-1', 'pep-1', 'master');
    await service.sacar('partida-1', 'pep-1', 'dueno');
    expect(pepsRepo.remove).toHaveBeenCalledTimes(2);
  });

  it('el código de invitación solo lo ve el máster', async () => {
    partidasRepo.find.mockResolvedValue([
      {
        id: 'partida-1',
        nombre: 'Mesa',
        descripcion: '',
        estado: 'preparacion',
        codigo: 'ABC234',
        masterId: 'user-1',
        master: { username: 'neesa' },
        personajes: [],
      },
    ]);
    const propias = await service.buscar(undefined, 'user-1');
    const ajenas = await service.buscar(undefined, 'user-2');
    expect(propias[0].codigo).toBe('ABC234');
    expect(ajenas[0].codigo).toBeUndefined();
  });

  it('actualizarPersonaje mueve el token y respeta los permisos', async () => {
    const pep = {
      id: 'pep-1',
      characterId: 'char-1',
      character: { ownerId: 'dueno', name: 'Valeros', level: 3, sheetData: {} },
      pgActuales: 30,
      danoNoLetal: 0,
      condiciones: '',
      posX: null,
      posY: null,
    };
    partidasRepo.findOne.mockResolvedValue({
      id: 'partida-1',
      masterId: 'master',
      personajes: [pep],
    });

    // Un tercero no puede tocar el token ajeno
    await expect(
      service.actualizarPersonaje('partida-1', 'pep-1', { posX: 3 }, 'otro'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // El dueño mueve su token y el resumen refleja la posición nueva
    const movido = await service.actualizarPersonaje(
      'partida-1',
      'pep-1',
      { posX: 3, posY: 5 },
      'dueno',
    );
    expect(pepsRepo.save).toHaveBeenCalled();
    expect(movido.posX).toBe(3);
    expect(movido.posY).toBe(5);
    expect(movido.esMio).toBe(true);
    // La CA la deriva el servidor con las reglas compartidas (ficha vacía → 10)
    expect(movido.ca).toBe(10);

    // El máster también puede (p. ej. bajarle los PG tras un golpe)
    const herido = await service.actualizarPersonaje(
      'partida-1',
      'pep-1',
      { pgActuales: 18 },
      'master',
    );
    expect(herido.pgActuales).toBe(18);
    expect(herido.esMio).toBe(false); // para el máster no es "suyo"

    // Cada cambio guardado se emite a la sala de la partida
    expect(gateway.emitirEstadoPersonaje).toHaveBeenCalledWith(
      'partida-1',
      'pep-1',
      { pgActuales: 18 },
    );
  });

  it('sacar a alguien que no está da 404', async () => {
    partidasRepo.findOne.mockResolvedValue({
      id: 'partida-1',
      masterId: 'master',
      personajes: [],
    });
    await expect(
      service.sacar('partida-1', 'pep-inexistente', 'master'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
