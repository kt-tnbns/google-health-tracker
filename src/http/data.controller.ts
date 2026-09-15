import { BadRequestException, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { config } from '../config';
import { HealthApiClient } from '../google/health-api.client';
import { IngestService } from '../ingest/ingest.service';
import { addDays, todayCivil } from '../ingest/time';
import { AdminGuard } from './admin.guard';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller('api')
@UseGuards(AdminGuard)
export class DataController {
  constructor(private readonly ingest: IngestService, private readonly api: HealthApiClient) {}

  @Get('sync/status')
  syncStatus() { return this.ingest.syncStatus(); }

  @Get('storage')
  storage() { return this.ingest.storageStatus(); }

  @Post('sync/ensure')
  ensureFresh() {
    return this.ingest.refresh({ trigger: 'app-open' });
  }

  /** Pull cloud data. Default: today + yesterday. Explicit start/end are end-exclusive. */
  @Post('refresh')
  refresh(@Query('days') days?: string, @Query('start') start?: string, @Query('end') end?: string) {
    if ((start && !DATE_RE.test(start)) || (end && !DATE_RE.test(end))) throw new BadRequestException('dates must be YYYY-MM-DD');
    const n = days ? Number(days) : undefined;
    if (n !== undefined && (!Number.isInteger(n) || n < 1 || n > 90)) throw new BadRequestException('days must be 1..90');
    return this.ingest.refresh({ startDate: start, endDate: end, days: n });
  }

  /** Today's (or a given day's) normalized metrics + list of missing fields. */
  @Get('days/:day')
  day(@Param('day') day: string) {
    const d = day === 'today' ? todayCivil(config.USER_TIMEZONE) : day;
    if (!DATE_RE.test(d)) throw new BadRequestException('day must be YYYY-MM-DD or "today"');
    return this.ingest.getDay(d);
  }

  /** Compact table for the last N days (for baseline inspection). */
  @Get('days')
  range(@Query('days') days = '14') {
    const n = Math.min(Math.max(Number(days) || 14, 1), 365);
    const end = addDays(todayCivil(config.USER_TIMEZONE), 1);
    return this.ingest.getRange(addDays(end, -n), end);
  }

  /** Stored data coverage for completed days, and today's personal health comparisons. */
  @Get('health')
  health(@Query('days') days = '60') {
    const n = Number(days);
    if (!Number.isInteger(n) || n < 28 || n > 90) throw new BadRequestException('days must be 28..90');
    return this.ingest.health(n);
  }

  /** Exercise sessions for the last N days (from the exercise data type). */
  @Get('exercise')
  exercise(@Query('days') days = '35') {
    const n = Math.min(Math.max(Number(days) || 35, 1), 365);
    const end = addDays(todayCivil(config.USER_TIMEZONE), 1);
    return this.ingest.getExerciseSessions(addDays(end, -n), end);
  }

  /** Raw upstream API responses (inspectable JSON). */
  @Get('raw')
  raw(@Query('limit') limit = '50') {
    return this.ingest.listRaw(Math.min(Number(limit) || 50, 500));
  }

  @Get('raw/:id')
  async rawOne(@Param('id') id: string) {
    const row = await this.ingest.getRaw(Number(id));
    if (!row) throw new NotFoundException();
    return row;
  }

  /** Quick connectivity probe: which devices Google sees on the account. */
  @Get('devices')
  devices() {
    return this.api.listPairedDevices();
  }
}
