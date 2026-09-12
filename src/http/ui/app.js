/* Health Coach UI — vanilla JS single page. All data via /api with the admin token; nothing is computed here except display formatting. */
(() => {
'use strict';

/* ================= i18n ================= */
const I18N = {
  th: {
    appName: 'Health Coach', today: 'วันนี้', trends: 'แนวโน้ม', coach: 'โค้ช', settings: 'ตั้งค่า',
    gateTitle: 'เข้าสู่พื้นที่สุขภาพของคุณ', gateSub: 'พื้นที่นี้เป็นส่วนตัว ต้องใช้รหัสเข้าถึงของเซิร์ฟเวอร์', accessCode: 'รหัสเข้าถึง', show: 'แสดง', hide: 'ซ่อน', signIn: 'เข้าสู่ระบบ', badCode: 'รหัสไม่ถูกต้อง', signOut: 'ออกจากระบบ',
    greetMorning: 'อรุณสวัสดิ์', greetDay: 'สวัสดี', greetEvening: 'สวัสดีตอนเย็น',
    latestData: 'ข้อมูลล่าสุด', fetchedAt: 'ดึงเมื่อ', neverFetched: 'ยังไม่เคยดึงข้อมูล', refresh: 'ดึงข้อมูลล่าสุดจาก Google Health', refreshing: 'กำลังดึง…', refreshed: 'ดึงแล้ว',
    connectTitle: 'เชื่อม Fitbit เพื่อเริ่มดูข้อมูลของคุณ', connectSub: 'เชื่อมบัญชี Google ที่ใช้กับแอป Fitbit — ระบบจะอ่านการนอน, HRV, ชีพจรขณะพัก, SpO₂, อัตราหายใจ, ก้าว และนาทีออกกำลัง แบบอ่านอย่างเดียว', connectBtn: 'เชื่อม Google Health',
    reconnectTitle: 'ต้องเชื่อมต่อ Google ใหม่', reconnectSub: 'Google ปฏิเสธ token ล่าสุด (แอปสถานะ Testing จะหมดอายุทุก 7 วัน) — ข้อมูลที่เคยดึงยังดูได้ตามวันที่ระบุ', reconnectBtn: 'เชื่อมต่อใหม่',
    noRecords: 'ยังไม่มีข้อมูลที่ซิงก์เข้ามา', noRecordsSub: 'เปิดแอป Fitbit บนมือถือให้นาฬิกาซิงก์ก่อน แล้วกดดึงข้อมูลอีกครั้ง', fetchAgain: 'ดึงอีกครั้ง',
    lastSleep: 'การนอนล่าสุด', woke: 'ตื่น', vs7: 'เทียบค่าเฉลี่ย 7 วันก่อนหน้า', more: 'มากขึ้น', less: 'น้อยลง', noBaseline: 'กำลังสะสมข้อมูลเปรียบเทียบ', interval: 'ช่วงเวลานอน', efficiency: 'ประสิทธิภาพ', details: 'ดูรายละเอียด', hrs: 'ชม.', min: 'น.', minutes: 'นาที',
    deep: 'หลับลึก', rem: 'REM', light: 'หลับตื้น', awake: 'ตื่นกลางดึก', asleepTotal: 'หลับรวม', recorded: 'ช่วงที่บันทึก', noSleep: 'ยังไม่มีข้อมูลการนอน', noStages: 'ไม่มีข้อมูลระยะการนอนคืนนี้', multiSession: 'มีหลาย session คืนนี้ ใช้ช่วงที่ยาวที่สุด', nap: 'งีบ',
    vitals: 'สัญญาณร่างกาย', vitalsInfo: 'เทียบกับค่าเฉลี่ย 7 วันก่อนหน้าของคุณเอง ข้อมูลจาก Google Health API', hrv: 'HRV', rhr: 'ชีพจรขณะพัก', spo2: 'SpO₂', rr: 'อัตราหายใจ', steps: 'ก้าว', azm: 'นาทีในโซนหัวใจ',
    dataOf: 'ข้อมูลคืนวันที่', dataOfDay: 'ข้อมูลวันที่', incomplete: 'ข้อมูลยังไม่ครบ', noData: 'ยังไม่มีข้อมูล', collecting: 'กำลังสะสมข้อมูลเปรียบเทียบ',
    sleepTrend: 'แนวโน้มการนอน', sleepTrendSub: 'ชั่วโมงต่อคืน แยกตามระยะ · แตะแท่งเพื่อดูวันนั้น', days: 'วัน', noDay: 'ไม่มีข้อมูลคืนนี้', scrollHint: 'เลื่อนดูด้านข้างได้',
    activity: 'กิจกรรม', cardioLoad: 'โหลดหัวใจและหลอดเลือด', loadToday: 'โหลดวันนี้', acute: 'เฉลี่ย 7 วัน', chronic: 'เฉลี่ย 28 วัน', acwr: 'อัตราเปลี่ยนแปลง', loadNote: 'บอกว่าโหลดกำลังเปลี่ยนเร็วแค่ไหน ไม่ใช่ความเสี่ยงบาดเจ็บ', needs28: 'ต้องมีข้อมูล 28 วันก่อนแสดงอัตราส่วน', monotony: 'ความซ้ำซาก',
    band_low: 'โหลดต่ำกว่าปกติ', band_steady: 'สม่ำเสมอ', band_building: 'เพิ่มเร็ว', band_spike: 'พุ่งสูง',
    recovery: 'ดัชนีการฟื้นตัว', recoverySub: 'คำนวณจาก HRV, ชีพจรขณะพัก, การนอน, อัตราหายใจ และ SpO₂ เทียบกับ baseline ของคุณ', confidence: 'ความมั่นใจ', rec_ready: 'พร้อม', rec_moderate: 'ปานกลาง', rec_recover: 'ควรพัก', rec_insufficient: 'ยังให้คะแนนไม่ได้', rec_provisional: 'ชั่วคราว', rec_established: 'มั่นคง', needNights: 'ต้องมี HRV อย่างน้อย 14 คืน', have: 'มี', nights: 'คืน',
    coachYours: 'โค้ชของคุณ', coachEmpty: 'ให้โค้ชช่วยสรุปจากข้อมูลล่าสุดของคุณ', coachMissing: 'สรุปจะพร้อมหลังจากซิงก์ข้อมูลการนอนคืนล่าสุด', summarizeToday: 'สรุปวันนี้', continueChat: 'คุยต่อกับโค้ช', askPh: 'ถามเกี่ยวกับข้อมูลสุขภาพของคุณ…', send: 'ส่ง', back: 'กลับ', clearChat: 'ล้างประวัติแชท', clearConfirm: 'ล้างประวัติแชททั้งหมด?', demo: 'โหมดสาธิต', notDoctor: 'โค้ชเห็นเฉพาะตัวเลขในหน้านี้ และไม่ใช่แพทย์', coachOff: 'ยังไม่ได้ตั้งค่า GLM — โค้ชจะตอบด้วยสรุปตัวเลข', retry: 'ลองใหม่', usingOlder: 'ใช้ข้อมูลเก่ากว่าวันนี้',
    sugg: ['สรุปการนอน', 'ดูแนวโน้มสัปดาห์นี้', 'วันนี้ควรใส่ใจอะไร', 'อธิบายดัชนีการฟื้นตัว'],
    refLastSleep: 'การนอนล่าสุด', refHrv7: 'HRV 7 วัน', refRecovery: 'ดัชนีการฟื้นตัว',
    dayDetail: 'รายละเอียดวัน', missing: 'ขาด', all: 'ครบทุกค่า', sourceData: 'ข้อมูลต้นทาง', close: 'ปิด', measured: 'ช่วงที่วัด',
    weeklyInsights: 'สิ่งที่พบในสัปดาห์นี้', insightsSub: 'เทียบวันที่บันทึกพฤติกรรมกับวันอื่นในช่วง 90 วัน · แสดงเฉพาะที่ผ่านเกณฑ์สถิติ', insightNone: 'ยังไม่มีรูปแบบที่ชัดพอ — บันทึกพฤติกรรมให้ครบอย่างน้อย 5 วันต่อรายการ', assoc: 'เป็นความสัมพันธ์ในข้อมูลของคุณ ไม่ใช่เหตุและผล', onDays: 'ในวันที่บันทึก', nextMorning: 'เช้าถัดมา', higher: 'สูงกว่า', lower: 'ต่ำกว่า', otherDays: 'วันอื่น', collectingTags: 'กำลังสะสม', needTagged: 'ต้อง ≥ 5 วัน',
    journal: 'บันทึกประจำวัน', journalSub: 'ติดแท็กสิ่งที่ทำวันนี้ เพื่อให้ระบบเชื่อมกับผลลัพธ์เช้าถัดไป', note: 'โน้ต', save: 'บันทึก', saved: 'บันทึกแล้ว',
    tag_alcohol: 'แอลกอฮอล์', tag_late_caffeine: 'กาเฟอีนหลังบ่าย 2', tag_late_meal: 'มื้อดึก', tag_nicotine: 'นิโคติน', tag_strength_training: 'เวทเทรนนิ่ง', tag_cardio_hard: 'คาร์ดิโอหนัก', tag_cardio_easy: 'คาร์ดิโอเบา', tag_rest_day: 'วันพัก', tag_late_screen: 'จอก่อนนอน', tag_late_bedtime: 'นอนดึกกว่าปกติ', tag_nap: 'งีบ', tag_travel: 'เดินทาง', tag_stress: 'เครียด', tag_sick: 'ป่วย', tag_sauna_or_cold: 'ซาวน่า/น้ำเย็น', tag_meditation: 'สมาธิ',
    fitness: 'ความฟิต', vo2: 'VO₂max โดยประมาณ', fitnessAge: 'อายุความฟิต', fitnessAgeSub: 'อายุที่ค่าเฉลี่ยประชากร (HUNT3) เท่ากับ VO₂max ของคุณ', needProfile: 'ใส่ปีเกิดและเพศในตั้งค่าเพื่อคำนวณ', noVo2: 'ยังไม่มี VO₂max จาก Fitbit — ต้องออกกำลังด้วย GPS อย่างน้อยหนึ่งครั้ง', sessions: 'เซสชันออกกำลัง',
    strength: 'บันทึกการยกน้ำหนัก', strengthSub: 'สิ่งที่ HR อย่างเดียวบอกไม่ได้: โหลด, ปริมาณ, ความใกล้ล้า', tonnage: 'ตันเนจ', hardSets: 'เซ็ตจริง', e1rm: 'e1RM (Epley)', addSession: 'เพิ่มเซสชัน', exercise: 'ท่า', reps: 'ครั้ง', load: 'กก.', rpe: 'RPE', addSet: '+ เซ็ต', warmup: 'วอร์ม', week: 'สัปดาห์', noStrength: 'ยังไม่มีบันทึก', deleteSession: 'ลบ',
    bioAge: 'อายุชีวภาพ', bioAgeSub: 'PhenoAge (Levine 2018) จากผลเลือด 9 ค่า · แยกจากอายุความฟิต ไม่รวมกัน', phenoAge: 'PhenoAge', accel: 'เทียบอายุจริง', older: 'แก่กว่า', younger: 'อ่อนกว่า', years: 'ปี', addPanel: 'เพิ่มผลเลือด', drawnOn: 'วันที่เจาะเลือด', noPanel: 'ยังไม่มีผลเลือด — เพิ่มได้ในตั้งค่า', panelNote: 'ค่าจากประชากร NHANES ไม่ใช่การวินิจฉัย ใช้ผลตอนสุขภาพปกติและงดอาหาร', updated: 'อัปเดต',
    energy: 'Energy Bank (ทดลอง)', energySub: 'ต้องพิสูจน์ก่อนว่ามี heart-rate ระหว่างวันพอ (≥ 85% ของนาที)', probe: 'ทดสอบข้อมูลระหว่างวัน', probing: 'กำลังดึง heart-rate ของเมื่อวาน…', coverage: 'ครอบคลุม', samples: 'ตัวอย่าง', verdict_sufficient: 'เพียงพอ — พร้อมทำโมเดลระหว่างวัน', verdict_partial: 'บางส่วน — ยังไม่พอ', verdict_insufficient: 'ไม่พอ — ใช้ดัชนีการฟื้นตัวรายวันแทน',
    setAccess: 'การเข้าถึง', setGoogle: 'การเชื่อมต่อ Google Health', setPrefs: 'ภาษาและธีม', setProfile: 'โปรไฟล์สำหรับการคำนวณ', setDiag: 'บันทึกข้อมูลและการวินิจฉัย', language: 'ภาษา', theme: 'ธีม', themeSystem: 'ตามระบบ', themeDark: 'มืด', themeLight: 'สว่าง', birthYear: 'ปีเกิด', sex: 'เพศ', male: 'ชาย', female: 'หญิง', hrMax: 'HR สูงสุด (ไม่บังคับ)', heightCm: 'ส่วนสูง (ซม.)',
    connected: 'เชื่อมต่อแล้ว', notConnected: 'ยังไม่เชื่อมต่อ', connectedAt: 'เชื่อมเมื่อ', lastRefresh: 'refresh token ล่าสุด', disconnect: 'ยกเลิกการเชื่อมต่อ', devices: 'อุปกรณ์ในบัญชี', scopes: 'สิทธิ์',
    rawData: 'response ดิบจาก Google', coachContext: 'สิ่งที่โค้ชเห็น', model: 'โมเดล', promptVersion: 'เวอร์ชัน prompt', recompute: 'คำนวณคะแนนวันนี้ใหม่', diagNote: 'ข้อมูลทั้งหมดอยู่บนเซิร์ฟเวอร์ของคุณ — โมเดลภาษาได้รับเฉพาะตัวเลขสรุป',
    fetched: 'ดึงเมื่อ', type: 'ชนิด', status: 'สถานะ', items: 'รายการ', range: 'ช่วง', copy: 'คัดลอก', copied: 'คัดลอกแล้ว', wrap: 'ตัดบรรทัด',
    footer: 'ข้อมูลต้นทางและการตั้งค่า', unitAlt: 'สลับหน่วยห้องแล็บ', unitsLevine: 'หน่วยตามโมเดล (g/L, µmol/L, mmol/L, mg/dL)', unitsUS: 'หน่วยทั่วไป (g/dL, mg/dL, mg/dL, mg/L)',
    askCoachDay: 'ถามโค้ชเรื่องวันนี้', secSleep: 'การนอนคืนนี้', secVitals: 'สัญญาณร่างกาย เทียบกับช่วงปกติของคุณ', secAct: 'กิจกรรมและโหลด', dataLog: 'บันทึกข้อมูลดิบ (สำหรับตรวจสอบว่าข้อมูลไหนมา/ขาด)', openDataLog: 'ดูบันทึกข้อมูลทั้งหมดในตั้งค่า',
    storySlept: 'คุณหลับรวม', storyMore: 'มากกว่าค่าเฉลี่ย 7 วันก่อนหน้า', storyLess: 'น้อยกว่าค่าเฉลี่ย 7 วันก่อนหน้า', storyBase: 'ยังไม่มีค่าเฉลี่ยให้เทียบ', effGood: 'ดี', effOk: 'พอใช้', effLow: 'ต่ำ', typical: 'ช่วงที่พบบ่อยในผู้ใหญ่', yourRange: 'ช่วงปกติของคุณ', ofSleep: 'ของเวลาหลับ', awakeFor: 'ตื่นกลางดึกรวม',
    within: 'อยู่ในช่วงปกติ', above: 'สูงกว่าปกติ', below: 'ต่ำกว่าปกติ', needMore: 'ต้องมีข้อมูลอย่างน้อย 3 วันก่อนเทียบ',
    hint_hrv_above: 'HRV สูงกว่าช่วงของคุณ — มักสัมพันธ์กับการฟื้นตัวที่ดี', hint_hrv_below: 'HRV ต่ำกว่าช่วงของคุณ — มักพบหลังวันหนัก นอนน้อย ดื่ม หรือเริ่มไม่สบาย',
    hint_rhr_above: 'ชีพจรขณะพักสูงกว่าปกติ — มักพบหลังดื่ม นอนน้อย เครียด หรือร่างกายกำลังสู้กับอะไรบางอย่าง', hint_rhr_below: 'ชีพจรขณะพักต่ำกว่าปกติ — มักสัมพันธ์กับการพักผ่อนที่ดี',
    hint_spo2_below: 'SpO₂ ต่ำกว่าช่วงของคุณ — คืนเดียวบอกอะไรไม่ได้มาก ถ้าต่ำต่อเนื่องหลายคืนค่อยสังเกต', hint_rr_above: 'อัตราหายใจสูงกว่าปกติ — มักพบเมื่อเริ่มไม่สบาย เครียด หรือนอนในห้องร้อน',
    exerciseMin: 'นาทีออกกำลัง', zoneFat: 'Fat burn', zoneCardio: 'Cardio', zonePeak: 'Peak', noSessions: 'ไม่มีเซสชันออกกำลังที่บันทึกวันนี้', avgHr: 'HR เฉลี่ย', loadDay: 'โหลดของวัน', noActivity: 'ยังไม่มีข้อมูลกิจกรรมของวันนี้',
    setCoach: 'โค้ชของคุณ', setCoachSub: 'ปรับสไตล์และบริบทที่โค้ชใช้ตอบ — ทุกอย่างในนี้ถูกส่งให้โมเดลอ่านเป็นข้อมูล ไม่ใช่คำสั่งเหนือกฎความปลอดภัย', tone: 'สไตล์โค้ช', tone_relaxed: 'สบายๆ', tone_balanced: 'สมดุล', tone_strict: 'จริงจัง', toneHint_relaxed: 'เน้นพักผ่อน อลุ่มอล่วย เตือนไม่เกิน 1 เรื่องต่อครั้ง', toneHint_balanced: 'เป็นกันเอง ชี้ 1–2 เรื่องที่สำคัญที่สุด', toneHint_strict: 'ตรงไปตรงมา ชี้ทุกจุดที่หลุดจาก baseline/เป้าหมาย',
    verbosity: 'ความยาวคำตอบ', verb_brief: 'สั้น', verb_normal: 'ปกติ', occupation: 'อาชีพ / ลักษณะงาน', occupationPh: 'เช่น Software engineer นั่งหน้าจอทั้งวัน', lifestyle: 'ไลฟ์สไตล์', lifestylePh: 'เช่น นอนดึกช่วงปล่อยงาน ดื่มกาแฟ 2 แก้ว/วัน ว่ายน้ำสัปดาห์ละครั้ง', healthNotes: 'สุขภาพที่โค้ชควรรู้', healthPh: 'เช่น ปวดหลังล่างเป็นๆ หายๆ ห้ามแนะนำท่า deadlift หนัก · ข้อมูลนี้อยู่บนเซิร์ฟเวอร์ของคุณเท่านั้น', exercisePurpose: 'ออกกำลังเพื่ออะไร', purposePh: 'เช่น สุขภาพทั่วไปและนอนหลับดีขึ้น / ลดไขมัน / เพิ่มกล้าม / วิ่ง 10K', customInstr: 'สิ่งที่อยากให้โค้ชทำ/ไม่ทำ', customPh: 'เช่น อย่าพูดเรื่องแคลอรี · ใช้ภาษาผู้ชายๆ ห้วนๆ · ถ้านอนน้อยกว่า 6 ชม. ให้เตือนเรื่องขับรถ',
    goals: 'เป้าหมายของคุณ', goalSleep: 'นอนต่อคืน (ชม.)', goalSteps: 'ก้าว/วัน', goalAzm: 'นาทีในโซนหัวใจ/สัปดาห์', chatNotes: 'สิ่งที่บอกโค้ชผ่านแชท', chatNotesHint: 'พิมพ์ในแชทว่า “จำไว้ว่า …” หรือ “/remember …” โค้ชจะเก็บไว้ที่นี่', removeNote: 'ลบ', rememberHint: 'พิมพ์ “จำไว้ว่า …” เพื่อบอกเรื่องตัวคุณให้โค้ชจำ',
    timeInBed: 'อยู่บนเตียง', fellAsleepIn: 'หลับภายใน', napsLabel: 'งีบ', totalInclNaps: 'รวมงีบ', sleepHr: 'HR ขณะหลับ', effDef: 'ประสิทธิภาพ = เวลาหลับ ÷ เวลาอยู่บนเตียง (นิยามเดียวกับ Google Health)', prevDay: 'วันก่อนหน้า', nextDay: 'วันถัดไป', sleepHrHint: 'ค่าเฉลี่ยชีพจรตลอดช่วงหลับ · ต่างจากชีพจรขณะพักรายวัน', coverageOf: 'ครอบคลุม',
    goalWord: 'เป้า', rulesTitle: 'กฎที่ใช้ตัดสินว่าค่าไหนดี', rulesSub: 'ทุกป้าย ดี/พอใช้/ต่ำ ในแอปและคำตัดสินของโค้ชมาจากตารางนี้เท่านั้น มีแหล่งอ้างอิงและเวอร์ชันกำกับ', ruleKind_reference: 'เกณฑ์อ้างอิง', ruleKind_personal: 'baseline ส่วนตัว', ruleKind_goal: 'เป้าหมายของคุณ', lvl_good: 'ดี', lvl_fair: 'พอใช้', lvl_low: 'ต่ำ', lvl_note: 'นอกช่วงที่พบบ่อย', lvl_na: 'ยังเทียบไม่ได้', source: 'ที่มา', weekTotal: '7 วันล่าสุด',
    clockFmt: 'รูปแบบเวลา', clock24: '24 ชั่วโมง (07:02)', clock12: '12 ชั่วโมง (7:02 AM)',
    err_generic: 'เกิดข้อผิดพลาด', partialFetch: 'บางชนิดข้อมูลดึงไม่สำเร็จ',
  },
  en: {
    appName: 'Health Coach', today: 'Today', trends: 'Trends', coach: 'Coach', settings: 'Settings',
    gateTitle: 'Enter your health space', gateSub: 'This space is private — it needs the server access code', accessCode: 'Access code', show: 'Show', hide: 'Hide', signIn: 'Sign in', badCode: 'Invalid code', signOut: 'Sign out',
    greetMorning: 'Good morning', greetDay: 'Hello', greetEvening: 'Good evening',
    latestData: 'Latest data', fetchedAt: 'fetched', neverFetched: 'never fetched', refresh: 'Fetch the latest from Google Health', refreshing: 'Fetching…', refreshed: 'Fetched',
    connectTitle: 'Connect Fitbit to start seeing your data', connectSub: 'Connect the Google account used by the Fitbit app — read-only access to sleep, HRV, resting HR, SpO₂, breathing rate, steps and zone minutes', connectBtn: 'Connect Google Health',
    reconnectTitle: 'Google needs to be reconnected', reconnectSub: 'Google rejected the last token (Testing apps expire every 7 days). Previously fetched data stays readable with its date.', reconnectBtn: 'Reconnect',
    noRecords: 'No data has synced yet', noRecordsSub: 'Open the Fitbit app on your phone so the watch syncs, then fetch again', fetchAgain: 'Fetch again',
    lastSleep: 'Last sleep', woke: 'woke', vs7: 'vs mean of the 7 prior days', more: 'more', less: 'less', noBaseline: 'Building your comparison baseline', interval: 'Sleep interval', efficiency: 'Efficiency', details: 'View details', hrs: 'h', min: 'm', minutes: 'min',
    deep: 'Deep', rem: 'REM', light: 'Light', awake: 'Awake', asleepTotal: 'Total asleep', recorded: 'Recorded interval', noSleep: 'No sleep data yet', noStages: 'No stage data for this night', multiSession: 'Several sessions this night; longest used', nap: 'nap',
    vitals: 'Vitals', vitalsInfo: 'Compared with your own mean of the 7 prior days. Source: Google Health API', hrv: 'HRV', rhr: 'Resting HR', spo2: 'SpO₂', rr: 'Breathing rate', steps: 'Steps', azm: 'Zone minutes',
    dataOf: 'Night of', dataOfDay: 'Data from', incomplete: 'Incomplete data', noData: 'No data yet', collecting: 'Building comparison baseline',
    sleepTrend: 'Sleep trend', sleepTrendSub: 'Hours per night by stage · tap a bar for that day', days: 'days', noDay: 'No data this night', scrollHint: 'Scroll sideways',
    activity: 'Activity', cardioLoad: 'Cardiovascular load', loadToday: 'Today', acute: '7-day avg', chronic: '28-day avg', acwr: 'Rate of change', loadNote: 'Describes how fast load is changing — not injury risk', needs28: '28 days of data needed before the ratio shows', monotony: 'Monotony',
    band_low: 'below usual', band_steady: 'steady', band_building: 'building fast', band_spike: 'spike',
    recovery: 'Recovery index', recoverySub: 'From HRV, resting HR, sleep, breathing rate and SpO₂ against your own baseline', confidence: 'confidence', rec_ready: 'ready', rec_moderate: 'moderate', rec_recover: 'recover', rec_insufficient: 'not enough data', rec_provisional: 'provisional', rec_established: 'established', needNights: 'Needs at least 14 nights of HRV', have: 'have', nights: 'nights',
    coachYours: 'Your coach', coachEmpty: 'Let the coach summarise your latest data', coachMissing: 'A summary becomes available after last night\'s sleep syncs', summarizeToday: 'Summarise today', continueChat: 'Continue with the coach', askPh: 'Ask about your health data…', send: 'Send', back: 'Back', clearChat: 'Clear chat history', clearConfirm: 'Clear the whole chat history?', demo: 'Demo mode', notDoctor: 'The coach only sees the numbers on this page, and is not a doctor', coachOff: 'GLM not configured — the coach will answer with a numbers-only summary', retry: 'Retry', usingOlder: 'uses data older than today',
    sugg: ['Summarise my sleep', 'This week\'s trend', 'What should I pay attention to today?', 'Explain the recovery index'],
    refLastSleep: 'Last sleep', refHrv7: 'HRV 7 days', refRecovery: 'Recovery index',
    dayDetail: 'Day detail', missing: 'Missing', all: 'All metrics present', sourceData: 'Source data', close: 'Close', measured: 'measured',
    weeklyInsights: 'What we found this week', insightsSub: 'Tagged days vs other days over 90 days · only statistically gated patterns are shown', insightNone: 'No clear pattern yet — log each behaviour on at least 5 days', assoc: 'A pattern in your data, not proof of cause', onDays: 'On days you logged', nextMorning: 'next morning', higher: 'higher', lower: 'lower', otherDays: 'other days', collectingTags: 'collecting', needTagged: 'needs ≥ 5 days',
    journal: 'Journal', journalSub: 'Tag what you did today so the app can relate it to next morning\'s numbers', note: 'Note', save: 'Save', saved: 'Saved',
    tag_alcohol: 'Alcohol', tag_late_caffeine: 'Caffeine after 2pm', tag_late_meal: 'Late meal', tag_nicotine: 'Nicotine', tag_strength_training: 'Strength training', tag_cardio_hard: 'Hard cardio', tag_cardio_easy: 'Easy cardio', tag_rest_day: 'Rest day', tag_late_screen: 'Screens before bed', tag_late_bedtime: 'Later bedtime', tag_nap: 'Nap', tag_travel: 'Travel', tag_stress: 'Stress', tag_sick: 'Sick', tag_sauna_or_cold: 'Sauna / cold', tag_meditation: 'Meditation',
    fitness: 'Fitness', vo2: 'Estimated VO₂max', fitnessAge: 'Fitness age', fitnessAgeSub: 'Age at which the reference population (HUNT3) averages your VO₂max', needProfile: 'Add birth year and sex in Settings to compute', noVo2: 'No VO₂max from Fitbit yet — needs at least one GPS workout', sessions: 'Workouts',
    strength: 'Strength log', strengthSub: 'What HR alone can\'t show: load, volume, proximity to failure', tonnage: 'Tonnage', hardSets: 'Hard sets', e1rm: 'e1RM (Epley)', addSession: 'Add session', exercise: 'Exercise', reps: 'Reps', load: 'kg', rpe: 'RPE', addSet: '+ set', warmup: 'warm-up', week: 'Week', noStrength: 'No sessions yet', deleteSession: 'Delete',
    bioAge: 'Biological age', bioAgeSub: 'PhenoAge (Levine 2018) from a 9-marker blood panel · shown apart from fitness age, never blended', phenoAge: 'PhenoAge', accel: 'vs chronological', older: 'older', younger: 'younger', years: 'years', addPanel: 'Add blood panel', drawnOn: 'Drawn on', noPanel: 'No blood panel yet — add one in Settings', panelNote: 'Population-derived (NHANES), not a diagnosis. Use a fasting panel taken while well.', updated: 'updated',
    energy: 'Energy Bank (experimental)', energySub: 'First prove intraday heart-rate coverage is sufficient (≥ 85% of minutes)', probe: 'Test intraday data', probing: 'Fetching yesterday\'s heart-rate samples…', coverage: 'coverage', samples: 'samples', verdict_sufficient: 'Sufficient — ready for an intraday model', verdict_partial: 'Partial — not enough yet', verdict_insufficient: 'Insufficient — use the daily recovery index instead',
    setAccess: 'Access', setGoogle: 'Google Health connection', setPrefs: 'Language & theme', setProfile: 'Profile for calculations', setDiag: 'Data log & diagnostics', language: 'Language', theme: 'Theme', themeSystem: 'System', themeDark: 'Dark', themeLight: 'Light', birthYear: 'Birth year', sex: 'Sex', male: 'Male', female: 'Female', hrMax: 'Max HR (optional)', heightCm: 'Height (cm)',
    connected: 'Connected', notConnected: 'Not connected', connectedAt: 'connected', lastRefresh: 'last token refresh', disconnect: 'Disconnect', devices: 'Devices on account', scopes: 'Scopes',
    rawData: 'Raw Google responses', coachContext: 'What the coach sees', model: 'Model', promptVersion: 'Prompt version', recompute: 'Recompute today\'s scores', diagNote: 'All data stays on your server — the language model only receives summary numbers',
    fetched: 'Fetched', type: 'Type', status: 'Status', items: 'Items', range: 'Range', copy: 'Copy', copied: 'Copied', wrap: 'Wrap',
    footer: 'Source data & settings', unitAlt: 'Switch lab units', unitsLevine: 'Model units (g/L, µmol/L, mmol/L, mg/dL)', unitsUS: 'Common units (g/dL, mg/dL, mg/dL, mg/L)',
    askCoachDay: 'Ask the coach about this day', secSleep: 'This night\'s sleep', secVitals: 'Vitals against your own usual range', secAct: 'Activity & load', dataLog: 'Raw data log (to check what arrived / what is missing)', openDataLog: 'Open the full data log in Settings',
    storySlept: 'You slept', storyMore: 'more than your 7-day mean', storyLess: 'less than your 7-day mean', storyBase: 'no baseline to compare yet', effGood: 'good', effOk: 'fair', effLow: 'low', typical: 'common adult range', yourRange: 'your usual range', ofSleep: 'of sleep', awakeFor: 'awake during the night',
    within: 'within your range', above: 'above usual', below: 'below usual', needMore: 'Needs at least 3 days of data to compare',
    hint_hrv_above: 'HRV above your range — often goes with good recovery', hint_hrv_below: 'HRV below your range — common after hard days, short sleep, alcohol, or when getting ill',
    hint_rhr_above: 'Resting HR above usual — common after alcohol, short sleep, stress, or when the body is fighting something', hint_rhr_below: 'Resting HR below usual — often goes with good rest',
    hint_spo2_below: 'SpO₂ below your range — one night says little; watch it only if it stays low for several nights', hint_rr_above: 'Breathing rate above usual — common when getting ill, stressed, or sleeping in a warm room',
    exerciseMin: 'Exercise minutes', zoneFat: 'Fat burn', zoneCardio: 'Cardio', zonePeak: 'Peak', noSessions: 'No recorded workout this day', avgHr: 'Avg HR', loadDay: 'Load this day', noActivity: 'No activity data for this day yet',
    setCoach: 'Your coach', setCoachSub: 'Tune the style and context the coach uses — everything here is shown to the model as data, never as instructions that override the safety rules', tone: 'Coaching style', tone_relaxed: 'Relaxed', tone_balanced: 'Balanced', tone_strict: 'Strict', toneHint_relaxed: 'Rest first, forgiving, at most one caution per reply', toneHint_balanced: 'Friendly, points out the 1–2 things that matter most', toneHint_strict: 'Direct, calls out every miss against baseline/goals',
    verbosity: 'Reply length', verb_brief: 'Brief', verb_normal: 'Normal', occupation: 'Occupation / kind of work', occupationPh: 'e.g. Software engineer, desk work all day', lifestyle: 'Lifestyle', lifestylePh: 'e.g. late nights around releases, 2 coffees a day, swim once a week', healthNotes: 'Health context the coach should know', healthPh: 'e.g. recurring lower-back pain, no heavy deadlifts · stays on your server only', exercisePurpose: 'Why you exercise', purposePh: 'e.g. general health and better sleep / fat loss / muscle / a 10K', customInstr: 'What the coach should or should not do', customPh: 'e.g. never talk about calories · blunt tone · if I sleep < 6 h, warn me about driving',
    goals: 'Your goals', goalSleep: 'Sleep per night (h)', goalSteps: 'Steps / day', goalAzm: 'Zone minutes / week', chatNotes: 'Things you told the coach in chat', chatNotesHint: 'Type “remember that …” or “/remember …” in the chat and it lands here', removeNote: 'Remove', rememberHint: 'Type “remember that …” to tell the coach something about you',
    timeInBed: 'Time in bed', fellAsleepIn: 'fell asleep in', napsLabel: 'naps', totalInclNaps: 'total incl. naps', sleepHr: 'Sleeping HR', effDef: 'Efficiency = time asleep ÷ time in bed (same definition as Google Health)', prevDay: 'Previous day', nextDay: 'Next day', sleepHrHint: 'Mean heart rate across the sleep interval · distinct from daily resting HR', coverageOf: 'coverage',
    goalWord: 'goal', rulesTitle: 'Rules that decide what “good” means', rulesSub: 'Every good/fair/low label in the app and every verdict from the coach comes from this table only — each with a source and version', ruleKind_reference: 'reference', ruleKind_personal: 'personal baseline', ruleKind_goal: 'your goal', lvl_good: 'good', lvl_fair: 'fair', lvl_low: 'low', lvl_note: 'outside common range', lvl_na: 'not comparable yet', source: 'Source', weekTotal: 'last 7 days',
    clockFmt: 'Time format', clock24: '24-hour (07:02)', clock12: '12-hour (7:02 AM)',
    err_generic: 'Something went wrong', partialFetch: 'Some data types failed to fetch',
  },
};


Object.assign(I18N.en, {
  sleep: 'Sleep',
  healthMonitor: 'Health Monitor', monitorNote: 'Today against your own recent readings. Your usual range is descriptive, not a health target.',
  coverageTitle: 'Data coverage', coverageNote: 'Complete daily readings in the previous 60 days, excluding today. Missing may mean not fetched, not recorded, or a sync gap. This is not wear-time coverage.',
  completeReadings: 'complete', partialReadings: 'partial', missingReadings: 'missing', fetchHistory: 'Fetch 60 days from Google',
  healthUnavailable: 'The health report could not be loaded. Retry to check coverage and comparisons.', healthRetry: 'Retry health report',
  previousReading: 'Last recorded', todayMissing: 'No reading for today', earlyRange: 'Early baseline', personalWindow: 'prior calendar days',
  mean7: '7-day mean', mean28: '28-day mean', readings: 'readings', rangeNotReady: 'Collecting readings for your usual range',
  recoveryDetails: 'What contributes to this index?', recoveryEstimate: 'Estimated recovery index', recoveryCaveat: 'A personal trend estimate, not a measured percentage recovered. Weights and score bands are heuristic.',
  dataSupport: 'Data support', dataSupportNote: 'Weighted input coverage × baseline history. This is not a probability that the estimate is correct.',
  inputCoverage: 'Input coverage', baselineHistory: 'HRV baseline', indexBaseline: 'Index baseline', contributorUp: 'Raises index', contributorDown: 'Lowers index', contributorNeutral: 'Near baseline', contributorMissing: 'Not used',
  contributorNote: 'Directions reflect the calculation, not medical judgments. Sleep combines duration and efficiency; HRV combines this night and its 7-day trend. The index uses up to 60 prior days, independently of the Monitor range.',
  recNoHrv: 'No HRV reading for this night', recFewInputs: 'Not enough usable inputs for this night',
  recHrvLow: '7-day HRV is below its index baseline', recRhrUp: 'Resting HR is up while HRV is down', recBreathing: 'Breathing rate and SpO₂ both differ substantially from baseline', recVariation: 'Low HRV with little recent variation',
  completedLoad: 'Latest completed-day trends', loadSoFar: 'Today so far', loadUnit: 'AZM', loadMethod: 'Moderate minutes + 2 × vigorous / peak minutes. Workout TRIMP is kept separate.',
  loadGaps: 'Trends need 7 / 28 consecutive complete days. A missing day or source change restarts the comparison.', workoutTrimp: 'Recorded-workout TRIMP',
  source_azm_total: 'Reported zone minutes', source_azm_zones: 'Summed zone credits', source_hr_zones: 'Converted heart-rate zones', source_none: 'No complete activity reading',
  latestAttempt: 'Last fetch attempt', notFetched: 'No fetch recorded', fetchFailed: 'Fetch failed', fetchOk: 'Fetch succeeded', rangeDays: 'days checked',
  monitorDetails: 'View today’s details', noRecovery: 'Recovery data could not be loaded', dayIncomplete: 'Day still in progress',
});
Object.assign(I18N.th, {
  sleep: 'การนอน',
  healthMonitor: 'ภาพรวมสุขภาพ', monitorNote: 'ค่าของวันนี้เทียบกับข้อมูลล่าสุดของคุณ ช่วงปกติส่วนตัวไม่ใช่เป้าหมายสุขภาพ',
  coverageTitle: 'ความครบถ้วนของข้อมูล', coverageNote: 'ค่ารายวันที่ครบถ้วนใน 60 วันก่อนหน้า ไม่รวมวันนี้ ข้อมูลที่ขาดอาจยังไม่ได้ดึง ไม่ได้บันทึก หรือยังไม่ซิงก์ ไม่ใช่สัดส่วนเวลาที่สวมอุปกรณ์',
  completeReadings: 'ครบถ้วน', partialReadings: 'บางส่วน', missingReadings: 'ขาด', fetchHistory: 'ดึงข้อมูล 60 วันจาก Google',
  healthUnavailable: 'โหลดรายงานสุขภาพไม่สำเร็จ ลองอีกครั้งเพื่อตรวจข้อมูลและช่วงเปรียบเทียบ', healthRetry: 'โหลดรายงานอีกครั้ง',
  previousReading: 'ค่าล่าสุดที่บันทึก', todayMissing: 'ยังไม่มีค่าของวันนี้', earlyRange: 'ช่วงเปรียบเทียบเบื้องต้น', personalWindow: 'วันปฏิทินก่อนหน้า',
  mean7: 'เฉลี่ย 7 วัน', mean28: 'เฉลี่ย 28 วัน', readings: 'ค่า', rangeNotReady: 'กำลังสะสมข้อมูลสำหรับช่วงปกติของคุณ',
  recoveryDetails: 'อะไรมีผลต่อดัชนีนี้?', recoveryEstimate: 'ดัชนีการฟื้นตัวโดยประมาณ', recoveryCaveat: 'ค่าประมาณแนวโน้มส่วนตัว ไม่ใช่เปอร์เซ็นต์การฟื้นตัวที่วัดได้ น้ำหนักและเกณฑ์คะแนนเป็นสูตรประมาณ',
  dataSupport: 'ข้อมูลรองรับ', dataSupportNote: 'ความครบถ้วนของข้อมูลตามน้ำหนัก × ประวัติ baseline ไม่ใช่โอกาสที่ค่าประมาณจะถูกต้อง',
  inputCoverage: 'ความครบถ้วนของข้อมูลที่ใช้', baselineHistory: 'ประวัติ HRV', indexBaseline: 'ค่าฐานของดัชนี', contributorUp: 'เพิ่มดัชนี', contributorDown: 'ลดดัชนี', contributorNeutral: 'ใกล้ค่าฐาน', contributorMissing: 'ไม่ได้ใช้',
  contributorNote: 'ทิศทางมาจากสูตร ไม่ใช่ข้อสรุปทางการแพทย์ การนอนรวมระยะเวลาและประสิทธิภาพ HRV รวมค่าคืนนี้กับแนวโน้ม 7 วัน ดัชนีใช้ประวัติสูงสุด 60 วัน แยกจากช่วงเปรียบเทียบในภาพรวมสุขภาพ',
  recNoHrv: 'ไม่มี HRV ของคืนนี้', recFewInputs: 'ข้อมูลที่ใช้คำนวณคืนนี้ยังไม่เพียงพอ',
  recHrvLow: 'HRV เฉลี่ย 7 วันต่ำกว่าค่าฐานของดัชนี', recRhrUp: 'ชีพจรขณะพักสูงขึ้นพร้อมกับ HRV ลดลง', recBreathing: 'อัตราหายใจและ SpO₂ ต่างจากค่าฐานมากทั้งคู่', recVariation: 'HRV ต่ำและเปลี่ยนแปลงน้อยในช่วงที่ผ่านมา',
  completedLoad: 'แนวโน้มจากวันล่าสุดที่สิ้นสุดแล้ว', loadSoFar: 'วันนี้ ณ ตอนนี้', loadUnit: 'AZM', loadMethod: 'นาทีปานกลาง + 2 × นาทีหนัก / สูงสุด แยก TRIMP ของการออกกำลังกายออกจากค่ารายวัน',
  loadGaps: 'แนวโน้มต้องมีข้อมูลครบ 7 / 28 วันติดกัน หากขาดข้อมูลหรือเปลี่ยนแหล่งข้อมูลจะเริ่มเปรียบเทียบใหม่', workoutTrimp: 'TRIMP ของการออกกำลังกายที่บันทึก',
  source_azm_total: 'นาทีในโซนที่รายงาน', source_azm_zones: 'ผลรวมเครดิตแต่ละโซน', source_hr_zones: 'แปลงจากเวลาในโซนหัวใจ', source_none: 'ยังไม่มีข้อมูลกิจกรรมที่ครบถ้วน',
  latestAttempt: 'ดึงข้อมูลล่าสุด', notFetched: 'ยังไม่มีประวัติการดึง', fetchFailed: 'ดึงไม่สำเร็จ', fetchOk: 'ดึงสำเร็จ', rangeDays: 'วันที่ตรวจ',
  monitorDetails: 'ดูรายละเอียดของวันนี้', noRecovery: 'โหลดข้อมูลการฟื้นตัวไม่สำเร็จ', dayIncomplete: 'วันนี้ยังไม่สิ้นสุด',
});

/* ================= state & helpers ================= */
const S = {
  token: '', lang: 'th', theme: 'system', clock: '24', view: 'today',
  health: null, status: null, rows: [], byDay: {}, days: [], scores: null, coachInfo: null, coachHist: [], journalToday: null,
  sleepRange: 7, selectedDay: null, loading: {}, err: {}, lastFetch: null, demo: false, raw: [], ctx: null,
  exercise: [], coachProfile: null, rules: null, insights: null, fitness: null, strength: null, strengthWeekly: null, bio: null, profile: null, coachOpen: false,
};
try { S.token = sessionStorage.getItem('adminToken') || ''; } catch {}
try { S.lang = localStorage.getItem('lang') || (navigator.language.startsWith('th') ? 'th' : 'en'); S.theme = localStorage.getItem('theme') || 'system'; S.clock = localStorage.getItem('clock') === '12' ? '12' : '24'; } catch {}
const t = (k) => (I18N[S.lang] && I18N[S.lang][k]) ?? I18N.th[k] ?? k;
const LOC = () => (S.lang === 'th' ? 'th-TH' : 'en-GB');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v, d = 0) => (v === null || v === undefined || Number.isNaN(+v) ? null : Number(v).toLocaleString('en-US', { maximumFractionDigits: d }));
const hm = (m) => (m === null || m === undefined ? '—' : `${Math.floor(m / 60)} ${t('hrs')} ${Math.round(m % 60)} ${t('min')}`);
const H12 = () => ({ hour: S.clock === '12' ? 'numeric' : '2-digit', minute: '2-digit', hour12: S.clock === '12' });
const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString(S.clock === '12' ? 'en-US' : LOC(), H12()) : '—');
const dateS = (d, o = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(d + 'T00:00:00').toLocaleDateString(LOC(), o);
const dt = (iso) => (iso ? `${new Date(iso).toLocaleDateString(LOC(), { day: 'numeric', month: 'short' })} ${clock(iso)}` : '—');
const todayStr = () => { if (S.health?.day) return S.health.day; const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const det = (day, m) => S.byDay[day]?.[m]?.details || null;
const chk = (day, id) => S.rules?.byDay?.[day]?.find((c) => c.id === id) || null;
const lvlCls = (l) => (l === 'good' ? 'ok' : l === 'low' ? 'warn' : l === 'fair' ? 'fair' : '');
const lvlBadge = (c) => (c ? `<span class="badge ${lvlCls(c.level)}" title="${esc(c.source)}">${t('lvl_' + c.level)}</span>` : '');
const ruleText = (c) => (c ? esc(c.text?.[S.lang] ?? c.text?.en ?? '') : '');
const goalBar = (c) => (c ? `<div class="goal"><div class="row between"><span class="small t2">${t('goalWord')} ${c.unit === 'min' ? hm(c.target) : num(c.target)}${c.unit === 'steps' ? ' ' + t('steps') : c.unit === 'min' && c.id !== 'goal.sleep' ? ' ' + t('minutes') : ''}</span><span class="small ${c.level === 'good' ? 'ok-text' : 't2'}">${Math.round((c.progress ?? 0) * 100)}%</span></div><div class="gbar"><span style="width:${Math.round((c.progress ?? 0) * 100)}%;background:${c.level === 'good' ? 'var(--c-teal)' : c.level === 'fair' ? 'var(--c-yellow)' : 'var(--c-orange)'}"></span></div></div>` : '');
const val = (day, m) => { const r = S.byDay[day]?.[m]; return r && r.status !== 'missing' && r.value !== null ? Number(r.value) : null; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const latestDayWith = (m) => { for (let i = S.days.length - 1; i >= 0; i--) if (val(S.days[i], m) !== null) return S.days[i]; return null; };
const MIN_BASE = 3;   // prior days with data needed before we show a comparison
const priorVals = (d, m) => S.days.filter((x) => x < d).slice(-7).map((x) => val(x, m)).filter((x) => x !== null);
const base7 = (d, m) => { const xs = priorVals(d, m); return xs.length >= MIN_BASE ? mean(xs) : null; };
const baseInfo = (d, m) => { const n = priorVals(d, m).length; return n >= MIN_BASE ? '' : `<span class="muted">${t('collecting')} (${n}/7)</span>`; };
const $ = (sel, root = document) => root.querySelector(sel);
const app = () => $('#app');

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { 'x-admin-token': S.token, ...(opts.body && !(opts.body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) } });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw Object.assign(new Error(typeof body === 'string' ? body : body.message || `${res.status}`), { status: res.status });
  return body;
}

function applyTheme() {
  const root = document.documentElement;
  if (S.theme === 'system') root.setAttribute('data-theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  else root.setAttribute('data-theme', S.theme);
  document.documentElement.lang = S.lang;
}
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (S.theme === 'system') applyTheme(); });

