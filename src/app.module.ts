import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { HealthApiClient } from './google/health-api.client';
import { GoogleOAuthService } from './google/oauth.service';
import { AuthController } from './http/auth.controller';
import { DataController } from './http/data.controller';
import { IngestService } from './ingest/ingest.service';

@Module({
  imports: [DbModule],
  controllers: [AuthController, DataController],
  providers: [GoogleOAuthService, HealthApiClient, IngestService],
})
export class AppModule {}
