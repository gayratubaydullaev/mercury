import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async setRlsContext(userId: string | null, role: string | null, sessionId?: string) {
    if (userId) await this.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    if (role) await this.$executeRaw`SELECT set_config('app.user_role', ${role}, true)`;
    if (sessionId) await this.$executeRaw`SELECT set_config('app.session_id', ${sessionId}, true)`;
  }
}
