import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { Character } from './entities/character.entity';

@Injectable()
export class CharactersService {
  constructor(
    @InjectRepository(Character)
    private readonly charactersRepository: Repository<Character>,
  ) {}

  create(
    createCharacterDto: CreateCharacterDto,
    ownerId: string,
  ): Promise<Character> {
    const character = this.charactersRepository.create({
      ...createCharacterDto,
      ownerId,
    });
    return this.charactersRepository.save(character);
  }

  findAll(ownerId: string): Promise<Character[]> {
    return this.charactersRepository.findBy({ ownerId });
  }

  /**
   * Busca por id Y por dueño: pedir el personaje de otro usuario da el
   * mismo 404 que uno inexistente — no revelamos qué ids existen.
   */
  async findOne(id: string, ownerId: string): Promise<Character> {
    const character = await this.charactersRepository.findOneBy({
      id,
      ownerId,
    });
    if (!character) {
      throw new NotFoundException(`Character with id ${id} not found`);
    }
    return character;
  }

  async update(
    id: string,
    updateCharacterDto: UpdateCharacterDto,
    ownerId: string,
  ): Promise<Character> {
    // findOne ya valida la propiedad; preload fusiona los cambios
    await this.findOne(id, ownerId);
    const character = await this.charactersRepository.preload({
      id,
      ...updateCharacterDto,
    });
    if (!character) {
      throw new NotFoundException(`Character with id ${id} not found`);
    }
    return this.charactersRepository.save(character);
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const character = await this.findOne(id, ownerId);
    await this.charactersRepository.remove(character);
  }
}
