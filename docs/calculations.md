# วิธีคำนวณ (Calculation methods)

เอกสารนี้อธิบายว่าแต่ละตัวเลขในระบบมาจากอะไร ส่วนไหนอิงงานวิจัย ส่วนไหนเป็น heuristic และต้องมีข้อมูลเท่าไรก่อนจะแสดง
ทุกอัลกอริทึมเป็นโค้ด TypeScript ล้วน (`src/scores/*`) มี unit test และมี version string ที่ถูกเก็บลง `computed_results` / `coach_messages.context_snapshot` ทุกครั้ง
โมเดลภาษา (GLM) **ไม่เคยคำนวณตัวเลขเอง** — ได้รับผลลัพธ์เหล่านี้เป็น input เท่านั้น

> ทั้งหมดนี้เป็นเครื่องมือดูแลตัวเอง ไม่ใช่การวินิจฉัย ไฟเขียวไม่ใช่ใบรับรองให้ซ้อมหนัก

---

## 1. Recovery index (`recovery-v0.1`, `src/scores/recovery.ts`)

**ข้อมูลที่ใช้ (จาก Fitbit Air ผ่าน Google Health API):** HRV รายคืน (RMSSD ms), ชีพจรขณะพัก, นาทีที่หลับ, ประสิทธิภาพการนอน, อัตราหายใจ, SpO₂

**ส่วนที่อิงหลักฐาน**
- ใช้ **ln(RMSSD)** แทนค่าดิบ และดูค่าเฉลี่ยกลิ้ง 7 วัน แทนค่ารายวันเดี่ยว ๆ (Plews et al. 2013; Buchheit 2015)
- ช่วง "ปกติ" ของแต่ละคน = baseline ± **SWC** โดย SWC = 0.5 × SD ของ baseline; ต้องมี baseline ≥ 2 สัปดาห์ (แนะนำ 4)
- กติกา "HRV 7 วันต่ำกว่าช่วงปกติ → วันนี้ควรเบา" มาจาก HRV-guided training (Kiviniemi 2007 และ RCT ถัด ๆ มา)
- z-score ต่อคนของ RR / RHR / RMSSD ใช้ตรวจแพทเทิร์นป่วยได้ (Natarajan et al. 2020, Fitbit COVID study)

**สูตร**
```
baseline  = 14–60 วันก่อนหน้า (ใช้ median/MAD เมื่อ ≥ 28 วัน, ไม่งั้น mean/SD; scale มี floor 2% ของ center กันหารศูนย์)
z_HRV     = 0.5·z(ln RMSSD วันนี้) + 0.5·z(ค่าเฉลี่ย ln RMSSD 7 วัน)
z_RHR     = −(RHR − center)/scale          (สูงขึ้น = แย่)
z_sleep   = 0.6·z(นาทีหลับ) + 0.4·z(ประสิทธิภาพ)
z_RR      = −|z(RR)|                       (เบี่ยงทางไหนก็หัก)
z_SpO2    = min(0, z(SpO₂))                (หักเฉพาะตอนต่ำลง)
ทุก z ถูก clamp ที่ ±3

S       = Σ wᵢ·zᵢ / Σ wᵢ(ที่มีข้อมูล)     w = HRV .35, RHR .20, sleep .25, RR .10, SpO₂ .10
score   = clamp(50 + 16.7·S, 0, 100)       ระดับ: ready ≥ 67, moderate 34–66, recover ≤ 33
```
**กติกาทับ (cap ที่ 40):** HRV7 ต่ำกว่าช่วงปกติ · RHR ขึ้น (z ≤ −1.5) พร้อม HRV ลง (z ≤ −1) · RR และ SpO₂ ผิดปกติแรงพร้อมกัน (z ≤ −2 ทั้งคู่)

**เงื่อนไขก่อนแสดงผล**
- ไม่ให้คะแนนจนกว่าจะมี HRV ≥ 14 คืน (`insufficient`) · 14–27 คืน = `provisional` · ≥ 28 = `established`
- ไม่มี HRV คืนนั้น → ไม่มีคะแนน (แสดงเหตุผล) · coverage (Σ น้ำหนักที่มีข้อมูล) < 0.55 → ไม่มีคะแนน
- `confidence = coverage × min(1, baselineDays/28)` แสดงคู่กับคะแนนเสมอ

**Heuristic ที่ต้องยอมรับ:** น้ำหนัก, การ map เป็น 0–100, เกณฑ์ระดับ (เลียนแบบลำดับความสำคัญของ Oura/WHOOP แต่ไม่มีการ validate) — จึงเรียกว่า "index" ไม่ใช่ readiness ทางการแพทย์

---

## 2. Cardiovascular load (`load-v0.1`, `src/scores/load.ts`)

