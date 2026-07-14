import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Character } from '@pathfinder/shared';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('demo')
  getDemo(): Character {
    return { id: '1', name: 'Ezren', level: 5, sheetData: {} };
  }
}
