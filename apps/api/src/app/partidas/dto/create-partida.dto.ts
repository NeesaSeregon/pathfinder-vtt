import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CrearPartida,
  ESTADOS_PARTIDA,
  EstadoPartida,
} from '@pathfinder/shared';

export class CreatePartidaDto implements CrearPartida {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}

export class UpdatePartidaDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsIn(ESTADOS_PARTIDA)
  estado?: EstadoPartida;
}

export class UnirsePartidaDto {
  @IsUUID()
  characterId: string;
}
