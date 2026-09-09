# Health Coach — UI Redesign Specification

> Design handoff for Claude. Created 2026-09-09. This document specifies the interface; it does not implement or change health calculations. User-facing language defaults to Thai, with complete English localization available.

## 1. Assignment and scope

Redesign the existing personal Fitbit Air health dashboard as a polished, contemporary health product. Preserve working data fetching, authorization, localization, theme switching, date filtering, sleep charts, metric details, raw-data inspection if implemented, and coaching conversations. Inspect the existing repository before choosing components or dependencies.

The user requested this `design.md` to hand to Claude. This is a proposed visual direction ready for implementation review, not a claim that the screenshots or running application have already been updated.

### Reference screenshots inspected

- `image.png`: populated dark desktop dashboard with a persistent right-hand chat column.
- `ui-mobile.png`: light mobile dashboard with an admin-token form, empty cards and floating chat button.
- `ui-light.png`: populated light desktop dashboard with sleep summary, metric tiles and historical sleep chart.

Images are references to the current UI, not dependencies that the new application needs to load. No source code was available during this design pass; component names and layout recommendations below must be adapted to the actual app.

### What is visibly weak today

1. The sleep summary stretches to the height of the entire metric grid, leaving a large unused rectangle.
2. Metrics sit inside cards inside another card; every border receives similar visual emphasis.
3. Multiple bright graph colors compete, without a clear semantic system.
4. The permanent chat transcript consumes roughly a third of desktop width before the user asks for coaching.
5. Admin credentials and connection setup appear as ordinary dashboard content.
6. Mobile empty states preserve large chart/card heights, producing mostly blank scrolling.
7. Technical text such as `glm-mock · coach-v0.2` and the sparkline implementation explanation appears in the primary experience.
8. Language is mixed within individual views. Connection warnings coexist with populated values without an obvious data-origin explanation.

### Desired first impression

“A calm personal health instrument: one useful takeaway, clear measurements, and quiet depth when I need it.”

The first viewport should answer: what data is available, what happened last night, and what should I inspect next. Avoid making the product look like a database admin page or a generic AI chat wrapper.

## 2. Selected visual direction

**Graphite + soft chartreuse + lavender.** Dark-first preview, with an equally considered light theme. Follow an existing saved theme; otherwise follow the operating system. Do not force dark mode on users who chose light.

Use restrained surfaces, strong typography, generous separation between sections, compact spacing inside data groups, and one prominent action per section. Color provides orientation; it is not decoration on every metric.

Alternatives considered:

| Direction | Strength | Trade-off |
|---|---|---|
| Graphite with chartreuse and lavender — selected | Distinct identity; suits sleep and recovery; strong dark/light pairing | Accent must remain restrained to avoid a gaming aesthetic |
| White with blue clinical accents | Familiar and readable | Too close to the current generic dashboard |
| Warm cream with terracotta | Friendly lifestyle feel | Less appropriate for a dense physiological dashboard |

Do not copy WHOOP or Bevel logos, proprietary score graphics, or exact layouts. Their useful lesson is information hierarchy, not brand imitation.

## 3. Non-negotiable product rules

- A visual redesign must not invent Recovery, Strain, Energy Bank or Biological Age calculations. Show them only if implemented with provenance. See section 15 for future placement.
- Never manufacture a sample score to fill a hero. Missing data is a real state, not zero.
- A rise in HRV or a fall in resting HR is not automatically “good”; use neutral comparison text unless the backend supplies an interpretation with context.
- Do not use green to imply medical clearance or red to imply disease. Explain measured deviations in words.
- Preserve existing security requirements. Moving the admin token out of the header does not remove authentication.
- Do not label fetched data “live.” Show measurement period separately from fetch time.
- Do not turn visible mock data into apparently connected real data. If demo mode exists, make it explicit.
- Do not change units, score definitions, baselines or time-zone attribution as a styling shortcut.

## 4. Design tokens

Use semantic CSS custom properties or the project's existing token mechanism. These are concrete target values, not permission to replace the styling framework.

### Surfaces, text and actions

