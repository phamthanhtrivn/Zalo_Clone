import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../../common/redis/redis.service';
import { AuthUser } from './types/auth.type';
import { parseClientInfo } from './util/client-info.util';
import { IClientInfo } from './decorator/client-info.decorator';

const socketCors = {
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
};

@WebSocketGateway({ cors: socketCors, namespace: '/auth' })
export class AuthGateway {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly redisService: RedisService) {}

  //web frontend yêu cầu gửi một qr code để đăng nhập
  @SubscribeMessage('request_qr_code')
  async handleRequestQr(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { deviceId: string },
  ) {
    const qrToken = uuidv4();

    const userAgent = socket.handshake.headers['user-agent'] || '';
    const ip =
      (socket.handshake.headers['x-forwarded-for'] as string) ||
      socket.handshake.address;
    //chứa thông tin vừa được phân tách từ user agent và ip
    const deviceInfo = parseClientInfo(userAgent, ip);

    //gộp lại cùng với deviceId và socket id
    const sessionData = {
      socketId: socket.id,
      clientInfo: { deviceId: data.deviceId, ...deviceInfo },
    };
    await this.redisService.set(
      `qr:${qrToken}`,
      JSON.stringify(sessionData),
      'EX',
      180,
    );

    //thông báo cho fe web là có qr code gửi tới nè
    socket.emit('qr_code_generated', { qrToken });
  }

  //Người dùng điện thoại quét, thông qua api và service gọi đến hàm này
  async notifyQrScanned(qrToken: string, user: AuthUser) {
    const sesionDataStr = await this.redisService.get(`qr:${qrToken}`);
    if (!sesionDataStr) return null;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const sessionData = JSON.parse(sesionDataStr);

    await this.redisService.set(`qr:${qrToken}`, sesionDataStr, 'EX', 60);

    //thông báo cho fe là có người quét rồi, hiển thị thông tin người dùng lên
    this.server.to(sessionData.socketId).emit('qr_scanned', {
      user: {
        name: user.name,
        avatar: user.avatarUrl,
      },
    });
    return sessionData.clientInfo as IClientInfo;
  }

  // Hàm này do auth service gọi, khi người dùng đã quét qr và đồng ý
  // cho web đăng nhập
  async confirmLoginForDevice(qrToken: string) {
    const dataStr = await this.redisService.get(`qr:${qrToken}`);
    if (!dataStr) return false;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const sessionData = JSON.parse(dataStr);

    // Phát lệnh cho PC: "Mày có vé rồi, cầm qrToken đi đổi lấy Token thật đi"
    this.server.to(sessionData.socketId).emit('qr_login_success', {
      ticket: qrToken,
    });

    return true;
  }
}
