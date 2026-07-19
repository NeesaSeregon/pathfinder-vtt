import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { IntentosLoginService } from './intentos-login.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
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
    // APP_GUARD: el AuthGuard se aplica a TODOS los endpoints de la API.
    // Solo lo marcado @Public() (register, login) queda abierto.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  controllers: [AuthController],
  // Exportado para que CuentaModule pueda reautenticar antes de borrar
  exports: [AuthService],
})
export class AuthModule {}
