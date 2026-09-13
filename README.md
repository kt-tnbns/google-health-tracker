# google-health-tracker

ระบบส่วนตัวสำหรับดึงข้อมูล **Fitbit Air** ผ่าน **Google Health API** มาเก็บบน VPS (Dokploy) แล้ววิเคราะห์/สรุปรายวัน

สถานะ: data access & inspection · AI coach (chat) · **Recovery index, Cardio load, Journal → Weekly insights, Strength log, Fitness/Bio age** (สูตรทั้งหมดใน `docs/calculations.md`) · UI ตาม `design.md` — ยังไม่มี daily briefing อัตโนมัติ / Telegram / Energy Bank (มีแค่ตัวทดสอบ)

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
  coach/
    context.ts            deterministic context: latest / 7-day baseline / delta / missing (versioned)
    prompt.ts             versioned coaching instructions (PROMPT_VERSION)
    glm.client.ts         OpenAI-compatible streaming client (Z.ai / BigModel)
    coach.service.ts      chat: persist turns + context snapshot; numbers-only fallback when GLM fails
  http/
    auth.controller.ts    /auth/google/*
    data.controller.ts    /api/*  (guarded by x-admin-token)
    coach.controller.ts   /api/coach/*  (SSE streaming chat)
    scores.controller.ts  /api/scores, journal, insights, strength, fitness, bioage, energy probe
    ui.controller.ts      /ui  (serves src/http/ui/* — vanilla SPA, TH/EN, dark/light, responsive)
  scores/
    stats.ts              mean/sd/median/MAD, EWMA, Hedges' g, bootstrap CI, Mann–Whitney (seeded PRNG)
    recovery.ts           Recovery index (ln RMSSD, SWC, per-person z-scores) — recovery-v0.1
    load.ts               daily load (AZM / HR zones; workout TRIMP separate), EWMA 7/28, ACWR, monotony — load-v0.2
    insights.ts           journal tags vs next-morning outcomes, gated — insights-v0.1
    strength.ts           tonnage, hard sets, e1RM (Epley/Brzycki), weekly
    bioage.ts             PhenoAge (Levine 2018) + Fitness age (HUNT3)
    scores.service.ts     DB glue for all of the above + energy-bank feasibility probe
docs/calculations.md      what each number means, evidence vs heuristic, minimum data, sources
```

### ชั้นข้อมูลใน Postgres

| ตาราง | เก็บอะไร |
|---|---|
| `oauth_tokens` | refresh/access token (เข้ารหัส) + สถานะ error ล่าสุด |
| `api_responses` | response ดิบจาก Google ทุกหน้า ทุกครั้งที่ดึง (URL, status, payload, batch_id) — ไม่มี token |
| `daily_metrics` | ค่าต่อวันต่อ metric (PK = day+metric) → ดึงซ้ำกี่ครั้งก็ไม่ซ้ำแถว; `value NULL` = ไม่มีข้อมูล |
| `computed_results` | (เฟสถัดไป) baseline/deviation พร้อม algorithm_version |
| `coach_messages` | แชทกับ coach: ทุกคำตอบเก็บ model, prompt_version, context_snapshot (สิ่งที่โมเดลเห็นจริง), usage, error |
| `coaching_reports` | (เฟสถัดไป) daily briefing อัตโนมัติ + delivery state |
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
| GET | `/ui` | หน้าเว็บตรวจสอบ: สถานะ, ปุ่ม refresh, ตารางค่าต่อวัน, raw JSON (กรอก admin token ครั้งเดียว) |
| GET | `/auth/google/start?token=…` | เปิดในเบราว์เซอร์ → หน้า consent ของ Google |
| GET | `/auth/google/callback` | Google เรียกกลับ (ป้องกันด้วย `state`) |
| GET | `/auth/google/status` | เชื่อมอยู่ไหม / scopes / error ล่าสุด / needsReconnect |
| POST | `/auth/google/disconnect` | ลบ token |
| POST | `/api/refresh?days=7` หรือ `?start=YYYY-MM-DD&end=YYYY-MM-DD` | ดึงข้อมูลจาก cloud (ไม่ใช่ sync จากนาฬิกา) |
| GET | `/api/days/today` , `/api/days/2026-09-09` | ค่าต่อวัน + รายการ field ที่ขาด |
| GET | `/api/days?days=14` | ตารางย่อ N วันล่าสุด |
| GET | `/api/health?days=60` | Health Monitor: today's personal comparisons + complete/partial/missing coverage |
| GET | `/api/raw?limit=50` , `/api/raw/:id` | response ดิบจาก Google |
| GET | `/api/devices` | อุปกรณ์ที่ Google เห็นในบัญชี (probe การเชื่อมต่อ) |
| GET | `/api/coach/info` | model / prompt version / configured? |
| GET | `/api/coach/context` | context ที่ coach เห็น (ตัวเลขล้วน) |
| GET/DELETE | `/api/coach/messages` | ประวัติแชท / ล้าง |
| POST | `/api/coach/chat` `{message, lang}` | ตอบแบบ stream (SSE) |
| GET | `/api/scores?days=30` · POST `/api/scores/recompute` | recovery + load ต่อวัน (persist วันนี้ลง computed_results) |
| GET/PUT | `/api/profile` | ปีเกิด/เพศ/HRmax สำหรับ TRIMP, fitness age, PhenoAge |
| GET/PUT | `/api/journal`, `/api/journal/:day` · GET `/api/journal/tags` | แท็กพฤติกรรมรายวัน |
| GET | `/api/insights?window=90` | ผลเปรียบเทียบ tag vs วันอื่น (surfaced เมื่อผ่านเกณฑ์) |
| GET/POST/DELETE | `/api/strength/sessions` · GET `/api/strength/weekly` | strength log |
| GET | `/api/fitness` · `/api/bioage` · POST `/api/bioage/panels` | VO₂max/fitness age · PhenoAge จากผลเลือด |
| POST | `/api/energy/probe` | ดึง heart-rate 1 วัน วัด coverage — go/no-go สำหรับ Energy Bank |

## AI coach — ขอบเขตที่ตั้งใจ

- โมเดลเห็นเฉพาะ `context.ts` (ค่าล่าสุด, baseline 7 วัน, delta, missing) ในรูปตัวเลข — ไม่เห็น raw JSON, ไม่เห็นข้อมูลอื่น
- ห้ามคิด "readiness score" / ไฟเขียว-แดง; ห้ามวินิจฉัย; ต้องบอกเมื่อข้อมูลขาดหรือ baseline สั้น (อยู่ใน `prompt.ts`)
- ถ้า GLM ล่ม ระบบตอบด้วยสรุปตัวเลขล้วน (`deterministicSummary`) และบันทึก error ไว้
- ข้อมูลสุขภาพที่ส่งไป GLM ออกจาก VPS ไปยัง Z.ai — ส่งเท่าที่จำเป็น (ไม่มีชื่อ/อีเมล/raw)

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
5. อัปเดตแบบ manual: รอ Actions push image สำเร็จ แล้วกด Deploy ใน Dokploy เพื่อ pull `latest` (`pull_policy: always`)
6. อัปเดตอัตโนมัติ (optional): เพิ่ม repository secret `DOKPLOY_DEPLOY_WEBHOOK` เป็น deployment webhook URL ของบริการนี้ที่รับ POST ได้ (รองรับชื่อเดิม `DOKPLOY_WEBHOOK` เป็น fallback) ไม่ต้องตั้ง API key; ถ้าไม่มี secret จะข้ามการเรียก deploy โดย workflow ไม่ล้ม
7. ลำดับ: push `main` → test → job `image` build/push GHCR สำเร็จ → job `redeploy` ส่ง GitHub push payload พร้อม `x-github-event: push` ให้ webhook เพื่อให้ Dokploy อ่าน branch `main` ได้ ส่วน tag builds และ PR ไม่เรียก deploy
   อย่าให้ Dokploy deploy จาก repository `On Push` อีกทางพร้อมกัน เพราะจะเริ่มก่อน image พร้อม การแยก job ใน Actions ไม่ได้ปิด trigger ฝั่ง Dokployให้เอง
   Git-provider webhook บางแบบต้องเปิด Autodeploy และรับ payload ของ Git event จึงไม่ใช่ทุก webhook ที่ใช้กับ POST เปล่าได้ ถ้าได้ HTTP 400 ให้ดู response ใน Actions ก่อนเปลี่ยนการตั้งค่า; อย่าปิด Autodeploy โดยสมมติว่า webhook เดิมจะยังทำงาน
   Workflow จัดคิวแต่ละ ref เพื่อไม่ให้ build เขียน `latest` พร้อมกัน; HTTP 2xx หมายถึงรับคำขอแล้ว ให้ตรวจ deployment logs ใน Dokploy เพื่อยืนยันว่า deploy เสร็จจริง
