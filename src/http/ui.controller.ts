import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Static single-page UI (src/http/ui/*). Contains no data; everything comes from /api with the admin token.
 * Files are read once at boot (restart to pick up changes in production; start:dev restarts on save).
 */
const UI_DIR = join(__dirname, 'ui');
const TYPES: Record<string, string> = { html: 'text/html; charset=utf-8', js: 'application/javascript; charset=utf-8', css: 'text/css; charset=utf-8', svg: 'image/svg+xml', woff2: 'font/woff2' };
const BINARY = new Set(['woff2']);

@Controller('ui')
export class UiController {
  private cache = new Map<string, string | Buffer>();

  private file(name: string, sub = ''): string | Buffer {
    if (!/^[a-z0-9._-]+$/i.test(name)) throw new NotFoundException();
    const p = join(UI_DIR, sub, name);
    if (!this.cache.has(p)) {
      if (!existsSync(p)) throw new NotFoundException();
      const ext = name.split('.').pop() ?? '';
      this.cache.set(p, BINARY.has(ext) ? readFileSync(p) : readFileSync(p, 'utf8'));
    }
    return this.cache.get(p)!;
  }

  @Get()
  index(@Res() res: Response) { res.type(TYPES.html).send(this.file('index.html')); }

  @Get(':name')
  asset(@Param('name') name: string, @Res() res: Response) {
    const ext = name.split('.').pop() ?? '';
    if (!TYPES[ext]) throw new NotFoundException();
    res.setHeader('cache-control', 'no-cache');
    res.type(TYPES[ext]).send(this.file(name));
  }

  /** Third-party bundles and fonts copied at build time (dist/http/ui/vendor) — versioned files, so cache for a day. */
  @Get('vendor/:name')
  vendor(@Param('name') name: string, @Res() res: Response) {
    const ext = name.split('.').pop() ?? '';
    if (ext !== 'js' && ext !== 'woff2') throw new NotFoundException();
    res.setHeader('cache-control', 'public, max-age=86400');
    res.type(TYPES[ext]).send(this.file(name, 'vendor'));
  }
}
