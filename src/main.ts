import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Pool } from 'pg';
import { AppModule } from './app.module';
import { config } from './config';
import { runMigrations } from './db/migrate';

async function bootstrap() {
  const log = new Logger('bootstrap');
  const pool = new Pool({ connectionString: config.DATABASE_URL, max: 1 });
  const applied = await runMigrations(pool);
  await pool.end();
  if (applied.length) log.log(`migrations applied: ${applied.join(', ')}`);

  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  app.enableShutdownHooks();
  await app.listen(config.PORT);
  log.log(`listening on :${config.PORT}  redirect URI = ${config.googleRedirectUri}  tz = ${config.USER_TIMEZONE}`);
}

bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
