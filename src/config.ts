import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_TOKEN: z.string().min(16, 'ADMIN_TOKEN must be at least 16 chars'),
  USER_TIMEZONE: z.string().default('Asia/Bangkok'),
  DATABASE_URL: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().default(''),
  GLM_API_KEY: z.string().default(''),
  GLM_BASE_URL: z.string().default('https://api.z.ai/api/paas/v4'),
  GLM_MODEL: z.string().default('glm-5.3'),
  GLM_THINKING: z.enum(['enabled', 'disabled']).default('disabled'),
});

export type AppConfig = z.infer<typeof schema> & { googleRedirectUri: string };

function load(): AppConfig {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${msg}`);
  }
  const c = parsed.data;
  return {
    ...c,
    googleRedirectUri: c.GOOGLE_REDIRECT_URI ?? `${c.PUBLIC_BASE_URL.replace(/\/$/, '')}/auth/google/callback`,
  };
}

// Lazy so that unit tests can import modules without a full environment.
let cached: AppConfig | undefined;
export const config: AppConfig = new Proxy({} as AppConfig, {
  get(_t, prop) {
    if (!cached) cached = load();
    return (cached as any)[prop];
  },
});
