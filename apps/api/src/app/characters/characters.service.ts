import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
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
   * Tus fichas de un tipo. Para 'pnj' devuelve SOLO las plantillas del
   * bestiario (plantillaId null): las instancias sentadas en las mesas son
   * copias desechables y no deben aparecer en ninguna lista.
   */
  findAll(ownerId: string, tipo: TipoPersonaje = 'pj'): Promise<Character[]> {
    return this.charactersRepository.findBy(
      tipo === 'pnj'
        ? { ownerId, tipo, plantillaId: IsNull() }
        : { ownerId, tipo },
    );
  }

  /** Una plantilla del bestiario, comprobando que es tuya y es plantilla. */
  async plantilla(id: string, ownerId: string): Promise<Character> {
    const plantilla = await this.charactersRepository.findOneBy({
      id,
      ownerId,
      tipo: 'pnj',
      plantillaId: IsNull(),
    });
    if (!plantilla) {
      throw new NotFoundException('Esa plantilla no está en tu bestiario');
    }
    return plantilla;
  }

  /** Copia de una plantilla para sentarla en una mesa (ficha desechable). */
  crearInstancia(
    plantilla: Character,
    nombre: string,
    ownerId: string,
  ): Promise<Character> {
    return this.charactersRepository.save(
      this.charactersRepository.create({
        name: nombre,
        level: plantilla.level,
        // Copia, no referencia: si luego retocas la plantilla, los
        // monstruos ya puestos en la mesa no cambian a media partida.
        sheetData: plantilla.sheetData,
        tipo: 'pnj',
        plantillaId: plantilla.id,
        ownerId,
      }),
    );
  }

  /** Borra una ficha sin preguntar por el dueño (uso interno del servidor). */
  async borrarPorId(id: string): Promise<void> {
    await this.charactersRepository.delete({ id });
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