| Token | Dark | Light | Purpose |
|---|---|---|---|
| `canvas` | `#101312` | `#F5F6F2` | Page background |
| `surface` | `#191D1B` | `#FFFFFF` | Primary cards and panels |
| `surface-raised` | `#222824` | `#ECEFE8` | Hover areas, selected controls, nested detail only |
| `surface-overlay` | `#1C211E` | `#FFFFFF` | Dialogs and drawers |
| `border` | `#323B35` | `#D7DED3` | Quiet structural separators |
| `text-primary` | `#F2F5EF` | `#19211B` | Headings and values |
| `text-secondary` | `#BAC5B9` | `#53604F` | Labels and useful metadata |
| `text-muted` | `#97A493` | `#63705F` | Timestamps and secondary annotations |
| `accent-fill` | `#D7EF9B` | `#D7EF9B` | Main filled button / key selection |
| `accent-ink` | `#D7EF9B` | `#365414` | Accent text and active navigation |
| `on-accent` | `#1A260D` | `#1A260D` | Text on accent fill |
| `accent-subtle` | `#2C3522` | `#EBF3DA` | Selected backgrounds |
| `focus-ring` | `#D7EF9B` | `#416517` | Keyboard focus |
| `positive` | `#9CD3B6` | `#286244` | Confirmed success only |
| `warning` | `#E5C17B` | `#805414` | Delayed/incomplete states |
| `danger` | `#F1A2A2` | `#A52D37` | Errors/destructive actions |

Use separate semantic foreground/background tokens for status badges; do not put light warning text on a light yellow surface. Verify WCAG AA contrast in the implemented UI: 4.5:1 for ordinary text, 3:1 for large text and essential non-text controls. Adjust token values if actual combinations fail. The palette has not been contrast-audited in a running app.

### Chart tokens

| Series | Dark | Light |
|---|---|---|
| Sleep deep | `#7966D9` | `#6954C4` |
| Sleep REM | `#B2A0F0` | `#9A83DF` |
| Sleep light | `#DDD3F5` | `#CDBFEF` |
| Awake | `#8B968D` | `#7B887E` |
| Generic trend | `#B8D99D` | `#4C743B` |
| Baseline | `#A4ADA5` | `#68756B` |
| Grid | `#303831` | `#DFE5DC` |

Use the same sleep-stage mapping in summary, detail, chart and legend. Use legend text, tooltips and patterns for selected/missing data; never rely on hue alone. Metric sparklines share the generic trend color by default. Reserve semantic warning/error coloring for validated states.

### Shape and elevation

- Card radius: 20px desktop; 18px mobile.
- Inputs/buttons: 12px. Pills: fully rounded only for statuses, date controls and suggestion chips.
- Card border: 1px. Never combine a strong border, heavy shadow and gradient on one card.
- Dark cards: primarily border separation; no visible drop shadow needed.
- Light card shadow: `0 4px 18px rgba(25, 33, 27, 0.035)`.
- Overlay shadow: `0 20px 64px rgba(0, 0, 0, 0.22)`.
- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48px.
- No glassmorphism, glowing borders, full-page gradients or decorative 3D assets.

## 5. Typography and language

Preferred font stack: `Inter, Noto Sans Thai, system-ui, sans-serif`. Bundle fonts where the project permits; keep a functional fallback and do not block rendering on a font request. Thai text must have enough vertical room for marks.

| Role | Desktop size / line height | Mobile size / line height | Weight |
|---|---|---|---|
| Page greeting/title | 28 / 38px | 24 / 34px | 600 |
| Main sleep value | 56 / 64px | 44 / 54px | 600 |
| Metric value | 32 / 40px | 28 / 36px | 600 |
| Section title | 18 / 28px | 18 / 28px | 600 |
| Main body | 15 / 24px | 15 / 24px | 400 |
| Labels | 13 / 20px | 13 / 20px | 500 |
| Supporting metadata | 12 / 18px | 12 / 18px | 400 |

- Use tabular numerals for numeric values and charts.
- Units are secondary, 14–16px, baseline aligned; no `6h37m` compressed run of text.
- Render sleep as `6 ชม. 37 น.` with visible spacing; numbers carry emphasis.
- Do not apply negative letter spacing or forced uppercase to Thai.
- All dates, buttons, placeholders, chart tooltips and errors follow the selected locale. Technical units such as ms, bpm and SpO₂ may remain conventional.
- Keep comparison descriptions human-readable: `เทียบค่าเฉลี่ย 7 วันก่อนหน้า`. Explain the exact calculation period in details, not a formula paragraph above every card.

