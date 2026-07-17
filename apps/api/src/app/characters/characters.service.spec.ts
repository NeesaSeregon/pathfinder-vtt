import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CharactersService } from './characters.service';
import { Character } from './entities/character.entity';

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

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharactersService,
        { provide: getRepositoryToken(Character), useValue: repo },
      ],
    }).compile();

    service = module.get<CharactersService>(CharactersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create asigna el dueño al personaje nuevo', () => {
    repo.create.mockReturnValue({});
    service.create({ name: 'Valeros' }, 'user-1');
    expect(repo.create).toHaveBeenCalledWith({
      name: 'Valeros',
      ownerId: 'user-1',
    });
  });

  it('findAll filtra por dueño', () => {
    repo.findBy.mockResolvedValue([]);
    service.findAll('user-1');
    expect(repo.findBy).toHaveBeenCalledWith({ ownerId: 'user-1' });
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
});
