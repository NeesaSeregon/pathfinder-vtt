import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Credenciales, RegistroDatos } from '@pathfinder/shared';

export class CredencialesDto implements Credenciales {
  @IsEmail({}, { message: 'El email no tiene un formato válido' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72)
  password: string;
}

export class RegistroDto extends CredencialesDto implements RegistroDatos {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[\p{L}0-9][\p{L}0-9 _-]*$/u, {
    message:
      'El usuario solo puede llevar letras, números, espacios, guión y guión bajo',
  })
  username: string;
}