## 6. Page structure and responsive layout

Use a centered content container with maximum width 1240px. All sizes below are CSS pixels. Do not infer CSS dimensions from the pixel resolution of the supplied screenshots.

### Breakpoints

| Viewport | Page gutter | Main layout | Metric grid | Coaching |
|---|---|---|---|---|
| 320–599px | 16px | One column | Two columns | Dedicated full-height view |
| 600–1023px | 24px | One column | Three columns | Drawer/view |
| ≥1024px | 32px | 12-column grid | Two columns inside vitals section | Overlay drawer on demand |

Desktop hero row: sleep summary spans 5 columns; vitals section spans 7. Use `align-items: start`; do not stretch the sleep card to match the entire vitals group. Section gap 24px; card internal padding 24px. Mobile padding 20px; section gap 20px; small-card gap 12px.

At 390px width, inner content is 358px; two metric cards are 173px each with a 12px gap. Long labels wrap instead of forcing a wider viewport. At 320px, permit smaller values down to 24px, never reduce ordinary body text to make the layout fit.

### Desktop order

1. Compact application header.
2. Greeting/date and connection freshness row.
3. One concise daily takeaway, only if grounded in available data.
4. Hero row: sleep summary + vital measurements.
5. Full-width sleep history.
6. Activity summary and compact coaching entry card.
7. Quiet footer link to data/source details.

### Mobile order

1. Compact application header.
2. Greeting and latest available data status.
3. Sleep summary.
4. Compact coach takeaway if available.
5. Vital metrics in two columns.
6. Sleep history with 7 visible days by default.
7. Activity summary.
8. Persistent bottom navigation.

The page may scroll naturally. Do not try to place every chart in the first mobile viewport. Ensure the initial viewport contains identity, freshness and useful sleep information rather than token forms and empty rectangles.

## 7. Header and navigation

### Header

- Height 64px desktop, 56px mobile.
- Left: small 28px brand mark and `Health Coach` in 16px semibold. Use a restrained pulse icon or existing mark recolored to the token palette.
- Right: small sync-status button and an accessible settings icon.
- Desktop navigation: `วันนี้`, `แนวโน้ม`, `โค้ช` as low-emphasis text tabs if these views exist; otherwise use working in-page sections. Do not add dead links to nonexistent pages.
- Language and theme controls live in settings. Preserve both features without keeping all controls visible in the header.
- A user-initiated refresh is a small secondary action near the freshness label. Only one main refresh control per dashboard.
- Tooltip/accessible label for refresh: `ดึงข้อมูลล่าสุดจาก Google Health`.

### Mobile bottom navigation

Four destinations: `วันนี้`, `แนวโน้ม`, `โค้ช`, `ตั้งค่า`. Each uses a 20px outlined icon and 11–12px label. Active item uses accent ink plus a subtle pill behind the icon. Minimum hit area 44×44px.

Height: 64px plus `env(safe-area-inset-bottom)`. Page padding-bottom must reserve this space plus 16px. Remove the large floating `AI Coach` bubble; do not overlap content with duplicate navigation.

## 8. Sleep summary — primary visual anchor

Do not add a readiness ring unless the backend actually provides a supported readiness metric. The current app already has sleep data, so make sleep the visual anchor.

Card structure:

1. Eyebrow: `การนอนล่าสุด` with wake date on the right.
2. Large duration on the next row.
3. Supporting line: `เทียบค่าเฉลี่ย 7 วันก่อนหน้า · น้อยลง 17 นาที` when this comparison is actually supplied/calculated.
4. Compact horizontal stage composition, 10px tall, with 4px radius at the outer edges only.
5. Two pairs of information separated by a fine line: sleep interval and efficiency.
6. Small stage legend with explicit duration units and a `ดูรายละเอียด` text action.

Target content-driven height: roughly 280–340px, not fixed. No empty lower half. On mobile, the legend wraps to two columns.

Optional subtle accent: a 3px lavender top rule or small sleep icon. No giant moon illustration; no stock photo background.

Data semantics:

- Total asleep excludes awake minutes. If the stage bar includes awake, label it as the recorded sleep interval, and keep total asleep explicit.
- Label the main sleep session versus naps correctly. Do not merge sessions just to fit the card.
- The supplied screenshot shows `16:04 → 23:13`; this might reflect a timezone issue or a valid unusual sleep period. Verify source timestamps before display; do not silently correct it to a conventional night.
- If session date differs from today's date, show the actual date prominently.