/* ================= icons ================= */
const ICO = {
  pulse: '<svg viewBox="0 0 24 24"><path d="M3 12h4l2.5-5 4 10 2.5-5H21"/></svg>',
  today: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  trends: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
  coach: '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  sync: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M3 21v-5h5M21 3v5h-5"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l4 4L19 6"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

/* ================= charts ================= */
function sparkline(days, m, color) {
  // The path SVG is stretched (preserveAspectRatio=none) so it fills the card; dots are HTML elements placed by percentage so they stay round.
  const pts = days.map((d, i) => [i, val(d, m)]);
  const have = pts.filter((p) => p[1] !== null);
  if (!have.length) return '<div class="spark" aria-hidden="true"></div>';
  const W = 100, H = 36, pad = 4;
  const ys = have.map((p) => p[1]), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const x = (i) => pad + (i / Math.max(1, days.length - 1)) * (W - 2 * pad), y = (v) => H - pad - ((v - lo) / span) * (H - 2 * pad);
  const dot = (i, v, cls = '') => `<i class="dot ${cls}" style="left:${x(i).toFixed(1)}%;top:${((y(v) / H) * 100).toFixed(1)}%;background:${color}"></i>`;
  if (have.length < 3) return `<div class="spark" aria-hidden="true">${have.map((p) => dot(p[0], (lo + hi) / 2)).join('')}</div>`;   // too few points for a trend line
  let d = '', prev = false;
  for (const [i, v] of pts) { if (v === null) { prev = false; continue; } d += `${prev ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; prev = true; }   // no interpolation across gaps
  const last = have[have.length - 1];
  return `<div class="spark" aria-hidden="true"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>${dot(last[0], last[1])}</div>`;
}

/* ================= Chart.js wrappers (theme-aware) ================= */
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const col = (c) => (c && c.startsWith('var(') ? cssVar(c.slice(4, -1)) : c);
const alpha = (hex, a) => { const h = col(hex).replace('#', ''); if (h.length !== 6) return col(hex); const n = parseInt(h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const dayLabel = (d) => `${+d.slice(8)}/${+d.slice(5, 7)}`;
function chartBase() {
  const C = window.Chart; if (!C) return null;
  C.defaults.font.family = '"IBM Plex Sans Thai", "Thonburi", sans-serif'; C.defaults.font.size = 11; C.defaults.color = col('var(--muted)');
  return {
    responsive: true, maintainAspectRatio: false, animation: { duration: 500, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: col('var(--overlay)'), borderColor: col('var(--border)'), borderWidth: 1, titleColor: col('var(--text)'), bodyColor: col('var(--text-2)'), footerColor: col('var(--text)'), padding: 10, cornerRadius: 12, boxPadding: 4, usePointStyle: true, titleFont: { weight: '600', size: 12 }, bodyFont: { size: 12 } },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: col('var(--muted)'), maxRotation: 0, autoSkipPadding: 12 } },
      y: { grid: { color: col('var(--grid)') }, border: { display: false, dash: [3, 4] }, ticks: { color: col('var(--muted)'), padding: 6, maxTicksLimit: 5 } },
    },
  };
}
function mkChart(box, cfg) {
  const cv = box.querySelector('canvas'); if (!cv || !window.Chart) return null;
  if (cv._chart) cv._chart.destroy();
  cv._chart = new window.Chart(cv, cfg); return cv._chart;
}
const gradientFill = (color, top = 0.28) => (ctx) => {
  const { chart } = ctx; const { ctx: g, chartArea: a } = chart; if (!a) return alpha(color, top);
  const gr = g.createLinearGradient(0, a.top, 0, a.bottom); gr.addColorStop(0, alpha(color, top)); gr.addColorStop(1, alpha(color, 0)); return gr;
};
/** bands: [[lo, hi, color]] drawn behind the data as soft tints */
const bandsPlugin = { id: 'bands', beforeDatasetsDraw(chart, _a, o) { if (!o?.bands?.length) return; const { ctx, chartArea: a, scales: { y } } = chart; ctx.save(); for (const [lo, hi, c] of o.bands) { ctx.fillStyle = alpha(c, 0.06); const y1 = y.getPixelForValue(hi), y2 = y.getPixelForValue(lo); ctx.fillRect(a.left, y1, a.right - a.left, y2 - y1); } ctx.restore(); } };

/** Vertical crosshair at the hovered index (line charts). */
const crosshairPlugin = { id: 'crosshair', afterDatasetsDraw(chart) { const act = chart.tooltip?.getActiveElements?.() || []; if (!act.length) return; const { ctx, chartArea: a } = chart; const x = act[0].element.x; ctx.save(); ctx.strokeStyle = alpha('var(--baseline)', 0.6); ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, a.top); ctx.lineTo(x, a.bottom); ctx.stroke(); ctx.restore(); } };

/** Line chart: series = [{label,color,values:[{day,v}],dots,dash,unit,fill}], opts {min,max,fmt,bands,onSelect} */
function lineChart(el, series, opts = {}) {
  const base = chartBase(); const box = el.querySelector('.chart-plot'); if (!base || !box) return;
  const days = series[0].values.map((p) => p.day);
  const fmt = opts.fmt || ((v) => num(v, 1));
  const datasets = series.map((s, i) => ({
    label: s.label, data: s.values.map((p) => p.v), borderColor: col(s.color), borderWidth: 2, tension: 0.35, spanGaps: false,
    pointRadius: s.dots ? 3 : 0, pointHoverRadius: 5, pointBackgroundColor: col(s.color), pointBorderColor: col('var(--surface)'), pointBorderWidth: 2,
    borderDash: s.dash ? [5, 5] : undefined, fill: (s.fill ?? i === 0) ? 'origin' : false, backgroundColor: gradientFill(s.color),
  }));
  mkChart(box, { type: 'line', data: { labels: days.map(dayLabel), datasets }, plugins: [bandsPlugin, crosshairPlugin], options: {
    ...base, plugins: { ...base.plugins, bands: { bands: opts.bands || [] }, tooltip: { ...base.plugins.tooltip, callbacks: { title: (it) => dateS(days[it[0].dataIndex]), label: (it) => ` ${it.dataset.label}: ${it.raw === null ? t('noData') : fmt(it.raw) + (series[it.datasetIndex].unit ? ' ' + series[it.datasetIndex].unit : '')}` } } },
    scales: { ...base.scales, y: { ...base.scales.y, min: opts.min, max: opts.max, ticks: { ...base.scales.y.ticks, callback: (v) => fmt(v) } } },
    onClick: (e, els, chart) => { if (!opts.onSelect) return; const pts = chart.getElementsAtEventForMode(e, 'index', { intersect: false }, false); if (pts.length) opts.onSelect(days[pts[0].index]); },
  } });
}

/** Stacked sleep bars: el = .scrollx wrapper containing .chart-plot > canvas. Clicking a bar selects that day. */
function sleepBars(el, days) {
  const base = chartBase(); const box = el.querySelector('.chart-plot'); if (!base || !box) return;
  box.style.width = `${Math.max(days.length * 44 + 56, el.clientWidth)}px`;
  const stages = [['sleep_deep_minutes', 'var(--deep)', t('deep')], ['sleep_rem_minutes', 'var(--rem)', t('rem')], ['sleep_light_minutes', 'var(--light)', t('light')], ['sleep_minutes_awake', 'var(--awake)', t('awake')]];
  const asleep = days.map((d) => val(d, 'sleep_minutes_asleep'));
  const hasStages = days.map((d) => stages.slice(0, 3).some(([m]) => (val(d, m) ?? 0) > 0));
  const selIdx = days.indexOf(S.selectedDay);
  const paint = (c) => (ctx) => (selIdx >= 0 && ctx.dataIndex !== selIdx ? alpha(c, 0.35) : col(c));
  const datasets = stages.map(([m, c, lab]) => ({ label: lab, data: days.map((d, i) => (hasStages[i] ? val(d, m) : m === 'sleep_rem_minutes' ? asleep[i] : null)), backgroundColor: paint(c), hoverBackgroundColor: col(c), borderRadius: 4, borderSkipped: false, maxBarThickness: 34, categoryPercentage: 0.72, barPercentage: 1 }));
  const totals = days.map((_, i) => stages.reduce((a, [m]) => a + (val(days[i], m) ?? 0), 0));
  const yMax = Math.ceil(Math.max(480, ...totals, ...asleep.map((x) => x ?? 0)) / 120) * 120;
  mkChart(box, { type: 'bar', data: { labels: days.map(dayLabel), datasets }, options: {
    ...base, interaction: { mode: 'index', intersect: false },
    plugins: { ...base.plugins, tooltip: { ...base.plugins.tooltip, filter: (it) => it.raw !== null && it.raw > 0, callbacks: {
      title: (it) => dateS(days[it[0].dataIndex]),
      label: (it) => ` ${it.dataset.label}: ${num(it.raw)} ${t('minutes')}`,
      footer: (it) => { const i = it[0]?.dataIndex; return i === undefined || asleep[i] === null ? t('noDay') : `${t('asleepTotal')} ${hm(asleep[i])}`; },
    } } },
    scales: { x: { ...base.scales.x, stacked: true }, y: { ...base.scales.y, stacked: true, min: 0, max: yMax, ticks: { ...base.scales.y.ticks, stepSize: 120, callback: (v) => `${v / 60}${t('hrs')}` } } },
    onClick: (e, _els, chart) => { const pts = chart.getElementsAtEventForMode(e, 'index', { intersect: false }, false); if (pts.length) { S.selectedDay = days[pts[0].index]; render(); } },
    onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
  } });
}

/* ================= data loading ================= */
async function loadCore() {
  S.status = await api('/auth/google/status').catch((e) => { if (e.status === 401) throw e; return null; });
  const [rows, scores, info, hist, raw, ex, health] = await Promise.all([
    api('/api/days?days=61').catch(() => []), api('/api/scores?days=35').catch(() => null), api('/api/coach/info').catch(() => null),
    api('/api/coach/messages').catch(() => []), api('/api/raw?limit=5').catch(() => []), api('/api/exercise?days=35').catch(() => []), api('/api/health?days=60').catch(() => null),
  ]);
  S.health = health;
  S.exercise = Array.isArray(ex) ? ex : [];
  S.rules = await api('/api/rules/eval?days=35').catch(() => null);
  S.rows = rows; S.byDay = {}; for (const r of rows) (S.byDay[r.day.slice(0, 10)] ||= {})[r.metric] = r;
  S.days = Object.keys(S.byDay).sort(); S.scores = scores; S.coachInfo = info; S.coachHist = hist; S.raw = raw;
  S.lastFetch = raw[0]?.fetched_at ?? null;
  S.demo = !!(info && /mock|demo/i.test(info.model || ''));
  S.journalToday = (await api(`/api/journal?days=1`).catch(() => []))[0] ?? null;
}
async function loadTrends() {
  const [ins, fit, sw, bio, prof, ss] = await Promise.all([
    api('/api/insights').catch(() => null), api('/api/fitness').catch(() => null), api('/api/strength/weekly').catch(() => null),
    api('/api/bioage').catch(() => null), api('/api/profile').catch(() => null), api('/api/strength/sessions?days=60').catch(() => []),
  ]);
  S.insights = ins; S.fitness = fit; S.strengthWeekly = sw; S.bio = bio; S.profile = prof; S.strength = ss;
}

/* ================= shell ================= */
function shell(inner) {
  const nav = (id, ico) => `<button class="${S.view === id ? 'on' : ''}" data-view="${id}"><i>${ico}</i>${t(id)}</button>`;
  return `
<header class="header"><div class="in">
  <div class="brand"><span class="mark">${ICO.pulse}</span>${t('appName')}</div>
  <nav class="tabs" aria-label="views">${['today', 'trends', 'coach', 'settings'].map((v) => `<button class="${S.view === v ? 'on' : ''}" data-view="${v}">${t(v)}</button>`).join('')}</nav>
  <div class="right">
    ${S.demo ? `<span class="badge warn">${ICO.warn}${t('demo')}</span>` : ''}
    <button class="icon-btn ghost ${S.loading.refresh ? 'is-loading' : ''}" id="syncBtn" title="${S.loading.refresh ? t('refreshing') : t('refresh')}" aria-label="${S.loading.refresh ? t('refreshing') : t('refresh')}" aria-busy="${S.loading.refresh}" ${S.loading.refresh ? 'disabled' : ''}>${S.loading.refresh ? '<span class="spinner" aria-hidden="true"></span>' : ICO.sync}</button>
    <button class="icon-btn ghost" data-view="settings" aria-label="${t('settings')}">${ICO.settings}</button>
  </div>
</div></header>
<main class="page" id="main">${inner}</main>
<nav class="nav" aria-label="navigation">${nav('today', ICO.today)}${nav('trends', ICO.trends)}${nav('coach', ICO.coach)}${nav('settings', ICO.settings)}</nav>
<div class="drawer-scrim" id="scrim"></div>
<aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="${t('coach')}"></aside>`;
}

function bindShell() {
  document.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => go(b.dataset.view)));
  $('#syncBtn').onclick = refreshData;
  $('#scrim').onclick = () => openCoach(false);
}

function go(view) {
  if (view === 'coach') { openCoach(true); return; }
  S.view = view; location.hash = view; render(); window.scrollTo({top:0, behavior:'instant'});
}

/* ================= gate ================= */
function renderGate(err) {
  app().innerHTML = `
<header class="header"><div class="in"><div class="brand"><span class="mark">${ICO.pulse}</span>${t('appName')}</div><div class="right"><button class="ghost sm" id="langBtn">${S.lang === 'th' ? 'EN' : 'TH'}</button></div></div></header>
<div class="gate"><form class="card form" id="gateForm">
  <h2>${t('gateTitle')}</h2><p class="t2 small" style="margin:0">${t('gateSub')}</p>
  <div class="f"><label for="tok">${t('accessCode')}</label><div class="field"><input id="tok" type="password" autocomplete="current-password" required><button type="button" class="ghost" id="showTok">${t('show')}</button></div>${err ? `<div class="err" role="alert">${esc(err)}</div>` : ''}</div>
  <button class="primary" type="submit">${t('signIn')}</button>
</form></div>`;
  $('#showTok').onclick = () => { const i = $('#tok'); i.type = i.type === 'password' ? 'text' : 'password'; $('#showTok').textContent = i.type === 'password' ? t('show') : t('hide'); };
  $('#langBtn').onclick = () => { S.lang = S.lang === 'th' ? 'en' : 'th'; try { localStorage.setItem('lang', S.lang); } catch {} applyTheme(); renderGate(); };
  $('#gateForm').onsubmit = async (e) => {
    e.preventDefault(); S.token = $('#tok').value.trim();
    try { await api('/auth/google/status'); try { sessionStorage.setItem('adminToken', S.token); } catch {} boot(); }
    catch (er) { S.token = ''; renderGate(er.status === 401 ? t('badCode') : er.message); }
  };
  $('#tok').focus();
}

/* ================= today view ================= */
function greeting() { const h = new Date().getHours(); return h < 11 ? t('greetMorning') : h < 17 ? t('greetDay') : t('greetEvening'); }

function freshnessRow() {
  const sd = latestDayWith('sleep_minutes_asleep');
  const conn = S.status?.connected;
  const stale = sd && sd !== todayStr();
  return `<div class="fresh">
    ${conn ? `<span class="badge ${S.status.needsReconnect ? 'warn' : 'ok'}">${S.status.needsReconnect ? ICO.warn : ICO.check}${S.status.needsReconnect ? t('reconnectTitle') : t('connected')}</span>` : `<span class="badge">${t('notConnected')}</span>`}
    <span class="small t2">${S.view === 'today' ? (stale ? `${t('usingOlder')} · ${dateS(sd)}` : S.lastFetch ? dt(S.lastFetch) : '') : `${t('latestData')}: ${sd ? `${t('dataOf')} ${dateS(sd)}` : t('noData')} · ${t('fetchedAt')} ${S.lastFetch ? dt(S.lastFetch) : t('neverFetched')}`}</span>
    <button class="ghost sm ${S.loading.refresh ? 'is-loading' : ''}" id="refreshBtn" title="${S.loading.refresh ? t('refreshing') : t('refresh')}" aria-busy="${!!S.loading.refresh}" ${S.loading.refresh ? 'disabled' : ''}>${S.loading.refresh ? '<span class="spinner" aria-hidden="true"></span> ' + t('refreshing') : S.view === 'today' ? (S.lang === 'th' ? 'ดึงข้อมูล' : 'Fetch data') : '↻ ' + t('refresh')}</button>
    ${S.err.refresh ? `<span class="err">${esc(S.err.refresh)}</span>` : ''}
  </div>`;
}

const REC_METRICS = { hrv: ['hrv_avg_ms', 'hrv', 'ms'], rhr: ['rhr_bpm', 'rhr', 'bpm'], sleep: ['sleep_minutes_asleep', 'sleep', 'min'], rr: ['respiratory_rate_bpm', 'rr', '/min'], spo2: ['spo2_avg_pct', 'spo2', '%'] };
const measurement = (metric, value) => value === null || value === undefined ? '—' : metric === 'sleep_minutes_asleep' ? hm(value) : num(value, 1);
function recoveryReasons(r) {
  if (r.score === null) return r.status === 'insufficient' ? `${t('needNights')} · ${r.baselineDays}/14` : !r.contributors?.find(c => c.metric === 'hrv')?.value ? t('recNoHrv') : t('recFewInputs');
  const names = { hrv7_low: 'recHrvLow', rhr_and_hrv_down: 'recRhrUp', illness_pattern: 'recBreathing', cv_collapse: 'recVariation' };
  return (r.flags || []).map(f => names[f] ? t(names[f]) : '').filter(Boolean).join(' · ') || t('recoverySub');
}
function recoveryContributors(r) {
  return `<p class="small t2">${t('contributorNote')}</p><div class="contributors">${(r.contributors || []).map(c => {
    const [metric, label, unit] = REC_METRICS[c.metric] || [c.metric, c.metric, ''];
    const used = r.score !== null && c.z !== null;
    const effect = !used ? 'contributorMissing' : c.z > 0.1 ? 'contributorUp' : c.z < -0.1 ? 'contributorDown' : 'contributorNeutral';
    return `<div class="contributor"><div><b>${t(label)}</b><span class="small">${measurement(metric, c.value)} ${metric === 'sleep_minutes_asleep' ? '' : unit}</span></div><div class="small t2">${t('indexBaseline')} ${measurement(metric, c.baseline)} ${metric === 'sleep_minutes_asleep' ? '' : unit}<br>${c.n} ${t('readings')}</div><span class="badge">${t(effect)}</span></div>`;
  }).join('')}</div>`;
}
function recoveryBlock(day) {
  const r = day ? S.scores?.recovery?.find(r => r.day === day) : S.scores?.recovery?.at(-1);
  if (!r) return `<section class="card"><h2>${t('recoveryEstimate')}</h2><p class="small t2">${t('noRecovery')}</p></section>`;
  const scored = r.score !== null;
  const prior = (n) => { const xs = S.scores.recovery.filter(x => x.day < r.day && x.day >= shiftDay(r.day, -n) && x.score !== null); return { n: xs.length, value: mean(xs.map(x => x.score)) }; };
  const trend = [7, 28].map(n => { const v = prior(n); return `<span>${t('mean' + n)} <b>${num(v.value, 0) ?? '—'}</b> <span class="small t2">(${v.n}/${n})</span></span>`; }).join('');
  return `<section class="card recovery-card">
    <div class="section-head"><h2>${t('recoveryEstimate')}</h2><span class="small t2">${dateS(r.day)}</span></div>
    <div class="recovery"><div class="score">${scored ? r.score : '—'}<small>/100</small></div><div>
      <div class="row between"><span class="badge">${t('rec_' + (scored ? r.band : r.status))}</span><span class="small t2">${t('dataSupport')} ${Math.round(r.confidence * 100)}%</span></div>
      ${scored ? `<div class="scale recovery-scale" role="img" aria-label="${t('recoveryEstimate')} ${r.score}/100"><span class="seg a"></span><span class="seg b"></span><i style="left:${r.score}%"></i></div>` : ''}
      <p class="small t2">${esc(recoveryReasons(r))}</p></div></div>
    <div class="recovery-trends">${trend}</div>
    <p class="small t2">${t('recoveryCaveat')}</p>
    <details class="recovery-explain"><summary>${t('recoveryDetails')}</summary>
      <div class="row recovery-meta"><span>${t('baselineHistory')}: <b>${r.baselineDays}</b> ${t('nights')}</span><span>${t('inputCoverage')}: <b>${Math.round(r.coverage * 100)}%</b></span></div>
      <p class="small t2">${t('dataSupportNote')}</p>${recoveryContributors(r)}
    </details>
  </section>`;
}

function shiftDay(day, offset) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); }
function healthMonitor() {
  if (!S.health) return `<section class="card"><h2>${t('healthMonitor')}</h2><p class="small t2">${t('healthUnavailable')}</p><button data-health-retry>${t('healthRetry')}</button></section>`;
  const defs = [...VITALS, {m:'sleep_minutes_asleep', k:'sleep', unit:'', c:'var(--deep)'}, {m:'sleep_efficiency_pct', k:'efficiency', unit:'%', c:'var(--c-blue)'}];
  return `<section class="health-monitor"><div class="section-head"><h2>${t('healthMonitor')}</h2><button class="ghost sm" data-health-day="${S.health.day}">${t('monitorDetails')}</button></div>
    <p class="small t2 monitor-intro">${dateS(S.health.day)} · ${t('monitorNote')}</p>
    <div class="monitor-grid">${defs.map(def => {
      const m = S.health.monitor.find(x => x.metric === def.m); if (!m) return '';
      const position = m.position === 'collecting' ? 'collecting' : m.position === 'partial' ? 'partialReadings' : m.position === 'missing' ? 'todayMissing' : m.position;
      const range = m.range ? `${measurement(def.m, m.range.lo)}–${measurement(def.m, m.range.hi)} ${def.unit}` : t('rangeNotReady');
      const old = m.value === null && m.lastReading ? `<p class="small t2">${t('previousReading')}: ${measurement(def.m, m.lastReading.value)} ${def.unit} · ${dateS(m.lastReading.day)}</p>` : '';
      return `<article class="metric monitor-metric" style="--mc:${def.c}"><h3 class="label">${t(def.k)}</h3><div class="monitor-value">${measurement(def.m, m.value)}<small>${def.unit}</small></div>
        <span class="badge">${t(position)}</span><p class="small t2">${m.range ? t('yourRange') + ': ' : ''}${range}</p>
        ${m.range ? `<span class="small t2">${m.range.n}/${m.baselineWindow} ${t('readings')}${m.range.n < 14 ? ' · ' + t('earlyRange') : ''}</span>` : ''}${old}
        <dl class="monitor-means">${[7,28].map(n => `<div><dt>${t('mean'+n)}</dt><dd>${measurement(def.m,m['mean'+n].value)} <small>(${m['mean'+n].n}/${n})</small></dd></div>`).join('')}</dl></article>`;
    }).join('')}</div></section>`;
}
function coverageBlock() {
  if (!S.health) return `<p class="small t2">${t('healthUnavailable')}</p><button data-health-retry>${t('healthRetry')}</button>`;
  const h = S.health;
  const label = m => { const def = VITALS.find(v=>v.m===m); return def ? t(def.k) : t(({ sleep_minutes_asleep:'sleep', sleep_efficiency_pct:'efficiency', sleeping_hr_bpm:'sleepHr', steps:'steps', active_zone_minutes:'azm', azm_fat_burn_min:'zoneFat', azm_cardio_min:'zoneCardio', azm_peak_min:'zonePeak', hrz_moderate_min:'zoneFat', hrz_vigorous_min:'zoneCardio', hrz_peak_min:'zonePeak' })[m] || m); };
  return `<details class="card coverage-panel"><summary>${t('coverageTitle')} · ${h.range.days} ${t('days')}</summary><p class="small t2">${t('coverageNote')}</p><p class="small t2">${dateS(h.range.start)} → ${dateS(h.range.end)} · ${esc(h.timezone)}</p>
    <div class="coverage-list">${h.coverage.map(c => {
      const upstream = h.upstream?.find(u=>u.data_type===c.dataType);
      return `<details class="coverage-row"><summary><span>${label(c.metric)}${c.metric.startsWith('hrz_') ? ' · HR' : c.metric.startsWith('azm_') ? ' · AZM' : ''}</span><span>${c.completeDays}/${h.range.days} · ${c.coveragePct}%</span><span class="coverage-track" aria-hidden="true"><i style="width:${c.coveragePct}%"></i></span></summary>
        <p class="small">${c.completeDays} ${t('completeReadings')} · ${c.partialDays} ${t('partialReadings')} · ${c.missingDays} ${t('missingReadings')}</p>
        <p class="small t2">${t('latestAttempt')}: ${upstream ? `${dt(upstream.fetched_at)} · ${t(upstream.http_status >= 200 && upstream.http_status < 300 ? 'fetchOk' : 'fetchFailed')} (${upstream.http_status})` : t('notFetched')}</p>
        ${c.missingDates.length ? `<p class="small t2">${t('missingReadings')}: ${c.missingDates.map(d=>dateS(d,{day:'numeric',month:'short'})).join(', ')}</p>` : ''}
        ${c.partialDates.length ? `<p class="small t2">${t('partialReadings')}: ${c.partialDates.map(d=>dateS(d,{day:'numeric',month:'short'})).join(', ')}</p>` : ''}
      </details>`;
    }).join('')}</div><button class="sm" data-history-fetch ${S.loading.refresh ? 'disabled' : ''}>${S.loading.refresh ? t('refreshing') : t('fetchHistory')}</button></details>`;
}
function bindHealth() {
  document.querySelectorAll('[data-health-retry]').forEach(b=>b.onclick=async()=>{ b.disabled=true; S.health=await api('/api/health?days=60').catch(()=>null); render(); });
  document.querySelectorAll('[data-history-fetch]').forEach(b=>b.onclick=()=>refreshData(60));
  document.querySelectorAll('[data-health-day]').forEach(b=>b.onclick=()=>openDay(b.dataset.healthDay));
}

function sleepSummary() {
  const d = latestDayWith('sleep_minutes_asleep');
  if (!d) return `<section class="card sleep-card"><div class="eyebrow"><span>${t('lastSleep')}</span></div><div class="empty" style="margin-top:12px">${t('noSleep')}</div></section>`;
  const asleep = val(d, 'sleep_minutes_asleep'), eff = val(d, 'sleep_efficiency_pct');
  const deep = val(d, 'sleep_deep_minutes'), rem = val(d, 'sleep_rem_minutes'), light = val(d, 'sleep_light_minutes'), awake = val(d, 'sleep_minutes_awake');
  const row = S.byDay[d].sleep_minutes_asleep; const b = base7(d, 'sleep_minutes_asleep');
  const delta = b !== null && asleep !== null ? asleep - b : null;
  const tib = val(d, 'sleep_minutes_in_period'), nap = val(d, 'sleep_nap_minutes') || 0, tot2 = val(d, 'sleep_total_asleep_minutes'), shr = val(d, 'sleeping_hr_bpm');
  const hasStages = [deep, rem, light].some((x) => x !== null);
  const tot = hasStages ? [deep, rem, light, awake].filter((x) => x !== null).reduce((a, x) => a + x, 0) : 0;
  const seg = (v, c) => (v === null || !tot ? '' : `<span style="width:${((v / tot) * 100).toFixed(1)}%;background:${c}"></span>`);
  const n0 = (v) => (v === null ? '—' : `${num(v)} ${t('minutes')}`);
  return `<section class="card sleep-card">
    <div class="eyebrow"><span>${t('lastSleep')}</span><span>${t('woke')} ${dateS(d, { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>
    <div class="hero-val">${asleep === null ? '—' : `${Math.floor(asleep / 60)}<small>${t('hrs')}</small>${Math.round(asleep % 60)}<small>${t('min')}</small>`}</div>
    <div class="small t2">${delta === null ? `${t('noBaseline')} (${priorVals(d, 'sleep_minutes_asleep').length}/7)` : `${t('vs7')} · ${delta >= 0 ? t('more') : t('less')} ${hm(Math.abs(delta))}`}${row?.status === 'partial' ? ` · ${t('multiSession')}` : ''}</div>
    ${tot ? `<div class="stage-bar" role="img" aria-label="${t('recorded')} ${hm(tot)}">${seg(deep, 'var(--deep)')}${seg(rem, 'var(--rem)')}${seg(light, 'var(--light)')}${seg(awake, 'var(--awake)')}</div>` : `<div class="small muted" style="margin-top:12px">${t('noStages')}</div>`}
    <div class="kv kv3"><div><span>${t('interval')}</span><b>${clock(row?.measured_start)} → ${clock(row?.measured_end)}</b></div><div><span>${t('timeInBed')}</span><b>${tib === null ? '—' : hm(tib)}</b></div><div title="${esc(chk(d, 'sleep.efficiency')?.source || t('effDef'))}"><span>${t('efficiency')}</span><b>${eff === null ? '—' : eff.toFixed(0) + '%'} ${lvlBadge(chk(d, 'sleep.efficiency'))}</b></div></div>
    ${goalBar(chk(d, 'goal.sleep'))}
    ${nap || shr !== null ? `<div class="small t2" style="margin-top:8px">${[nap ? `${t('napsLabel')} ${hm(nap)} · ${t('totalInclNaps')} ${hm(tot2)}` : '', shr !== null ? `${t('sleepHr')} ${num(shr)} bpm` : ''].filter(Boolean).join(' · ')}</div>` : ''}
    ${tot ? `<div class="legend"><span><i style="background:var(--deep)"></i>${t('deep')} ${n0(deep)}</span><span><i style="background:var(--rem)"></i>${t('rem')} ${n0(rem)}</span><span><i style="background:var(--light)"></i>${t('light')} ${n0(light)}</span><span><i style="background:var(--awake)"></i>${t('awake')} ${n0(awake)}</span></div>` : ''}
    <div style="margin-top:12px"><a href="#" data-day="${d}" class="small">${t('details')} →</a></div>
  </section>`;
}

const VITALS = [
  { m: 'hrv_avg_ms', k: 'hrv', unit: 'ms', dec: 0, c: 'var(--c-teal)' }, { m: 'rhr_bpm', k: 'rhr', unit: 'bpm', dec: 0, c: 'var(--c-red)' },
  { m: 'spo2_avg_pct', k: 'spo2', unit: '%', dec: 1, c: 'var(--c-cyan)' }, { m: 'respiratory_rate_bpm', k: 'rr', unit: '/min', dec: 1, c: 'var(--c-magenta)' },
];
function metricCard(def, latestOverall) {
  const d = latestDayWith(def.m); const v = d ? val(d, def.m) : null; const b = d ? base7(d, def.m) : null;
  let cmp = d ? baseInfo(d, def.m) : `<span class="muted">${t('collecting')}</span>`;
  if (v !== null && b !== null) { const diff = v - b; cmp = `${diff >= 0 ? '+' : '−'}${num(Math.abs(diff), def.dec)} ${def.unit} <span class="muted">${t('vs7')}</span>`; }
  const stale = d && latestOverall && d !== latestOverall;
  return `<button class="metric" data-metric="${def.m}" aria-label="${t(def.k)}" style="--mc:${def.c || 'var(--trend)'}">
    <div class="label">${t(def.k)}</div>
    <div class="val">${v === null ? `<span class="dash">—</span>` : `${num(v, def.dec)}<small>${def.unit}</small>`}</div>
    <div class="cmp">${v === null ? `<span class="muted">${t('noData')}</span>` : cmp}</div>
    ${sparkline(S.days.slice(-14), def.m, def.c || 'var(--trend)')}
    ${stale ? `<div class="foot">${t('dataOf')} ${dateS(d)}</div>` : v === null ? `<div class="foot">${t('incomplete')}</div>` : ''}
  </button>`;
}

function activityBlock() {
  const l = S.scores?.load?.[S.scores.load.length - 1];
  const completed = S.scores?.load?.filter(x=>x.day < todayStr()).at(-1);
  const sd = latestDayWith('steps'), ad = latestDayWith('active_zone_minutes');
  const dayLabel = sd && sd !== todayStr() ? ` · ${t('dataOfDay')} ${dateS(sd)}` : '';
  const card = (k, d, m, unit, c, extra = '') => { const v = d ? val(d, m) : null; return `<div class="metric" style="min-height:0;--mc:${c}"><div class="label">${t(k)}</div><div class="val">${v === null ? '<span class="dash">—</span>' : `${num(v)}<small>${unit}</small>`}</div>${extra}${sparkline(S.days.slice(-14), m, c)}</div>`; };
  const stepsChk = sd ? chk(sd, 'goal.steps') || chk(sd, 'activity.steps') : null;
  const azmWeek = ad ? chk(ad, 'goal.azm_week') || chk(ad, 'activity.azm_week') : null;
  const stepsExtra = stepsChk ? (stepsChk.kind === 'goal' ? goalBar(stepsChk) : `<div class="cmp">${lvlBadge(stepsChk)} <span class="muted">${ruleText(stepsChk)}</span></div>`) : '';
  const azmExtra = azmWeek ? (azmWeek.kind === 'goal' ? `<div class="cmp">${t('weekTotal')} ${num(azmWeek.value)} ${t('minutes')}</div>${goalBar(azmWeek)}` : `<div class="cmp">${t('weekTotal')} ${num(azmWeek.value)} ${t('minutes')} ${lvlBadge(azmWeek)}</div>`) : '';
  const loadCard = l ? `<div class="metric" style="min-height:0;--mc:var(--c-purple)">
      <div class="label">${t('cardioLoad')}</div>
      <div class="val">${l.load === null ? '<span class="dash">—</span>' : `${num(l.load)}<small>${t('loadUnit')}</small>`}</div>
      <div class="cmp">${dateS(l.day)} · ${t(l.provisional ? 'loadSoFar' : 'dataOfDay')}</div><div class="cmp">${t('source_' + l.source.replaceAll('-', '_'))}</div><div class="cmp">${t('completedLoad')}${completed ? ' · ' + dateS(completed.day) : ''}: ${t('acute')} ${num(completed?.acute, 1) ?? '—'} · ${t('chronic')} ${num(completed?.chronic, 1) ?? '—'}</div>
      <div class="cmp">${t('loadGaps')} (${completed?.history ?? 0}/28)</div>
      <div class="foot">${t('loadMethod')}</div>${l.workoutTrimp != null ? `<div class="cmp">${t('workoutTrimp')}: ${num(l.workoutTrimp,1)}</div>` : ''}</div>` : '';
  return `<section><div class="section-head"><h2>${t('activity')}<span class="small t2" style="font-weight:400">${dayLabel}</span></h2></div>
    <div class="metrics" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">${card('steps', sd, 'steps', '', 'var(--c-yellow)', stepsExtra)}${card('azm', ad, 'active_zone_minutes', 'min', 'var(--c-orange)', azmExtra)}${loadCard}</div></section>`;
}

function sleepHistory() {
  const days = S.days.slice(-S.sleepRange);
  const sel = S.selectedDay && S.byDay[S.selectedDay] ? S.selectedDay : null;
  const dsel = sel ? (() => { const a = val(sel, 'sleep_minutes_asleep'); return a === null ? `<div class="daysel"><b>${dateS(sel, { weekday: 'long', day: 'numeric', month: 'long' })}</b><span class="muted">${t('noDay')}</span></div>` : `<div class="daysel"><div class="row between"><b>${dateS(sel, { weekday: 'long', day: 'numeric', month: 'long' })}</b><a href="#" data-day="${sel}" class="small">${t('details')} →</a></div><span>${t('asleepTotal')} ${hm(a)} · ${t('efficiency')} ${val(sel, 'sleep_efficiency_pct')?.toFixed(0) ?? '—'}% · ${t('deep')} ${num(val(sel, 'sleep_deep_minutes')) ?? '—'} · ${t('rem')} ${num(val(sel, 'sleep_rem_minutes')) ?? '—'} · ${t('light')} ${num(val(sel, 'sleep_light_minutes')) ?? '—'} ${t('minutes')}</span></div>`; })() : '';
  const empty = !days.some((d) => val(d, 'sleep_minutes_asleep') !== null);
  return `<section class="card">
    <div class="section-head"><div><h2>${t('sleepTrend')}</h2><div class="small t2">${t('sleepTrendSub')}</div></div>
      <div class="seg-ctl" role="tablist">${[7, 14, 30].map((n) => `<button role="tab" aria-selected="${S.sleepRange === n}" class="${S.sleepRange === n ? 'on' : ''}" data-range="${n}">${n} ${t('days')}</button>`).join('')}</div></div>
    <div class="legend-inline"><span><i style="background:var(--deep)"></i>${t('deep')}</span><span><i style="background:var(--rem)"></i>${t('rem')}</span><span><i style="background:var(--light)"></i>${t('light')}</span><span><i style="background:var(--awake)"></i>${t('awake')}</span></div>
    ${empty ? `<div class="empty" style="margin-top:12px">${t('noSleep')}</div>` : `<div class="chart scrollx" id="sleepChart"><div class="chart-plot"><canvas role="img" aria-label="${t('sleepTrend')}"></canvas></div></div>${S.sleepRange > 7 ? `<div class="meta" style="margin-top:4px">${t('scrollHint')}</div>` : ''}${dsel}`}
  </section>`;
}

function coachPreview() {
  const last = [...S.coachHist].reverse().find((m) => m.role === 'assistant' && !m.error);
  const sd = latestDayWith('sleep_minutes_asleep');
  const fresh = last && Date.now() - new Date(last.created_at).getTime() < 36 * 3600e3;
  return `<section class="card coach-preview">
    <div class="row between"><div class="row" style="gap:10px"><span class="badge accent">${ICO.coach}${t('coachYours')}</span>${S.demo ? `<span class="badge warn">${t('demo')}</span>` : ''}</div>${last ? `<span class="meta">${dt(last.created_at)}</span>` : ''}</div>
    <div class="msg-preview" style="margin-top:12px">${fresh ? md(last.content).split('</p>').slice(0, 2).join('</p>') : `<span class="t2">${sd ? t('coachEmpty') : t('coachMissing')}</span>`}</div>
    <div class="row" style="margin-top:14px">${sd && !fresh ? `<button class="primary" id="summBtn">${t('summarizeToday')}</button>` : ''}<button class="${sd && !fresh ? '' : 'primary'}" id="openCoach">${t('continueChat')}</button><span class="meta">${t('notDoctor')}</span></div>
  </section>`;
}

function connectPanel(kind) {
  if (kind === 'reconnect') return `<section class="callout warn"><div class="row between"><div><b>${t('reconnectTitle')}</b><div class="small t2">${t('reconnectSub')}</div></div><button class="primary" id="connectBtn">${t('reconnectBtn')}</button></div></section>`;
  return `<section class="card" style="max-width:640px"><h2>${t('connectTitle')}</h2><p class="t2" style="margin:8px 0 16px">${t('connectSub')}</p><button class="primary" id="connectBtn">${t('connectBtn')}</button></section>`;
}

function todayOverview() {
  const day = todayStr(), r = S.scores?.recovery?.find(x => x.day === day);
  const load = S.scores?.load?.find(x => x.day === day), sleep = val(day, 'sleep_minutes_asleep');
  const th = S.lang === 'th', score = r?.score ?? null, target = chk(day, 'goal.sleep')?.target;
  const readiness = ['ready', 'moderate', 'recover'].includes(r?.band) ? t('rec_' + r.band) : t('noData');
  const ring = (label, value, unit, color, progress, note, action) => `<button class="day-ring" ${action} style="--ring-color:${color}">
    <span class="ring-face"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-track" cx="60" cy="60" r="51"/>${progress !== null ? `<circle class="ring-progress" cx="60" cy="60" r="51" pathLength="100" stroke-dasharray="${Math.min(100, Math.max(0, progress))} 100"/>` : ''}</svg><span class="ring-value">${value}<small>${unit}</small></span></span>
    <strong>${label}</strong><span class="ring-note">${note}</span></button>`;
  return `<section class="card today-overview"><div class="day-rings">
    ${ring(th ? 'การนอน' : 'Sleep', sleep === null ? '—' : `${Math.floor(sleep / 60)}<small>${t('hrs')}</small>${Math.round(sleep % 60)}`, sleep === null ? '' : t('min'), 'var(--c-purple)', sleep !== null && target > 0 ? sleep / target * 100 : null, sleep === null ? t('todayMissing') : target > 0 ? `${th ? 'เป้าหมาย' : 'Goal'} ${hm(target)}` : dateS(day), `data-health-day="${day}"`)}
    ${ring('Recovery', score ?? '—', score === null ? '' : '/100', 'var(--c-teal)', score, score === null ? (r?.baselineDays >= 14 ? t('todayMissing') : `${th ? 'สะสมข้อมูล' : 'Building baseline'} ${r?.baselineDays ?? 0}/14 ${t('nights')}`) : readiness, `data-health-day="${day}"`)}
    ${ring(th ? 'ภาระกิจกรรม' : 'Activity load', load?.load == null ? '—' : num(load.load), load?.load == null ? '' : 'AZM', 'var(--c-orange)', null, load?.load == null ? t('todayMissing') : t('loadSoFar'), 'data-view="trends"')}
    </div><div class="readiness-line"><span><b>${th ? 'ความพร้อม' : 'Readiness'}</b> · ${score === null ? (th ? 'รอข้อมูลเพิ่มเติม' : 'Waiting for enough data') : readiness}<small class="readiness-source">${th ? 'แอปประเมินจาก Recovery' : 'Estimated by this app from Recovery'}</small></span><a href="#trends" data-view="trends">${t('details')} →</a></div></section>`;
}

function renderToday() {
  const conn = S.status?.connected, hasData = S.days.length > 0;
  let body = `<div class="greet"><div><h1>${greeting()}</h1><div class="t2">${new Date().toLocaleDateString(LOC(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div>${freshnessRow()}</div>`;
  if (!conn) body += connectPanel('connect');
  else if (S.status.needsReconnect) body += connectPanel('reconnect');
  if (!hasData) {
    body += conn ? `<section class="card"><h2>${t('noRecords')}</h2><p class="t2" style="margin:8px 0 16px">${t('noRecordsSub')}</p><button class="primary" id="fetchAgain" ${S.loading.refresh ? 'disabled' : ''}>${S.loading.refresh ? t('refreshing') : t('fetchAgain')}</button></section>` : '';
  } else {
    body += todayOverview();
    body += `<div class="grid12 today-details"><div class="span5">${sleepSummary()}</div><div class="span7"><div class="today-vitals">${VITALS.map(def => metricCard(def, todayStr())).join('')}</div></div></div>`;
  }
  body += coachPreview();
  body += `<div class="footer"><a href="#" data-view="settings" class="small muted">${t('footer')} →</a></div>`;
  $('#main').innerHTML = body;
  bindToday();
}

function bindToday() {
  bindHealth();
  $('#refreshBtn')?.addEventListener('click', refreshData);
  $('#fetchAgain')?.addEventListener('click', refreshData);
  $('#connectBtn')?.addEventListener('click', () => { location.href = `/auth/google/start?token=${encodeURIComponent(S.token)}`; });
  $('#openCoach')?.addEventListener('click', () => openCoach(true));
  $('#summBtn')?.addEventListener('click', () => { openCoach(true); sendChat(t('sugg')[0]); });
  document.querySelectorAll('#main [data-view]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); go(b.dataset.view); }));
  document.querySelectorAll('#main [data-range]').forEach((b) => (b.onclick = () => { S.sleepRange = +b.dataset.range; render(); }));
  document.querySelectorAll('#main a[data-day]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); openDay(a.dataset.day); }));
  document.querySelectorAll('#main .metric[data-metric]').forEach((b) => (b.onclick = () => openDay(latestDayWith(b.dataset.metric) || S.days[S.days.length - 1])));
  const vi = $('#vitalsInfo');
  if (vi) {
    const pop = vi.nextElementSibling;
    const close = () => { pop.hidden = true; vi.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', onDoc, true); };
    const onDoc = (e) => { if (!vi.parentElement.contains(e.target)) close(); };
    vi.onclick = (e) => { e.stopPropagation(); if (pop.hidden) { pop.hidden = false; vi.setAttribute('aria-expanded', 'true'); document.addEventListener('click', onDoc, true); } else close(); };
  }
  const sc = $('#sleepChart');
  if (sc) { sleepBars(sc, S.days.slice(-S.sleepRange)); sc.scrollLeft = sc.scrollWidth; }   // 2) start at the latest day; scroll left for history
}

async function refreshData(days = 7) {
  if (typeof days !== 'number') days = 7;
  if (S.loading.refresh) return;
  S.loading.refresh = true; S.err.refresh = ''; render();
  try {
    const r = await api(`/api/refresh?days=${days}`, { method: 'POST' });
    const bad = r.perType.filter((x) => !x.ok);
    if (bad.length) S.err.refresh = `${t('partialFetch')}: ${bad.map((x) => `${x.dataType} (${x.error ? x.error.slice(0, 60) : x.httpStatus})`).join(', ')}`;
    await api('/api/scores/recompute', { method: 'POST' }).catch(() => {});
    await loadCore();
  } catch (e) { S.err.refresh = e.message; }
  S.loading.refresh = false; render();
}

/* ================= day detail drawer ================= */
/* ================= day detail (human-readable) ================= */
const BASE_FLOOR = { hrv_avg_ms: 3, rhr_bpm: 2, spo2_avg_pct: 0.7, respiratory_rate_bpm: 0.5, sleeping_hr_bpm: 2 };
function personalBand(day, m) {
  const xs = S.days.filter((x) => x < day).slice(-14).map((x) => val(x, m)).filter((x) => x !== null);
  if (xs.length < MIN_BASE) return { n: xs.length };
  const mu = mean(xs), sd = Math.sqrt(xs.reduce((a, x) => a + (x - mu) ** 2, 0) / xs.length), w = Math.max(sd, BASE_FLOOR[m] ?? 1);
  return { n: xs.length, mu, lo: mu - w, hi: mu + w };
}
/** Range bar: band [lo,hi] tinted, marker at v; scale is padded around both. */
function rangeBar(v, lo, hi, fmt, opts = {}) {
  const pad = Math.max((hi - lo) * 0.6, opts.minPad ?? 0.5);
  const a = Math.min(lo, v) - pad, b = Math.max(hi, v) + pad, pct = (x) => (((x - a) / (b - a)) * 100).toFixed(1);
  return `<div class="range"><span class="band" style="left:${pct(lo)}%;width:${(((hi - lo) / (b - a)) * 100).toFixed(1)}%"></span><i class="mk" style="left:${pct(v)}%"></i><span class="lab" style="left:${pct(lo)}%">${fmt(lo)}</span><span class="lab" style="left:${pct(hi)}%">${fmt(hi)}</span></div>`;
}
const PERSONAL_RULE = { hrv_avg_ms: 'personal.hrv', rhr_bpm: 'personal.rhr', spo2_avg_pct: 'personal.spo2', respiratory_rate_bpm: 'personal.rr', sleeping_hr_bpm: 'personal.sleeping_hr' };
function vitalRow(def, day) {
  const v = val(day, def.m); if (v === null) return '';
  const rc = chk(day, PERSONAL_RULE[def.m]); const f = (x) => num(x, def.dec);
  if (rc) {   // server-evaluated rule: band, level and text all come from the rules table
    const has = rc.band && Number.isFinite(rc.band.lo);
    const bar = has ? rangeBar(v, rc.band.lo, rc.band.hi, f, { minPad: BASE_FLOOR[def.m] }) : `<div class="range"><i class="mk" style="left:50%"></i></div>`;
    const chip = has ? lvlBadge(rc) : `<span class="badge">${t('collecting')} (${rc.band?.n ?? 0}/${MIN_BASE})</span>`;
    const rangeTxt = has ? `${t('yourRange')} ${f(rc.band.lo)}–${f(rc.band.hi)} ${def.unit}` : '';
    let hint = has ? (/^(Within|อยู่ในช่วง)/.test(rc.text?.en || '') || /^อยู่ในช่วง/.test(rc.text?.th || '') ? rangeTxt : `${ruleText(rc)} · ${rangeTxt}`) : t('needMore');
    if (def.hint) hint = `${def.hint(day)} · ${hint}`;
    return `<div class="vrow" style="--mc:${def.c}"><span class="nm">${t(def.k)}</span><span class="vv">${f(v)}<small>${def.unit}</small></span>${bar}<span class="st">${chip}</span><span class="hint">${hint}</span></div>`;
  }
  const b = personalBand(day, def.m);
  let status = '', chip = `<span class="badge">${t('collecting')} (${b.n}/${MIN_BASE})</span>`, bar = `<div class="range"><i class="mk" style="left:50%"></i></div>`, hint = t('needMore');
  if (b.lo !== undefined) {
    status = v > b.hi ? 'above' : v < b.lo ? 'below' : 'within';
    chip = `<span class="badge ${status === 'within' ? 'ok' : 'warn'}">${t(status)}</span>`;
    bar = rangeBar(v, b.lo, b.hi, f, { minPad: BASE_FLOOR[def.m] });
    hint = status === 'within' ? `${t('yourRange')} ${f(b.lo)}–${f(b.hi)} ${def.unit}` : (I18N[S.lang][`hint_${def.k}_${status}`] || `${t('yourRange')} ${f(b.lo)}–${f(b.hi)} ${def.unit}`);
  }
  if (def.hint) hint = `${def.hint(day)}${b.lo !== undefined ? ` · ${t('yourRange')} ${f(b.lo)}–${f(b.hi)} ${def.unit}` : ''}`;
  return `<div class="vrow" style="--mc:${def.c}"><span class="nm">${t(def.k)}</span><span class="vv">${f(v)}<small>${def.unit}</small></span>${bar}<span class="st">${chip}</span><span class="hint">${hint}</span></div>`;
}
const STAGE_TYPICAL = { deep: [13, 23], rem: [20, 25], light: [45, 60] };   // % of time asleep, common adult ranges (approximate)
function sleepStory(day) {
  const asleep = val(day, 'sleep_minutes_asleep'); if (asleep === null) return `<div class="empty">${t('noDay')}</div>`;
  const row = S.byDay[day].sleep_minutes_asleep, eff = val(day, 'sleep_efficiency_pct'), awake = val(day, 'sleep_minutes_awake');
  const tib = val(day, 'sleep_minutes_in_period'), lat = val(day, 'sleep_latency_min'), nap = val(day, 'sleep_nap_minutes') || 0, tot2 = val(day, 'sleep_total_asleep_minutes');
  const deep = val(day, 'sleep_deep_minutes'), rem = val(day, 'sleep_rem_minutes'), light = val(day, 'sleep_light_minutes');
  const b = base7(day, 'sleep_minutes_asleep'), delta = b === null ? null : asleep - b;
  const effC = chk(day, 'sleep.efficiency'), durC = chk(day, 'sleep.duration'), latC = chk(day, 'sleep.latency'), goalC = chk(day, 'goal.sleep');
  const effWord = effC ? t('lvl_' + effC.level) : eff === null ? '' : eff >= 85 ? t('effGood') : eff >= 75 ? t('effOk') : t('effLow');
  const effCls = effC ? lvlCls(effC.level) : eff === null ? '' : eff >= 85 ? 'ok' : eff >= 75 ? '' : 'warn';
  const stagesTot = [deep, rem, light].filter((x) => x !== null).reduce((a, x) => a + x, 0);
  const stageRow = (k, v, c) => { if (v === null || !stagesTot) return ''; const rc = chk(day, 'sleep.stage.' + k); const pct = (v / stagesTot) * 100; const [lo, hi] = rc?.good?.lo != null ? [rc.good.lo, rc.good.hi] : STAGE_TYPICAL[k]; const st = pct < lo ? 'below' : pct >= hi ? 'above' : 'within';
    return `<div class="vrow" style="--mc:${c}"><span class="nm">${t(k)}</span><span class="vv">${num(v)}<small>${t('minutes')} · ${pct.toFixed(0)}%</small></span>${rangeBar(pct, lo, hi, (x) => `${Number.isInteger(x) ? x : x.toFixed(1)}%`, { minPad: 5 })}<span class="st">${rc ? lvlBadge(rc) : `<span class="badge ${st === 'within' ? 'ok' : ''}">${t(st)}</span>`}</span><span class="hint">${rc ? ruleText(rc) : `${t('typical')} ${lo}–${hi}% ${t('ofSleep')}`}</span></div>`; };
  return `
    <div class="hero-val" style="font-size:40px;line-height:48px;margin:0">${Math.floor(asleep / 60)}<small>${t('hrs')}</small>${Math.round(asleep % 60)}<small>${t('min')}</small></div>
    <div class="story">${t('storySlept')} <b>${hm(asleep)}</b> · ${clock(row?.measured_start)} → ${clock(row?.measured_end)}${durC ? ` ${lvlBadge(durC)} <span class="muted">${ruleText(durC)}</span>` : ''}<br>
      ${delta === null ? t('storyBase') : `<b>${hm(Math.abs(delta))}</b> ${delta >= 0 ? t('storyMore') : t('storyLess')}`}${eff !== null ? ` · ${t('efficiency')} <b title="${esc(effC?.source || t('effDef'))}">${eff.toFixed(0)}%</b> <span class="badge ${effCls}">${effWord}</span>` : ''}${awake !== null ? ` · ${t('awakeFor')} <b>${num(awake)} ${t('minutes')}</b>` : ''}${row?.status === 'partial' ? ` · ${t('multiSession')}` : ''}<br>
      ${[tib !== null ? `${t('timeInBed')} <b>${hm(tib)}</b>` : '', lat !== null ? `${t('fellAsleepIn')} <b>${num(lat)} ${t('minutes')}</b>${latC && latC.level !== 'good' ? ` ${lvlBadge(latC)}` : ''}` : '', nap ? `${t('napsLabel')} <b>${hm(nap)}</b> · ${t('totalInclNaps')} <b>${hm(tot2)}</b>` : ''].filter(Boolean).join(' · ')}</div>
    ${goalC ? `${goalBar(goalC)}<div class="meta">${ruleText(goalC)}</div>` : ''}
    ${stagesTot ? `<div class="stage-bar" style="margin:4px 0 0">${[[deep, 'var(--deep)'], [rem, 'var(--rem)'], [light, 'var(--light)'], [awake, 'var(--awake)']].map(([v, c]) => (v ? `<span style="width:${((v / (stagesTot + (awake || 0))) * 100).toFixed(1)}%;background:${c}"></span>` : '')).join('')}</div>
    ${stageRow('deep', deep, 'var(--deep)')}${stageRow('rem', rem, 'var(--rem)')}${stageRow('light', light, 'var(--light)')}` : `<div class="small muted">${t('noStages')}</div>`}`;
}
function activityStory(day) {
  const steps = val(day, 'steps'), azm = val(day, 'active_zone_minutes'), exm = val(day, 'exercise_minutes');
  const zones = [['zoneFat', val(day, 'azm_fat_burn_min'), 'var(--c-yellow)'], ['zoneCardio', val(day, 'azm_cardio_min'), 'var(--c-orange)'], ['zonePeak', val(day, 'azm_peak_min'), 'var(--c-red)']].filter((z) => z[1] !== null && z[1] > 0);
  const zTot = zones.reduce((a, z) => a + z[1], 0);
  const sess = S.exercise.filter((e) => String(e.day).slice(0, 10) === day);
  const l = (S.scores?.load || []).find((x) => x.day === day);
  if (steps === null && azm === null && !sess.length && !l) return `<div class="empty">${t('noActivity')}</div>`;
  return `
    <div class="kpi3"><div><b style="color:var(--c-yellow)">${steps === null ? '—' : num(steps)}</b><span>${t('steps')}</span></div><div><b style="color:var(--c-orange)">${azm === null ? '—' : num(azm)}</b><span>${t('azm')}</span></div><div><b style="color:var(--c-teal)">${exm === null ? (sess.length ? num(sess.reduce((a, e) => a + (+e.active_min || 0), 0)) : '—') : num(exm)}</b><span>${t('exerciseMin')}</span></div></div>
    ${(() => { const sc = chk(day, 'goal.steps'), ac = chk(day, 'goal.azm_week') || chk(day, 'activity.azm_week'), st = chk(day, 'activity.steps'); return [sc ? `${goalBar(sc)}<div class="meta">${ruleText(sc)}</div>` : st ? `<div class="small">${lvlBadge(st)} <span class="t2">${ruleText(st)}</span></div>` : '', ac ? (ac.kind === 'goal' ? `<div class="small t2" style="margin-top:6px">${t('weekTotal')}: ${num(ac.value)} ${t('minutes')}</div>${goalBar(ac)}<div class="meta">${ruleText(ac)}</div>` : `<div class="small" style="margin-top:6px">${t('weekTotal')}: <b>${num(ac.value)} ${t('minutes')}</b> ${lvlBadge(ac)} <span class="t2">${ruleText(ac)}</span></div>`) : ''].join(''); })()}
    ${zTot ? `<div class="zones">${zones.map((z) => `<span style="width:${((z[1] / zTot) * 100).toFixed(1)}%;background:${z[2]}"></span>`).join('')}</div><div class="legend-inline" style="margin-top:6px">${zones.map((z) => `<span><i style="background:${z[2]}"></i>${t(z[0])} ${num(z[1])} ${t('minutes')}</span>`).join('')}</div>` : ''}
    ${sess.length ? sess.map((e) => `<div class="sess"><span class="ic">${ICO.pulse}</span><b>${esc(e.display_name || e.exercise_type || '—')}</b><span class="meta">${clock(e.started_at)} · ${e.active_min ?? '—'} ${t('minutes')}${e.avg_hr ? ` · ${t('avgHr')} ${e.avg_hr}` : ''}${e.azm ? ` · ${e.azm} AZM` : ''}</span></div>`).join('') : `<div class="small muted">${t('noSessions')}</div>`}
    ${l ? `<div class="vrow" style="--mc:var(--c-purple)"><span class="nm">${t('loadDay')}</span><span class="vv">${l.load === null ? '—' : num(l.load)}<small>${esc(l.source || '')}</small></span><div class="small t2" style="grid-column:2">${t('acute')} ${num(l.acute, 1) ?? '—'} · ${t('chronic')} ${num(l.chronic, 1) ?? '—'}</div><span class="st">${l.acwr !== null ? `<span class="badge ${l.acwrBand === 'spike' ? 'warn' : ''}">${t('band_' + l.acwrBand)} · ${l.acwr}</span>` : `<span class="badge">${t('needs28')}</span>`}</span></div>` : ''}`;
}
async function openDay(day) {
  const dr = $('#drawer');
  dr.setAttribute('aria-label', t('dayDetail'));
  const sec = (k, color, inner) => `<section class="sec" style="--sc:${color}"><h3><i></i>${t(k)}</h3>${inner}</section>`;
  const idx = S.days.indexOf(day), prev = idx > 0 ? S.days[idx - 1] : null, next = idx >= 0 && idx < S.days.length - 1 ? S.days[idx + 1] : null;
  dr.innerHTML = `<div class="head"><button class="icon-btn ghost" id="drClose" aria-label="${t('close')}">${ICO.back}</button><div class="grow"><b>${t('dayDetail')}</b><span class="meta">${dateS(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
      <div class="seg-ctl daynav"><button id="dPrev" ${prev ? '' : 'disabled'} aria-label="${t('prevDay')}" title="${prev ? dateS(prev) : ''}">‹</button><button id="dNext" ${next ? '' : 'disabled'} aria-label="${t('nextDay')}" title="${next ? dateS(next) : ''}">›</button></div><button class="sm primary" id="askDay">${t('askCoachDay')}</button></div>
    <div class="msgs det">
      ${recoveryBlock(day)}
      ${sec('secSleep', 'var(--deep)', sleepStory(day))}
      ${sec('secVitals', 'var(--c-teal)', ([{ m: 'sleeping_hr_bpm', k: 'sleepHr', unit: 'bpm', dec: 0, c: 'var(--c-orange)', hint: (dd) => { const x = det(dd, 'sleeping_hr_bpm'); return x?.coveragePct !== undefined ? `${t('sleepHrHint')} · ${t('coverageOf')} ${x.coveragePct}%` : t('sleepHrHint'); } }, ...VITALS]).map((v) => vitalRow(v, day)).join('') || `<div class="small muted">${t('noData')}</div>`)}
      ${sec('secAct', 'var(--c-orange)', activityStory(day))}
      <details class="raw" id="rawDet"><summary>${t('dataLog')}</summary><div id="rawBody" class="small muted">…</div></details>
    </div>`;
  if (!dr.classList.contains('on')) openDrawer(true);
  $('#drClose').onclick = () => openDrawer(false);
  $('#dPrev').onclick = () => prev && openDay(prev); $('#dNext').onclick = () => next && openDay(next);
  $('#askDay').onclick = () => { openCoach(true); sendChat(S.lang === 'th' ? `สรุปข้อมูลของวันที่ ${dateS(day, { day: 'numeric', month: 'long' })} ให้หน่อย` : `Summarise my data for ${dateS(day, { day: 'numeric', month: 'long' })}`); };
  $('#rawDet').addEventListener('toggle', async () => {
    if (!$('#rawDet').open || $('#rawBody').dataset.loaded) return;
    const d = await api(`/api/days/${day}`).catch((e) => ({ error: e.message, metrics: [], missing: [] }));
    $('#rawBody').dataset.loaded = '1';
    $('#rawBody').innerHTML = `<div style="margin-bottom:8px">${d.missing?.length ? `${t('missing')} ${d.missing.length}: <span class="t2">${esc(d.missing.join(', '))}</span>` : `<span class="badge ok">${ICO.check}${t('all')}</span>`}</div>
      <div class="tbl"><table><thead><tr><th>metric</th><th class="num">value</th><th>${t('status')}</th><th>${t('measured')}</th></tr></thead><tbody>
      ${(d.metrics || []).map((m) => `<tr><td>${esc(m.metric)}</td><td class="num">${m.unit === 'iso8601' ? esc(dt(m.details?.iso)) : m.status === 'missing' || m.value === null ? '—' : `${num(m.value, 1)} <span class="muted">${esc(m.unit)}</span>`}</td><td class="${m.status === 'ok' ? '' : 'muted'}">${esc(m.status)}${m.status_reason ? ` · ${esc(m.status_reason)}` : ''}</td><td class="muted">${m.measured_start ? `${clock(m.measured_start)}–${clock(m.measured_end)}` : ''}</td></tr>`).join('')}
      </tbody></table></div><div style="margin-top:8px"><a href="#" id="toLog" class="small">${t('openDataLog')} →</a></div>`;
    $('#toLog').onclick = (e) => { e.preventDefault(); openDrawer(false); go('settings'); };
  });
}

let lastFocus = null;
function openDrawer(on) {
  const dr = $('#drawer'), sc = $('#scrim');
  if (on) { lastFocus = document.activeElement; dr.classList.add('on'); sc.classList.add('on'); document.body.style.overflow = 'hidden'; setTimeout(() => dr.querySelector('button,textarea,input')?.focus(), 50); }
  else { dr.classList.remove('on'); sc.classList.remove('on'); document.body.style.overflow = ''; S.coachOpen = false; lastFocus?.focus?.(); if (location.hash === '#coach') history.replaceState(null, '', '#' + S.view); }
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#drawer')?.classList.contains('on')) openDrawer(false); });

/* ================= coach ================= */
function md(s) {
  const lines = esc(s).split('\n'); let html = '', inList = false;
  for (const ln of lines) {
    const b = ln.match(/^\s*[-•*]\s+(.*)/);
    if (b) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${b[1]}</li>`; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    if (ln.trim()) html += `<p>${ln.replace(/^#+\s*/, '')}</p>`;
  }
  if (inList) html += '</ul>';
  return html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}
function refChips() {
  const refs = [];
  if (latestDayWith('sleep_minutes_asleep')) refs.push(t('refLastSleep'));
  if (S.days.filter((d) => val(d, 'hrv_avg_ms') !== null).length >= 3) refs.push(t('refHrv7'));
  if (S.scores?.recovery?.[S.scores.recovery.length - 1]?.score !== null && S.scores?.recovery?.length) refs.push(t('refRecovery'));
  return refs.length ? `<div class="refs">${refs.map((r) => `<span class="badge">${esc(r)}</span>`).join('')}</div>` : '';
}
function msgEl(role, text, opts = {}) {
  const el = document.createElement('div');
  el.className = `msg ${role === 'user' ? 'user' : 'ai'}${opts.error ? ' err' : ''}`;
  el.innerHTML = (role === 'user' ? esc(text) : md(text)) + (role === 'assistant' && !opts.error && opts.refs ? refChips() : '') + (opts.time ? `<span class="time">${esc(dt(opts.time))}</span>` : '');
  return el;
}
function openCoach(on) {
  if (!on) { openDrawer(false); return; }
  S.coachOpen = true; history.replaceState(null, '', '#coach');
  const dr = $('#drawer');
  dr.innerHTML = `<div class="head" style="position:relative">
      <button class="icon-btn ghost" id="drClose" aria-label="${t('back')}">${ICO.back}</button>
      <div class="grow"><b>${t('coachYours')}</b><span class="meta">${S.demo ? `<span class="badge warn">${t('demo')}</span> ` : ''}${S.coachInfo && !S.coachInfo.configured ? t('coachOff') : t('notDoctor')}</span></div>
      <button class="icon-btn ghost" id="moreBtn" aria-label="menu" aria-haspopup="menu">${ICO.more}</button>
      <div class="menu" id="menu" hidden role="menu"><button role="menuitem" id="clearBtn">${t('clearChat')}</button></div>
    </div>
    <div class="msgs" id="msgs"></div>
    <div class="sugg" id="sugg">${t('sugg').map((s) => `<button class="chip">${esc(s)}</button>`).join('')}<span class="meta" style="align-self:center">${t('rememberHint')}</span></div>
    <div class="compose"><textarea id="chatIn" rows="1" placeholder="${t('askPh')}" aria-label="${t('askPh')}"></textarea><button class="primary icon-btn" id="sendBtn" aria-label="${t('send')}">${ICO.send}</button></div>`;
  const box = $('#msgs');
  if (!S.coachHist.length) box.innerHTML = `<div class="empty">${t('coachEmpty')}</div>`;
  for (const m of S.coachHist) box.appendChild(msgEl(m.role, m.content, { time: m.created_at, error: !!m.error, refs: true }));
  openDrawer(true); box.scrollTop = box.scrollHeight;
  $('#drClose').onclick = () => openDrawer(false);
  $('#moreBtn').onclick = () => { $('#menu').hidden = !$('#menu').hidden; };
  $('#clearBtn').onclick = async () => { $('#menu').hidden = true; if (!confirm(t('clearConfirm'))) return; await api('/api/coach/messages', { method: 'DELETE' }); S.coachHist = []; openCoach(true); };
  dr.querySelectorAll('.chip').forEach((b) => (b.onclick = () => sendChat(b.textContent)));
  const ta = $('#chatIn');
  const autosize = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; };
  ta.addEventListener('input', autosize);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(ta.value); } });
  $('#sendBtn').onclick = () => sendChat(ta.value);
}
let streaming = false;
async function sendChat(text) {
  text = (text || '').trim(); if (!text || streaming) return;
  if (!S.coachOpen) openCoach(true);
  streaming = true; const box = $('#msgs'), ta = $('#chatIn'), send = $('#sendBtn'); if (ta) { ta.value = ''; ta.style.height = 'auto'; } if (send) send.disabled = true;
  box.querySelector('.empty')?.remove();
  box.appendChild(msgEl('user', text, { time: Date.now() }));
  const typing = document.createElement('div'); typing.className = 'msg ai typing'; typing.innerHTML = '<i></i><i></i><i></i>'; box.appendChild(typing); box.scrollTop = box.scrollHeight;
  let el = null, acc = '';
  try {
    const res = await fetch('/api/coach/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': S.token }, body: JSON.stringify({ message: text, lang: S.lang, clock: S.clock }) });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx; while ((idx = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
        if (!chunk.startsWith('data:')) continue;
        const j = JSON.parse(chunk.slice(5));
        if (j.delta) { if (!el) { typing.remove(); el = msgEl('assistant', ''); box.appendChild(el); } acc += j.delta; el.innerHTML = md(acc); box.scrollTop = box.scrollHeight; }
        if (j.error) { typing.remove(); box.appendChild(msgEl('assistant', j.error, { error: true })); }
      }
    }
    if (el) { el.innerHTML = md(acc) + refChips() + `<span class="time">${esc(dt(Date.now()))}</span>`; }
    S.coachHist = await api('/api/coach/messages').catch(() => S.coachHist);
  } catch (e) {
    typing.remove();
    const er = msgEl('assistant', e.message, { error: true }); const rb = document.createElement('button'); rb.className = 'sm'; rb.textContent = t('retry'); rb.onclick = () => { er.remove(); sendChat(text); }; er.appendChild(rb); box.appendChild(er);
  } finally { streaming = false; if (send) send.disabled = false; ta?.focus(); }
}

/* ================= trends view ================= */
function renderTrends() {
  const rec = S.scores?.recovery || [], load = S.scores?.load || [];
  const ins = S.insights, surfaced = ins?.insights?.filter((i) => i.surfaced) || [], collecting = (() => { const m = new Map(); for (const i of ins?.insights || []) if (i.nTagged > 0 && i.nTagged < 5) m.set(i.tag, Math.max(m.get(i.tag) || 0, i.nTagged)); return [...m.entries()]; })();
  const tags = Object.keys(I18N.th).filter((k) => k.startsWith('tag_')).map((k) => k.slice(4));
  const jt = S.journalToday?.tags || [];
  const fit = S.fitness, bio = S.bio, sw = S.strengthWeekly || [];
  const insightText = (i) => `${t('onDays')} <b>${t('tag_' + i.tag)}</b> (${i.nTagged}) — ${t('nextMorning')} ${esc(i.label)} ${Math.abs(i.diff) >= 0 ? (i.diff >= 0 ? t('higher') : t('lower')) : ''} <b>${num(Math.abs(i.diff), 1)} ${esc(i.unit)}</b> vs ${i.nUntagged} ${t('otherDays')} <span class="meta">(g ${i.g}, 95% CI ${i.ci ? `${i.ci.lo}…${i.ci.hi}` : '—'})</span>`;
  $('#main').innerHTML = `
  <div class="greet"><div><h1>${t('trends')}</h1><div class="t2">${S.days[0] ? `${dateS(S.days[0])} → ${dateS(S.days[S.days.length - 1])}` : ''}</div></div>${freshnessRow()}</div>
  ${healthMonitor()}
  <details class="trend-recovery"><summary>${t('recoveryDetails')}</summary>${recoveryBlock(todayStr())}</details>
  ${sleepHistory()}
  ${activityBlock()}
  <div class="grid12">
    <section class="card span6 chart" id="recChart"><div class="section-head"><div><h2>${t('recovery')}</h2><div class="small t2">${t('recoverySub')}</div></div>${S.scores?.versions ? `<span class="meta">${S.scores.versions.recovery}</span>` : ''}</div>
      ${rec.some((r) => r.score !== null) ? `<div class="chart-plot sm"><canvas role="img"></canvas></div>` : `<div class="empty">${t('rec_insufficient')} · ${t('needNights')}${rec.length ? ` · ${t('have')} ${rec[rec.length - 1].baselineDays}` : ''}</div>`}</section>
    <section class="card span6 chart" id="loadChart"><div class="section-head"><div><h2>${t('cardioLoad')}</h2><div class="small t2">${t('loadNote')}</div></div>${S.scores?.versions ? `<span class="meta">${S.scores.versions.load}</span>` : ''}</div>
      ${load.some((l) => l.acute !== null) ? `<div class="chart-plot sm"><canvas role="img"></canvas></div><div class="legend-inline"><span><i style="background:var(--trend)"></i>${t('acute')}</span><span><i style="background:var(--baseline)"></i>${t('chronic')}</span></div>` : `<div class="empty">${t('noData')}</div>`}</section>

    <section class="card span7"><div class="section-head"><div><h2>${t('weeklyInsights')}</h2><div class="small t2">${t('insightsSub')}</div></div>${ins ? `<span class="meta">${ins.version}</span>` : ''}</div>
      ${surfaced.length ? `<div class="list">${surfaced.slice(0, 3).map((i) => `<div class="item"><span>${insightText(i)}</span><span class="meta">${t('assoc')}</span></div>`).join('')}</div>` : `<div class="empty">${t('insightNone')}</div>`}
      ${collecting.length ? `<div class="meta" style="margin-top:12px">${t('collectingTags')}: ${collecting.map(([tag, n]) => `${t('tag_' + tag)} ${n}/5`).slice(0, 8).join(' · ')} <span class="muted">(${t('needTagged')})</span></div>` : ''}</section>
    <section class="card span5"><div class="section-head"><div><h2>${t('journal')}</h2><div class="small t2">${t('journalSub')}</div></div><span class="meta">${dateS(todayStr())}</span></div>
      <div class="chips" id="tagChips">${tags.map((g) => `<button class="chip ${jt.includes(g) ? 'on' : ''}" data-tag="${g}" aria-pressed="${jt.includes(g)}">${t('tag_' + g)}</button>`).join('')}</div>
      <div class="form" style="margin-top:12px"><input id="jnote" placeholder="${t('note')}" value="${esc(S.journalToday?.note || '')}"><div class="row"><button class="primary sm" id="jsave">${t('save')}</button><span class="meta" id="jstatus"></span></div></div></section>

    <section class="card span6 chart" id="vo2Chart"><div class="section-head"><div><h2>${t('fitness')}</h2><div class="small t2">${t('vo2')}</div></div>${fit?.latestVo2max ? `<span class="badge">${num(fit.latestVo2max.value, 1)} ml/kg/min</span>` : ''}</div>
      ${fit?.vo2max?.length ? `<div class="chart-plot sm"><canvas role="img"></canvas></div>` : `<div class="empty">${t('noVo2')}</div>`}
      <div class="rule"></div><div class="row between"><div><div class="label">${t('fitnessAge')}</div><div class="small t2">${t('fitnessAgeSub')}</div></div><div style="font-size:28px;font-weight:600">${fit?.fitnessAge ?? '—'}${fit?.fitnessAge ? `<small class="small t2"> ${t('years')}</small>` : ''}</div></div>
      ${fit?.needsProfile ? `<div class="meta" style="margin-top:6px"><a href="#" data-view="settings">${t('needProfile')}</a></div>` : ''}
      ${fit?.sessions?.length ? `<div class="meta" style="margin-top:8px">${t('sessions')}: ${fit.sessions.length}</div>` : ''}</section>
    <section class="card span6"><div class="section-head"><div><h2>${t('bioAge')}</h2><div class="small t2">${t('bioAgeSub')}</div></div>${bio?.phenoAgeVersion ? `<span class="meta">${bio.phenoAgeVersion}</span>` : ''}</div>
      ${bio?.phenoAge?.length && bio.phenoAge[0].phenoAge !== null ? (() => { const p = bio.phenoAge[0]; return `<div class="row between"><div><div class="label">${t('phenoAge')}</div><div style="font-size:32px;font-weight:600">${p.phenoAge}<small class="small t2"> ${t('years')}</small></div></div><div><div class="label">${t('accel')}</div><div class="small">${p.accel > 0 ? `+${p.accel} ${t('years')} ${t('older')}` : `${Math.abs(p.accel)} ${t('years')} ${t('younger')}`}</div></div><div class="meta">${t('drawnOn')} ${dateS(p.drawnOn)}</div></div>`; })() : `<div class="empty">${bio?.needsProfile ? t('needProfile') : t('noPanel')}</div>`}
      <div class="meta" style="margin-top:12px">${t('panelNote')}</div></section>

    <section class="card span12"><div class="section-head"><div><h2>${t('strength')}</h2><div class="small t2">${t('strengthSub')}</div></div><button class="sm" id="addStrength">${t('addSession')}</button></div>
      ${sw.length ? `<div class="tbl"><table><thead><tr><th>${t('week')}</th><th class="num">${t('tonnage')}</th><th class="num">${t('hardSets')}</th><th class="num">${t('sessions')}</th><th>${t('e1rm')}</th></tr></thead><tbody>${sw.slice(-8).reverse().map((w) => `<tr><td>${dateS(w.weekStart)}</td><td class="num">${num(w.tonnage)} kg</td><td class="num">${w.hardSets}</td><td class="num">${w.sessions}</td><td>${Object.entries(w.bestE1rm).map(([e, v]) => `${esc(e)} ${num(v, 1)}`).join(' · ') || '—'}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${t('noStrength')}</div>`}
      <div id="strengthForm" hidden style="margin-top:16px"></div></section>
  </div>`;
  bindTrends(rec, load);
}
function bindTrends(rec, load) {
  bindHealth();
  document.querySelectorAll('#main [data-range]').forEach(b => b.onclick = () => { S.sleepRange = +b.dataset.range; render(); });
  document.querySelectorAll('#main a[data-day]').forEach(a => a.onclick = e => { e.preventDefault(); openDay(a.dataset.day); });
  const sc = $('#sleepChart'); if (sc) { sleepBars(sc, S.days.slice(-S.sleepRange)); sc.scrollLeft = sc.scrollWidth; }
  document.querySelectorAll('#main [data-view]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); go(b.dataset.view); }));
  $('#refreshBtn')?.addEventListener('click', refreshData);
  const rc = $('#recChart'); if (rc?.querySelector('canvas')) lineChart(rc, [{ label: t('recovery'), color: 'var(--c-teal)', values: rec.map((r) => ({ day: r.day, v: r.score })), dots: true }], { min: 0, max: 100, bands: [[0, 33, 'var(--c-red)'], [33, 67, 'var(--c-yellow)'], [67, 100, 'var(--c-teal)']] });
  const lc = $('#loadChart'); if (lc?.querySelector('canvas')) lineChart(lc, [{ label: t('acute'), color: 'var(--c-orange)', values: load.map((l) => ({ day: l.day, v: l.acute })) }, { label: t('chronic'), color: 'var(--baseline)', dash: true, values: load.map((l) => ({ day: l.day, v: l.chronic })) }], { min: 0, fmt: (v) => Math.round(v) });
  const vc = $('#vo2Chart'); if (vc?.querySelector('canvas') && S.fitness?.vo2max?.length) lineChart(vc, [{ label: 'VO₂max', color: 'var(--c-blue)', unit: 'ml/kg/min', values: S.fitness.vo2max.map((p) => ({ day: p.day, v: p.value })), dots: true }], { fmt: (v) => v.toFixed(0) });
  // journal
  const selected = new Set(S.journalToday?.tags || []);
  document.querySelectorAll('#tagChips .chip').forEach((b) => (b.onclick = () => { const g = b.dataset.tag; selected.has(g) ? selected.delete(g) : selected.add(g); b.classList.toggle('on'); b.setAttribute('aria-pressed', selected.has(g)); }));
  $('#jsave').onclick = async () => { const st = $('#jstatus'); try { S.journalToday = await api(`/api/journal/${todayStr()}`, { method: 'PUT', body: JSON.stringify({ tags: [...selected], note: $('#jnote').value }) }); st.textContent = t('saved'); S.insights = await api('/api/insights').catch(() => S.insights); } catch (e) { st.textContent = e.message; } };
  // strength form
  $('#addStrength').onclick = () => { const f = $('#strengthForm'); f.hidden = !f.hidden; if (!f.hidden) renderStrengthForm(f); };
}
function renderStrengthForm(f) {
  const row = () => `<div class="setrow"><div class="f"><label>${t('exercise')}</label><input class="ex" placeholder="squat"></div><div class="f"><label>${t('reps')}</label><input class="reps" type="number" min="1" value="5"></div><div class="f"><label>${t('load')}</label><input class="load" type="number" min="0" step="0.5" value="0"></div><div class="f"><label>${t('rpe')}</label><input class="rpe" type="number" min="6" max="10" step="0.5"></div><label class="row small" style="min-height:44px"><input type="checkbox" class="wu" style="min-height:0;width:18px">${t('warmup')}</label></div>`;
  f.innerHTML = `<div class="form"><div class="row"><div class="f"><label>${t('dayDetail')}</label><input id="sday" type="date" value="${todayStr()}"></div></div><div id="sets">${row()}${row()}${row()}</div><div class="row"><button class="sm" id="moreSet">${t('addSet')}</button><button class="primary sm" id="saveStrength">${t('save')}</button><span class="meta" id="sstatus"></span></div></div>`;
  $('#moreSet').onclick = () => $('#sets').insertAdjacentHTML('beforeend', row());
  $('#saveStrength').onclick = async () => {
    const sets = [...f.querySelectorAll('.setrow')].map((r) => ({ exercise: r.querySelector('.ex').value.trim(), reps: +r.querySelector('.reps').value, load_kg: +r.querySelector('.load').value, rpe: r.querySelector('.rpe').value ? +r.querySelector('.rpe').value : null, is_warmup: r.querySelector('.wu').checked })).filter((s) => s.exercise && s.reps > 0);
    try { await api('/api/strength/sessions', { method: 'POST', body: JSON.stringify({ day: $('#sday').value, sets }) }); await loadTrends(); renderTrends(); } catch (e) { $('#sstatus').textContent = e.message; }
  };
}

/* ================= settings view ================= */
function renderSettings() {
  const s = S.status, p = S.profile || {}, info = S.coachInfo;
  $('#main').innerHTML = `
  <div class="greet"><div><h1>${t('settings')}</h1></div></div>
  <div class="grid12">
    <section class="card span6"><h2>${t('setAccess')}</h2><div class="rule"></div><div class="row between"><span class="t2 small">${t('accessCode')} ••••••••</span><button class="sm" id="signOut">${t('signOut')}</button></div></section>
    <section class="card span6"><h2>${t('setPrefs')}</h2><div class="rule"></div>
      <div class="form cols"><div class="f"><label>${t('language')}</label><select id="langSel"><option value="th" ${S.lang === 'th' ? 'selected' : ''}>ไทย</option><option value="en" ${S.lang === 'en' ? 'selected' : ''}>English</option></select></div>
      <div class="f"><label>${t('theme')}</label><select id="themeSel">${['system', 'dark', 'light'].map((x) => `<option value="${x}" ${S.theme === x ? 'selected' : ''}>${t('theme' + x[0].toUpperCase() + x.slice(1))}</option>`).join('')}</select></div>
      <div class="f"><label>${t('clockFmt')}</label><select id="clockSel"><option value="24" ${S.clock === '24' ? 'selected' : ''}>${t('clock24')}</option><option value="12" ${S.clock === '12' ? 'selected' : ''}>${t('clock12')}</option></select></div></div></section>
    <section class="card span6"><h2>${t('setGoogle')}</h2><div class="rule"></div>
      <div class="row between"><div>${s?.connected ? `<span class="badge ${s.needsReconnect ? 'warn' : 'ok'}">${s.needsReconnect ? ICO.warn : ICO.check}${s.needsReconnect ? t('reconnectTitle') : t('connected')}</span><div class="meta" style="margin-top:6px">${t('connectedAt')} ${dt(s.connectedAt)} · ${t('lastRefresh')} ${dt(s.lastRefreshAt)}</div><div class="meta">${t('scopes')}: ${esc((s.scopes || []).map((x) => x.split('googlehealth.')[1] || x).join(', '))}</div>${s.lastError ? `<div class="err">${esc(s.lastError)}</div>` : ''}` : `<span class="badge">${t('notConnected')}</span>`}</div>
      <div class="row"><button class="primary" id="connectBtn">${s?.connected ? t('reconnectBtn') : t('connectBtn')}</button>${s?.connected ? `<button class="ghost sm" id="devBtn">${t('devices')}</button><button class="ghost sm" id="discBtn">${t('disconnect')}</button>` : ''}</div></div></section>
    <section class="card span6"><h2>${t('setProfile')}</h2><div class="small t2">${t('needProfile')}</div><div class="rule"></div>
      <div class="form cols"><div class="f"><label>${t('birthYear')}</label><input id="pby" type="number" min="1900" max="2030" value="${p.birth_year ?? ''}"></div><div class="f"><label>${t('sex')}</label><select id="psex"><option value="">—</option><option value="male" ${p.sex === 'male' ? 'selected' : ''}>${t('male')}</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>${t('female')}</option></select></div><div class="f"><label>${t('hrMax')}</label><input id="phr" type="number" min="120" max="230" value="${p.hr_max ?? ''}"></div><div class="f"><label>${t('heightCm')}</label><input id="pht" type="number" min="100" max="250" value="${p.height_cm ?? ''}"></div></div>
      <div class="row" style="margin-top:12px"><button class="primary sm" id="psave">${t('save')}</button><span class="meta" id="pstatus"></span></div></section>
    <section class="card span12"><h2>${t('addPanel')}</h2><div class="small t2">${t('bioAgeSub')} · ${t('panelNote')}</div><div class="rule"></div>
      <div class="row between" style="margin-bottom:12px"><div class="seg-ctl"><button class="on" data-units="levine">${t('unitsLevine')}</button><button data-units="us">${t('unitsUS')}</button></div><div class="f"><label class="small">${t('drawnOn')}</label><input id="bdate" type="date" value="${todayStr()}"></div></div>
      <div class="form cols" id="panelForm"></div>
      <div class="row" style="margin-top:12px"><button class="primary sm" id="bsave">${t('save')}</button><span class="meta" id="bstatus"></span></div></section>
    <section class="card span12" id="coachCard"><h2>${t('setCoach')}</h2><div class="small t2">${t('setCoachSub')}</div><div class="rule"></div>
      ${(() => { const c = S.coachProfile || {}; const seg = (name, opts, cur, pre) => `<div class="seg-ctl" data-seg="${name}">${opts.map((o) => `<button class="${cur === o ? 'on' : ''}" data-v="${o}">${t(pre + o)}</button>`).join('')}</div>`;
        return `<div class="form cols" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">
          <div class="f"><label>${t('tone')}</label>${seg('tone', ['relaxed', 'balanced', 'strict'], c.tone || 'balanced', 'tone_')}<div class="meta" id="toneHint">${t('toneHint_' + (c.tone || 'balanced'))}</div></div>
          <div class="f"><label>${t('verbosity')}</label>${seg('verbosity', ['brief', 'normal'], c.verbosity || 'normal', 'verb_')}</div></div>
        <div class="form cols" style="margin-top:12px"><div class="f"><label>${t('occupation')}</label><input id="cpOcc" maxlength="120" placeholder="${t('occupationPh')}" value="${esc(c.occupation || '')}"></div><div class="f"><label>${t('exercisePurpose')}</label><input id="cpPurpose" maxlength="300" placeholder="${t('purposePh')}" value="${esc(c.exercise_purpose || '')}"></div></div>
        <div class="form" style="margin-top:12px"><div class="f"><label>${t('lifestyle')}</label><textarea id="cpLife" rows="2" maxlength="800" placeholder="${t('lifestylePh')}">${esc(c.lifestyle || '')}</textarea></div>
          <div class="f"><label>${t('healthNotes')}</label><textarea id="cpHealth" rows="2" maxlength="800" placeholder="${t('healthPh')}">${esc(c.health_notes || '')}</textarea></div>
          <div class="f"><label>${t('customInstr')}</label><textarea id="cpCustom" rows="2" maxlength="1500" placeholder="${t('customPh')}">${esc(c.custom_instructions || '')}</textarea></div></div>
        <div class="label" style="margin-top:16px">${t('goals')}</div>
        <div class="form cols"><div class="f"><label>${t('goalSleep')}</label><input id="cpGSleep" type="number" min="3" max="12" step="0.25" value="${c.goal_sleep_min ? (c.goal_sleep_min / 60).toFixed(2).replace(/\.?0+$/, '') : ''}"></div><div class="f"><label>${t('goalSteps')}</label><input id="cpGSteps" type="number" min="1000" max="50000" step="500" value="${c.goal_steps ?? ''}"></div><div class="f"><label>${t('goalAzm')}</label><input id="cpGAzm" type="number" min="30" max="2000" step="10" value="${c.goal_azm_week ?? ''}"></div></div>
        <div class="row" style="margin-top:12px"><button class="primary sm" id="cpSave">${t('save')}</button><span class="meta" id="cpStatus"></span></div>
        <div class="rule"></div><div class="label">${t('chatNotes')}</div><div class="meta" style="margin-bottom:8px">${t('chatNotesHint')}</div>
        <div class="list" id="cpNotes">${(c.chat_notes || []).length ? c.chat_notes.map((n, i) => `<div class="item" style="display:flex;justify-content:space-between;align-items:center;gap:12px"><span class="small">${esc(n.text)}<span class="meta" style="margin-left:8px">${dt(n.at)}</span></span><button class="sm ghost" data-rm="${i}">${t('removeNote')}</button></div>`).join('') : `<div class="meta">—</div>`}</div>`; })()}
    </section>
    <div class="span12">${coverageBlock()}</div>
    <section class="card span12"><h2>${t('setDiag')}</h2><div class="small t2">${t('diagNote')}</div><div class="rule"></div>
      <div class="row" style="margin-bottom:12px"><span class="badge">${t('model')}: ${esc(info?.model || '—')}</span><span class="badge">${t('promptVersion')}: ${esc(info?.promptVersion || '—')}</span>${info && !info.configured ? `<span class="badge warn">${t('coachOff')}</span>` : ''}${S.demo ? `<span class="badge warn">${t('demo')}</span>` : ''}</div>
      <div class="row"><button class="sm" id="ctxBtn">${t('coachContext')}</button><button class="sm" id="recomputeBtn">${t('recompute')}</button><button class="sm" id="probeBtn">${t('probe')}</button><span class="meta" id="probeStatus"></span></div>
      <div class="rule"></div><h2 class="small" style="font-size:15px">${t('rulesTitle')}</h2><div class="meta" style="margin-bottom:8px">${t('rulesSub')}</div><div class="tbl" id="rulesTbl">…</div>
      <div class="rule"></div><h2 class="small" style="font-size:15px">${t('rawData')}</h2>
      <div class="tbl" id="rawTbl"></div>
      <div class="row" style="margin-top:8px"><button class="sm ghost" id="copyBtn" hidden>${t('copy')}</button></div><pre id="diagPre" hidden></pre>
      <div class="rule"></div><div class="small t2"><b>${t('energy')}</b> — ${t('energySub')}</div></section>
  </div>`;
  bindSettings();
}
const PANEL_FIELDS = [
  { k: 'albumin_g_l', th: 'Albumin', levine: 'g/L', us: 'g/dL', conv: (v) => v * 10 },
  { k: 'creatinine_umol_l', th: 'Creatinine', levine: 'µmol/L', us: 'mg/dL', conv: (v) => v * 88.42 },
  { k: 'glucose_mmol_l', th: 'Glucose (fasting)', levine: 'mmol/L', us: 'mg/dL', conv: (v) => v / 18.016 },
  { k: 'crp_mg_dl', th: 'CRP', levine: 'mg/dL', us: 'mg/L', conv: (v) => v / 10 },
  { k: 'lymphocyte_pct', th: 'Lymphocyte', levine: '%', us: '%', conv: (v) => v },
  { k: 'mcv_fl', th: 'MCV', levine: 'fL', us: 'fL', conv: (v) => v },
  { k: 'rdw_pct', th: 'RDW', levine: '%', us: '%', conv: (v) => v },
  { k: 'alp_u_l', th: 'Alkaline phosphatase', levine: 'U/L', us: 'U/L', conv: (v) => v },
  { k: 'wbc_k_ul', th: 'WBC', levine: '10³/µL', us: '10³/µL', conv: (v) => v },
];
let panelUnits = 'levine';
function bindSettings() {
  bindHealth();
  $('#signOut').onclick = () => { S.token = ''; try { sessionStorage.removeItem('adminToken'); } catch {} renderGate(); };
  $('#langSel').onchange = (e) => { S.lang = e.target.value; try { localStorage.setItem('lang', S.lang); } catch {} applyTheme(); render(); };
  $('#themeSel').onchange = (e) => { S.theme = e.target.value; try { localStorage.setItem('theme', S.theme); } catch {} applyTheme(); };
  $('#clockSel').onchange = (e) => { S.clock = e.target.value === '12' ? '12' : '24'; try { localStorage.setItem('clock', S.clock); } catch {} };
  $('#connectBtn').onclick = () => { location.href = `/auth/google/start?token=${encodeURIComponent(S.token)}`; };
  $('#devBtn')?.addEventListener('click', async () => showDiag(await api('/api/devices')));
  $('#discBtn')?.addEventListener('click', async () => { await api('/auth/google/disconnect', { method: 'POST' }); await loadCore(); render(); });
  $('#psave').onclick = async () => { try { S.profile = await api('/api/profile', { method: 'PUT', body: JSON.stringify({ birth_year: $('#pby').value || null, sex: $('#psex').value || null, hr_max: $('#phr').value || null, height_cm: $('#pht').value || null }) }); $('#pstatus').textContent = t('saved'); } catch (e) { $('#pstatus').textContent = e.message; } };
  const drawPanel = () => { $('#panelForm').innerHTML = PANEL_FIELDS.map((f) => `<div class="f"><label>${f.th} <span class="muted">(${panelUnits === 'levine' ? f.levine : f.us})</span></label><input data-k="${f.k}" type="number" step="any" min="0"></div>`).join(''); };
  drawPanel();
  document.querySelectorAll('[data-units]').forEach((b) => (b.onclick = () => { panelUnits = b.dataset.units; document.querySelectorAll('[data-units]').forEach((x) => x.classList.toggle('on', x === b)); drawPanel(); }));
  $('#bsave').onclick = async () => {
    const body = { drawn_on: $('#bdate').value };
    for (const f of PANEL_FIELDS) { const v = parseFloat($(`#panelForm [data-k="${f.k}"]`).value); body[f.k] = panelUnits === 'levine' ? v : f.conv(v); }
    try { await api('/api/bioage/panels', { method: 'POST', body: JSON.stringify(body) }); $('#bstatus').textContent = t('saved'); S.bio = await api('/api/bioage').catch(() => null); } catch (e) { $('#bstatus').textContent = e.message; }
  };
  // coach personalisation
  const cpSel = { tone: S.coachProfile?.tone || 'balanced', verbosity: S.coachProfile?.verbosity || 'normal' };
  document.querySelectorAll('#coachCard [data-seg] button').forEach((b) => (b.onclick = () => { const name = b.closest('[data-seg]').dataset.seg; cpSel[name] = b.dataset.v; b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); if (name === 'tone') $('#toneHint').textContent = t('toneHint_' + b.dataset.v); }));
  const saveCp = async (extra = {}) => { const st = $('#cpStatus'); try {
      const hrs = parseFloat($('#cpGSleep').value);
      S.coachProfile = await api('/api/coach/profile', { method: 'PUT', body: JSON.stringify({ ...cpSel, occupation: $('#cpOcc').value, exercise_purpose: $('#cpPurpose').value, lifestyle: $('#cpLife').value, health_notes: $('#cpHealth').value, custom_instructions: $('#cpCustom').value,
        goal_sleep_min: Number.isFinite(hrs) ? Math.round(hrs * 60) : null, goal_steps: $('#cpGSteps').value || null, goal_azm_week: $('#cpGAzm').value || null, ...extra }) });
      st.textContent = t('saved'); setTimeout(() => (st.textContent = ''), 2000); } catch (e) { st.textContent = e.message; } };
  $('#cpSave').onclick = () => saveCp();
  document.querySelectorAll('#cpNotes [data-rm]').forEach((b) => (b.onclick = async () => { const notes = [...(S.coachProfile?.chat_notes || [])]; notes.splice(+b.dataset.rm, 1); await saveCp({ chat_notes: notes }); renderSettings(); }));
  $('#ctxBtn').onclick = async () => showDiag(await api('/api/coach/context'));
  $('#recomputeBtn').onclick = async () => showDiag(await api('/api/scores/recompute', { method: 'POST' }));
  $('#probeBtn').onclick = async () => { $('#probeStatus').textContent = t('probing'); try { const r = await api('/api/energy/probe', { method: 'POST' }); $('#probeStatus').textContent = r.ok ? `${t('coverage')} ${r.coveragePct}% · ${r.samples} ${t('samples')} · ${t('verdict_' + r.verdict)}` : r.error || t('err_generic'); showDiag(r); } catch (e) { $('#probeStatus').textContent = e.message; } };
  api('/api/rules').then((r) => {
    const bands = (x) => x.bands ? x.bands.map((b) => `<span class="badge ${lvlCls(b.level)}" style="margin:2px 4px 2px 0">${b.min ?? ''}${b.min != null && b.max != null ? '–' : b.min != null ? '+' : b.max != null ? '< ' : ''}${b.max ?? ''} ${x.unit} · ${t('lvl_' + b.level)}</span>`).join('') : x.personal ? `<span class="meta">mean ± max(SD, ${x.personal.floor}) · ${x.personal.windowDays} d · ≥ ${x.personal.minDays} d</span>` : `<span class="meta">${esc(x.goal.profileField)}</span>`;
    $('#rulesTbl').innerHTML = `<div class="meta" style="margin-bottom:6px">${esc(r.version)}</div><table><thead><tr><th>id</th><th>${t('type')}</th><th>${t('range')}</th><th>${t('source')}</th></tr></thead><tbody>${r.rules.map((x) => `<tr><td><b>${esc(x.title?.[S.lang] || x.id)}</b><div class="meta">${esc(x.id)}</div></td><td class="muted">${t('ruleKind_' + x.kind)}</td><td style="white-space:normal;min-width:220px">${bands(x)}</td><td class="muted" style="white-space:normal;max-width:420px">${esc(x.source)}</td></tr>`).join('')}</tbody></table>`;
  }).catch(() => { $('#rulesTbl').textContent = '—'; });
  api('/api/raw?limit=40').then((rows) => {
    $('#rawTbl').innerHTML = `<table><thead><tr><th>id</th><th>${t('fetched')}</th><th>${t('type')}</th><th>${t('status')}</th><th class="num">${t('items')}</th><th>${t('range')}</th></tr></thead><tbody>${rows.map((r) => `<tr><td><a href="#" data-raw="${r.id}">#${r.id}</a></td><td class="muted">${dt(r.fetched_at)}</td><td>${esc(r.data_type)} <span class="muted">${esc(r.method)}</span></td><td class="${r.http_status < 300 ? '' : 'err'}">${r.http_status}</td><td class="num">${r.item_count ?? ''}</td><td class="muted">${esc(r.range_start?.slice(0, 10))} → ${esc(r.range_end?.slice(0, 10))}</td></tr>`).join('') || `<tr><td colspan="6" class="muted">${t('noData')}</td></tr>`}</tbody></table>`;
    $('#rawTbl').querySelectorAll('a[data-raw]').forEach((a) => (a.onclick = async (e) => { e.preventDefault(); showDiag(await api(`/api/raw/${a.dataset.raw}`)); }));
  }).catch(() => {});
}
function showDiag(obj) { const pre = $('#diagPre'), cp = $('#copyBtn'); pre.hidden = false; pre.textContent = JSON.stringify(obj, null, 2); cp.hidden = false; cp.onclick = async () => { try { await navigator.clipboard.writeText(pre.textContent); cp.textContent = t('copied'); setTimeout(() => (cp.textContent = t('copy')), 1500); } catch {} }; pre.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }

/* ================= render / boot ================= */
function render() {
  if (!S.token) { renderGate(); return; }
  if (!$('#main')) { app().innerHTML = shell(''); bindShell(); }
  else { document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === S.view && (b.closest('.tabs') || b.closest('.nav')))); }
  const sync = $('#syncBtn');
  if (sync) { const busy = !!S.loading.refresh; sync.disabled = busy; sync.classList.toggle('is-loading', busy); sync.setAttribute('aria-busy', String(busy)); sync.title = t(busy ? 'refreshing' : 'refresh'); sync.setAttribute('aria-label', sync.title); sync.innerHTML = busy ? '<span class="spinner" aria-hidden="true"></span>' : ICO.sync; }
  if (S.view === 'trends') { if (!S.insights) { $('#main').innerHTML = `<div class="empty">…</div>`; loadTrends().then(renderTrends); } else renderTrends(); }
  else if (S.view === 'settings') { if (!S.profile || !S.coachProfile) Promise.all([api('/api/profile').catch(() => ({})), api('/api/coach/profile').catch(() => null)]).then(([p, cp]) => { S.profile = p || {}; S.coachProfile = cp; renderSettings(); }); else renderSettings(); }
  else renderToday();
}
async function boot() {
  applyTheme();
  if (!S.token) { renderGate(); return; }
  app().innerHTML = shell(`<div class="empty">…</div>`); bindShell();
  try { await loadCore(); } catch (e) { if (e.status === 401) { S.token = ''; try { sessionStorage.removeItem('adminToken'); } catch {} renderGate(t('badCode')); return; } }
  const h = location.hash.replace('#', '');
  if (new URLSearchParams(location.search).get('connected')) history.replaceState(null, '', '/ui#today');
  S.view = ['today', 'trends', 'settings'].includes(h) ? h : 'today';
  render();
  if (h === 'coach') openCoach(true);
}
window.addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (h === 'coach') { openCoach(true); return; } if (['today', 'trends', 'settings'].includes(h) && h !== S.view) { S.view = h; render(); } });
let rs; window.addEventListener('resize', () => { clearTimeout(rs); rs = setTimeout(() => { if (S.token && $('#main')) render(); }, 150); });
boot();
})();
