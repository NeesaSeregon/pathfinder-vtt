import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TipoPersonaje } from '@pathfinder/shared';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { Character } from './entities/character.entity';
import { PersonajeEnPartida } from '../partidas/entities/personaje-en-partida.entity';
import { PartidasGateway } from '../partidas/partidas.gateway';

@Injectable()
export class CharactersService {
  constructor(
    @InjectRepository(Character)
    private readonly charactersRepository: Repository<Character>,
    @InjectRepository(PersonajeEnPartida)
    private readonly peps: Repository<PersonajeEnPartida>,
    private readonly gateway: PartidasGateway,
  ) {}

  /**
   * El tipo NO viaja en el DTO a propósito: por la API pública siempre se
   * crean PJ. Los PNJ los siembra PartidasService, que pasa 'pnj' aquí.
   */
  create(
    createCharacterDto: CreateCharacterDto,
    ownerId: string,
    tipo: TipoPersonaje = 'pj',
  ): Promise<Character> {
    const character = this.charactersRepository.create({
      ...createCharacterDto,
      tipo,
      ownerId,
    });
    return this.charactersRepository.save(character);
  }

  /**
   * La lista de /personajes son TUS PJ. Los PNJ (el bestiario que generas
   * en las mesas) se piden aparte: si no, cuatro goblins por combate
   * sepultarían a los personajes de verdad.
   */
  findAll(ownerId: string, tipo: TipoPersonaje = 'pj'): Promise<Character[]> {
    return this.charactersRepository.findBy({ ownerId, tipo });
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

  /**
   * LECTURA de la ficha: la ve su dueño o el máster de una partida donde el
   * personaje esté sentado (en una mesa real el máster necesita la hoja del
   * jugador). Sigue siendo 404 —no 403— si no tienes acceso: no revelamos
   * qué ids existen. OJO: solo lectura; editar/borrar siguen siendo del dueño.
   */
  async leer(id: string, userId: string): Promise<Character> {
    const character = await this.charactersRepository.findOneBy({ id });
    if (!character) {
      throw new NotFoundException(`Character with id ${id} not found`);
    }
    if (character.ownerId === userId) {
      return character;
    }
    const enSuMesa = await this.peps.count({
      where: { characterId: id, partida: { masterId: userId } },
    });
    if (enSuMesa > 0) {
      return character;
    }
    throw new NotFoundException(`Character with id ${id} not found`);
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
    const guardado = await this.charactersRepository.save(character);
    await this.avisarASusMesas(id);
    return guardado;
  }

  /**
   * La ficha manda sobre valores que la mesa muestra DERIVADOS (CA, PG
   * totales, iniciativa, casillas que ocupa). Si no avisáramos, el resto de
   * la mesa seguiría viendo la CA vieja hasta recargar a mano.
   */
  private async avisarASusMesas(characterId: string): Promise<void> {
    const sentado = await this.peps.find({ where: { characterId } });
    for (const pep of sentado) {
      this.gateway.emitirMesaCambiada(pep.partidaId);
    }
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const character = await this.findOne(id, ownerId);
    await this.charactersRepository.remove(character);
  }
}