**แต้มโหลดรายวัน — เลือกแหล่งที่ละเอียดสุดที่มี**
1. `trimp` — Banister TRIMP ต่อ session = นาที × HRR × y, HRR = (HRavg − HRrest)/(HRmax − HRrest), y = 0.64·e^(1.92·HRR) (ชาย) / 0.86·e^(1.67·HRR) (หญิง). ต้องมี avg HR ของ session + RHR วันนั้น + HRmax (โปรไฟล์ หรือ 211 − 0.64·อายุ ตาม HUNT)
2. `hr-zones` — จาก `time-in-heart-rate-zone`: 1×moderate + 2×vigorous + 3×peak นาที (Lucia-style, น้ำหนักเป็น heuristic)
3. `azm-zones` — จาก AZM รายโซน: fat-burn 1/นาที, cardio 2, peak 3 (AZM ของ Fitbit ให้เครดิต 2× สำหรับ cardio/peak อยู่แล้ว จึงหาร 2 กลับเป็นนาทีก่อน)
4. `azm-total` — AZM รวม
5. มีก้าวแต่ไม่มีโซน → โหลด 0 จริง · ไม่มีอะไรเลย → `null` (ไม่ใช่ 0)

**แนวโน้ม**
```
acute   = EWMA 7 วัน  (λ = 2/8)      แสดงเมื่อมีข้อมูล ≥ 7 วัน
chronic = EWMA 28 วัน (λ = 2/29)     แสดงเมื่อมีข้อมูล ≥ 28 วัน
ACWR    = acute / chronic  (chronic ต้อง ≥ 20% ของ median โหลด กัน ratio ระเบิด)
ระดับ: < 0.8 low · 0.8–1.3 steady · 1.3–1.5 building · > 1.5 spike
Monotony = mean(7 วัน)/SD(7 วัน);  Strain = Σ7 วัน × monotony  (Foster)
```
(Williams et al. 2017 สำหรับ EWMA; วันที่ไม่มีข้อมูลหลังเริ่มนับ = โหลด 0)

**คำเตือนที่ต้องแสดงคู่กัน (Impellizzeri et al. 2020):** ACWR ไม่มีหลักฐานเชิงสาเหตุกับการบาดเจ็บ, "sweet spot" มาจากข้อมูลแบบ bin, ratio ไม่เสถียรเมื่อ chronic ต่ำ — ใช้เป็น "โหลดเปลี่ยนเร็วแค่ไหน" เท่านั้น แสดง acute/chronic แบบ absolute เสมอ

---

## 3. Journal → Weekly insights (`insights-v0.1`, `src/scores/insights.ts`)

**คำถาม:** วันที่ติด tag (เช่น `late_caffeine`) ผลลัพธ์เช้าถัดไป (HRV, RHR, นาทีหลับ, ประสิทธิภาพ, deep) ต่างจากวันอื่นไหม

**วิธี (n-of-1, หน้าต่าง 90 วัน)**
1. ต้องมี ≥ 5 วันที่ติด tag และ ≥ 5 วันที่ไม่ติด (เกณฑ์เดียวกับ WHOOP Journal)
2. ปรับ weekday: หัก median ของวันในสัปดาห์เดียวกันออกก่อน (กัน "แอลกอฮอล์" ปนกับ "วันเสาร์")
3. ขนาดผล **Hedges' g** = Cohen's d × (1 − 3/(4·df − 1))
4. ความไม่แน่ใจ: **bootstrap CI 95%** ของผลต่างค่าเฉลี่ย (B = 2000, PRNG กำหนด seed → ผลซ้ำได้)
5. เช็คแบบไม่ต้องสมมติการแจกแจง: **Mann–Whitney U** (normal approx + tie correction)
6. **แสดงเฉพาะเมื่อครบทุกข้อ:** |g| ≥ 0.5 · CI ไม่คร่อม 0 · p < 0.05 · n ครบ — และแสดง n, ผลต่างในหน่วยจริง, CI เสมอ

**ถ้อยคำ:** "ในวันที่คุณติด X ... เช้าถัดมา HRV ต่ำกว่าเฉลี่ย 9 ms (n=8 vs 41)" + "เป็นความสัมพันธ์ในข้อมูลของคุณ ไม่ใช่เหตุและผล" — ห้ามใช้คำว่า "เพราะ"

**Tag ที่กำหนดตาย (16):** alcohol, late_caffeine, late_meal, nicotine, strength_training, cardio_hard, cardio_easy, rest_day, late_screen, late_bedtime, nap, travel, stress, sick, sauna_or_cold, meditation

---

## 4. Fitness trends + Strength log (`src/scores/strength.ts`)

