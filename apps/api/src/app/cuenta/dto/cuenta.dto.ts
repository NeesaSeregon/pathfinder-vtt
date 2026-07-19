import { IsString, MaxLength, MinLength } from 'class-validator';
import { BorrarCuentaDatos, CambiarPasswordDatos } from '@pathfinder/shared';

export class BorrarCuentaDto implements BorrarCuentaDatos {
  @IsString()
  @MinLength(8, { message: 'Escribe tu contraseña para confirmar' })
  @MaxLength(72)
  password: string;
}

export class CambiarPasswordDto implements CambiarPasswordDatos {
  @IsString()
  @MinLength(8, { message: 'Escribe tu contraseña actual' })
  @MaxLength(72)
  passwordActual: string;

  // El mismo mínimo que en el registro: si no, se podría "rebajar" aquí
  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener 8 caracteres o más' })
  @MaxLength(72)
  passwordNueva: string;
}
