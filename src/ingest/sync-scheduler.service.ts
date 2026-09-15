import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { config } from '../config';
import { IngestService } from './ingest.service';

@Injectable()
export class SyncScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(SyncScheduler.name);
  private timer?: ReturnType<typeof setInterval>;
  private pending?: Promise<void>;
  onApplicationBootstrap() {
    if (!config.AUTO_SYNC_ENABLED) return;
    // A cheap database freshness check each minute, not an upstream request.
    this.timer = setInterval(() => this.tick(), 60_000);
    this.timer.unref();
    this.tick();
  }
  constructor(private readonly ingest: IngestService) {}
  tick() {
    if (this.pending) return;
    this.pending = this.ingest.refresh({ trigger: 'hourly' })
      .then(result => { if (result.status === 'partial') this.log.warn('Automatic sync partially failed; freshness was not advanced'); })
      .catch(error => { this.log.warn(`Automatic sync failed: ${error.message}`); })
      .finally(() => { this.pending = undefined; });
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.pending;
  }
}
