# google-health-tracker

ระบบส่วนตัวสำหรับดึงข้อมูล **Fitbit Air** ผ่าน **Google Health API** มาเก็บบน VPS (Dokploy) แล้ววิเคราะห์/สรุปรายวัน

สถานะ: **Milestone 1 — data access & inspection** (ยังไม่มีส่วนคำนวณ baseline / GLM / Telegram)

## โครงสร้าง

```
src/
  main.ts                 boot: run migrations → start Nest
  config.ts               env validation (zod)
  db/                     pg pool + SQL migrations (forward-only)
  google/
    oauth.service.ts      Google OAuth (consent URL, code exchange, refresh, encrypted storage)
    health-api.client.ts  list / reconcile / dailyRollUp + pagination, raw pages preserved
    crypto.ts             AES-256-GCM for refresh tokens at rest
  ingest/
    metrics.ts            data types ที่ดึง + filter field ของแต่ละ type
    normalize.ts          pure functions: raw DataPoint → daily_metrics (missing ≠ 0)
    time.ts               timezone helpers (Asia/Bangkok) ไม่พึ่ง lib ภายนอก
    ingest.service.ts     fetch → store raw → upsert (idempotent)
  http/
    auth.controller.ts    /auth/google/*
    data.controller.ts    /api/*  (guarded by x-admin-token)
```

### ชั้นข้อมูลใน Postgres

| ตาราง | เก็บอะไร |
|---|---|
| `oauth_tokens` | refresh/access token (เข้ารหัส) + สถานะ error ล่าสุด |
| `api_responses` | response ดิบจาก Google ทุกหน้า ทุกครั้งที่ดึง (URL, status, payload, batch_id) — ไม่มี token |
| `daily_metrics` | ค่าต่อวันต่อ metric (PK = day+metric) → ดึงซ้ำกี่ครั้งก็ไม่ซ้ำแถว; `value NULL` = ไม่มีข้อมูล |
| `computed_results` | (เฟสถัดไป) baseline/deviation พร้อม algorithm_version |
| `coaching_reports` | (เฟสถัดไป) output จาก GLM + prompt_version + delivery state |
| `checkins` | (เฟสถัดไป) self check-in |

## ตั้งค่า Google Cloud (ทำครั้งเดียว)

อ้างอิง: https://developers.google.com/health/setup

1. สร้าง Google Cloud project → **Enable "Google Health API"** (`health.googleapis.com`)
2. OAuth consent: **User type = External**, publishing status = Testing, เพิ่มอีเมลตัวเองเป็น **Test user**
3. Data Access → เพิ่ม scope ของ Google Health API: `sleep.readonly`, `health_metrics_and_measurements.readonly`, `activity_and_fitness.readonly`
4. Credentials → **OAuth client (Web application)** → Authorized redirect URI = `https://<โดเมนของคุณ>/auth/google/callback`
   (ต้องตรงกับ `PUBLIC_BASE_URL` ใน `.env` ทุกตัวอักษร)
5. ใส่ Client ID / Secret ใน `.env` บน Dokploy (ไม่ commit)

> ⚠️ ขณะแอปอยู่ในสถานะ **Testing** Google ระบุว่า refresh token **หมดอายุทุก 7 วัน** → ต้องกด reconnect ทุกสัปดาห์
> ถ้าต้องการให้รันเองระยะยาว ให้ push app เป็น **Production** (ใช้เองคนเดียว ไม่เกิน 100 users ไม่ต้อง security review ตามเอกสาร)
> ระบบจะรายงาน `needsReconnect: true` ที่ `/auth/google/status` เมื่อ refresh ล้มเหลว

## รัน local

```bash
cp .env.example .env         # แก้ค่า
openssl rand -base64 32      # → TOKEN_ENCRYPTION_KEY
docker compose up -d db
npm install
npm run start:dev
```

## Endpoints (ทุกอันยกเว้น callback ต้องส่ง header `x-admin-token: <ADMIN_TOKEN>` หรือ `?token=`)

