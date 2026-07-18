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
import { PartidasService } from './partidas.service';
import {
  ActualizarPersonajeEnPartidaDto,
  CreatePartidaDto,
  TirarDadosDto,
  UnirsePartidaDto,
  UpdatePartidaDto,
} from './dto/create-partida.dto';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('partidas')
export class PartidasController {
  constructor(private readonly partidas: PartidasService) {}

  @Post()
  crear(@Body() dto: CreatePartidaDto, @CurrentUser() user: JwtPayload) {
    return this.partidas.crear(dto, user.sub);
  }

  @Get()
  buscar(
    @Query('buscar') buscar: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.partidas.buscar(buscar, user.sub);
  }

  @Get(':id')
  detalle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.partidas.detalle(id, user.sub);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartidaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.partidas.actualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.partidas.eliminar(id, user.sub);
  }

  @Post(':id/personajes')
  unir(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UnirsePartidaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.partidas.unir(id, dto.characterId, user.sub);
  }

  @Patch(':id/personajes/:pepId')
  actualizarPersonaje(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pepId', ParseUUIDPipe) pepId: string,
    @Body() dto: ActualizarPersonajeEnPartidaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.partidas.actualizarPersonaje(id, pepId, dto, user.sub);
  }

  @Get(':id/personajes/:pepId/ficha')
  ficha(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pepId', ParseUUIDPipe) pepId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.partidas.fichaDePersonaje(id, pepId, user.sub);
  }

  @Post(':id/personajes/:pepId/iniciativa')
  tirarIniciativa(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pepId', ParseUUIDPipe) pepId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.partidas.tirarIniciativa(id, pepId, user.sub);
  }

  @Post(':id/combate/iniciar')
  iniciarCombate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.partidas.iniciarCombate(id, user.sub);
  }

  @Post(':id/combate/siguiente')
  siguienteTurno(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.partidas.siguienteTurno(id, user.sub);
  }

  @Post(':id/combate/terminar')
  terminarCombate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.partidas.terminarCombate(id, user.sub);
  }

  @Post(':id/tiradas')
  tirar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TirarDadosDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.partidas.tirarDados(id, dto, user);
  }

  @Delete(':id/personajes/:pepId')
  @HttpCode(HttpStatus.NO_CONTENT)
  sacar(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pepId', ParseUUIDPipe) pepId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.partidas.sacar(id, pepId, user.sub);
  }
}