## 9. Vital measurements and activity

### Vitals

Section title `สัญญาณร่างกาย`, with a small information action explaining baseline and source. Remove the enclosing large bordered card. Render individual metric cards directly on the page grid.

Current cards: HRV, resting HR, SpO₂, respiratory rate. Arrange 2×2 inside the desktop vitals area; on tablet they can use the shared three-column grid. Activity metrics are separate, not empty positions in the vitals grid.

Each card:

- Label + optional outline icon, no colored dot for every card.
- Value and unit.
- Neutral signed change or absolute comparison with the comparison period.
- 36px-high sparkline; 1.8px stroke; no glow; no decorative fill by default.
- Footer text only when needed: `ข้อมูลคืนวันที่ …` / `ข้อมูลยังไม่ครบ`.

Card padding 16px; typical height 156–184px, driven by content. Entire card opens a metric detail view, with keyboard activation and a visible focus ring. Do not nest additional buttons inside the same click target without valid interaction semantics.

### Activity

A separate `กิจกรรม` section shows steps and active-zone minutes. Include the source date in its heading when displaying yesterday rather than today. Use two compact cards and a shared detail action. Do not introduce invented goals/progress rings if no goal has been configured.

## 10. Sleep history and metric details

Sleep history uses one full-width card with:

- Left: `แนวโน้มการนอน` and a short contextual subtitle.
- Right: segmented range control `7 วัน / 14 วัน / 30 วัน` only for supported ranges. Keep selection separate from the baseline used by metric comparisons.
- Chart plot: 220px desktop, 176px mobile when populated.
- Y-axis: hours; approximately four subtle horizontal gridlines. Legend below the title or below the plot, not squeezed into the mobile title row.
- Bar gap 6–10px; top segment may use 3px top corners. Do not round every internal stage boundary.
- Missing days: gap plus an explicit `ไม่มีข้อมูล` state on selection, never a zero-height “0 hours slept” inference.
- If an awake segment is included, tooltip distinguishes total asleep from total recorded interval.
- No smoothed interpolation across missing samples in sparklines or line charts.

On mobile, show 7 days initially. For 14/30-day views, allow local horizontal chart scrolling with a visible range hint; do not make the entire page scroll horizontally. Tap selects a day and displays a readable detail block below the chart. Desktop hover can show a tooltip; click and keyboard selection provide the same information.

Tooltips use theme surfaces and borders, minimum 13px text, explicit units and date. Constrain to viewport boundaries. Provide an accessible data table/list alternative.

### Metric details

Display the selected metric, exact date range, larger chart, baseline description, coverage/missingness and source link. Preserve raw response access behind `ข้อมูลต้นทาง` if implemented. Prefer a right drawer on desktop and a full-height view on mobile.

## 11. Coach experience

### Default dashboard presence

Replace the permanently open transcript with a compact coach card. Use a small icon, `โค้ชของคุณ`, a maximum of two short paragraphs of grounded insight, and `คุยต่อกับโค้ช` as a secondary button.

If no analysis exists, use: `ให้โค้ชช่วยสรุปจากข้อมูลล่าสุดของคุณ` and `สรุปวันนี้`. If data is missing, explain that a summary becomes available after sync rather than inviting an analysis that will fail.

### Conversation mode

- Desktop: open an overlay drawer, width 420px, max-width `calc(100vw - 32px)`; dim the background lightly. The dashboard does not permanently lose a third of its width.
- Mobile: full-height coach view using dynamic viewport height. Composer remains visible above the keyboard and safe area. Hide bottom navigation while the full-screen conversation is active; provide back navigation in the coach header.
- Assistant messages use readable unboxed text or a subtle surface; user messages use accent-subtle with normal text. Avoid saturated blue message bubbles.
- Body line height 1.6–1.7, with comfortable Thai paragraph spacing.
- Show source date/metric chips when actual references exist: `การนอนล่าสุด`, `HRV 7 วัน`. Do not create fake citations.
- Suggested questions wrap into two rows; no clipped chip carousel. Initial examples: `สรุปการนอน`, `ดูแนวโน้มสัปดาห์นี้`, `วันนี้ควรใส่ใจอะไร`.
- Input placeholder: `ถามเกี่ยวกับข้อมูลสุขภาพของคุณ…`.
- Move clear-history into an overflow menu with confirmation. An unlabeled trash can should not be a prominent header action.
- Put model/version diagnostics in settings/debug details. If the model is mocked, still show a clear `โหมดสาธิต` label in the conversation; hiding technical names must not hide demo status.

