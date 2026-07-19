import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CharactersService } from './characters.service';
import { Character } from './entities/character.entity';
import { PersonajeEnPartida } from '../partidas/entities/personaje-en-partida.entity';
import { PartidasGateway } from '../partidas/partidas.gateway';

describe('CharactersService', () => {
  let service: CharactersService;
  const repo = {
    create: jest.fn(),
    save: jest.fn(),
    findBy: jest.fn(),
    findOneBy: jest.fn(),
    preload: jest.fn(),
    remove: jest.fn(),
  };
  const peps = { count: jest.fn(), find: jest.fn() };
  const gateway = { emitirMesaCambiada: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    // Por defecto, el personaje no está sentado en ninguna mesa
    peps.find.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharactersService,
        { provide: getRepositoryToken(Character), useValue: repo },
        { provide: getRepositoryToken(PersonajeEnPartida), useValue: peps },
        { provide: PartidasGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<CharactersService>(CharactersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create asigna el dueño al personaje nuevo, y lo crea como PJ', () => {
    repo.create.mockReturnValue({});
    service.create({ name: 'Valeros' }, 'user-1');
    expect(repo.create).toHaveBeenCalledWith({
      name: 'Valeros',
      ownerId: 'user-1',
      tipo: 'pj',
    });
  });

  // El tipo NO viaja en el DTO: por la API pública solo se crean PJ. Solo
  // PartidasService, al sembrar la mesa, pide 'pnj' explícitamente.
  it('create marca PNJ solo si se pide como tercer argumento', () => {
    repo.create.mockReturnValue({});
    service.create({ name: 'Goblin 1' }, 'master-1', 'pnj');
    expect(repo.create).toHaveBeenCalledWith({
      name: 'Goblin 1',
      ownerId: 'master-1',
      tipo: 'pnj',
    });
  });

  it('findAll lista TUS PJ, sin los goblins del bestiario', () => {
    repo.findBy.mockResolvedValue([]);
    service.findAll('user-1');
    expect(repo.findBy).toHaveBeenCalledWith({ ownerId: 'user-1', tipo: 'pj' });
  });

  it('findOne de un personaje ajeno da el mismo 404 que uno inexistente', async () => {
    // El repositorio no encuentra nada al filtrar por (id, dueño)
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.findOne('id-ajeno', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.findOneBy).toHaveBeenCalledWith({
      id: 'id-ajeno',
      ownerId: 'user-1',
    });
  });

  it('leer: el dueño accede a su ficha sin consultar mesas', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'char-1', ownerId: 'user-1' });
    const ficha = await service.leer('char-1', 'user-1');
    expect(ficha.id).toBe('char-1');
    expect(peps.count).not.toHaveBeenCalled();
  });

  it('leer: el máster de una mesa donde está sentado el personaje lo ve', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'char-1', ownerId: 'otro' });
    peps.count.mockResolvedValue(1); // hay una partida suya con ese personaje
    const ficha = await service.leer('char-1', 'master-1');
    expect(ficha.id).toBe('char-1');
    expect(peps.count).toHaveBeenCalledWith({
      where: { characterId: 'char-1', partida: { masterId: 'master-1' } },
    });
  });

  it('leer: un tercero sin relación recibe 404 (no revelamos que existe)', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'char-1', ownerId: 'otro' });
    peps.count.mockResolvedValue(0);
    await expect(service.leer('char-1', 'extrano')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // Editar la ficha cambia valores DERIVADOS que la mesa muestra (CA, PG
  // totales, iniciativa): sin este aviso los demás verían datos viejos.
  it('update avisa a todas las mesas donde el personaje está sentado', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'char-1', ownerId: 'yo' });
    repo.preload.mockResolvedValue({ id: 'char-1', name: 'Valeros' });
    repo.save.mockResolvedValue({ id: 'char-1', name: 'Valeros' });
    peps.find.mockResolvedValue([
      { partidaId: 'partida-1' },
      { partidaId: 'partida-2' },
    ]);

    await service.update('char-1', { name: 'Valeros' }, 'yo');

    expect(gateway.emitirMesaCambiada).toHaveBeenCalledWith('partida-1');
    expect(gateway.emitirMesaCambiada).toHaveBeenCalledWith('partida-2');
  });

  it('update de un personaje que no está en ninguna mesa no emite nada', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'char-1', ownerId: 'yo' });
    repo.preload.mockResolvedValue({ id: 'char-1' });
    repo.save.mockResolvedValue({ id: 'char-1' });

    await service.update('char-1', { name: 'Solo' }, 'yo');

    expect(gateway.emitirMesaCambiada).not.toHaveBeenCalled();
  });
});
