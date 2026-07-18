import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import {
  caConCondiciones,
  claseDeArmadura,
  efectoDeCondiciones,
  iniciativa,
  JwtPayload,
  lanzarDados,
  ordenarIniciativa,
  PartidaDetalle,
  PartidaResumen,
  PersonajeEnPartidaResumen,
  TiradaResultado,
} from '@pathfinder/shared';
import { Character } from '../characters/entities/character.entity';
import { Partida } from './entities/partida.entity';
import { PersonajeEnPartida } from './entities/personaje-en-partida.entity';
import {
  ActualizarPersonajeEnPartidaDto,
  CreatePartidaDto,
  TirarDadosDto,
  UpdatePartidaDto,
} from './dto/create-partida.dto';
import { CharactersService } from '../characters/characters.service';
import { PartidasGateway } from './partidas.gateway';

/** Sin caracteres ambiguos (0/O, 1/I/L) para dictarlo en voz alta en mesa. */
const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LARGO_CODIGO = 6;

@Injectable()
export class PartidasService {
  constructor(
    @InjectRepository(Partida)
    private readonly partidas: Repository<Partida>,
    @InjectRepository(PersonajeEnPartida)
    private readonly personajes: Repository<PersonajeEnPartida>,
    private readonly characters: CharactersService,
    private readonly gateway: PartidasGateway,
  ) {}

  async crear(
    dto: CreatePartidaDto,
    masterId: string,
  ): Promise<PartidaResumen> {
    const partida = await this.partidas.save(
      this.partidas.create({
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? '',
        codigo: this.generarCodigo(),
        masterId,
      }),
    );
    return this.aResumen({ ...partida, personajes: [] }, masterId);
  }

  /** Busca por código exacto o por nombre (parcial); sin texto lista todo. */
  async buscar(
    texto: string | undefined,
    userId: string,
  ): Promise<PartidaResumen[]> {
    const filtro = texto?.trim();
    const partidas = await this.partidas.find({
      where: filtro
        ? [{ codigo: filtro.toUpperCase() }, { nombre: ILike(`%${filtro}%`) }]
        : {},
      relations: { master: true, personajes: true },
      order: { createdAt: 'DESC' },
      // Con unas pocas basta: el buscador es para encontrar TU mesa, no un
      // catálogo. Se afina escribiendo el nombre o el código.
      take: 12,
    });
    return partidas.map((partida) => this.aResumen(partida, userId));
  }

  async detalle(id: string, userId: string): Promise<PartidaDetalle> {
    const partida = await this.buscarEntidad(id);
    return {
      ...this.aResumen(partida, userId),
      esMaster: partida.masterId === userId,
      personajes: partida.personajes.map((pep) =>
        this.aPersonajeResumen(pep, userId),
      ),
      enCombate: partida.enCombate,
      ronda: partida.ronda,
      turnoPepId: partida.turnoPepId,
    };
  }

  async actualizar(
    id: string,
    dto: UpdatePartidaDto,
    userId: string,
  ): Promise<PartidaDetalle> {
    const partida = await this.buscarEntidad(id);
    this.soloElMaster(partida, userId);
    Object.assign(partida, dto);
    await this.partidas.save(partida);
    return this.detalle(id, userId);
  }

  async eliminar(id: string, userId: string): Promise<void> {
    const partida = await this.buscarEntidad(id);
    this.soloElMaster(partida, userId);
    await this.partidas.remove(partida);
  }

  /** Unirse con UN personaje TUYO; el estado de sesión nace de la ficha. */
  async unir(
    partidaId: string,
    characterId: string,
    userId: string,
  ): Promise<PersonajeEnPartidaResumen> {
    await this.buscarEntidad(partidaId);
    // Reutiliza la regla de propiedad: el personaje de otro da 404
    const character = await this.characters.findOne(characterId, userId);

    const existente = await this.personajes.findOneBy({
      partidaId,
      characterId,
    });
    if (existente) {
      throw new ConflictException('Ese personaje ya está en la partida');
    }

    const pep = await this.personajes.save(
      this.personajes.create({
        partidaId,
        characterId,
        // El estado de sesión ARRANCA desde la ficha, pero vive aparte
        pgActuales: character.sheetData.pg?.total ?? null,
      }),
    );
    // Primero persistir, después avisar a la sala
    this.gateway.emitirMesaCambiada(partidaId);
    return this.aPersonajeResumen({ ...pep, character }, userId);
  }

