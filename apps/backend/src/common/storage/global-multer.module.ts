import { Global, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';

@Global()
@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB in bytes
      },
    }),
  ],
  exports: [MulterModule],
})
export class GlobalMulterModule { }
