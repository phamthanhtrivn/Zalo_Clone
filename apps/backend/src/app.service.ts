import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class AppService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  getHello(): string {
    return 'Hello World!';
  }

  async setRedisTest() {
    await this.redis.set('hello', 'zalo-clone');
    return 'OK';
  }

  async getRedisTest() {
    return this.redis.get('hello');
  }
}