- **VO₂max** จาก `daily-vo2-max` (Fitbit cardio fitness score) — เป็นค่าประมาณ อัปเดตเมื่อออกกำลัง; แสดงเป็นแนวโน้มรายเดือน ไม่ใช่รายวัน
- **Fitness age** (HUNT3 / NTNU): อายุที่ค่าเฉลี่ย VO₂max ของประชากรอ้างอิงเท่ากับของคุณ (interpolate ตารางแยกเพศ, clamp 20–80) — ต้องมีเพศ + ปีเกิดในโปรไฟล์
- **Strength log:** session → sets (exercise, reps, load_kg, RPE/RIR, warmup)
  - Tonnage = Σ reps × load · Hard sets = sets ที่ไม่ใช่ warmup
  - e1RM: Epley `w(1 + r/30)`, Brzycki `w/(1.0278 − 0.0278r)` — ใช้เฉพาะ ≤ 12 reps และ RPE ≥ 7
  - รายสัปดาห์ (จันทร์–อาทิตย์): tonnage, hard sets ต่อกล้ามเนื้อ, best e1RM ต่อท่า
- สิ่งที่ HR อย่างเดียวบอกไม่ได้: โหลดเชิงกล, ความใกล้ล้า (RPE/RIR), กล้ามเนื้อที่ฝึก, การ overload สัปดาห์ต่อสัปดาห์ — และ tag `strength_training` ในสมุดบันทึกจะปิดลูปกับ HRV/RHR เช้าถัดไปผ่าน §3

---

## 5. Energy Bank (ทดลอง — ยังไม่เปิด)

Body Battery ของ Garmin/Firstbeat ใช้ HR + HRV ต่อนาทีตลอด 24 ชม. เพื่อจำแนก stress/recovery/activity — Fitbit ผ่าน Google Health **ไม่มี HRV กลางวัน** (มีเฉพาะ RMSSD ตอนนอน) ดังนั้นด้าน stress จะเป็น HR-only
**ขั้นตอนที่ระบบทำให้แล้ว:** `POST /api/energy/probe` ดึง heart-rate samples ของวันก่อน แล้ววัด coverage (% ของนาทีที่มี sample), median gap → `sufficient` (≥ 85%) / `partial` / `insufficient`
**เกณฑ์ go/no-go:** ถ้า ≥ 85% ค่อยทำโมเดลต่อนาที (เริ่มจาก recovery ตอนเช้า, หักตาม HRR ระหว่างออกกำลัง, ชาร์จตอนนอนตาม RMSSD/baseline); ถ้าไม่ถึง ให้ใช้ Recovery index รายวัน (§1) แทน

---

## 6. Biological age (`src/scores/bioage.ts`)

**โมเดลหลัก: PhenoAge (Levine et al. 2018)** — ต้องกรอกผลเลือด 9 ค่า + อายุ
| ตัวชี้วัด | หน่วยที่เก็บ | β |
|---|---|---|
| Albumin | g/L | −0.03359 |
| Creatinine | µmol/L | +0.00951 |
| Glucose | mmol/L | +0.19532 |
| ln(CRP) | CRP mg/dL | +0.09537 |
| Lymphocyte | % | −0.01200 |
| MCV | fL | +0.02676 |
| RDW | % | +0.33062 |
| ALP | U/L | +0.00187 |
| WBC | 10³/µL | +0.05542 |
| Age | ปี | +0.08035 |
```
xb       = −19.90667 + Σ βᵢxᵢ
M(10y)   = 1 − exp(−e^xb · (e^(120·γ) − 1)/γ),  γ = 0.007692696
PhenoAge = 141.50225 + ln(−0.0055305 · ln(1 − M)) / 0.090165
```
ค่า β จาก Table 1 ของบทความ; intercept/γ ตรวจกับ BioAge R package (Kwon & Belsky) — UI แปลงหน่วยห้องแล็บทั่วไป (g/dL, mg/dL, mg/L) ให้เอง
ข้อจำกัด: เทรนบนประชากร NHANES (สหรัฐ), ไว้ต่อ CRP/WBC ที่พุ่งช่วงป่วย → ใช้ผลเลือดตอนสุขภาพปกติ งดอาหาร; อัปเดตเมื่อมีผลเลือดใหม่ (6–12 เดือน)

**โมเดลสำรอง (wearable-only): Fitness age** ตาม §4 — แสดงแยกกัน **ไม่เอามาถัวเฉลี่ยกัน**

**ไม่เลือก:** Klemera-Doubal (ต้อง reference population; ทำกับคนเดียวไม่ได้), โมเดล non-exercise VO₂max (สัมประสิทธิ์ที่หาได้ขัดกันเอง)

---

