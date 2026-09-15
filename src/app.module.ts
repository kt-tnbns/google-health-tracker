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
import { RulesController } from './http/rules.controller';
import { RulesService } from './rules/rules.service';
import { IngestService } from './ingest/ingest.service';
import { SyncScheduler } from './ingest/sync-scheduler.service';
import { ScoresService } from './scores/scores.service';

@Module({
  imports: [DbModule],
  controllers: [AuthController, DataController, UiController, CoachController, ScoresController, RulesController],
  providers: [GoogleOAuthService, HealthApiClient, IngestService, SyncScheduler, GlmClient, CoachService, ScoresService, RulesService],
})
export class AppModule {}
