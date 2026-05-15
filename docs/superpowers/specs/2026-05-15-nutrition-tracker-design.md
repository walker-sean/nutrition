# Nutrition Tracker — Design Spec
_2026-05-15_

## Overview

A mobile-first PWA (Progressive Web App) installable on iPhone that tracks daily nutrition, body weight, and measurements for the **Intermediate Lifter's 4-Day Lean Bulk Blueprint**. All data is local (IndexedDB) — no account, no backend, no sync.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Vite + React + TypeScript |
| Styling | Tailwind CSS (mobile-first, dark theme) |
| Storage | Dexie.js (IndexedDB) |
| PWA | `vite-plugin-pwa` + Web App Manifest |
| Food search | USDA FoodData Central API (free API key, `DEMO_KEY` available for dev) |
| Barcode scan | `@zxing/browser` (camera-based) + Open Food Facts API (no key required) |
| Routing | React Router v6 |
| Charts | Recharts |

---

## Screens & Navigation

Bottom tab bar with four tabs. Dark theme throughout.

### Today
- Date header
- Calorie ring (conic-gradient) showing % of daily target consumed
- Three macro progress bars (protein / carbs / fat), each showing `actual / target g`
- Running list of food log entries for the day: name, grams, kcal, macros
- "+ Add Food" button → opens add-food sheet

### Library
- Search bar (text search against personal library + USDA API)
- Barcode scan icon → opens camera
- List of saved foods: name, kcal/100g, macros per 100g
- Tap any food → add to today's log with gram input

### Progress
- **Weight section:** current weekly average, trend line chart (Recharts), "+ Weight" button
- **Measurements section:** grid showing latest values (chest, waist, hips, arms, thighs), "+ Check-in" button
- **Photos section:** grid of progress photos by date

### Settings
- Body weight input (lbs) → all macro targets recalculate live
- Calorie surplus slider (200–350 kcal, 25 kcal steps)
- Calculated targets display: maintenance, target kcal, protein g, carbs g, fat g
- Program name badge (read-only context)

---

## Macro Target Formula

Derived fresh from `settings` on every render — never stored.

```
maintenance_kcal = bodyWeight_lbs × 15
target_kcal      = maintenance_kcal + surplusTarget
protein_g        = bodyWeight_lbs / 2.205 × 2.0       (2.0 g/kg)
fat_g            = bodyWeight_lbs / 2.205 × 0.95       (0.9–1.0 g/kg, midpoint)
carbs_g          = (target_kcal - protein_g×4 - fat_g×9) / 4
```

---

## Data Model (Dexie.js / IndexedDB)

### `settings` (single row, id=1)
```ts
{
  id: 1,
  bodyWeight_lbs: number,
  surplusTarget: 200 | 275 | 350,
  startDate: string  // YYYY-MM-DD
}
```

### `foods` (personal library)
```ts
{
  id: string,           // uuid
  name: string,
  calories: number,     // per 100g
  protein: number,
  carbs: number,
  fat: number,
  servingSize: number,  // default serving in grams
  servingUnit: string,  // e.g. "g", "oz"
  barcode?: string
}
```

### `log_entries` (daily food log)
```ts
{
  id: string,
  date: string,    // YYYY-MM-DD
  foodId: string,
  grams: number,
  calories: number,  // computed at save time
  protein: number,
  carbs: number,
  fat: number
}
```

### `weight_entries`
```ts
{
  id: string,
  date: string,   // YYYY-MM-DD
  weight_lbs: number
}
```

### `check_ins`
```ts
{
  id: string,
  date: string,   // YYYY-MM-DD
  measurements: {
    chest?: number,
    waist?: number,
    hips?: number,
    arms?: number,
    thighs?: number
  },
  photoDataUrl?: string  // base64, stored in IndexedDB
}
```

---

## Key Interaction Flows

### Add food to today's log
1. Tap "+ Add Food" → bottom sheet slides up
2. Search field auto-focuses
3. Type to filter personal library (instant) or USDA API (debounced, requires connection)
4. Tap scan icon → `@zxing/browser` opens camera, reads barcode → looks up in Open Food Facts → pre-fills food form
5. Select food → gram input (pre-filled with default serving size)
6. Confirm → `log_entries` row saved, Today screen updates

### Add new food to library
1. In Library, search returns a USDA result not yet in library
2. Tap result → review/edit name and macros
3. Save → added to `foods` table, available for future logging

### Log body weight
1. Progress tab → tap "+ Weight"
2. Enter weight in lbs
3. Save → `weight_entries` row saved, weekly average recalculates (avg of all entries in current Mon–Sun week)

### Log check-in
1. Progress tab → tap "+ Check-in"
2. Enter any/all measurements
3. Optionally attach photo (camera or photo library via `<input type="file" accept="image/*" capture>`)
4. Photo resized client-side to max 1080px on longest side before storing as base64 JPEG (quality 0.8)

---

## PWA & Offline

- `vite-plugin-pwa` generates service worker with Workbox
- App shell (HTML/CSS/JS) fully cached → loads offline
- All data reads/writes are local → logging works offline
- USDA search: graceful "Offline — search unavailable" message when no connection
- Web App Manifest: name, icons, `display: standalone`, `theme_color: #111`

---

## Out of Scope

- Cloud sync / multi-device
- Workout tracking (separate repo)
- Meal planning / scheduling food in advance
- Social / sharing features
- Recipe builder
