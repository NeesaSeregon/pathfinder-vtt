import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
  ACTITUDES,
  ActitudPnj,
  ActualizarPersonajeEnPartida,
  CONDICION_IDS,
  CrearPartida,
  CrearPnj,
  ESTADOS_PARTIDA,
  EstadoPartida,
  PNJ_MAX_CANTIDAD,
  TABLERO_ALTO,
  TABLERO_ANCHO,
  Tamano,
  TAMANOS,
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

  // Lista de ids del catálogo de condiciones; rechazamos cualquier id ajeno
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CONDICION_IDS.length)
  @IsIn(CONDICION_IDS, { each: true })
  condiciones?: string[];

  // La iniciativa puede ser negativa (tirada baja + modificador negativo)
  @IsOptional()
  @IsInt()
  @Min(-50)
  @Max(99)
  iniciativa?: number;
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

/**
 * Bloque de estadísticas corto de un PNJ. Se piden COMPONENTES y no
 * totales (CA, iniciativa): así los derivan las mismas funciones puras
 * que para un PJ. Los rangos son generosos a propósito — hay monstruos
 * con armadura natural absurda — pero acotados para que un dedazo no
 * cree una criatura imposible.
 */
export class CrearPnjDto implements CrearPnj {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre: string;

  @IsInt()
  @Min(1)
  @Max(PNJ_MAX_CANTIDAD)
  cantidad: number;

  @IsIn(ACTITUDES)
  actitud: ActitudPnj;

  @IsBoolean()
  oculto: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  nivel?: number;

  @IsOptional()
  @IsIn(TAMANOS)
  tamano?: Tamano;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  destreza?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  bonifArmadura?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  bonifEscudo?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  armaduraNatural?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  pgTotal?: number;

  @IsOptional()
  @IsInt()
  @Min(-20)
  @Max(20)
  modVarioIniciativa?: number;
}

/** Revelar u ocultar un PNJ ya colocado. */
export class RevelarPnjDto {
  @IsBoolean()
  oculto: boolean;
}
