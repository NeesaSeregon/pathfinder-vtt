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

  create(createCharacterDto: CreateCharacterDto): Promise<Character> {
    const character = this.charactersRepository.create(createCharacterDto);
    return this.charactersRepository.save(character);
  }

  findAll(): Promise<Character[]> {
    return this.charactersRepository.find();
  }

  async findOne(id: string): Promise<Character> {
    const character = await this.charactersRepository.findOneBy({ id });
    if (!character) {
      throw new NotFoundException(`Character with id ${id} not found`);
    }
    return character;
  }

  async update(
    id: string,
    updateCharacterDto: UpdateCharacterDto,
  ): Promise<Character> {
    const character = await this.charactersRepository.preload({
      id,
      ...updateCharacterDto,
    });
    if (!character) {
      throw new NotFoundException(`Character with id ${id} not found`);
    }
    return this.charactersRepository.save(character);
  }

  async remove(id: string): Promise<void> {
    const character = await this.findOne(id);
    await this.charactersRepository.remove(character);
  }
}
