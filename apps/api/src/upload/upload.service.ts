import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function isWebP(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP';
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadsDir: string;
  private cloudinaryConfigured = false;

  constructor(private config: ConfigService) {
    // Cloudinary: checked once at startup. After setting CLOUDINARY_* in .env, restart API to use Cloudinary.
    const cloudName = this.config.get('CLOUDINARY_CLOUD_NAME');
    this.cloudinaryConfigured = !!cloudName?.trim();
    if (this.cloudinaryConfigured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: this.config.get('CLOUDINARY_API_KEY'),
        api_secret: this.config.get('CLOUDINARY_API_SECRET'),
      });
      this.logger.log('Cloudinary configured; uploads will use Cloudinary');
    } else {
      this.logger.log('Cloudinary not configured; uploads will be stored locally (uploads/)');
    }
    this.uploadsDir = join(process.cwd(), 'uploads');
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

  /** Public base URL for local uploads (e.g. https://jomboy.online/api-proxy). */
  private getLocalUploadBaseUrl(): string {
    const apiPublic = this.config.get('API_PUBLIC_URL');
    if (apiPublic?.trim()) return apiPublic.replace(/\/$/, '');
    const appUrl = this.config.get('APP_URL');
    if (appUrl?.trim()) return `${appUrl.replace(/\/$/, '')}/api-proxy`;
    return 'http://localhost:3000/api-proxy';
  }

  /** Save file to uploads/ and return public URL. */
  private async saveLocally(file: Express.Multer.File): Promise<string> {
    await mkdir(this.uploadsDir, { recursive: true });
    const ext = MIME_EXT[file.mimetype?.toLowerCase() ?? ''] ?? '.jpg';
    const filename = `${randomUUID()}${ext}`;
    const path = join(this.uploadsDir, filename);
    await writeFile(path, file.buffer);
    const baseUrl = this.getLocalUploadBaseUrl();
    return `${baseUrl}/uploads/${filename}`;
  }

  async uploadImage(file: Express.Multer.File, folder = 'myshopuz'): Promise<string> {
    this.validateImageFile(file);
    if (this.cloudinaryConfigured) {
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
    return this.saveLocally(file);
  }

  async uploadFromUrl(url: string, folder = 'myshopuz'): Promise<string> {
    if (!this.cloudinaryConfigured) {
      throw new BadRequestException(
        'uploadFromUrl is only supported when Cloudinary is configured (CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET)',
      );
    }
    const result = await cloudinary.uploader.upload(url, { folder });
    return result.secure_url;
  }
}
