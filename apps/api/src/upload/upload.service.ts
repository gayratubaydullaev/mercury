import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function isWebP(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP';
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get('CLOUDINARY_API_KEY'),
      api_secret: this.config.get('CLOUDINARY_API_SECRET'),
    });
  }

  private ensureCloudinaryConfigured(): void {
    const name = this.config.get('CLOUDINARY_CLOUD_NAME');
    if (!name?.trim()) {
      throw new BadRequestException(
        'Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env',
      );
    }
  }

  private validateImageFile(file: Express.Multer.File): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    const mime = file.mimetype?.toLowerCase();
    if (!ALLOWED_MIMES.has(mime)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${[...ALLOWED_MIMES].join(', ')}`,
      );
    }
    const buf = file.buffer;
    const match =
      (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ||
      (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) ||
      (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) ||
      (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && isWebP(buf));
    if (!match) {
      throw new BadRequestException('File content does not match image type');
    }
  }

  async uploadImage(file: Express.Multer.File, folder = 'myshopuz'): Promise<string> {
    this.ensureCloudinaryConfigured();
    this.validateImageFile(file);
    return new Promise((resolve, reject) => {
      const opts = { folder, resource_type: 'image' as const };
      const uploadStream = cloudinary.uploader.upload_stream(opts, (err, result) => {
        if (err) {
          this.logger.warn(`Cloudinary upload failed: ${err.message}`);
          return reject(err);
        }
        resolve(result!.secure_url);
      });
      uploadStream.end(file.buffer);
    });
  }

  async uploadFromUrl(url: string, folder = 'myshopuz'): Promise<string> {
    this.ensureCloudinaryConfigured();
    const result = await cloudinary.uploader.upload(url, { folder });
    return result.secure_url;
  }
}
