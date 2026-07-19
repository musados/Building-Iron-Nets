# IronNets — Design Brief (for redesign)

Hand this document to a designer (or a Claude design session) together with
screenshots. It describes the product, every screen, the current visual
language, hard technical constraints, and the problems a redesign should solve.

## 1. What the product is

IronNets is a Hebrew, RTL-only app for construction professionals in Israel who
order rebar steel: welded meshes (רשתות), individual bars (מוטות), and column
reinforcement (עמודים). The user enters areas/quantities — or attaches
construction plans (PDF/DWG/DXF) and lets an AI extract a proposed bill of
quantities — and the app calculates sheet counts with overlaps (חפיות),
cut lengths, stirrups, and total weight, then produces a shareable order
(WhatsApp text / PDF) for a steel supplier.

**Primary persona:** a site engineer / contractor, often outdoors on a
construction site, phone in hand, bright sunlight, sometimes gloves. Speed and
legibility beat visual flourish. Numbers must be unmistakable — an ordering
mistake costs real money.

**Platforms:** iPhone (Expo Go / native) and desktop web (same React Native
code via react-native-web). The web version is used in the office on wide
screens; the phone version on site.

## 2. Screen inventory (current flows — keep them)

1. **הזמנות (Home)** — list of saved orders (title, date, sheet count, weight);
   two CTA buttons pinned at the bottom: "הזמנה רגילה" and "הזמנה לפי תוכנית".
   Long-press deletes. Tap opens detail.
2. **הזמנה רגילה (Simple order editor)** — one scrollable form: project name,
   overlap (cm), global mesh spec picker (chips: sheet size presets + custom,
   wire diameter, eye spacing + custom), dynamic list of area cards, live
   summary footer + save button.
3. **הזמנה לפי תוכנית (Plan order editor)** — the heaviest screen. Sections:
   plan files list (attach/view/remove, multiple files incl. section drawings),
   processing-server URL + "חלץ כמויות (AI)" button, overlap, global mesh
   picker, area cards, individual-bars rows (diameter/length/qty), column
   cards (8 numeric fields each), live summary footer.
   - **Area card**: name, length×width, and an "inherit" switch — when off it
     expands to show a per-area overlap field + the full chips picker.
   - **AI progress modal**: spinner + the model's streaming "thinking" text.
   - **AI report modal** ("איך המודל חישב?"): per-item derivation
     explanations, printable to PDF.
4. **פירוט הזמנה (Order detail)** — AI-report button (if exists), order lines
   grouped by mesh spec, bar lines, column breakdowns, totals box, per-area
   breakdown cards, plan-file view buttons, footer actions: שתף PDF / שתף
   כטקסט / ערוך.
5. **צפייה בתוכנית (Plan viewer)** — PDF in WebView (native) / new tab (web).

## 3. Current visual language (to be replaced or evolved)

- **Primary:** `#b45309` (terracotta/burnt orange) — buttons, chips, headers.
  Secondary dark accent: `#7c3f00`. 
- **Surfaces:** page `#fdfcfa`, cards `#fff` and `#faf8f5`, borders `#e5e0d8`,
  totals highlight `#f5f0e8`, warning tint `#fdf3e3` with `#e5c88f` border.
- **Text:** `#1a1a1a` primary, `#555–#777` secondary, white on primary.
- **Shape:** radii 8–16 (cards 10–12, buttons 10–12, chips pill 20, sheets 20).
- **Type:** system font only, sizes ~11–18, weights 600–700 for emphasis.
- **Patterns:** chip groups for enums, dashed-border "add" buttons, bottom
  action footers, bottom-sheet modals.

## 4. Hard constraints (non-negotiable)

- **React Native StyleSheet** styling; one codebase for iOS **and** web
  (react-native-web). No CSS frameworks, no HTML-only tricks. Web quirks
  exist (e.g. `flex: 0` renders as `flex-basis: 0%`).
- **RTL Hebrew everywhere** (`I18nManager.forceRTL` + `dir=rtl` on web).
  All copy Hebrew; digits stay Latin. Rely on RTL flex flipping — avoid
  hardcoded left/right.
- **Custom fonts** need explicit loading via expo-font — allowed, but propose
  at most one Hebrew-suitable family (e.g. Heebo/Assistant/Rubik) with system
  fallback.
- **No new libraries** for UI (no component kits); pure RN views. Mermaid/SVG
  charts not available in-app.
- **Two PDF documents** are generated as standalone RTL HTML (order + AI
  report) — restyle them too; they must print well in black & white.
- Keep all existing flows, fields, and logic — this is a visual/layout
  redesign, not a product redesign. Component-level restructuring (accordion,
  steps, tables) is welcome if it maps to the same data.

## 5. Known UX problems to solve (observed in use)

1. **plan-order is a very long single scroll** — six unrelated sections stack
   vertically; on desktop web it stretches edge-to-edge on wide screens.
   Consider: section accordions or a stepper; a max-width centered column or a
   two-pane layout (form right, live summary/files left) on web.
2. **Area cards balloon** when inherit is off (full chips picker inline) —
   consider a compact summary line ("רשת 2×3 Ø8@20 · חפייה 30") with edit-in
   place expansion or a per-area bottom sheet.
3. **Result lists are card-per-row** — with 20+ bar types (real case) a dense
   table reads better, especially on web and in print.
4. **Button hierarchy is muddled** — solid/outline/dashed/link variants exist
   ad hoc. Define primary/secondary/tertiary/destructive states.
5. **Validation is alert-based** — inline field errors and a disabled-save
   reason would be gentler.
6. **Empty states are plain text** — home screen especially deserves guidance
   (two order types explained).
7. **No dark mode** — optional, but tokens should make it possible.
8. **Sunlight legibility** — raise contrast of secondary text (#777 on #fdfcfa
   is borderline); target WCAG AA at minimum.
9. **Touch targets** — some hit areas (chip rows, ✕ delete) are small for
   gloved hands; aim ≥44px.
10. **The AI progress/report modals** are functional but plain — this is the
    "wow" moment of the product; give it identity (still restrained).

## 6. What to deliver

1. **Design tokens** — color palette (semantic: primary/surface/border/text/
   success/warning/danger), spacing scale, radius scale, type scale — as a
   TypeScript object ready to drop into `src/ui/theme.ts`.
2. **Per-screen layout specs** — annotated structure per screen (mobile +
   desktop web breakpoint), described precisely enough to implement with RN
   flexbox.
3. **Component specs** — Button (variants/states), Chip, NumberField (with
   error state), Card, SectionHeader, Switch row, Modal/BottomSheet, Table
   (for order lines), EmptyState.
4. **PDF templates** — restyled order + AI-report HTML look (B&W-print safe).
5. Optional: HTML mockups of the two editors and the detail screen (RTL,
   Hebrew placeholder content) for visual approval before implementation.

## 7. Tone

Professional tool, not a consumer toy: calm, sturdy, high-contrast,
"engineering paper" feeling. The terracotta/steel direction fits the domain
(rebar = בברזל) and can stay if evolved deliberately — but propose 2–3
distinct directions (e.g. industrial steel-blue, blueprint-inspired, warm
terracotta refined) before committing.
