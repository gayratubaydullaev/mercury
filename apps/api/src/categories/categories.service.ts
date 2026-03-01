import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(parentId?: string | null) {
    return this.prisma.category.findMany({
      where: { parentId: parentId ?? null },
      include: { children: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true, parent: true },
    });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async findBySlug(slug: string) {
    const cat = await this.prisma.category.findUnique({
      where: { slug },
      include: { children: true, parent: true },
    });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }
}