Handle loading, streaming, error and retry without discarding the user's message. Explain if a report uses older data. Do not silently re-run paid inference when the user only refreshes source data.

## 12. Authentication, connection and raw data

### App authentication

When an admin token is required, use a focused access screen before protected dashboard content. Keep the existing authentication mechanism; this is a presentation change.

- Max-width 420px; centered with ordinary app branding.
- Title `เข้าสู่พื้นที่สุขภาพของคุณ`.
- Password-style field labelled `รหัสเข้าถึง`, with show/hide action.
- Primary action `เข้าสู่ระบบ`.
- Invalid-token error appears next to the field. Never print the credential in the UI or URL.
- Do not render large empty dashboard cards behind this screen or briefly flash previous protected data.

If the existing app permits a public demo, make `ดูตัวอย่าง` a separate, clearly labelled route/state. Do not introduce a demo without supporting behavior.

### Google Health connection

App authentication and Google authorization are distinct. Once authenticated, an unconnected user sees one compact setup panel: `เชื่อม Fitbit เพื่อเริ่มดูข้อมูลของคุณ`, one-sentence explanation, and the existing `เชื่อม Google Health` action. Replace the amber full-width warning plus empty dashboard with this panel and a concise description of what will appear.

If cached real data exists while disconnected, keep it readable with an explicit source date and reconnect prompt. If the view is populated with fixtures, badge the whole view `ข้อมูลตัวอย่าง`.

### Settings and source inspection

Settings groups: account access, Google Health connection, language/theme, data diagnostics. No model identifiers in everyday metric labels.

`ข้อมูลต้นทาง` detail should show measurement period, fetched-at timestamp, source, coverage if available and a read-only JSON viewer with wrap/copy controls. Redact credentials. If raw-data features do not exist yet, identify that implementation dependency rather than displaying a nonfunctional button.

## 13. Complete state design

| State | Presentation | Action |
|---|---|---|
| Not authenticated | Focused access screen | Enter access token |
| Authenticated, Google not connected | Single connection panel | Connect account |
| Connected, first fetch pending | Compact progress panel | No duplicate fetch button while pending |
| Connected, no records | `ยังไม่มีข้อมูลที่ซิงก์เข้ามา` + short mobile-sync explanation | Fetch again |
| Partial measurements | Available cards plus compact unavailable rows | Inspect coverage/source |
| Delayed/cached data | Quiet amber badge with actual source date | Refresh |
| Insufficient baseline | Real value with `กำลังสะสมข้อมูลเปรียบเทียบ` | View history |
| Fetch error | Inline error retaining prior data | Retry |
| OAuth expired | Reconnection callout retaining labelled cached data | Reconnect |
| Coach failure | Retain conversation, inline explanation | Retry this response |
| Demo data | Persistent `ข้อมูลตัวอย่าง` label | Exit demo / connect if supported |

Loading skeletons mirror the final hierarchy but appear only during a genuine request. Honor reduced-motion preferences. Empty charts collapse to a 96–120px explanation instead of a 300px blank plot. A single unavailable metric uses a dash with `ยังไม่มีข้อมูล`, not an indefinite shimmer.

## 14. Interaction and accessibility

- Hover and pressed transitions: 120–180ms; drawer transition 200ms maximum. No counting animations on physiological values.
- Hover changes surface/border gently, without translating every card upward.
- One outline icon family throughout, 1.75–2px stroke; use an existing library rather than adding several icon packages.
- Minimum touch area 44×44px. Icon-only controls need accessible labels.
- Visible keyboard focus; predictable tab order; dialogs/drawers trap focus and restore it on close.
- Provide Escape/back behavior, scroll locking and screen-reader dialog labels.
- Numeric updates should not repeatedly interrupt assistive technology; announce completion/error status politely.
- Support 200% text zoom and narrow layouts without clipping Thai text or essential controls.
- Do not encode change direction or connection status by color alone.

