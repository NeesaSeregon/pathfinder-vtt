import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CuentaDetalle } from '@pathfinder/shared';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { PartidasService } from '../partidas/partidas.service';
import { Character } from '../characters/entities/character.entity';
import { Partida } from '../partidas/entities/partida.entity';
import { PersonajeEnPartida } from '../partidas/entities/personaje-en-partida.entity';

/**
 * Todo lo que un usuario puede hacer con SU PROPIA cuenta. Vive en su
 * módulo (y no en users/) porque para borrar necesita coordinar a tres:
 * las credenciales (auth), los ficheros de los mapas (partidas) y la fila
 * del usuario (users).
 */
@Injectable()
export class CuentaService {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly partidas: PartidasService,
    @InjectRepository(Character)
    private readonly characters: Repository<Character>,
    @InjectRepository(Partida)
    private readonly partidasRepo: Repository<Partida>,
    @InjectRepository(PersonajeEnPartida)
    private readonly peps: Repository<PersonajeEnPartida>,
  ) {}

  async detalle(userId: string): Promise<CuentaDetalle> {
    const user = await this.users.findById(userId);
    if (!user) {
      // La cookie es válida pero el usuario ya no está (¿borrado en otra
      // pestaña?). Para el cliente es lo mismo que no existir.
      throw new NotFoundException('La cuenta ya no existe');
    }

    const [numPersonajes, numPartidasComoMaster, numPartidasComoJugador] =
      await Promise.all([
        this.characters.countBy({ ownerId: userId }),
        this.partidasRepo.countBy({ masterId: userId }),
        this.peps.count({ where: { character: { ownerId: userId } } }),
      ]);

    return {
      username: user.username,
      email: user.email,
      creadaEl: user.createdAt.toISOString(),
      numPersonajes,
      numPartidasComoMaster,
      numPartidasComoJugador,
    };
  }

  /**
   * Borra la cuenta y todo lo que cuelga de ella. Pide la contraseña otra
   * vez: la sesión sola no basta para una acción sin vuelta atrás.
   */
  async borrar(userId: string, password: string): Promise<void> {
    if (!(await this.auth.verificarPassword(userId, password))) {
      // 403 y no 401 a propósito: la sesión es válida, lo que falla es la
      // reconfirmación. Un 401 aquí significaría "tu sesión ha caducado" y
      // el interceptor del front te echaría a /entrar en vez de enseñarte
      // el error, que es justo lo contrario de lo que ha pasado.
      throw new ForbiddenException('La contraseña no es correcta');
    }
    // Primero los ficheros: si fallara el borrado en BD, mejor un mapa de
    // menos que un fichero huérfano que ya nadie sabe de quién era.
    await this.partidas.borrarMapasDeMaster(userId);
    await this.users.eliminar(userId);
  }
}
