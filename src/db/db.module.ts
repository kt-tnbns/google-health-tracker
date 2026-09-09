import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { config } from '../config';

export const PG_POOL = Symbol('PG_POOL');

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => new Pool({ connectionString: config.DATABASE_URL, max: 5 }),
    },
  ],
  exports: [PG_POOL],
})
export class DbModule implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  async onModuleDestroy() {
    await this.pool.end().catch(() => undefined);
  }
}
