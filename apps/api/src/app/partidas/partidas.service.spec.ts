import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
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
    emitirTirada: jest.fn(),
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

  it('tirar dados: solo participantes; el máster y los jugadores pueden', async () => {
    const partida = {
      id: 'partida-1',
      masterId: 'master',
      personajes: [{ id: 'pep-1', character: { ownerId: 'jugador' } }],
    };
    partidasRepo.findOne.mockResolvedValue(partida);
    const user = (sub: string) => ({ sub, username: `nombre-${sub}` });

    // Un extraño a la mesa no puede tirar
    await expect(
      service.tirarDados('partida-1', { notacion: '1d20' }, user('extrano')),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // El máster tira: 2d1+3 siempre suma 5, así el test es determinista
    const delMaster = await service.tirarDados(
      'partida-1',
      { notacion: '2d1+3', etiqueta: 'Iniciativa' },
      user('master'),
    );
    expect(delMaster.total).toBe(5);
    expect(delMaster.autor).toBe('nombre-master');
    expect(delMaster.etiqueta).toBe('Iniciativa');
    // El resultado se retransmite a la sala
    expect(gateway.emitirTirada).toHaveBeenCalledWith('partida-1', delMaster);

    // Un jugador con personaje en la mesa también puede
    const delJugador = await service.tirarDados(
      'partida-1',
      { notacion: '2d1+3' },
      user('jugador'),
    );
    expect(delJugador.total).toBe(5);
  });

  it('tirar una notación inválida da 400', async () => {
    partidasRepo.findOne.mockResolvedValue({
      id: 'partida-1',
      masterId: 'master',
      personajes: [],
    });
    await expect(
      service.tirarDados('partida-1', { notacion: 'patata' }, {
        sub: 'master',
        username: 'neesa',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ver ficha: la ven el máster y el dueño; un tercero recibe 403', async () => {
    const partida = {
      id: 'partida-1',
      masterId: 'master',
      personajes: [
        { id: 'pep-1', character: { id: 'char-1', ownerId: 'dueno', sheetData: {} } },
      ],
    };
    partidasRepo.findOne.mockResolvedValue(partida);

    await expect(
      service.fichaDePersonaje('partida-1', 'pep-1', 'un-tercero'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const paraMaster = await service.fichaDePersonaje('partida-1', 'pep-1', 'master');
    expect(paraMaster.id).toBe('char-1');
    const paraDueno = await service.fichaDePersonaje('partida-1', 'pep-1', 'dueno');
    expect(paraDueno.id).toBe('char-1');
  });

  it('ver la ficha de un personaje que no está en la mesa da 404', async () => {
    partidasRepo.findOne.mockResolvedValue({
      id: 'partida-1',
      masterId: 'master',
      personajes: [],
    });
    await expect(
      service.fichaDePersonaje('partida-1', 'pep-inexistente', 'master'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  const partidaConCombatientes = () => ({
    id: 'partida-1',
    nombre: 'Mesa',
    descripcion: '',
    estado: 'preparacion',
    codigo: 'ABC234',
    masterId: 'master',
    master: { username: 'neesa' },
    enCombate: false,
    ronda: 0,
    turnoPepId: null as string | null,
    personajes: [
      { id: 'pep-a', iniciativa: 12, character: { ownerId: 'j1', sheetData: {} } },
      { id: 'pep-b', iniciativa: 20, character: { ownerId: 'j2', sheetData: {} } },
      { id: 'pep-c', iniciativa: null, character: { ownerId: 'j3', sheetData: {} } },
    ],
  });

  it('iniciar combate: solo el máster; ordena por iniciativa y da el turno 1', async () => {
    partidasRepo.findOne.mockResolvedValue(partidaConCombatientes());

    await expect(
      service.iniciarCombate('partida-1', 'j1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const detalle = await service.iniciarCombate('partida-1', 'master');
    expect(detalle.enCombate).toBe(true);
    expect(detalle.ronda).toBe(1);
    // pep-b (20) va antes que pep-a (12); pep-c (sin tirar) queda fuera
    expect(detalle.turnoPepId).toBe('pep-b');
  });

  it('iniciar combate sin nadie que haya tirado da 400', async () => {
    const partida = partidaConCombatientes();
    partida.personajes.forEach((pep) => (pep.iniciativa = null));
    partidasRepo.findOne.mockResolvedValue(partida);
    await expect(
      service.iniciarCombate('partida-1', 'master'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('siguiente turno avanza y, al dar la vuelta, sube la ronda', async () => {
    const partida = partidaConCombatientes();
    partida.enCombate = true;
    partida.ronda = 1;
    partida.turnoPepId = 'pep-b'; // el primero del orden
    partidasRepo.findOne.mockResolvedValue(partida);

    const trasUno = await service.siguienteTurno('partida-1', 'master');
    expect(trasUno.turnoPepId).toBe('pep-a');
    expect(trasUno.ronda).toBe(1);

    // pep-a es el último → volver arriba inicia la ronda 2
    const trasDos = await service.siguienteTurno('partida-1', 'master');
    expect(trasDos.turnoPepId).toBe('pep-b');
    expect(trasDos.ronda).toBe(2);
  });

  it('terminar combate limpia el rastreador (solo el máster)', async () => {
    const partida = partidaConCombatientes();
    partida.enCombate = true;
    partida.ronda = 3;
    partida.turnoPepId = 'pep-b';
    partidasRepo.findOne.mockResolvedValue(partida);

    await expect(
      service.terminarCombate('partida-1', 'j1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const detalle = await service.terminarCombate('partida-1', 'master');
    expect(detalle.enCombate).toBe(false);
    expect(detalle.ronda).toBe(0);
    expect(detalle.turnoPepId).toBeNull();
  });

  it('tirar iniciativa: la fija con 1d20+mod; máster o dueño, no un tercero', async () => {
    partidasRepo.findOne.mockResolvedValue(partidaConCombatientes());

    await expect(
      service.tirarIniciativa('partida-1', 'pep-a', 'un-tercero'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const resumen = await service.tirarIniciativa('partida-1', 'pep-a', 'j1');
    // Ficha vacía → mod 0 → resultado de 1d20, entre 1 y 20
    expect(resumen.iniciativa).toBeGreaterThanOrEqual(1);
    expect(resumen.iniciativa).toBeLessThanOrEqual(20);
    expect(gateway.emitirEstadoPersonaje).toHaveBeenCalledWith(
      'partida-1',
      'pep-a',
      { iniciativa: resumen.iniciativa },
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
