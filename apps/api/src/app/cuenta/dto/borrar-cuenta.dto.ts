import { IsString, MaxLength, MinLength } from 'class-validator';
import { BorrarCuentaDatos } from '@pathfinder/shared';

export class BorrarCuentaDto implements BorrarCuentaDatos {
  @IsString()
  @MinLength(8, { message: 'Escribe tu contraseña para confirmar' })
  @MaxLength(72)
  password: string;
}
