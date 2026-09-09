import { Module } from '@nestjs/common';
import { CoachService } from './coach/coach.service';
import { GlmClient } from './coach/glm.client';
import { DbModule } from './db/db.module';
import { HealthApiClient } from './google/health-api.client';
import { GoogleOAuthService } from './google/oauth.service';
import { AuthController } from './http/auth.controller';
import { CoachController } from './http/coach.controller';
import { DataController } from './http/data.controller';
import { UiController } from './http/ui.controller';
import { ScoresController } from './http/scores.controller';
import { IngestService } from './ingest/ingest.service';
import { ScoresService } from './scores/scores.service';

@Module({
  imports: [DbModule],
  controllers: [AuthController, DataController, UiController, CoachController, ScoresController],
  providers: [GoogleOAuthService, HealthApiClient, IngestService, GlmClient, CoachService, ScoresService],
})
export class AppModule {}
