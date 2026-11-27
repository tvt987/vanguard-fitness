# VANGUARD — Bio-Performance Club

Flagship boutique luxury fitness, Reformer Pilates, 4.8°C contrast recovery sanctuary & metabolic bio-engineering web application engineered by **TVT Studio (Truong Van Tinh)**.

**Live Demo:** https://tvt987.github.io/vanguard-fitness/

## Core Capabilities

- **Mifflin-St Jeor Metabolic Lab & 12-Week Transformation Simulator**: Exact resting metabolic rate (BMR), 5-tier TDEE multipliers, goal-calibrated macro splits (Fat Loss, Lean Recomp, Hypertrophy, Endurance), hydration & sodium electrolyte targets, interactive dual-series SVG 12-week Weight & Lean Mass trajectory, and UTF-8 BOM CSV blueprint export.
- **Live Weekly Class Timetable with Capacity Locking & Waitlist**: Filterable 7-day studio schedule across HIIT Lab, Reformer Pilates, Strength & Barbell, and Cryo Recovery with real-time seat locking, automatic waitlist queue assignment on full sessions, instant cancellation, and RFC 5545 `.ics` calendar downloads.
- **Personal Trainer Specialty Matcher**: Algorithmic specialist pairing synced dynamically with the member's 12-week metabolic objective, preferred modality, and training window.
- **Membership Tiers, Techcombank VietQR & Digital Member Pass**: 3 membership tiers with Monthly vs Annual (-20% + initiation waiver) calculator, smart add-on deduplication, live Techcombank VietQR settlement (`970407` / `19077742964012`) with offline-resilient SVG QR fallback, interactive Obsidian Digital Member Pass, and dedicated `@media print` A4 Bio-Performance Blueprint & QR Access Pass.
- **Bilingual & Multi-Currency**: Seamless `EN/VI` localization, `VNĐ/USD` conversion, Dark/Light architectural themes, and persistent `localStorage` state.

## Tech Stack & Quality

- React 19 + TypeScript (strict) + Vite 6 + Tailwind CSS v4
- 27 Vitest unit tests covering Metabolic, Timetable/PT Matcher, and Membership/VietQR engines
- GitHub Actions CI/CD to GitHub Pages (`npm ci` → `npm test` → `npm run build` → Pages deploy)

```bash
npm install
npm test
npm run build
```
