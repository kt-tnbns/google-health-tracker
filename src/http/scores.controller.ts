import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { config } from '../config';
import { addDays, todayCivil } from '../ingest/time';
import { ScoresService } from '../scores/scores.service';
import { AdminGuard } from './admin.guard';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const int = (v: string | undefined, def: number, lo: number, hi: number) => { const n = v ? Number(v) : def; if (!Number.isInteger(n) || n < lo || n > hi) throw new BadRequestException(`value must be ${lo}..${hi}`); return n; };
const dateOr = (v: string | undefined, def: string) => { if (v && !DATE_RE.test(v)) throw new BadRequestException('YYYY-MM-DD'); return v ?? def; };

@Controller('api')
@UseGuards(AdminGuard)
export class ScoresController {
  constructor(private readonly svc: ScoresService) {}

  /** Recovery + cardiovascular load per day. */
  @Get('scores') scores(@Query('days') days?: string) { return this.svc.daily(int(days, 30, 1, 180)); }
  @Post('scores/recompute') recompute() { return this.svc.persistToday(); }

  @Get('profile') profile() { return this.svc.profile(); }
  @Put('profile') saveProfile(@Body() b: any) {
    const sex = b?.sex === 'male' || b?.sex === 'female' ? b.sex : null;
    const by = b?.birth_year ? Number(b.birth_year) : null;
    if (by !== null && (by < 1900 || by > new Date().getFullYear())) throw new BadRequestException('birth_year');
    return this.svc.saveProfile({ birth_year: by, sex, height_cm: b?.height_cm ? Number(b.height_cm) : null, hr_max: b?.hr_max ? Number(b.hr_max) : null });
  }

  // journal + insights
  @Get('journal/tags') tags() { return this.svc.tags(); }
  @Get('journal') journal(@Query('days') days?: string) { const t = todayCivil(config.USER_TIMEZONE); return this.svc.journal(addDays(t, -int(days, 90, 1, 365)), t); }
  @Put('journal/:day') saveJournal(@Param('day') day: string, @Body() b: any) {
    if (!DATE_RE.test(day)) throw new BadRequestException('YYYY-MM-DD');
    return this.svc.saveJournal(day, Array.isArray(b?.tags) ? b.tags.map(String) : [], typeof b?.note === 'string' ? b.note.slice(0, 1000) : null);
  }
  @Get('insights') insights(@Query('window') w?: string) { return this.svc.insights(int(w, 90, 14, 365)); }

  // strength
  @Get('strength/sessions') strength(@Query('days') days?: string) { const t = todayCivil(config.USER_TIMEZONE); return this.svc.strengthSessions(addDays(t, -int(days, 90, 1, 730)), t); }
  @Post('strength/sessions') addStrength(@Body() b: any) {
    const day = dateOr(b?.day, todayCivil(config.USER_TIMEZONE));
    if (!Array.isArray(b?.sets) || !b.sets.length) throw new BadRequestException('sets required');
    return this.svc.addStrengthSession({ day, duration_min: b.duration_min ?? null, notes: b.notes ?? null, sets: b.sets.map((s: any) => ({ exercise: String(s.exercise ?? ''), muscle_group: s.muscle_group ?? null, reps: Number(s.reps), load_kg: Number(s.load_kg ?? 0), rpe: s.rpe == null ? null : Number(s.rpe), rir: s.rir == null ? null : Number(s.rir), is_warmup: !!s.is_warmup })) });
  }
  @Delete('strength/sessions/:id') async delStrength(@Param('id') id: string) { await this.svc.deleteStrengthSession(Number(id)); return { ok: true }; }
  @Get('strength/weekly') weekly(@Query('weeks') w?: string) { return this.svc.strengthWeekly(int(w, 12, 1, 104)); }

  // fitness + biological age
  @Get('fitness') fitness(@Query('days') d?: string) { return this.svc.fitness(int(d, 180, 7, 730)); }
  @Get('bioage') bioage() { return this.svc.biologicalAge(); }
  @Get('bioage/panels') panels() { return this.svc.bloodPanels(); }
  @Post('bioage/panels') async addPanel(@Body() b: any) {
    const need = ['albumin_g_l', 'creatinine_umol_l', 'glucose_mmol_l', 'crp_mg_dl', 'lymphocyte_pct', 'mcv_fl', 'rdw_pct', 'alp_u_l', 'wbc_k_ul'];
    for (const k of need) if (!(Number(b?.[k]) > 0)) throw new BadRequestException(`${k} required (> 0)`);
    const id = await this.svc.addBloodPanel({ drawn_on: dateOr(b.drawn_on, todayCivil(config.USER_TIMEZONE)), notes: b.notes ?? null, ...Object.fromEntries(need.map((k) => [k, Number(b[k])])) } as any);
    return { id };
  }

  // energy bank feasibility
  @Post('energy/probe') probe(@Query('day') day?: string) { if (day && !DATE_RE.test(day)) throw new BadRequestException('YYYY-MM-DD'); return this.svc.energyProbe(day); }
}