  /** Estado de sesión: mover el token, ajustar PG... Máster o dueño. */
  async actualizarPersonaje(
    partidaId: string,
    pepId: string,
    dto: ActualizarPersonajeEnPartidaDto,
    userId: string,
  ): Promise<PersonajeEnPartidaResumen> {
    const partida = await this.buscarEntidad(partidaId);
    const pep = partida.personajes.find((p) => p.id === pepId);
    if (!pep) {
      throw new NotFoundException('Ese personaje no está en la partida');
    }
    const esMaster = partida.masterId === userId;
    const esDueno = pep.character.ownerId === userId;
    if (!esMaster && !esDueno) {
      throw new ForbiddenException(
        'Solo el máster o el dueño pueden tocar a este personaje',
      );
    }
    Object.assign(pep, dto);
    await this.personajes.save(pep);
    const resumen = this.aPersonajeResumen(pep, userId);
    this.gateway.emitirEstadoPersonaje(
      partidaId,
      pepId,
      this.aEstadoNeutro(resumen),
    );
    return resumen;
  }

  /** Puede sacar un personaje: el máster de la mesa o el dueño de la ficha. */
  async sacar(
    partidaId: string,
    pepId: string,
    userId: string,
  ): Promise<void> {
    const partida = await this.buscarEntidad(partidaId);
    const pep = partida.personajes.find((p) => p.id === pepId);
    if (!pep) {
      throw new NotFoundException('Ese personaje no está en la partida');
    }
    const esMaster = partida.masterId === userId;
    const esDueno = pep.character.ownerId === userId;
    if (!esMaster && !esDueno) {
      throw new ForbiddenException(
        'Solo el máster o el dueño del personaje pueden sacarlo',
      );
    }
    await this.personajes.remove(pep);
    this.gateway.emitirMesaCambiada(partidaId);
  }

  /** Tira 1d20 + el modificador de iniciativa de la ficha y lo fija. */
  async tirarIniciativa(
    partidaId: string,
    pepId: string,
    userId: string,
  ): Promise<PersonajeEnPartidaResumen> {
    const partida = await this.buscarEntidad(partidaId);
    const pep = this.buscarPep(partida, pepId);
    this.soloMasterODueno(partida, pep, userId, 'tirar su iniciativa');

    const mod = iniciativa(pep.character?.sheetData ?? {});
    const notacion = mod >= 0 ? `1d20+${mod}` : `1d20${mod}`;
    pep.iniciativa = lanzarDados(notacion).total;
    await this.personajes.save(pep);

    const resumen = this.aPersonajeResumen(pep, userId);
    this.gateway.emitirEstadoPersonaje(
      partidaId,
      pepId,
      this.aEstadoNeutro(resumen),
    );
    return resumen;
  }

  /** Quita esMio (lo único que depende de quién pregunta) para retransmitir. */
  private aEstadoNeutro(
    resumen: PersonajeEnPartidaResumen,
  ): Partial<Omit<PersonajeEnPartidaResumen, 'esMio'>> {
    const neutro = { ...resumen } as Partial<PersonajeEnPartidaResumen>;
    delete neutro.esMio;
    return neutro;
  }

  /** El máster arranca el combate: ordena por iniciativa y da el turno 1. */
  async iniciarCombate(
    partidaId: string,
    userId: string,
  ): Promise<PartidaDetalle> {
    const partida = await this.buscarEntidad(partidaId);
    this.soloElMaster(partida, userId);

    const orden = this.ordenDeCombate(partida);
    if (orden.length === 0) {
      throw new BadRequestException('Nadie ha tirado iniciativa todavía');
    }
    partida.enCombate = true;
    partida.ronda = 1;
    partida.turnoPepId = orden[0].id;
    await this.partidas.save(partida);

    this.gateway.emitirMesaCambiada(partidaId);
    return this.detalle(partidaId, userId);
  }

