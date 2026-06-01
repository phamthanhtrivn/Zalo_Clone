import { Module } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { LocalStrategy } from './passport/local.strategy';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './passport/jwt.stratege';
import { MongooseModule } from '@nestjs/mongoose';
import { Session, SessionSchema } from './schemas/session.schem';
import { SessionService } from './services/session.service';
import { TokenModule } from 'src/common/jwt-token/jwt.module';
import { ChatModule } from '../chat/chat.module';
import { AuthGateway } from './auth.gateway';
import { StorageModule } from 'src/common/storage/storage.module';

import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
    UsersModule,
    PassportModule,
    JwtModule.register({
      global: true,
    }),
    TokenModule,
    ChatModule,
    StorageModule,
    ConversationsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    SessionService,
    AuthGateway,
  ],
})
export class AuthModule { }
