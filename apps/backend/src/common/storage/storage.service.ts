import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileType } from '@zalo-clone/shared-types';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;

  constructor(private readonly configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.getOrThrow<string>('aws.region'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('aws.accessKeyId'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'aws.secretAccessKey',
        ),
      },
    });
  }

  private resolveFileType(mimeType: string): FileType {
    if (mimeType.startsWith('image/')) {
      return FileType.IMAGE;
    } else if (mimeType.startsWith('video/')) {
      return FileType.VIDEO;
    } else {
      return FileType.FILE;
    }
  }

  async uploadFile(file: Express.Multer.File) {
    const bucket = this.configService.get<string>('aws.s3Bucket') || '';
    const key = `messages/${randomUUID()}-${file.originalname}`;
    const fileType = this.resolveFileType(file.mimetype);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      fileKey: key,
      fileSize: file.size,
      type: fileType,
    };
  }

  async deleteFile(fileKey: string) {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.configService.getOrThrow<string>('aws.s3Bucket'),
        Key: fileKey,
      }),
    );
  }
}