## 15. Future scores without clutter

The user has explored Strain, Recovery, Energy Bank and Biological Age. These are potential future features, not confirmed implementations in the screenshots.

- Recovery, if implemented: a compact daily summary block above sleep with score, timestamp, reasons and confidence/coverage. Use a horizontal scale or typography; no mandatory giant ring.
- Strain, if implemented: belongs to the activity section with a stated measurement period and load explanation.
- Energy Bank, if implemented: belongs to a daily timeline detail view; display estimated status explicitly.
- Biological Age, if implemented: belongs to long-term trends, with model name, input completeness and update date. It should not occupy a changing “today” hero or imply an observed age measurement.

Do not add placeholder score cards or navigation tabs for unsupported features. The current redesign must look complete using sleep and the six existing metric types alone.

## 16. Suggested UI component boundaries

These names communicate responsibility; reuse existing components where possible.

| Component | Responsibility |
|---|---|
| `AppShell` | Header, responsive content container, mobile navigation |
| `AccessGate` | Existing app authentication presentation |
| `ConnectionPanel` | Google connection / reconnection state |
| `DataFreshness` | Fetch status versus measurement period |
| `SleepSummary` | Last sleep duration, stages and interval |
| `MetricCard` | Value, unit, neutral comparison, sparkline, detail trigger |
| `SleepHistory` | Range selection, chart, selected-day details |
| `ActivitySummary` | Steps and active-zone minutes with date context |
| `CoachPreview` | Short grounded insight and conversation entry |
| `CoachView` | Conversation, composer and retry states |
| `MetricDetail` | Expanded trend, coverage and source details |
| `SettingsView` | Connection, preferences and diagnostics |

The view consumes existing backend values; it must not invent health scoring. Formatting, chart selection and locale handling may live in presentation utilities. Auth boundaries and raw-data redaction remain enforced by the existing application architecture.

## 17. Implementation sequence for Claude

1. Inspect current UI routes, styling, charts, auth, localization and theme mechanisms. Identify actual data states and mock fixtures.
2. Establish semantic theme and typography tokens; make light and dark themes coherent.
3. Refactor the app shell and connection/auth presentation, preserving existing access control.
4. Implement content-driven sleep and metric layouts; remove equal-height stretching and the enclosing metrics box.
5. Restyle chart series, legends and selected-day behavior; preserve data semantics.
6. Replace the always-open chat with CoachPreview and an on-demand conversation view.
7. Add responsive navigation and compact empty/error/loading states using actual supported routes/actions.
8. Verify the views below with real browser screenshots. Report backend dependencies separately; do not fake missing endpoints or scores.

Use the current stack. Avoid unrelated backend refactors, a new design framework or a chart-library migration unless a concrete requirement cannot be met with existing code.

## 18. Definition of done

Validate with representative fixtures clearly confined to development and, when available, real account data.

- Capture light and dark screenshots at 390×844, 768×1024 and 1440×1000 CSS pixels; additionally inspect 320px and 200% text zoom for overflow.
- Inspect populated, unauthenticated, unconnected, no-records, partial-data, stale-data and coach-error states.
- Sleep summary has no unnecessary empty lower half and does not stretch to match a metric grid.
- Mobile dashboard contains useful hierarchy, no large admin-token card inside content, and no floating button obscuring a chart.
- No page-level horizontal overflow; chart-only scrolling is intentional and labelled.
- Header, composer and bottom navigation respect safe areas and mobile keyboard behavior.
- Charts preserve units, dates, missing days and sleep-stage totals; sample images are not treated as authoritative medical values.
- Theme and locale selection persist according to existing application behavior. Thai and English screens are internally consistent.
- All visible controls work or are omitted; none silently call mock behavior as if real.
- Credentials and implementation identifiers are absent from ordinary dashboards. Authentication is still enforced.
- Freshness and demo/cached states cannot be mistaken for current connected measurements.
- Keyboard, focus, tooltips and chart alternatives work; implemented contrast is checked.
- Deliver a short change summary and before/after screenshots. A successful build alone is not visual verification.

## 19. Final instruction

Implement this as a cohesive redesign of the existing Health Coach UI. Prioritize typography, information order, whitespace and state handling over decoration. Preserve functionality and health-data truthfulness. Make the current feature set feel finished before adding any new score or analysis feature.
