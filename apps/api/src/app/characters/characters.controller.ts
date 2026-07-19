import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { JwtPayload } from '@pathfinder/shared';
import { CharactersService } from './characters.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('characters')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Post()
  create(
    @Body() createCharacterDto: CreateCharacterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.charactersService.create(createCharacterDto, user.sub);
  }

  /** ?tipo=pnj devuelve el BESTIARIO (plantillas); por defecto, tus PJ. */
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('tipo') tipo?: string,
  ) {
    return this.charactersService.findAll(
      user.sub,
      tipo === 'pnj' ? 'pnj' : 'pj',
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Lectura ampliada: el dueño o el máster de una mesa donde esté sentado
    return this.charactersService.leer(id, user.sub);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCharacterDto: UpdateCharacterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.charactersService.update(id, updateCharacterDto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.charactersService.remove(id, user.sub);
  }
}
