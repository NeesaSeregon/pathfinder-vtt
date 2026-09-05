import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import {
  ActitudPnj,
  caConCondiciones,
  casillasQueOcupa,
  CharacterSheetData,
  claseDeArmadura,
  efectoDeCondiciones,
  estadoVitalDe,
  huellasSeSolapan,
  iniciativa,
  JwtPayload,
  lanzarDados,
  MiPartidaResumen,
  ordenarIniciativa,
  PartidaDetalle,
  PartidaResumen,
  PersonajeEnPartidaResumen,
  TABLERO_ALTO,
  TABLERO_ANCHO,
  TiradaResultado,
  zonaCabeEnTablero,
  ZonaTablero,
  ZONAS_MAX,
} from '@pathfinder/shared';
import { Partida } from './entities/partida.entity';
import { PersonajeEnPartida } from './entities/personaje-en-partida.entity';
import {
  ActualizarPersonajeEnPartidaDto,
  CreatePartidaDto,
  CrearPnjDto,
  SembrarPnjDto,
  TirarDadosDto,
  UpdatePartidaDto,
} from './dto/create-partida.dto';
import { Character } from '../characters/entities/character.entity';
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

  /**
   * El buscador NO es un catálogo de mesas ajenas: antes listaba las 12 más
   * recientes de todo el mundo y cualquiera podía colarse. Ahora hay dos
   * caminos, y ninguno permite enumerar:
   *  - CÓDIGO exacto: devuelve esa mesa (es la invitación, quien lo tiene
   *    puede entrar).
   *  - NOMBRE: busca SOLO entre TUS mesas, que es para lo que se usa de
   *    verdad — reencontrar la tuya, no descubrir las de otros.
   * Sin texto no devuelve nada.
   */
  async buscar(
    texto: string | undefined,
    userId: string,
  ): Promise<PartidaResumen[]> {
    const filtro = texto?.trim();
    if (!filtro) {
      return [];
    }

    // Primero, ¿es un código de invitación? Búsqueda exacta, no parcial.
    const porCodigo = await this.partidas.findOne({
      where: { codigo: filtro.toUpperCase() },
      relations: { master: true, personajes: true },
    });
    if (porCodigo) {
      return [this.aResumen(porCodigo, userId)];
    }

    // Si no, por nombre, pero acotado a las mesas donde ya participas
    const idsMios = await this.idsDeMisMesas(userId);
    if (idsMios.length === 0) {
      return [];
    }
    const partidas = await this.partidas.find({
      where: { id: In(idsMios), nombre: ILike(`%${filtro}%`) },
      relations: { master: true, personajes: true },
      order: { createdAt: 'DESC' },
    });
    return partidas.map((partida) => this.aResumen(partida, userId));
  }

  /** Ids de las mesas que diriges o donde tienes algún personaje sentado. */
  private async idsDeMisMesas(userId: string): Promise<string[]> {
    const sentados = await this.personajes.find({
      where: { character: { ownerId: userId } },
    });
    const dirigidas = await this.partidas.find({
      where: { masterId: userId },
      select: { id: true },
    });
    return [
      ...new Set([
        ...sentados.map((pep) => pep.partidaId),
        ...dirigidas.map((p) => p.id),
      ]),
    ];
  }

  /**
   * Las mesas del usuario: las que dirige MÁS aquellas donde tiene algún
   * personaje sentado. Sin tope: son tuyas, caben todas.
   */
  async mias(userId: string): Promise<MiPartidaResumen[]> {
    // En dos pasos a propósito: filtrar por una relación anidada y cargar
    // esa misma relación en la misma consulta hace que TypeORM devuelva
    // SOLO las filas que casan (verías un personaje por mesa, el tuyo).
    const ids = await this.idsDeMisMesas(userId);
    if (ids.length === 0) {
      return [];
    }

    const partidas = await this.partidas.find({
      where: { id: In(ids) },
      relations: { master: true, personajes: { character: true } },
      order: { updatedAt: 'DESC' },
    });

    return partidas.map((partida) => ({
      ...this.aResumen(partida, userId),
      soyMaster: partida.masterId === userId,
      misPersonajes: (partida.personajes ?? [])
        .filter((pep) => pep.character?.ownerId === userId)
        .map((pep) => pep.character.name),
    }));
  }

  async detalle(id: string, userId: string): Promise<PartidaDetalle> {
    const partida = await this.buscarEntidad(id);
    // La mesa es PRIVADA: quien no está sentado en ella recibe el mismo 404
    // que si no existiera. 404 y no 403, igual que con las fichas ajenas: un
    // 403 confirmaría que esa partida existe.
    if (!this.esParticipante(partida, userId)) {
      throw new NotFoundException(`Partida ${id} no encontrada`);
    }
    const esMaster = partida.masterId === userId;
    return {
      ...this.aResumen(partida, userId),
      esMaster,
      // ÚNICO filtro de PNJ ocultos de toda la aplicación. Que esté aquí y
      // solo aquí es lo que hace la emboscada fiable: cualquier camino que
      // lleve datos al cliente pasa por este detalle (la carga inicial y la
      // recarga que dispara mesa-cambiada).
      //
      // Y el mismo sitio recorta los PG exactos de los PNJ para quien no es
      // el máster: es el único punto donde se sabe QUIÉN pregunta, así que
      // es el único donde se puede decidir.
      personajes: partida.personajes
        .filter((pep) => esMaster || !pep.oculto)
        .map((pep) => {
          const resumen = this.aPersonajeResumen(pep, userId);
          return esMaster ? resumen : this.soloLoPublico(resumen);
        }),
      enCombate: partida.enCombate,
      ronda: partida.ronda,
      turnoPepId: partida.turnoPepId,
      // Mismo criterio que los PNJ ocultos: lo que el jugador no debe ver
      // no se le manda. Ocultar en el cliente sería enseñarlo en la
      // respuesta de la API a quien mire.
      zonas: partida.zonas.filter((zona) => esMaster || zona.visible),
    };
  }

  /**
   * Reemplaza LA LISTA ENTERA de zonas. Solo el máster.
   *
   * Se guarda entera a propósito: la edita una sola persona, así que no hay
   * dos versiones que fusionar, y un reemplazo no deja estados a medias
   * como sí haría un alta/baja por zona.
   */
  async guardarZonas(
    partidaId: string,
    zonas: ZonaTablero[],
    userId: string,
  ): Promise<PartidaDetalle> {
    const partida = await this.buscarEntidad(partidaId);
    this.soloElMaster(partida, userId);

    if (zonas.length > ZONAS_MAX) {
      throw new BadRequestException(
        `Demasiadas zonas (máximo ${ZONAS_MAX}); junta las que se toquen`,
      );
    }
    // El DTO comprueba cada número por su cuenta; esto comprueba el
    // rectángulo entero, que es donde está el error de verdad: una zona que
    // empieza dentro del tablero y termina fuera.
    const fuera = zonas.find((zona) => !zonaCabeEnTablero(zona));
    if (fuera) {
      throw new BadRequestException(
        `La zona «${fuera.nombre || 'sin nombre'}» se sale del tablero`,
      );
    }
    partida.zonas = zonas;
    await this.partidas.save(partida);

    // Una zona se dibuja preparando la mesa, no en mitad de un turno: el
    // aviso barato (recarga filtrada) basta, y además es el ÚNICO correcto
    // aquí, porque cada jugador ve una lista distinta según lo visible.
    this.gateway.emitirMesaCambiada(partidaId);
    return this.detalle(partidaId, userId);
  }

  /**
   * Genera un código de invitación nuevo. Es la respuesta barata a "se me
   * ha filtrado": los que ya están dentro siguen dentro, y el viejo deja de
   * abrir la puerta.
   */
  async regenerarCodigo(
    partidaId: string,
    userId: string,
  ): Promise<PartidaDetalle> {
    const partida = await this.buscarEntidad(partidaId);
    this.soloElMaster(partida, userId);
    partida.codigo = this.generarCodigo();
    await this.partidas.save(partida);
    this.gateway.emitirMesaCambiada(partidaId);
    return this.detalle(partidaId, userId);
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

  /**
   * Cierra la mesa entera. Solo el máster. Los asientos se los lleva el
   * CASCADE de la BD, pero hay algo que la base de datos no ve y quedaría
   * de basura para siempre: las INSTANCIAS de PNJ, fichas desechables que
   * existían solo para esta mesa. Misma regla que en sacar(): un PJ (es del
   * jugador) o una PLANTILLA del bestiario NO se borran jamás por cerrar
   * una partida.
   * Al final se avisa a la sala: si no, los que estuvieran dentro seguirían
   * mirando una mesa que ya no existe.
   */
  async eliminar(id: string, userId: string): Promise<void> {
    const partida = await this.buscarEntidad(id);
    this.soloElMaster(partida, userId);

    // Se recogen ANTES del remove: después, partida.personajes ya no sirve
    const instancias = partida.personajes
      .map((pep) => pep.character)
      .filter((ficha) => ficha?.tipo === 'pnj' && ficha.plantillaId);

    await this.partidas.remove(partida);
    for (const instancia of instancias) {
      await this.characters.borrarPorId(instancia.id);
    }

    this.gateway.emitirMesaEliminada(id);
  }

  /** Unirse con UN personaje TUYO; el estado de sesión nace de la ficha. */
  async unir(
    partidaId: string,
    characterId: string,
    userId: string,
    codigo?: string,
  ): Promise<PersonajeEnPartidaResumen> {
    const partida = await this.buscarEntidad(partidaId);

    // EL CÓDIGO ES LA INVITACIÓN. Quien ya está en la mesa (el máster, o un
    // jugador que trae un segundo personaje) no tiene que volver a teclearlo;
    // para el resto es obligatorio y es lo único que da acceso.
    if (!this.esParticipante(partida, userId)) {
      const dado = codigo?.trim().toUpperCase();
      if (!dado || dado !== partida.codigo) {
        throw new ForbiddenException(
          'Necesitas el código de invitación de esta mesa',
        );
      }
    }

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
    // Si es una colocación/movimiento, la huella debe caber y no pisar a nadie
    if (dto.posX !== undefined || dto.posY !== undefined) {
      this.validarColocacion(
        partida,
        pep,
        dto.posX ?? pep.posX,
        dto.posY ?? pep.posY,
      );
    }

    Object.assign(pep, dto);
    await this.personajes.save(pep);
    const resumen = this.aPersonajeResumen(pep, userId);
    // Bajarle los PG a un PNJ no se difunde: el número es del máster. Se
    // avisa a la sala y cada cliente recarga el detalle que le toca.
    const tocaNumerosPrivados =
      pep.character?.tipo === 'pnj' &&
      (dto.pgActuales !== undefined || dto.danoNoLetal !== undefined);
    this.emitirCambioDePep(partidaId, pep, resumen, tocaNumerosPrivados);
    return resumen;
  }

  /**
   * Crea un monstruo NUEVO: guarda su PLANTILLA en el bestiario del máster
   * y siembra N instancias en la mesa. Todo lo que creas queda reutilizable
   * sin tener que decidirlo de antemano; si no lo quieres, se borra desde
   * el bestiario.
   */
  async crearPnjs(
    partidaId: string,
    dto: CrearPnjDto,
    userId: string,
  ): Promise<PartidaDetalle> {
    const partida = await this.buscarEntidad(partidaId);
    this.soloElMaster(partida, userId);

    const plantilla = await this.characters.create(
      { name: dto.nombre, level: dto.nivel ?? 1, sheetData: this.sheetDePnj(dto) },
      userId,
      'pnj',
    );
    return this.sembrar(partida, plantilla, dto, userId);
  }

  /** Trae a la mesa copias de un monstruo YA guardado en el bestiario. */
  async sembrarDesdePlantilla(
    partidaId: string,
    dto: SembrarPnjDto,
    userId: string,
  ): Promise<PartidaDetalle> {
    const partida = await this.buscarEntidad(partidaId);
    this.soloElMaster(partida, userId);
    // Valida de paso que la plantilla es TUYA y es una plantilla
    const plantilla = await this.characters.plantilla(dto.plantillaId, userId);
    return this.sembrar(partida, plantilla, dto, userId);
  }

  /**
   * Siembra N copias de una plantilla. UNA FICHA POR COPIA porque el
   * asiento es único por (partida, personaje): dos tokens del mismo goblin
   * necesitan dos fichas, cada una con sus PG y condiciones.
   */
  private async sembrar(
    partida: Partida,
    plantilla: Character,
    opciones: { cantidad: number; actitud: ActitudPnj; oculto: boolean },
    userId: string,
  ): Promise<PartidaDetalle> {
    const cantidad = opciones.cantidad ?? 1;
    const pgTotal = plantilla.sheetData?.pg?.total ?? null;

    for (let i = 0; i < cantidad; i++) {
      // Con una sola copia no se numera: "Jefe goblin", no "Jefe goblin 1"
      const nombre =
        cantidad > 1 ? `${plantilla.name} ${i + 1}` : plantilla.name;
      const instancia = await this.characters.crearInstancia(
        plantilla,
        nombre,
        userId,
      );
      await this.personajes.save(
        this.personajes.create({
          partidaId: partida.id,
          characterId: instancia.id,
          // Arranca con los PG llenos, igual que un PJ al unirse
          pgActuales: pgTotal,
          condiciones: [],
          actitud: opciones.actitud,
          oculto: opciones.oculto ?? false,
        }),
      );
    }

    this.gateway.emitirMesaCambiada(partida.id);
    return this.detalle(partida.id, userId);
  }

  /**
   * Del formulario corto a una ficha de verdad. Se guardan COMPONENTES
   * (Destreza, armadura, escudo, tamaño), no totales: así la CA, la
   * iniciativa y la huella salen de las mismas funciones puras que usan
   * los PJ, y las condiciones siguen sumando encima sin casos especiales.
   */
  private sheetDePnj(dto: CrearPnjDto): CharacterSheetData {
    return {
      tamano: dto.tamano ?? 'mediano',
      atributos: { destreza: { puntuacion: dto.destreza ?? 10 } },
      combate: {
        bonifArmadura: dto.bonifArmadura ?? 0,
        bonifEscudo: dto.bonifEscudo ?? 0,
        armaduraNatural: dto.armaduraNatural ?? 0,
        modVarioIniciativa: dto.modVarioIniciativa ?? 0,
      },
      pg: { total: dto.pgTotal ?? 0 },
    };
  }

  /** El máster revela (o vuelve a esconder) un PNJ colocado en el tablero. */
  async revelarPnj(
    partidaId: string,
    pepId: string,
    oculto: boolean,
    userId: string,
  ): Promise<PartidaDetalle> {
    const partida = await this.buscarEntidad(partidaId);
    this.soloElMaster(partida, userId);
    const pep = this.buscarPep(partida, pepId);

    pep.oculto = oculto;
    await this.personajes.save(pep);
    // Siempre mesa-cambiada: aparecer o desaparecer del tablero cambia lo
    // que cada cliente tiene derecho a ver, y eso lo resuelve detalle().
    this.gateway.emitirMesaCambiada(partidaId);
    return this.detalle(partidaId, userId);
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
    const instancia = pep.character;
    await this.personajes.remove(pep);
    // Las INSTANCIAS de PNJ son desechables: su ficha muere con el asiento.
    // Si no, cada emboscada dejaría cuatro fichas fantasma para siempre.
    // Ojo con la condición: un PJ (tipo 'pj') o una PLANTILLA del bestiario
    // (plantillaId null) NO se borran jamás por sacarlos de una mesa.
    if (instancia?.tipo === 'pnj' && instancia.plantillaId) {
      await this.characters.borrarPorId(instancia.id);
    }
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
    this.emitirCambioDePep(partidaId, pep, resumen);
    return resumen;
  }

  /**
   * Retransmite un cambio de estado a la sala. Si el asiento está OCULTO no
   * se puede usar el evento de estado —va a todos por igual y delataría la
   * posición o los PG del PNJ—, así que se manda un mesa-cambiada: cada
   * cliente recarga y el filtro de detalle() decide qué merece ver.
   *
   * Lo mismo vale cuando el cambio TOCA LOS PG DE UN PNJ: los números
   * exactos son del máster, y un payload que va a toda la sala no puede
   * llevarlos. Se avisa y cada uno recarga lo suyo. Ojo con ampliarlo a
   * "todo PNJ": mover un ogro no tiene nada privado y no merece que los
   * cinco clientes recarguen la mesa entera.
   */
  private emitirCambioDePep(
    partidaId: string,
    pep: PersonajeEnPartida,
    resumen: PersonajeEnPartidaResumen,
    tocaNumerosPrivados = false,
  ): void {
    if (pep.oculto || tocaNumerosPrivados) {
      this.gateway.emitirMesaCambiada(partidaId);
      return;
    }
    this.gateway.emitirEstadoPersonaje(
      partidaId,
      pep.id,
      this.aEstadoPublico(resumen),
    );
  }

  /**
   * Payload de difusión: UNO para toda la sala, así que no puede llevar
   * nada que dependa de quién mira. Fuera esMio y fuera los PG exactos de
   * un PNJ (queda su estadoVital). Es la misma regla que soloLoPublico,
   * aplicada aquí también para que ningún camino pueda saltársela.
   */
  private aEstadoPublico(
    resumen: PersonajeEnPartidaResumen,
  ): Partial<Omit<PersonajeEnPartidaResumen, 'esMio'>> {
    const publico = this.soloLoPublico(
      resumen,
    ) as Partial<PersonajeEnPartidaResumen>;
    delete publico.esMio;
    return publico;
  }

  /**
   * Recorta de un asiento lo que un jugador no tiene derecho a saber: los
   * PG exactos de un PNJ. Devuelve SIEMPRE una copia — quien la llama sigue
   * usando el resumen original para responder por HTTP a quien sí tiene
   * derecho, y mutarlo le quitaría campos por la espalda.
   *
   * Los PJ no se tocan: la partida comparte su propio estado.
   */
  private soloLoPublico(
    resumen: PersonajeEnPartidaResumen,
  ): PersonajeEnPartidaResumen {
    const publico = { ...resumen };
    if (publico.tipo !== 'pnj') {
      return publico;
    }
    delete publico.pgActuales;
    delete publico.pgTotal;
    delete publico.danoNoLetal;
    return publico;
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
  esParticipante(partida: Partida, userId: string): boolean {
    return (
      partida.masterId === userId ||
      (partida.personajes ?? []).some(
        (pep) => pep.character?.ownerId === userId,
      )
    );
  }

  private soloParticipantes(partida: Partida, userId: string): void {
    if (!this.esParticipante(partida, userId)) {
      throw new ForbiddenException(
        'Solo los participantes de la mesa pueden tirar dados',
      );
    }
  }

  /**
   * Un personaje ocupa una huella cuadrada según su tamaño (Grande = 2×2).
   * Al colocarlo, esa huella debe caber entera en el tablero y no solaparse
   * con la de nadie más. Lo valida el SERVIDOR: el cliente no es de fiar.
   */
  private validarColocacion(
    partida: Partida,
    pep: PersonajeEnPartida,
    posX: number | null,
    posY: number | null,
  ): void {
    if (posX === null || posY === null) {
      return; // sigue en el banquillo, no hay nada que validar
    }
    const lado = casillasQueOcupa(pep.character?.sheetData ?? {});
    if (posX + lado > TABLERO_ANCHO || posY + lado > TABLERO_ALTO) {
      throw new BadRequestException(
        `No cabe ahí: ocupa ${lado}×${lado} casillas`,
      );
    }
    for (const otro of partida.personajes) {
      if (otro.id === pep.id || otro.posX === null || otro.posY === null) {
        continue;
      }
      const otroLado = casillasQueOcupa(otro.character?.sheetData ?? {});
      if (huellasSeSolapan(posX, posY, lado, otro.posX, otro.posY, otroLado)) {
        throw new BadRequestException('Esa casilla ya está ocupada');
      }
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
      soyParticipante: this.esParticipante(partida, userId),
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
      // Lo ÚNICO de la ficha que se comparte con toda la mesa. No pasa por
      // soloLoPublico a propósito: es público también en el PNJ, que es
      // justo lo que un jugador ve al mirar al bicho. Los ocultos no se
      // libran de nada por esto: su asiento entero se filtra en detalle().
      descripcion: sheet.descripcion,
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
      // Derivado por el servidor con la misma función pura que usa el
      // cliente: es lo ÚNICO que sobrevive al recorte de soloLoPublico, así
      // que tiene que ir siempre, no solo cuando se recorta.
      estadoVital: estadoVitalDe(
        pep.pgActuales,
        pep.character?.sheetData?.pg?.total,
      ),
      condiciones: pep.condiciones ?? [],
      posX: pep.posX,
      posY: pep.posY,
      // Huella en casillas según el tamaño de la ficha (Grande = 2×2)
      casillas: casillasQueOcupa(sheet),
      iniciativa: pep.iniciativa,
      // El modificador de iniciativa lo deriva el servidor de la ficha
      iniciativaMod: iniciativa(pep.character?.sheetData ?? {}),
      esMio: pep.character?.ownerId === userId,
      tipo: pep.character?.tipo ?? 'pj',
      actitud: pep.actitud ?? undefined,
      oculto: pep.oculto,
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
