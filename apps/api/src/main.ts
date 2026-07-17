/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  // Necesario para leer la cookie de sesión (req.cookies)
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist: descarta propiedades que no estén en el DTO.
      // transform: convierte el body JSON en instancias del DTO
      // (necesario para que @Min/@Max validen números correctamente).
      whitelist: true,
      transform: true,
    }),
  );
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
