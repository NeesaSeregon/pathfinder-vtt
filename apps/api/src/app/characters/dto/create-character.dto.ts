import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { errorDeSheetData } from '@pathfinder/shared';
import type { CharacterSheetData } from '@pathfinder/shared';

/**
 * sheetData es JSONB y viaja sin validar campo a campo (a propósito: así
 * añadir una casilla a la ficha no toca la API). Pero SIN validar nada, el
 * único tope es el del body de Express, y el maxlength del formulario es
 * cliente: no frena a nadie. Esto pone el suelo mínimo —longitud de los
 * textos libres y tamaño del documento— con la función pura compartida,
 * para que el límite sea el mismo número en los dos lados.
 */
@ValidatorConstraint({ name: 'sheetDataValida', async: false })
export class SheetDataValida implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    return errorDeSheetData(valor) === null;
  }

  defaultMessage(args: ValidationArguments): string {
    return errorDeSheetData(args.value) ?? 'sheetData no es válido';
  }
}

export class CreateCharacterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  level?: number;

  @IsOptional()
  @IsObject()
  @Validate(SheetDataValida)
  sheetData?: CharacterSheetData;
}
