# ADR-002: 12-Week Mesocycle Periodization Model, ACWR Injury-Risk Guard & Frontend Code-Splitting

- **Status:** Accepted
- **Date:** 2026-11-28
- **Authors:** TVT Studio — Principal Solution Architecture
- **Applies To:** `src/engines/periodizationEngine.ts`, `src/components/PeriodizationBuilderLab.tsx`, `Vanguard.Domain.Services.MetabolicAnalyzerService`, `vite.config.ts`

---

## 1. Context

High-output club athletes and executives frequently suffer from two opposite programming mistakes:
1. **Linear Stagnation:** Repeating static sets/reps indefinitely without structured accumulation, intensification, and peaking phases.
2. **Acute Workload Spikes (Overtraining):** Jumping weekly volume or intensity too rapidly (> 1.50 Acute:Chronic Workload Ratio), driving soft-tissue injury and CNS fatigue.

Additionally, adding a rich interactive 12-week SVG progression lab + exercise split generator to the client bundle risked bloating initial JavaScript (`> 310 kB` monolithic entry bundle in v1.0) and hurting First Contentful Paint on mobile devices.

---

## 2. Sports-Science Mathematical Model

### 2.1 Three-Mesocycle Macro-Architecture (12 Weeks)

Every generated plan divides into three structured 4-week mesocycles following a **3:1 loading-to-deload ratio**:

| Mesocycle | Weeks | Primary Adaptation | Intensity Trajectory | Built-In Deload |
| --- | --- | --- | --- | --- |
| **Mesocycle 1: Accumulation** | W1–W4 | Hypertrophy volume base, work capacity & barbell skill | Moderate (`66–80% 1RM`) | **W4** (`-40%` sets) |
| **Mesocycle 2: Intensification** | W5–W8 | Progressive mechanical tension & force transfer | High (`71–87% 1RM`) | **W8** (`-40%` sets) |
| **Mesocycle 3: Peak & Deload** | W9–W12 | Neural peak expression (W10–W11) + supercompensation taper | Peak (`75–94% 1RM`) | **W12** (`-40%` sets) |

### 2.2 Evidence-Based Volume Deloads (`-35%` to `-45%`) with Intensity Retention

Following Mujika & Padilla taper physiology, W4, W8, and W12 cut **effective working sets by ~40%** (`Math.round(prevPeakSets * 0.60)`, mathematically bounded inside `[-45%, -35%]`) while retaining moderate-high bar load (`62–76% 1RM`) at RPE `6.5`. This sheds systemic fatigue without inducing neuromuscular detraining.

### 2.3 Rolling 4-Week Acute:Chronic Workload Ratio (`ACWR <= 1.35`) Safety Cap

Each week's training load is quantified in Arbitrary Units:

$$\text{Load}_{w} = \text{EffectiveSets}_{w} \times \left(\frac{\%\text{1RM}_{w}}{100}\right) \times \text{RPE}_{w} \times 10$$

The coupled 4-week rolling chronic load $C_w$ averages the preceding 3 weeks plus the current week (seeded with habitual pre-block chronic baseline $L_0 = 0.95 \cdot L_1$ to eliminate artificial W1 spikes):

$$\text{ACWR}_{w} = \frac{\text{Load}_{w}}{C_{w}}$$

**Hard Safety Invariant:** Grounded in Gabbett's workload-injury sweet spot (`0.80 – 1.30`), any non-deload week whose raw ACWR exceeds `MAX_SAFE_ACWR = 1.35` automatically triggers iterative set regulation downward until `ACWR <= 1.35`. Deload weeks are computed *after* preceding peak weeks stabilize, preserving both `ACWR <= 1.35` and `deloadDrop ∈ [-45%, -35%]` across all 48 combinations (`4 goals × 4 frequencies × 3 experience levels`).

### 2.4 1RM Estimation & Barbell Plate Rounding

- **Epley:** $\text{1RM} = W \cdot (1 + \frac{R}{30})$
- **Brzycki:** $\text{1RM} = W \cdot \frac{36}{37 - R}$ (clamped $R \in [1, 15]$)
- **Working Load Prescription:** All Squat, Bench, and Deadlift working weights round deterministically to `2.5 kg` Olympic barbell plate increments (`Math.round(raw / 2.5) * 2.5`).

---

## 3. Frontend Performance & Code-Splitting Architecture

To keep the initial critical rendering path lean while adding the Periodization Lab:

1. **Above-the-Fold Eager Path:** Only `Navbar`, `HeroSection`, and `Footer` render synchronously on initial hydration.
2. **Route/Section Lazy Boundaries:** All heavy calculators and labs (`MetabolicLabSection`, `PeriodizationBuilderLab`, `SpacesSection`, `TimetableSection`, `TrainersSection`, `MembershipSection`, `PrintableBlueprintSheet`) are dynamically imported via `React.lazy()` + `<Suspense>` with layout-matched Editorial skeletons.
3. **Vite `manualChunks` Strategy (`vite.config.ts`):**
   - `react` chunk: isolates `react`, `react-dom`, `scheduler` for long-term immutable browser caching.
   - `engines` chunk: isolates pure deterministic TypeScript computation engines (`metabolic`, `periodizationEngine`, `timetable`, `membership`).
   - Result: Main entry JS dropped from **`312.40 kB`** (`91.16 kB` gzip) down to **`48.96 kB`** (`15.66 kB` gzip) — an **84.3% reduction**!

---

## 4. Client / Server Parity

Both the TypeScript browser engine (`src/engines/periodizationEngine.ts`) and the `.NET 10` backend (`MetabolicAnalyzerService.cs`) implement identical Mifflin-St Jeor equations, 3:1 deload ratios, `2.5 kg` barbell rounding, and the `ACWR <= 1.35` safety guard. This guarantees zero-latency interactive UX on static GitHub Pages deployments while enabling authoritative server-side verification in full-stack Docker/cloud deployments.