  /** Pasa el turno al siguiente; al dar la vuelta, sube la ronda. */
  async siguienteTurno(
    partidaId: string,
    userId: string,
  ): Promise<PartidaDetalle> {
    const partida = await this.buscarEntidad(partidaId);
    this.soloElMaster(partida, userId);
    if (!partida.enCombate) {
      throw new BadRequestException('El combate no está activo');
    }

    const orden = this.ordenDeCombate(partida);
    if (orden.length === 0) {
      throw new BadRequestException('No hay combatientes con iniciativa');
    }
    const actual = orden.findIndex((pep) => pep.id === partida.turnoPepId);
    const siguiente = actual === -1 ? 0 : (actual + 1) % orden.length;
    // Si volvemos al principio de la tabla, empieza una ronda nueva
    if (actual !== -1 && siguiente === 0) {
      partida.ronda += 1;
    }
    partida.turnoPepId = orden[siguiente].id;
    await this.partidas.save(partida);

    this.gateway.emitirMesaCambiada(partidaId);
    return this.detalle(partidaId, userId);
  }

  /** El máster cierra el combate y limpia el rastreador. */
  async terminarCombate(
    partidaId: string,
    userId: string,
  ): Promise<PartidaDetalle> {
    const partida = await this.buscarEntidad(partidaId);
    this.soloElMaster(partida, userId);

    partida.enCombate = false;
    partida.ronda = 0;
    partida.turnoPepId = null;
    await this.partidas.save(partida);

    this.gateway.emitirMesaCambiada(partidaId);
    return this.detalle(partidaId, userId);
  }

  /** Combatientes (los que han tirado) en orden de turno. */
  private ordenDeCombate(partida: Partida): PersonajeEnPartida[] {
    const combatientes = partida.personajes
      .filter((pep) => pep.iniciativa !== null)
      .map((pep) => ({
        pep,
        iniciativa: pep.iniciativa,
        iniciativaMod: iniciativa(pep.character?.sheetData ?? {}),
      }));
    return ordenarIniciativa(combatientes).map((c) => c.pep);
  }

  /** Tira los dados en el servidor y retransmite el resultado a la sala. */
  async tirarDados(
    partidaId: string,
    dto: TirarDadosDto,
    user: JwtPayload,
  ): Promise<TiradaResultado> {
    const partida = await this.buscarEntidad(partidaId);
    this.soloParticipantes(partida, user.sub);

    let tirada;
    try {
      tirada = lanzarDados(dto.notacion);
    } catch (error) {
      // Notación mal formada → 400 con el mensaje de la función pura
      throw new BadRequestException((error as Error).message);
    }

    const resultado: TiradaResultado = {
      ...tirada,
      id: randomUUID(),
      autor: user.username,
      etiqueta: dto.etiqueta?.trim() || undefined,
      timestamp: Date.now(),
    };
    this.gateway.emitirTirada(partidaId, resultado);
    return resultado;
  }

  /**
   * Ficha COMPLETA de un personaje de la mesa, en solo lectura. La ve el
   * máster (necesita las hojas de sus jugadores para dirigir) o el propio
   * dueño; nadie más, ni siquiera otros jugadores de la misma partida.
   */
  async fichaDePersonaje(
    partidaId: string,
    pepId: string,
    userId: string,
  ): Promise<Character> {
    const partida = await this.buscarEntidad(partidaId);
    const pep = partida.personajes.find((p) => p.id === pepId);
    if (!pep) {
      throw new NotFoundException('Ese personaje no está en la partida');
    }
    const esMaster = partida.masterId === userId;
    const esDueno = pep.character?.ownerId === userId;
    if (!esMaster && !esDueno) {
      throw new ForbiddenException(
        'Solo el máster o el dueño pueden ver esta ficha',
      );
    }
    return pep.character;
  }

