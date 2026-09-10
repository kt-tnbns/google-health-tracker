import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RulesService } from '../rules/rules.service';
import { AdminGuard } from './admin.guard';

/** The health-rule table (what each value means) and its evaluation per day. Both are deterministic; the coach only quotes them. */
@Controller('api/rules')
@UseGuards(AdminGuard)
export class RulesController {
  constructor(private readonly rules: RulesService) {}

  @Get()
  table() { return this.rules.table(); }

  @Get('eval')
  eval(@Query('days') days = '35') { return this.rules.evaluate(Math.min(Math.max(Number(days) || 35, 1), 120)); }
}