## แหล่งอ้างอิงหลัก
- Plews, Laursen, Buchheit et al. 2013 — https://pubmed.ncbi.nlm.nih.gov/23852425/
- Buchheit/Schmitt 2015 — https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2015.00343/full
- Kiviniemi et al. 2007 — https://pubmed.ncbi.nlm.nih.gov/17849143/
- Natarajan et al. 2020 (Fitbit z-scores) — https://www.nature.com/articles/s41746-020-00363-7
- Oura Readiness — https://support.ouraring.com/hc/en-us/articles/360057791533 · WHOOP Recovery — https://www.whoop.com/us/en/thelocker/how-does-whoop-recovery-work-101/
- Williams et al. 2017 (EWMA ACWR) — https://pubmed.ncbi.nlm.nih.gov/27650255/ · Impellizzeri et al. 2020 — https://journals.humankinetics.com/view/journals/ijspp/15/6/article-p907.xml
- Banister/Edwards/Lucia TRIMP — https://www.trainingimpulse.com/banisters-trimp-0 · Fitbit AZM — https://support.google.com/fitbit/answer/14236509
- WHOOP Journal (≥5/≥5 rule) — https://www.whoop.com/us/en/thelocker/a-new-way-to-see-insights-on-which-behaviors-affect-your-recovery/ · Oura tags — https://ouraring.com/blog/tags/
- Hedges' g — https://metricgate.com/docs/hedges-g-corrected/ · MoTR (n-of-1 causal) — https://arxiv.org/html/2208.00739v7
- Epley/Brzycki validation — https://opensiuc.lib.siu.edu/cgi/viewcontent.cgi?article=1744&context=gs_rp · Zourdos RPE/RIR 2016 — https://journals.lww.com/nsca-jscr/fulltext/2016/01000/novel_resistance_training_specific_rating_of.31.aspx
- Levine et al. 2018 PhenoAge — https://www.aging-us.com/article/101414/text · BioAge R package — https://github.com/dayoonkwon/BioAge
- NTNU CERG fitness numbers (HUNT3) — https://www.ntnu.edu/cerg/fitness-numbers
- Firstbeat stress & recovery — https://www.firstbeat.com/en/blog/at-the-heart-of-stress-and-recovery/
- Google Health API REST reference — https://developers.google.com/health/reference/rest


## Sleep definitions (v2, Sep 2026)

- **Time in bed** = `summary.minutesInSleepPeriod` from the sleep data point (metric `sleep_minutes_in_period`).
- **Efficiency** = asleep ÷ time in bed × 100 — the same definition Google Health / Fitbit use. Falls back to asleep ÷ (asleep + awake) only when `minutesInSleepPeriod` is absent; the formula used is recorded in `details.formula`.
- **Latency** (`sleep_latency_min`) = `summary.minutesToFallAsleep`, taken from the source, never derived.
- **Main sleep vs naps**: a session belongs to the civil day it *ended* on. Non-nap sessions feed the main-sleep metrics (longest wins, status `partial` if several). Naps (`metadata.nap = true`) are summed into `sleep_nap_minutes`; `sleep_total_asleep_minutes` = main + naps; `sleep_sessions_count` counts both. A naps-only day keeps main-sleep metrics missing.
- **Sleeping HR** (`sleeping_hr_bpm`) = mean of `heart-rate` samples whose `sampleTime.physicalTime` falls inside the main-sleep interval. One request per night after the main pass; `details.coveragePct` = minutes with ≥1 sample ÷ interval minutes. Status `ok` when coverage ≥ 50%, `partial` below, `missing` when no samples. Nights ≥ 2 days old with ≥ 85% coverage are not refetched. Distinct from daily resting HR (`rhr_bpm`, Google's own daily value).
- Not derived (no field in the API, definition not published): sleep score, restlessness, sound sleep, time to sound sleep, full awakenings, interruptions. Read those in the Google Health app.


## Health rules table (`src/rules/rules.ts`, rules-v1)

Every good / fair / low label shown in the UI and every verdict the coach gives comes from one table with three kinds of rule:
**reference** (fixed bands with a cited source: NSF/AASM 7–9 h; efficiency ≥ 85 %; sleep-onset ≤ 30 min; stage % ranges from wearable guidance; WHO 150 min/week ≈ 150 AZM; steps plateau 8,000+ from Paluch 2022), **personal** (mean ± max(SD, floor) of the prior 14 days, ≥ 3 days, for HRV, RHR, SpO₂, breathing rate, sleeping HR — direction-aware: a deviation toward "better" is labelled good, toward "worse" fair, never low) and **goal** (targets from Settings → Your coach; progress = value ÷ target, met ≥ 100 %, fair ≥ 80 %).
`GET /api/rules` returns the table, `GET /api/rules/eval?days=N` the per-day evaluation. The coach receives the latest day's checks as `RULE CHECKS` and is instructed to quote those labels only. Missing metrics produce no check (never treated as zero). Bump `RULES_VERSION` when a band, source or wording changes.
