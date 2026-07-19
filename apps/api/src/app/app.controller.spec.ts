import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();
  });

  describe('getDemo', () => {
    it('should return a demo character', () => {
      const appController = app.get<AppController>(AppController);
      expect(appController.getDemo()).toEqual({
        id: '1',
        name: 'Ezren',
        level: 5,
        tipo: 'pj',
        sheetData: {},
      });
    });
  });
});
