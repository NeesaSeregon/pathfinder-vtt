import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import {
  OlvidePasswordDatos,
  PASSWORD_MAX_LONGITUD,
  PASSWORD_MIN_LONGITUD,
  RestablecerPasswordDatos,
} from '@pathfinder/shared';

export class OlvidePasswordDto implements OlvidePasswordDatos {
  @IsEmail({}, { message: 'El email no tiene un formato válido' })
  email: string;
}

export class RestablecerPasswordDto implements RestablecerPasswordDatos {
  // El token son 32 bytes en base64url, o sea 43 caracteres. Se acota por
  // arriba y por abajo para que un campo absurdo ni llegue a la consulta.
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;

  // El MISMO mínimo que el registro y que el cambio desde /cuenta: si aquí
  // se aflojara, este sería el camino para rebajar cualquier contraseña.
  @IsString()
  @MinLength(PASSWORD_MIN_LONGITUD, {
    message: `La contraseña debe tener al menos ${PASSWORD_MIN_LONGITUD} caracteres`,
  })
  @MaxLength(PASSWORD_MAX_LONGITUD)
  passwordNueva: string;
}
