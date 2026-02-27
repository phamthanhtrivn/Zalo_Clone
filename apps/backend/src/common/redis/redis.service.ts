// src/redis/redis.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private redisClient: Redis;

  constructor(private configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
    });
  }

  // GET
  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  // SET với options
  async set(
    key: string,
    value: string,
    mode?: 'EX',
    duration?: number,
  ): Promise<'OK'> {
    if (mode === 'EX' && duration) {
      return this.redisClient.set(key, value, 'EX', duration);
    }
    return this.redisClient.set(key, value);
  }

  // DELETE
  async del(key: string): Promise<number> {
    return this.redisClient.del(key);
  }

  // TTL - thời gian sống còn lại
  async ttl(key: string): Promise<number> {
    return this.redisClient.ttl(key);
  }
}
