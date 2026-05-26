import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Session } from '../schemas/session.schem';
import { Model, Types } from 'mongoose';
import { SessionResponseDTO } from '../dto/session-response.dto';
import { plainToInstance } from 'class-transformer';
import crypto from 'crypto';
import { RedisService } from '../../../common/redis/redis.service';

@Injectable()
export class SessionService {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<Session>,
    private readonly redisService: RedisService,
  ) { }

  async create(
    userId: string,
    refreshToken: string,
    expiresAt: Date,
    deviceId: string,
    deviceName: string,
    deviceType: string,
    ip: string,
    location: string,
  ) {
    const userObjectId = new Types.ObjectId(userId);
    return await this.sessionModel.create({
      userId: userObjectId,
      refreshToken,
      expiresAt,
      deviceId,
      deviceName,
      deviceType,
      ip,
      location,
    });
  }

  async findValidSession(userId: string, refreshToken: string) {
    const userObjectId = new Types.ObjectId(userId);
    const hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const session = await this.sessionModel.findOne({
      userId: userObjectId,
      refreshToken: hashedToken,
    });

    return session;
  }

  async remove(userId: string, refreshToken: string) {
    const session = await this.findValidSession(userId, refreshToken);

    if (session) {
      await this.sessionModel.deleteOne({ _id: session._id });
      return true;
    }
    return false;
  }

  async removeByDevice(userId: string, deviceId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const result = await this.sessionModel
      .deleteMany({ userId: userObjectId, deviceId })
      .lean();
    return result.deletedCount > 0;
  }

  async findOtherSessions(userId: string, currentDeviceId: string) {
    // Tìm tất cả session của user này, NGOẠI TRỪ máy đang dùng
    return this.sessionModel.find({
      userId: new Types.ObjectId(userId),
      deviceId: { $ne: currentDeviceId },
    });
  }

  async removeAllOtherDevices(userId: string, currentDeviceId: string) {
    const result = await this.sessionModel.deleteMany({
      userId: new Types.ObjectId(userId),
      deviceId: { $ne: currentDeviceId }, // $ne = Not Equal (không bằng id hiện tại)
    });
    return result;
  }

  async getAll(userId: string): Promise<SessionResponseDTO[]> {
    const sessions = await this.sessionModel.find({
      userId: new Types.ObjectId(userId),
    });

    const redis = this.redisService.getClient();

    const sessionsWithStatus = await Promise.all(
      sessions.map(async (session) => {
        const isOnline = await redis.exists(`online_device:${session.deviceId}`);
        return {
          ...session.toObject(),
          isOnline: isOnline === 1,
        };
      })
    );

    return plainToInstance(SessionResponseDTO, sessionsWithStatus, {
      excludeExtraneousValues: true,
    });
  }

  async removeAllSessions(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const sessions = await this.sessionModel.find({
      userId: userObjectId,
    }).select('deviceId').lean();

    if (sessions.length === 0) {
      return { deletedCount: 0, deviceIds: [] };
    }
    const deviceIds = sessions.map(s => s.deviceId);
    const result = await this.sessionModel.deleteMany({
      userId: userObjectId,
      deviceId: { $in: deviceIds }
    });

    return {
      deletedCount: result.deletedCount,
      deviceIds: deviceIds,
    };
  }
}
