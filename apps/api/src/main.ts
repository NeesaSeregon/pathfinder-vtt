import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app/app.module';

/**
 * Dónde vive el front ya compilado. En el contenedor se copia junto al
 * bundle de la API; en desarrollo no existe y el front lo sirve `nx serve`
 * con su proxy, así que este bloque no se activa.
 */
const CARPETA_FRONT =
  process.env.FRONT_DIR ?? join(__dirname, '..', 'pathfinder-app', 'browser');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Detrás de un proxy inverso (nginx, Caddy, el balanceador del hosting)
  // req.ip sería la del proxy y no la del visitante. Sin esto, el freno de
  // intentos de login contaría a TODO el mundo como la misma IP y un solo
  // atacante dejaría a los demás sin poder entrar.
  app.set('trust proxy', 1);

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

  // En producción la API sirve TAMBIÉN el front, así todo va por el mismo
  // origen: la cookie SameSite=Strict sigue viajando y no hace falta CORS.
  if (existsSync(CARPETA_FRONT)) {
    app.useStaticAssets(CARPETA_FRONT);
    // Es una SPA: cualquier ruta que no sea /api ni un fichero con
    // extensión devuelve index.html. Sin esto, recargar en /partidas/:id
    // daría un 404 en vez de la aplicación.
    app.use(
      (
        req: { path: string },
        res: { sendFile(ruta: string): void },
        next: () => void,
      ) => {
        if (req.path.startsWith(`/${globalPrefix}`) || req.path.includes('.')) {
          return next();
        }
        res.sendFile(join(CARPETA_FRONT, 'index.html'));
      },
    );
    Logger.log(`Sirviendo el front desde ${CARPETA_FRONT}`);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