| Method | Path | ทำอะไร |
|---|---|---|
| GET | `/auth/google/start?token=…` | เปิดในเบราว์เซอร์ → หน้า consent ของ Google |
| GET | `/auth/google/callback` | Google เรียกกลับ (ป้องกันด้วย `state`) |
| GET | `/auth/google/status` | เชื่อมอยู่ไหม / scopes / error ล่าสุด / needsReconnect |
| POST | `/auth/google/disconnect` | ลบ token |
| POST | `/api/refresh?days=7` หรือ `?start=YYYY-MM-DD&end=YYYY-MM-DD` | ดึงข้อมูลจาก cloud (ไม่ใช่ sync จากนาฬิกา) |
| GET | `/api/days/today` , `/api/days/2026-09-09` | ค่าต่อวัน + รายการ field ที่ขาด |
| GET | `/api/days?days=14` | ตารางย่อ N วันล่าสุด |
| GET | `/api/raw?limit=50` , `/api/raw/:id` | response ดิบจาก Google |
| GET | `/api/devices` | อุปกรณ์ที่ Google เห็นในบัญชี (probe การเชื่อมต่อ) |

## กฎการ normalize ที่ตัดสินใจไว้ (แก้ได้ที่ `normalize.ts`)

- **การนอน** นับเป็นของ "วันที่ตื่น" (civil date ของ `interval.endTime` ใน `USER_TIMEZONE`) ตามแบบแอป Fitbit; ตัด nap ออก; ถ้ามีหลาย session ในวันเดียวใช้อันยาวสุดและติด `status = partial`
- **sleep_efficiency_pct** = asleep / (asleep + awake) × 100 — เป็นสูตรของเรา ไม่ใช่ sleep score ของ Fitbit
- **daily-*** types ใช้ field `date` ตรง ๆ
- **steps / active-zone-minutes** ใช้ `dailyRollUp` ต่อ civil day
- `value = NULL` + `status = missing` เมื่อไม่มีข้อมูล (ไม่ใช่ 0)
- เวลาที่วัด (`measured_start/end`) แยกจากเวลาที่ดึง (`api_responses.fetched_at`)

## สิ่งที่ยังต้องยืนยันกับข้อมูลจริง (ครั้งแรกที่ต่อบัญชีได้)

ดูใน `/api/raw` แล้วปรับ:
1. รูปแบบ literal ของ filter `daily-*.date >= "YYYY-MM-DD"` (เอกสารระบุแค่ว่ารองรับ `.date`)
2. ชื่อ field จริงใน `dailyRespiratoryRate`, `dailyOxygenSaturation` และ `value` ของ rollup (`normalize.ts` เดาไว้หลายชื่อ)
3. รูปแบบ `CivilDateTime` ใน body ของ `dailyRollUp` (ใช้ `{year, month, day, hours, minutes, seconds}`)

## ทดสอบ

```bash
npm test                                    # unit
TEST_DATABASE_URL=postgres://... npm test   # + integration (idempotent upsert, raw history)
```

## Deploy: GitHub Actions → GHCR → Dokploy

1. push repo ขึ้น GitHub (branch `main`) → workflow `.github/workflows/build.yml` จะรัน typecheck + test (มี Postgres service) แล้ว build image push ไป `ghcr.io/<owner>/<repo>:latest` และ `:sha-xxxxxxx`
   - ใช้ `GITHUB_TOKEN` ในตัว ไม่ต้องตั้ง secret เพิ่ม; ครั้งแรก package จะเป็น private → ไปที่ GitHub → Packages → ตั้ง visibility หรือเพิ่ม registry credential ใน Dokploy
2. Dokploy → New **Compose** service → ใช้ `docker-compose.dokploy.yml` → ตั้ง env ใน UI:
   `GITHUB_REPOSITORY=<owner>/<repo>`, `IMAGE_TAG=latest`, `PUBLIC_BASE_URL`, `ADMIN_TOKEN`, `POSTGRES_PASSWORD`, `TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
3. ผูก domain (HTTPS) เข้ากับ service `app` port 3000 → `PUBLIC_BASE_URL` ต้องเป็นโดเมนนี้
4. volume `health_pgdata` ต้องเป็น persistent (ข้อมูล + token ต้องรอด redeploy) — migrations รันเองตอน boot
5. อัปเดต: push ใหม่ → image ใหม่ → กด Redeploy ใน Dokploy (หรือตั้ง webhook/auto-deploy ให้ pull `latest`)
