import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Personaje } from '@pathfinder/shared';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

@Get('demo')
getDemo(): Personaje {
  return { id: '1', nombre: 'Ezren', nivel: 5 };
}
}
