import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { CharacterSheetData } from '@pathfinder/shared';

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
  sheetData?: CharacterSheetData;
}
