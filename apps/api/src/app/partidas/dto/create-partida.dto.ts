import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ActualizarPersonajeEnPartida,
  CrearPartida,
  ESTADOS_PARTIDA,
  EstadoPartida,
  TABLERO_ALTO,
  TABLERO_ANCHO,
  TirarDados,
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

export class ActualizarPersonajeEnPartidaDto
  implements ActualizarPersonajeEnPartida
{
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(TABLERO_ANCHO - 1)
  posX?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(TABLERO_ALTO - 1)
  posY?: number;

  // Puede ser negativo: en PF1e estás moribundo hasta -CON
  @IsOptional()
  @IsInt()
  @Min(-100)
  @Max(9999)
  pgActuales?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  danoNoLetal?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  condiciones?: string;
}

export class TirarDadosDto implements TirarDados {
  // El parseo fino (formato, topes) lo valida lanzarDados en el servicio,
  // única fuente de verdad; aquí solo acotamos que sea texto razonable.
  @IsString()
  @MaxLength(30)
  notacion: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  etiqueta?: string;
}
