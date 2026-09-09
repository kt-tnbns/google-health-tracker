import { BadRequestException, Body, Controller, Delete, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CoachService, Lang } from '../coach/coach.service';
import { AdminGuard } from './admin.guard';

@Controller('api/coach')
@UseGuards(AdminGuard)
export class CoachController {
  constructor(private readonly coach: CoachService) {}

  @Get('info')
  info() { return this.coach.info(); }

  /** Exactly what the coach is shown — for transparency. */
  @Get('context')
  context() { return this.coach.context(); }

  @Get('messages')
  messages() { return this.coach.history(60); }

  @Delete('messages')
  async clear() { await this.coach.clear(); return { ok: true }; }

  /** Server-Sent Events: `data: {"delta":"..."}` chunks, then `data: {"done":true,"id":n}`. */
  @Post('chat')
  async chat(@Body() body: { message?: string; lang?: string }, @Req() req: Request, @Res() res: Response) {
    const message = (body?.message ?? '').toString();
    const lang: Lang = body?.lang === 'en' ? 'en' : 'th';
    if (!message.trim()) throw new BadRequestException('message is required');
    res.setHeader('content-type', 'text/event-stream; charset=utf-8');
    res.setHeader('cache-control', 'no-cache, no-transform');
    res.setHeader('x-accel-buffering', 'no');
    res.flushHeaders();
    const send = (o: unknown) => res.write(`data: ${JSON.stringify(o)}\n\n`);
    const ac = new AbortController();
    req.on('close', () => ac.abort());
    try {
      const r = await this.coach.chat(message, lang, (delta) => send({ delta }), ac.signal);
      send({ done: true, id: r.id });
    } catch (e) {
      send({ error: (e as Error).message });
    }
    res.end();
  }
}
