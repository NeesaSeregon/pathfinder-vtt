import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CharactersService } from './characters.service';
import { CharactersController } from './characters.controller';
import { Character } from './entities/character.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Character])],
  controllers: [CharactersController],
  providers: [CharactersService],
  // PartidasModule valida la propiedad del personaje al unirse a una mesa
  exports: [CharactersService],
})
export class CharactersModule {}