  private async buscarEntidad(id: string): Promise<Partida> {
    const partida = await this.partidas.findOne({
      where: { id },
      relations: { master: true, personajes: { character: true } },
    });
    if (!partida) {
      throw new NotFoundException(`Partida ${id} no encontrada`);
    }
    return partida;
  }

  /** Participante = el máster o el dueño de algún personaje de la mesa. */
  private soloParticipantes(partida: Partida, userId: string): void {
    const esMaster = partida.masterId === userId;
    const esJugador = partida.personajes.some(
      (pep) => pep.character?.ownerId === userId,
    );
    if (!esMaster && !esJugador) {
      throw new ForbiddenException(
        'Solo los participantes de la mesa pueden tirar dados',
      );
    }
  }

  private buscarPep(partida: Partida, pepId: string): PersonajeEnPartida {
    const pep = partida.personajes.find((p) => p.id === pepId);
    if (!pep) {
      throw new NotFoundException('Ese personaje no está en la partida');
    }
    return pep;
  }

  private soloMasterODueno(
    partida: Partida,
    pep: PersonajeEnPartida,
    userId: string,
    accion: string,
  ): void {
    const esMaster = partida.masterId === userId;
    const esDueno = pep.character?.ownerId === userId;
    if (!esMaster && !esDueno) {
      throw new ForbiddenException(`Solo el máster o el dueño pueden ${accion}`);
    }
  }

  private soloElMaster(partida: Partida, userId: string): void {
    // 403 y no 404: las partidas son públicas en el buscador, así que
    // su existencia no es secreta (a diferencia de los personajes).
    if (partida.masterId !== userId) {
      throw new ForbiddenException('Solo el máster puede hacer eso');
    }
  }

  private aResumen(partida: Partida, userId: string): PartidaResumen {
    return {
      id: partida.id,
      nombre: partida.nombre,
      descripcion: partida.descripcion,
      estado: partida.estado,
      master: partida.master?.username ?? '',
      numPersonajes: partida.personajes?.length ?? 0,
      // El código de invitación solo lo ve su máster
      ...(partida.masterId === userId ? { codigo: partida.codigo } : {}),
    };
  }

  private aPersonajeResumen(
    pep: PersonajeEnPartida,
    userId: string,
  ): PersonajeEnPartidaResumen {
    const sheet = pep.character?.sheetData ?? {};
    const condiciones = pep.condiciones ?? [];
    const efecto = efectoDeCondiciones(condiciones);
    return {
      id: pep.id,
      characterId: pep.characterId,
      nombre: pep.character?.name ?? '',
      jugador: pep.character?.sheetData?.jugador,
      nivel: pep.character?.level ?? 1,
      // El servidor deriva la CA con LAS MISMAS reglas que el formulario,
      // ya con el efecto de las condiciones activas (sistema de efectos).
      ca: caConCondiciones(sheet, condiciones),
      caBase: claseDeArmadura(sheet),
      modAtaque: efecto.ataque,
      modSalvaciones: efecto.salvaciones,
      pgTotal: pep.character?.sheetData?.pg?.total,
      pgActuales: pep.pgActuales,
      danoNoLetal: pep.danoNoLetal,
      condiciones: pep.condiciones ?? [],
      posX: pep.posX,
      posY: pep.posY,
      iniciativa: pep.iniciativa,
      // El modificador de iniciativa lo deriva el servidor de la ficha
      iniciativaMod: iniciativa(pep.character?.sheetData ?? {}),
      esMio: pep.character?.ownerId === userId,
    };
  }

  private generarCodigo(): string {
    let codigo = '';
    for (let i = 0; i < LARGO_CODIGO; i++) {
      codigo +=
        ALFABETO_CODIGO[Math.floor(Math.random() * ALFABETO_CODIGO.length)];
    }
    return codigo;
  }
}
