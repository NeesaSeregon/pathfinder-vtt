import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { IntentosLoginService } from './intentos-login.service';
import { RecuperacionService } from './recuperacion.service';
import { FrenoRecuperacionService } from './freno-recuperacion.service';
import { TokenRecuperacion } from './entities/token-recuperacion.entity';
import { UsersModule } from '../users/users.module';
import { CorreoModule } from '../correo/correo.module';

@Module({
  imports: [
    UsersModule,
    CorreoModule,
    TypeOrmModule.forFeature([TokenRecuperacion]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  providers: [
    AuthService,
    IntentosLoginService,
    RecuperacionService,
    FrenoRecuperacionService,
    // APP_GUARD: el AuthGuard se aplica a TODOS los endpoints de la API.
    // Solo lo marcado @Public() (register, login) queda abierto.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  controllers: [AuthController],
  // Exportado para que CuentaModule pueda reautenticar antes de borrar
  exports: [AuthService],
})
export class AuthModule {}
