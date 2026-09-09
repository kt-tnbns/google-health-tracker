import { Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { GoogleOAuthService } from '../google/oauth.service';
import { AdminGuard } from './admin.guard';

@Controller('auth/google')
export class AuthController {
  constructor(private readonly oauth: GoogleOAuthService) {}

  /** Step 1 (protected): redirects the browser to Google's consent screen. Open: /auth/google/start?token=ADMIN_TOKEN */
  @Get('start')
  @UseGuards(AdminGuard)
  start(@Res() res: Response) {
    res.redirect(this.oauth.buildAuthUrl());
  }

  /**
   * Step 2: Google redirects here with ?code=&state=. The redirect URI registered in Google Cloud must be
   * exactly `${PUBLIC_BASE_URL}/auth/google/callback`. Not admin-guarded (Google calls it) — protected by `state`.
   */
  @Get('callback')
  async callback(@Query('code') code?: string, @Query('state') state?: string, @Query('error') error?: string) {
    if (error) return { ok: false, error };
    if (!code) return { ok: false, error: 'missing code' };
    const status = await this.oauth.handleCallback(code, state);
    return { ok: true, status };
  }

  @Get('status')
  @UseGuards(AdminGuard)
  status() {
    return this.oauth.status();
  }

  @Post('disconnect')
  @UseGuards(AdminGuard)
  async disconnect() {
    await this.oauth.disconnect();
    return { ok: true };
  }
}
