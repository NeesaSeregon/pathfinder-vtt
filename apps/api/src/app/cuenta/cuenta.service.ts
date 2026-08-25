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
import { Character } from '../characters/entities/character.entity';
import { Partida } from '../partidas/entities/partida.entity';
import { PersonajeEnPartida } from '../partidas/entities/personaje-en-partida.entity';
import { EnviadorCorreo } from '../correo/enviador-correo';
import { correoPasswordCambiada } from '../correo/plantillas';

/**
 * Todo lo que un usuario puede hacer con SU PROPIA cuenta. Vive en su
 * módulo (y no en users/) porque para borrar necesita coordinar las
 * credenciales (auth) con la fila del usuario (users), y de paso contar lo
 * que se va a perder.
 */
@Injectable()
export class CuentaService {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly correo: EnviadorCorreo,
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
   * Cambio de contraseña estando dentro: hay que saber la actual.
   *
   * DEVUELVE UN TOKEN NUEVO, y no es un capricho: cambiar la contraseña
   * sube el tokenVersion del usuario, lo que invalida todas sus sesiones
   * abiertas… incluida la del navegador desde el que se está cambiando. El
   * controlador repone la cookie con este token para que quien lo hace se
   * quede dentro y solo se caigan LOS DEMÁS dispositivos.
   *
   * Manda además el MISMO aviso por correo que el restablecimiento. No
   * sobra: si alguien te ha robado la sesión y te cambia la contraseña
   * desde aquí, este correo es lo único que te lo cuenta.
   */
  async cambiarPassword(
    userId: string,
    passwordActual: string,
    passwordNueva: string,
  ): Promise<string | null> {
    await this.reautenticar(userId, passwordActual);
    await this.auth.cambiarPassword(userId, passwordNueva);

    const user = await this.users.findById(userId);
    if (user) {
      await this.correo.enviar(
        correoPasswordCambiada(user.email, user.username),
      );
    }
    const sesion = await this.auth.renovarSesion(userId);
    return sesion?.token ?? null;
  }

  /**
   * Borra la cuenta y todo lo que cuelga de ella. Pide la contraseña otra
   * vez: la sesión sola no basta para una acción sin vuelta atrás.
   */
  async borrar(userId: string, password: string): Promise<void> {
    await this.reautenticar(userId, password);
    // Ya no queda nada fuera de la base de datos que limpiar: desde que el
    // tablero no admite mapas subidos, todo lo de una partida (zonas
    // incluidas) vive en su fila y se lo lleva el CASCADE.
    await this.users.eliminar(userId);
  }

  /** Vuelve a pedir la contraseña antes de una acción delicada. */
  private async reautenticar(userId: string, password: string): Promise<void> {
    if (!(await this.auth.verificarPassword(userId, password))) {
      // 403 y no 401 a propósito: la sesión es válida, lo que falla es la
      // reconfirmación. Un 401 aquí significaría "tu sesión ha caducado" y
      // el interceptor del front te echaría a /entrar en vez de enseñarte
      // el error, que es justo lo contrario de lo que ha pasado.
      throw new ForbiddenException('La contraseña no es correcta');
    }
  }
}
