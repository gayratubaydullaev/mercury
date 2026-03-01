import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  const mockPrisma = {
    favorite: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
    product: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FavoritesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<FavoritesService>(FavoritesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('add should throw if product not found', async () => {
    (mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.add('user1', 'prod1')).rejects.toThrow(NotFoundException);
  });
});
