# Nutrition Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first PWA that tracks daily nutrition, body weight, and measurements for the Intermediate Lifter's 4-Day Lean Bulk Blueprint. All data stays local on the device.

**Architecture:** Vite + React + TypeScript single-page app with React Router. Dexie.js wraps IndexedDB for persistence. Tailwind CSS for mobile-first styling. `vite-plugin-pwa` adds installability and offline support. USDA FoodData Central handles food search; Open Food Facts handles barcode lookups; `@zxing/browser` reads barcodes from the device camera.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, React Router v6, Dexie.js, Recharts, `@zxing/browser`, `vite-plugin-pwa`, Vitest, React Testing Library.

---

## File Structure

```
nutrition/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── index.html
├── tailwind.config.js
├── postcss.config.js
├── .gitignore
├── public/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── apple-touch-icon.png
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Router root + tab bar layout
│   ├── index.css                 # Tailwind directives + globals
│   ├── types.ts                  # Shared TypeScript types
│   ├── lib/
│   │   ├── db.ts                 # Dexie database setup
│   │   ├── macros.ts             # Macro target calculation
│   │   ├── usda.ts               # USDA FoodData Central API client
│   │   ├── openFoodFacts.ts      # Open Food Facts API client
│   │   ├── photos.ts             # Client-side photo resize
│   │   └── date.ts               # Date helpers (ISO date, week-of)
│   ├── hooks/
│   │   ├── useSettings.ts
│   │   ├── useDailyLog.ts
│   │   ├── useFoods.ts
│   │   ├── useWeight.ts
│   │   └── useCheckIns.ts
│   ├── components/
│   │   ├── TabBar.tsx            # Bottom navigation
│   │   ├── CalorieRing.tsx       # Conic-gradient progress ring
│   │   ├── MacroBars.tsx         # Protein/carbs/fat progress bars
│   │   ├── FoodLogEntry.tsx      # Single row in today's log
│   │   ├── AddFoodSheet.tsx      # Slide-up sheet for adding food
│   │   ├── BarcodeScanner.tsx    # Camera + ZXing reader
│   │   ├── WeightChart.tsx       # Recharts line chart
│   │   └── CheckInForm.tsx       # Measurements + photo form
│   └── screens/
│       ├── TodayScreen.tsx
│       ├── LibraryScreen.tsx
│       ├── ProgressScreen.tsx
│       └── SettingsScreen.tsx
└── tests/
    ├── setup.ts                  # Vitest setup (fake-indexeddb, RTL)
    ├── lib/
    │   ├── macros.test.ts
    │   ├── db.test.ts
    │   ├── date.test.ts
    │   ├── usda.test.ts
    │   └── openFoodFacts.test.ts
    ├── hooks/
    │   ├── useSettings.test.ts
    │   ├── useDailyLog.test.ts
    │   └── useWeight.test.ts
    └── components/
        ├── CalorieRing.test.tsx
        └── MacroBars.test.tsx
```

---

## Phase 1: Project Setup

### Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.gitignore`

- [ ] **Step 1: Create package.json**

Create `package.json`:
```json
{
  "name": "nutrition-tracker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "dexie": "^4.0.8",
    "dexie-react-hooks": "^1.1.7"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.0",
    "vitest": "^2.0.5",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^25.0.0",
    "fake-indexeddb": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": false,
    "noEmit": true,
    "useDefineForClassFields": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create tsconfig.node.json**

Create `tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "composite": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create vite.config.ts**

Create `vite.config.ts`:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
```

- [ ] **Step 5: Create index.html**

Create `index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#111111" />
    <title>Nutrition Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create src/main.tsx**

Create `src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 7: Create src/App.tsx (placeholder)**

Create `src/App.tsx`:
```tsx
export default function App() {
  return <div style={{ padding: 16, color: 'white', background: '#111', minHeight: '100vh' }}>Nutrition Tracker</div>;
}
```

- [ ] **Step 8: Create src/index.css (placeholder)**

Create `src/index.css`:
```css
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #111; color: white; font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
```

- [ ] **Step 9: Create .gitignore**

Create `.gitignore`:
```
node_modules/
dist/
.DS_Store
.vite/
coverage/
.superpowers/
*.local
.env
.env.local
*.tsbuildinfo
vite.config.js
vite.config.d.ts
```

- [ ] **Step 10: Install dependencies and verify dev server starts**

Run: `npm install`
Run: `npm run dev`
Expected: Vite dev server starts on http://localhost:5173 and displays "Nutrition Tracker" on a dark background. Stop the server (Ctrl-C) after verifying.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts index.html src/main.tsx src/App.tsx src/index.css .gitignore
git commit -m "chore: scaffold Vite + React + TypeScript project"
```

---

### Task 2: Add Tailwind CSS

**Files:**
- Create: `tailwind.config.js`, `postcss.config.js`
- Modify: `src/index.css`, `package.json`

- [ ] **Step 1: Install Tailwind**

Run: `npm install -D tailwindcss@^3.4.10 postcss@^8.4.41 autoprefixer@^10.4.20`

- [ ] **Step 2: Create tailwind.config.js**

Create `tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#111111',
        surface: '#1a1a1a',
        card: '#252525',
        border: '#2a2a2a',
        muted: '#666666',
        subtle: '#888888',
        accent: '#6ee7b7',
        protein: '#60a5fa',
        carbs: '#fbbf24',
        fat: '#f87171',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Create postcss.config.js**

Create `postcss.config.js`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Replace src/index.css with Tailwind directives**

Replace `src/index.css` contents with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body {
    @apply bg-bg text-white;
    font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    -webkit-tap-highlight-color: transparent;
  }
  body {
    @apply min-h-screen;
  }
}
```

- [ ] **Step 5: Update App.tsx to use Tailwind classes**

Replace `src/App.tsx`:
```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-bg p-4">
      <h1 className="text-2xl font-bold text-white">Nutrition Tracker</h1>
      <p className="mt-2 text-accent">Tailwind is wired up.</p>
    </div>
  );
}
```

- [ ] **Step 6: Run dev server and verify styles render**

Run: `npm run dev`
Expected: Dark background, white heading, green accent text. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.js postcss.config.js postcss.config.js src/index.css src/App.tsx package.json package-lock.json
git commit -m "chore: add Tailwind CSS with project theme colors"
```

---

### Task 3: Set up Vitest test infrastructure

**Files:**
- Create: `tests/setup.ts`
- Create: `tests/lib/example.test.ts` (sanity test)

- [ ] **Step 1: Create tests/setup.ts**

Create `tests/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 2: Create a sanity test**

Create `tests/lib/example.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('example', () => {
  it('runs the test framework', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Run tests to verify infrastructure works**

Run: `npm test`
Expected: 1 test passes.

- [ ] **Step 4: Delete the sanity test**

Delete `tests/lib/example.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add tests/setup.ts
git commit -m "chore: add Vitest setup with jsdom and fake-indexeddb"
```

---

## Phase 2: Core Logic (Pure Functions)

### Task 4: Macro target calculation

**Files:**
- Create: `src/lib/macros.ts`, `tests/lib/macros.test.ts`

- [ ] **Step 1: Write failing tests for macro calculation**

Create `tests/lib/macros.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { calculateTargets } from '../../src/lib/macros';

describe('calculateTargets', () => {
  it('uses bodyweight × 15 for maintenance', () => {
    const t = calculateTargets({ bodyWeight_lbs: 175, surplusTarget: 300 });
    expect(t.maintenance_kcal).toBe(2625);
  });

  it('adds surplus to target', () => {
    const t = calculateTargets({ bodyWeight_lbs: 175, surplusTarget: 300 });
    expect(t.target_kcal).toBe(2925);
  });

  it('sets protein at 2.0 g per kg bodyweight', () => {
    const t = calculateTargets({ bodyWeight_lbs: 175, surplusTarget: 300 });
    // 175 / 2.205 ≈ 79.37 kg × 2.0 = ~158.7g
    expect(t.protein_g).toBe(159);
  });

  it('sets fat at 0.95 g per kg bodyweight', () => {
    const t = calculateTargets({ bodyWeight_lbs: 175, surplusTarget: 300 });
    // 79.37 × 0.95 = ~75.4g
    expect(t.fat_g).toBe(75);
  });

  it('fills remaining calories with carbs', () => {
    const t = calculateTargets({ bodyWeight_lbs: 175, surplusTarget: 300 });
    // 2925 - (159 × 4) - (75 × 9) = 2925 - 636 - 675 = 1614 / 4 = 403.5 → 404
    expect(t.carbs_g).toBe(404);
  });

  it('handles different bodyweights', () => {
    const t = calculateTargets({ bodyWeight_lbs: 200, surplusTarget: 250 });
    expect(t.maintenance_kcal).toBe(3000);
    expect(t.target_kcal).toBe(3250);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: All tests fail with "Cannot find module".

- [ ] **Step 3: Implement macros.ts**

Create `src/lib/macros.ts`:
```ts
export interface MacroInput {
  bodyWeight_lbs: number;
  surplusTarget: number;
}

export interface MacroTargets {
  maintenance_kcal: number;
  target_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const LBS_PER_KG = 2.205;

export function calculateTargets({ bodyWeight_lbs, surplusTarget }: MacroInput): MacroTargets {
  const bodyWeight_kg = bodyWeight_lbs / LBS_PER_KG;
  const maintenance_kcal = Math.round(bodyWeight_lbs * 15);
  const target_kcal = maintenance_kcal + surplusTarget;
  const protein_g = Math.round(bodyWeight_kg * 2.0);
  const fat_g = Math.round(bodyWeight_kg * 0.95);
  const carbs_kcal = target_kcal - protein_g * 4 - fat_g * 9;
  const carbs_g = Math.round(carbs_kcal / 4);
  return { maintenance_kcal, target_kcal, protein_g, carbs_g, fat_g };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/macros.ts tests/lib/macros.test.ts
git commit -m "feat(lib): calculate macro targets from bodyweight and surplus"
```

---

### Task 5: Date helpers

**Files:**
- Create: `src/lib/date.ts`, `tests/lib/date.test.ts`

- [ ] **Step 1: Write failing tests for date helpers**

Create `tests/lib/date.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { toISODate, weekStart, daysInRange } from '../../src/lib/date';

describe('toISODate', () => {
  it('formats a date as YYYY-MM-DD in local time', () => {
    const d = new Date(2026, 4, 15); // May 15, 2026 local
    expect(toISODate(d)).toBe('2026-05-15');
  });

  it('pads month and day', () => {
    const d = new Date(2026, 0, 3); // Jan 3
    expect(toISODate(d)).toBe('2026-01-03');
  });
});

describe('weekStart', () => {
  it('returns Monday as the start of the week', () => {
    // Thursday May 14, 2026 → Monday May 11, 2026
    const thursday = new Date(2026, 4, 14);
    expect(toISODate(weekStart(thursday))).toBe('2026-05-11');
  });

  it('returns the same date when given a Monday', () => {
    const monday = new Date(2026, 4, 11);
    expect(toISODate(weekStart(monday))).toBe('2026-05-11');
  });

  it('handles Sunday correctly (goes back 6 days)', () => {
    const sunday = new Date(2026, 4, 17);
    expect(toISODate(weekStart(sunday))).toBe('2026-05-11');
  });
});

describe('daysInRange', () => {
  it('returns ISO dates inclusive of start and end', () => {
    const start = new Date(2026, 4, 11);
    const end = new Date(2026, 4, 13);
    expect(daysInRange(start, end)).toEqual(['2026-05-11', '2026-05-12', '2026-05-13']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: All tests fail with "Cannot find module".

- [ ] **Step 3: Implement date.ts**

Create `src/lib/date.ts`:
```ts
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function weekStart(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay(); // 0 = Sunday, 1 = Monday, ...
  const offset = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - offset);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function daysInRange(start: Date, end: Date): string[] {
  const result: string[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cur <= last) {
    result.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All date tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/date.ts tests/lib/date.test.ts
git commit -m "feat(lib): add date helpers (ISO date, week start, range)"
```

---

### Task 6: Define shared types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create the types file**

Create `src/types.ts`:
```ts
export interface Settings {
  id: 1;
  bodyWeight_lbs: number;
  surplusTarget: number; // 200..350, multiples of 25
  startDate: string; // YYYY-MM-DD
}

export interface Food {
  id: string;
  name: string;
  calories: number; // per 100g
  protein: number;  // per 100g
  carbs: number;    // per 100g
  fat: number;      // per 100g
  servingSize: number;  // grams
  servingUnit: string;  // display only
  barcode?: string;
}

export interface LogEntry {
  id: string;
  date: string;     // YYYY-MM-DD
  foodId: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface WeightEntry {
  id: string;
  date: string;     // YYYY-MM-DD
  weight_lbs: number;
}

export interface CheckIn {
  id: string;
  date: string;
  measurements: {
    chest?: number;
    waist?: number;
    hips?: number;
    arms?: number;
    thighs?: number;
  };
  photoDataUrl?: string;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: define shared TypeScript types for app entities"
```

---

## Phase 3: Database Layer

### Task 7: Dexie database setup

**Files:**
- Create: `src/lib/db.ts`, `tests/lib/db.test.ts`

- [ ] **Step 1: Write failing test for database schema**

Create `tests/lib/db.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/lib/db';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('db', () => {
  it('opens and exposes the expected tables', () => {
    expect(db.settings).toBeDefined();
    expect(db.foods).toBeDefined();
    expect(db.logEntries).toBeDefined();
    expect(db.weightEntries).toBeDefined();
    expect(db.checkIns).toBeDefined();
  });

  it('stores and retrieves a settings row', async () => {
    await db.settings.put({
      id: 1,
      bodyWeight_lbs: 175,
      surplusTarget: 300,
      startDate: '2026-05-15',
    });
    const s = await db.settings.get(1);
    expect(s?.bodyWeight_lbs).toBe(175);
  });

  it('stores and queries food entries', async () => {
    await db.foods.add({
      id: 'food-1',
      name: 'Chicken Breast',
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 4,
      servingSize: 100,
      servingUnit: 'g',
    });
    const all = await db.foods.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Chicken Breast');
  });

  it('queries log entries by date', async () => {
    await db.logEntries.bulkAdd([
      { id: 'l1', date: '2026-05-15', foodId: 'food-1', grams: 200, calories: 330, protein: 62, carbs: 0, fat: 8 },
      { id: 'l2', date: '2026-05-14', foodId: 'food-1', grams: 100, calories: 165, protein: 31, carbs: 0, fat: 4 },
    ]);
    const today = await db.logEntries.where('date').equals('2026-05-15').toArray();
    expect(today).toHaveLength(1);
    expect(today[0].id).toBe('l1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: Tests fail with "Cannot find module".

- [ ] **Step 3: Implement db.ts**

Create `src/lib/db.ts`:
```ts
import Dexie, { type Table } from 'dexie';
import type { Settings, Food, LogEntry, WeightEntry, CheckIn } from '../types';

export class NutritionDB extends Dexie {
  settings!: Table<Settings, number>;
  foods!: Table<Food, string>;
  logEntries!: Table<LogEntry, string>;
  weightEntries!: Table<WeightEntry, string>;
  checkIns!: Table<CheckIn, string>;

  constructor() {
    super('nutrition-tracker');
    this.version(1).stores({
      settings: 'id',
      foods: 'id, name, barcode',
      logEntries: 'id, date, foodId',
      weightEntries: 'id, date',
      checkIns: 'id, date',
    });
  }
}

export const db = new NutritionDB();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All db tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/lib/db.test.ts
git commit -m "feat(db): set up Dexie schema with 5 tables"
```

---

## Phase 4: Navigation Shell

### Task 8: Tab bar component

**Files:**
- Create: `src/components/TabBar.tsx`

- [ ] **Step 1: Create TabBar component**

Create `src/components/TabBar.tsx`:
```tsx
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Today', icon: '📋', end: true },
  { to: '/library', label: 'Library', icon: '🥦', end: false },
  { to: '/progress', label: 'Progress', icon: '📈', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙️', end: false },
];

export default function TabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bg border-t border-border grid grid-cols-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
      {tabs.map(({ to, label, icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-xs ${isActive ? 'text-accent font-semibold' : 'text-muted'}`
          }
        >
          <span className="text-lg">{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TabBar.tsx
git commit -m "feat(ui): add bottom tab bar with active state styling"
```

---

### Task 9: Router with placeholder screens

**Files:**
- Create: `src/screens/TodayScreen.tsx`, `src/screens/LibraryScreen.tsx`, `src/screens/ProgressScreen.tsx`, `src/screens/SettingsScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create placeholder Today screen**

Create `src/screens/TodayScreen.tsx`:
```tsx
export default function TodayScreen() {
  return (
    <div className="p-4 pb-24">
      <h1 className="text-xl font-bold">Today</h1>
    </div>
  );
}
```

- [ ] **Step 2: Create placeholder Library screen**

Create `src/screens/LibraryScreen.tsx`:
```tsx
export default function LibraryScreen() {
  return (
    <div className="p-4 pb-24">
      <h1 className="text-xl font-bold">Library</h1>
    </div>
  );
}
```

- [ ] **Step 3: Create placeholder Progress screen**

Create `src/screens/ProgressScreen.tsx`:
```tsx
export default function ProgressScreen() {
  return (
    <div className="p-4 pb-24">
      <h1 className="text-xl font-bold">Progress</h1>
    </div>
  );
}
```

- [ ] **Step 4: Create placeholder Settings screen**

Create `src/screens/SettingsScreen.tsx`:
```tsx
export default function SettingsScreen() {
  return (
    <div className="p-4 pb-24">
      <h1 className="text-xl font-bold">Settings</h1>
    </div>
  );
}
```

- [ ] **Step 5: Wire up router in App.tsx**

Replace `src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TabBar from './components/TabBar';
import TodayScreen from './screens/TodayScreen';
import LibraryScreen from './screens/LibraryScreen';
import ProgressScreen from './screens/ProgressScreen';
import SettingsScreen from './screens/SettingsScreen';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg text-white">
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
        <TabBar />
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Run dev server and verify all four tabs work**

Run: `npm run dev`
Expected: Tapping each tab navigates to that screen with the correct heading. Active tab indicator (green) follows the current tab. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add src/screens/ src/App.tsx
git commit -m "feat(ui): add router with 4 placeholder screens and tab bar"
```

---

## Phase 5: Settings Screen

### Task 10: Settings hook

**Files:**
- Create: `src/hooks/useSettings.ts`, `tests/hooks/useSettings.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/hooks/useSettings.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSettings } from '../../src/hooks/useSettings';
import { db } from '../../src/lib/db';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('useSettings', () => {
  it('returns null while loading and then a default when nothing stored', async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.settings).not.toBeUndefined());
    expect(result.current.settings).toBeNull();
  });

  it('persists settings via save', async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.settings).not.toBeUndefined());

    await act(async () => {
      await result.current.save({ bodyWeight_lbs: 175, surplusTarget: 300, startDate: '2026-05-15' });
    });

    await waitFor(() => expect(result.current.settings?.bodyWeight_lbs).toBe(175));
    const stored = await db.settings.get(1);
    expect(stored?.surplusTarget).toBe(300);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: Tests fail with "Cannot find module".

- [ ] **Step 3: Implement useSettings**

Create `src/hooks/useSettings.ts`:
```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { Settings } from '../types';

export function useSettings() {
  const settings = useLiveQuery(async () => {
    const row = await db.settings.get(1);
    return row ?? null;
  }, []);

  async function save(input: Omit<Settings, 'id'>) {
    await db.settings.put({ id: 1, ...input });
  }

  return { settings, save };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: Both useSettings tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSettings.ts tests/hooks/useSettings.test.ts
git commit -m "feat(hooks): add useSettings with live query and save"
```

---

### Task 11: Build the Settings screen

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Replace SettingsScreen with the real implementation**

Replace `src/screens/SettingsScreen.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { calculateTargets } from '../lib/macros';
import { toISODate } from '../lib/date';

export default function SettingsScreen() {
  const { settings, save } = useSettings();
  const [bodyWeight, setBodyWeight] = useState<string>('');
  const [surplus, setSurplus] = useState<number>(300);

  useEffect(() => {
    if (settings) {
      setBodyWeight(String(settings.bodyWeight_lbs));
      setSurplus(settings.surplusTarget);
    }
  }, [settings]);

  const bw = parseFloat(bodyWeight);
  const valid = !Number.isNaN(bw) && bw > 0;
  const targets = valid ? calculateTargets({ bodyWeight_lbs: bw, surplusTarget: surplus }) : null;

  async function handleSave() {
    if (!valid) return;
    await save({
      bodyWeight_lbs: bw,
      surplusTarget: surplus,
      startDate: settings?.startDate ?? toISODate(new Date()),
    });
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>

      <section>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Your Stats</div>
        <div className="bg-card rounded-xl p-4 space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm">Body Weight</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(e.target.value)}
                onBlur={handleSave}
                className="bg-surface rounded-md px-2 py-1 w-20 text-right text-white"
                aria-label="Body weight in pounds"
              />
              <span className="text-subtle text-xs">lb</span>
            </div>
          </label>

          <label className="block">
            <div className="flex items-center justify-between text-sm">
              <span>Calorie Surplus</span>
              <span className="text-subtle text-xs">{surplus} kcal</span>
            </div>
            <input
              type="range"
              min={200}
              max={350}
              step={25}
              value={surplus}
              onChange={(e) => setSurplus(parseInt(e.target.value, 10))}
              onMouseUp={handleSave}
              onTouchEnd={handleSave}
              className="w-full mt-2 accent-accent"
              aria-label="Calorie surplus"
            />
          </label>
        </div>
      </section>

      {targets && (
        <section>
          <div className="text-xs uppercase tracking-wider text-muted mb-2">Calculated Targets</div>
          <div className="bg-card rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-subtle">Maintenance</span><span>{targets.maintenance_kcal} kcal</span></div>
            <div className="flex justify-between"><span className="text-subtle">Target (+ surplus)</span><span className="font-bold text-accent">{targets.target_kcal} kcal</span></div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between"><span className="text-protein">Protein</span><span>{targets.protein_g} g</span></div>
            <div className="flex justify-between"><span className="text-carbs">Carbs</span><span>{targets.carbs_g} g</span></div>
            <div className="flex justify-between"><span className="text-fat">Fat</span><span>{targets.fat_g} g</span></div>
          </div>
        </section>
      )}

      <section>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Program</div>
        <div className="bg-card rounded-xl p-4 text-sm">
          <div>4-Day Lean Bulk Blueprint</div>
          <div className="text-subtle text-xs mt-1">Intermediate · Upper/Lower Split</div>
          <div className="text-subtle text-xs mt-1">Target gain: 0.5 lb / week</div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Run dev server and verify**

Run: `npm run dev`
Expected: Navigate to Settings. Enter 175 in bodyweight, slide surplus to 300. Targets update live (maintenance 2625, target 2925, protein 159g, fat 75g, carbs 404g). Refresh — values persist. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat(settings): bodyweight + surplus inputs with live target calculation"
```

---

## Phase 6: Today Screen — Display

### Task 12: CalorieRing component

**Files:**
- Create: `src/components/CalorieRing.tsx`, `tests/components/CalorieRing.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/CalorieRing.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CalorieRing from '../../src/components/CalorieRing';

describe('CalorieRing', () => {
  it('renders consumed and target calories', () => {
    render(<CalorieRing consumed={1692} target={2925} />);
    expect(screen.getByText('1,692')).toBeInTheDocument();
    expect(screen.getByText(/2,925/)).toBeInTheDocument();
  });

  it('renders percentage rounded to whole number', () => {
    render(<CalorieRing consumed={1692} target={2925} />);
    // 1692 / 2925 = 0.5784 → 58%
    expect(screen.getByText('58%')).toBeInTheDocument();
  });

  it('caps the displayed percentage at 100', () => {
    render(<CalorieRing consumed={4000} target={2925} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: Tests fail with "Cannot find module".

- [ ] **Step 3: Implement CalorieRing**

Create `src/components/CalorieRing.tsx`:
```tsx
interface Props {
  consumed: number;
  target: number;
}

export default function CalorieRing({ consumed, target }: Props) {
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  const remaining = Math.max(0, target - consumed);
  return (
    <div className="flex items-center gap-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: `conic-gradient(#6ee7b7 0% ${pct}%, #333 ${pct}% 100%)` }}
        role="img"
        aria-label={`${pct}% of daily calories consumed`}
      >
        <div className="w-12 h-12 bg-card rounded-full flex items-center justify-center text-xs font-bold">
          {pct}%
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-accent">{consumed.toLocaleString()}</div>
        <div className="text-xs text-muted">of {target.toLocaleString()} kcal</div>
        <div className="text-xs text-subtle mt-0.5">{remaining.toLocaleString()} remaining</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All CalorieRing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/CalorieRing.tsx tests/components/CalorieRing.test.tsx
git commit -m "feat(ui): add CalorieRing component with conic-gradient progress"
```

---

### Task 13: MacroBars component

**Files:**
- Create: `src/components/MacroBars.tsx`, `tests/components/MacroBars.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/MacroBars.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MacroBars from '../../src/components/MacroBars';

describe('MacroBars', () => {
  it('renders all three macro values', () => {
    render(<MacroBars protein={{ actual: 104, target: 160 }} carbs={{ actual: 215, target: 391 }} fat={{ actual: 56, target: 80 }} />);
    expect(screen.getByText('104 / 160g')).toBeInTheDocument();
    expect(screen.getByText('215 / 391g')).toBeInTheDocument();
    expect(screen.getByText('56 / 80g')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: Tests fail with "Cannot find module".

- [ ] **Step 3: Implement MacroBars**

Create `src/components/MacroBars.tsx`:
```tsx
interface Macro {
  actual: number;
  target: number;
}

interface Props {
  protein: Macro;
  carbs: Macro;
  fat: Macro;
}

function Bar({ label, color, actual, target }: { label: string; color: string; actual: number; target: number }) {
  const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
  return (
    <div>
      <div className="text-[10px] text-muted mb-1">{label}</div>
      <div className="h-1 bg-border rounded">
        <div className="h-full rounded" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-[10px] text-white/80 mt-1">{Math.round(actual)} / {target}g</div>
    </div>
  );
}

export default function MacroBars({ protein, carbs, fat }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Bar label="Protein" color="#60a5fa" actual={protein.actual} target={protein.target} />
      <Bar label="Carbs" color="#fbbf24" actual={carbs.actual} target={carbs.target} />
      <Bar label="Fat" color="#f87171" actual={fat.actual} target={fat.target} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: MacroBars test passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/MacroBars.tsx tests/components/MacroBars.test.tsx
git commit -m "feat(ui): add MacroBars component for protein/carbs/fat progress"
```

---

### Task 14: Daily log hook

**Files:**
- Create: `src/hooks/useDailyLog.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useDailyLog.ts`:
```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { LogEntry } from '../types';

export function useDailyLog(date: string) {
  const entries = useLiveQuery(
    () => db.logEntries.where('date').equals(date).toArray(),
    [date],
    [] as LogEntry[]
  );

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  async function remove(id: string) {
    await db.logEntries.delete(id);
  }

  async function add(entry: LogEntry) {
    await db.logEntries.put(entry);
  }

  return { entries, totals, add, remove };
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDailyLog.ts
git commit -m "feat(hooks): add useDailyLog for date-scoped food log + totals"
```

---

### Task 15: FoodLogEntry component

**Files:**
- Create: `src/components/FoodLogEntry.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/FoodLogEntry.tsx`:
```tsx
import type { LogEntry } from '../types';

interface Props {
  entry: LogEntry;
  foodName: string;
  onDelete: (id: string) => void;
}

export default function FoodLogEntry({ entry, foodName, onDelete }: Props) {
  return (
    <div className="bg-card rounded-xl p-3 flex items-center justify-between">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{foodName} ({Math.round(entry.grams)}g)</div>
        <div className="text-xs text-muted">
          {Math.round(entry.protein)}p · {Math.round(entry.carbs)}c · {Math.round(entry.fat)}f
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-3">
        <span className="text-sm text-subtle">{Math.round(entry.calories)} kcal</span>
        <button
          onClick={() => onDelete(entry.id)}
          aria-label={`Delete ${foodName}`}
          className="text-muted text-lg leading-none px-1"
        >
          ×
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/FoodLogEntry.tsx
git commit -m "feat(ui): add FoodLogEntry row component"
```

---

### Task 16: Wire up Today screen (without add-food sheet yet)

**Files:**
- Modify: `src/screens/TodayScreen.tsx`

- [ ] **Step 1: Implement TodayScreen**

Replace `src/screens/TodayScreen.tsx`:
```tsx
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSettings } from '../hooks/useSettings';
import { useDailyLog } from '../hooks/useDailyLog';
import { calculateTargets } from '../lib/macros';
import { toISODate } from '../lib/date';
import { db } from '../lib/db';
import type { Food } from '../types';
import CalorieRing from '../components/CalorieRing';
import MacroBars from '../components/MacroBars';
import FoodLogEntry from '../components/FoodLogEntry';

export default function TodayScreen() {
  const today = toISODate(new Date());
  const { settings } = useSettings();
  const { entries, totals, remove } = useDailyLog(today);

  const foodIds = useMemo(() => entries.map((e) => e.foodId), [entries]);
  const foods = useLiveQuery<Food[]>(
    () => (foodIds.length === 0 ? Promise.resolve([] as Food[]) : db.foods.where('id').anyOf(foodIds).toArray()),
    [foodIds.join(',')],
    [] as Food[]
  );
  const foodNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of foods) map.set(f.id, f.name);
    return map;
  }, [foods]);

  const targets = settings ? calculateTargets(settings) : null;
  const formattedDate = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="p-4 pb-24 space-y-4">
      <div>
        <div className="text-xs text-muted">{formattedDate}</div>
        <h1 className="text-xl font-bold">Today</h1>
      </div>

      {!settings && (
        <div className="bg-card rounded-xl p-4 text-sm">
          Enter your bodyweight in <strong>Settings</strong> to see your targets.
        </div>
      )}

      {settings && targets && (
        <div className="bg-card rounded-xl p-4 space-y-3">
          <CalorieRing consumed={totals.calories} target={targets.target_kcal} />
          <MacroBars
            protein={{ actual: totals.protein, target: targets.protein_g }}
            carbs={{ actual: totals.carbs, target: targets.carbs_g }}
            fat={{ actual: totals.fat, target: targets.fat_g }}
          />
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Food Log</div>
        {entries.length === 0 ? (
          <div className="text-sm text-subtle">Nothing logged yet today.</div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((e) => (
              <FoodLogEntry
                key={e.id}
                entry={e}
                foodName={foodNameById.get(e.foodId) ?? '(unknown food)'}
                onDelete={remove}
              />
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="w-full bg-accent text-black font-bold rounded-xl py-3 text-sm"
        disabled
        title="Add Food (added in a later task)"
      >
        + Add Food
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify dev server**

Run: `npm run dev`
Expected: After saving settings, Today screen shows the calorie ring (0 / target), macro bars (all 0), empty log message, and a disabled "+ Add Food" button. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/screens/TodayScreen.tsx
git commit -m "feat(today): wire up ring, bars, and food log display"
```

---

## Phase 7: Food Library — Manual Entry

### Task 17: Foods hook

**Files:**
- Create: `src/hooks/useFoods.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useFoods.ts`:
```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { Food } from '../types';

export function useFoods() {
  const foods = useLiveQuery(
    () => db.foods.orderBy('name').toArray(),
    [],
    [] as Food[]
  );

  async function add(food: Food) {
    await db.foods.put(food);
  }

  async function remove(id: string) {
    await db.foods.delete(id);
  }

  return { foods, add, remove };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFoods.ts
git commit -m "feat(hooks): add useFoods for personal food library"
```

---

### Task 18: Library screen with manual add + search filter

**Files:**
- Modify: `src/screens/LibraryScreen.tsx`

- [ ] **Step 1: Implement LibraryScreen**

Replace `src/screens/LibraryScreen.tsx`:
```tsx
import { useState, useMemo } from 'react';
import { useFoods } from '../hooks/useFoods';
import type { Food } from '../types';

function blankDraft(): Omit<Food, 'id'> {
  return {
    name: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    servingSize: 100,
    servingUnit: 'g',
  };
}

export default function LibraryScreen() {
  const { foods, add, remove } = useFoods();
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(blankDraft());

  const filtered = useMemo(
    () =>
      query.trim() === ''
        ? foods
        : foods.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    [foods, query]
  );

  async function handleSave() {
    if (!draft.name.trim()) return;
    await add({ ...draft, id: crypto.randomUUID() });
    setDraft(blankDraft());
    setShowForm(false);
  }

  function update<K extends keyof Omit<Food, 'id'>>(key: K, value: Omit<Food, 'id'>[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function numberField(key: 'calories' | 'protein' | 'carbs' | 'fat' | 'servingSize', label: string) {
    return (
      <label className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <input
          type="number"
          inputMode="decimal"
          value={draft[key]}
          onChange={(e) => update(key, parseFloat(e.target.value) || 0)}
          className="bg-surface rounded-md px-2 py-1 w-24 text-right"
        />
      </label>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold">Library</h1>

      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search foods..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-card rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-accent text-black rounded-lg px-3 text-sm font-bold"
        >
          {showForm ? 'Cancel' : 'New'}
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl p-4 space-y-3">
          <label className="block text-sm">
            Name
            <input
              type="text"
              value={draft.name}
              onChange={(e) => update('name', e.target.value)}
              className="block w-full bg-surface rounded-md px-2 py-1 mt-1"
            />
          </label>
          <div className="text-xs text-muted">Per 100g</div>
          {numberField('calories', 'Calories')}
          {numberField('protein', 'Protein (g)')}
          {numberField('carbs', 'Carbs (g)')}
          {numberField('fat', 'Fat (g)')}
          <div className="text-xs text-muted pt-2">Default serving</div>
          {numberField('servingSize', 'Serving size (g)')}
          <button
            onClick={handleSave}
            className="w-full bg-accent text-black font-bold rounded-lg py-2 text-sm"
          >
            Save Food
          </button>
        </div>
      )}

      <div className="text-xs uppercase tracking-wider text-muted">My Foods</div>
      {filtered.length === 0 ? (
        <div className="text-sm text-subtle">No foods yet. Tap <strong>New</strong> to add one.</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((f) => (
            <div key={f.id} className="bg-card rounded-xl p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{f.name}</div>
                <div className="text-xs text-muted">
                  {Math.round(f.calories)} kcal / 100g · {Math.round(f.protein)}p {Math.round(f.carbs)}c {Math.round(f.fat)}f
                </div>
              </div>
              <button
                onClick={() => remove(f.id)}
                aria-label={`Delete ${f.name}`}
                className="text-muted text-lg leading-none px-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run dev server and verify**

Run: `npm run dev`
Expected: Tap **New**, fill in "Chicken Breast" with 165/31/0/4, serving 100, Save. Food appears. Type "chicken" in search — only filtered foods show. Delete works. Refresh — foods persist. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/screens/LibraryScreen.tsx
git commit -m "feat(library): manual food entry with search and delete"
```

---

## Phase 8: Add Food Sheet

### Task 19: AddFoodSheet — pick from library

**Files:**
- Create: `src/components/AddFoodSheet.tsx`
- Modify: `src/screens/TodayScreen.tsx`

- [ ] **Step 1: Create AddFoodSheet**

Create `src/components/AddFoodSheet.tsx`:
```tsx
import { useState, useMemo, useEffect } from 'react';
import { useFoods } from '../hooks/useFoods';
import type { Food, LogEntry } from '../types';

interface Props {
  open: boolean;
  date: string;
  onClose: () => void;
  onAdd: (entry: LogEntry) => void;
}

export default function AddFoodSheet({ open, date, onClose, onAdd }: Props) {
  const { foods } = useFoods();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState<string>('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelected(null);
      setGrams('');
    }
  }, [open]);

  useEffect(() => {
    if (selected) setGrams(String(selected.servingSize));
  }, [selected]);

  const filtered = useMemo(
    () =>
      query.trim() === ''
        ? foods
        : foods.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    [foods, query]
  );

  const gramsNum = parseFloat(grams);
  const canAdd = !!selected && !Number.isNaN(gramsNum) && gramsNum > 0;

  function handleAdd() {
    if (!canAdd || !selected) return;
    const f = gramsNum / 100;
    onAdd({
      id: crypto.randomUUID(),
      date,
      foodId: selected.id,
      grams: gramsNum,
      calories: selected.calories * f,
      protein: selected.protein * f,
      carbs: selected.carbs * f,
      fat: selected.fat * f,
    });
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl p-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Add Food</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted">×</button>
        </div>

        {!selected && (
          <>
            <input
              type="search"
              placeholder="Search my foods..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="bg-card rounded-lg px-3 py-2 text-sm mb-3"
            />
            <div className="overflow-y-auto -mx-1 px-1 space-y-1.5">
              {filtered.length === 0 ? (
                <div className="text-sm text-subtle px-1 py-2">
                  No foods in your library yet. Add one from the Library tab first.
                </div>
              ) : (
                filtered.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelected(f)}
                    className="w-full bg-card rounded-xl p-3 text-left"
                  >
                    <div className="text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-muted">
                      {Math.round(f.calories)} kcal / 100g
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {selected && (
          <div className="space-y-4">
            <button onClick={() => setSelected(null)} className="text-xs text-accent">← Back to list</button>
            <div className="bg-card rounded-xl p-3">
              <div className="text-sm font-medium">{selected.name}</div>
              <div className="text-xs text-muted">{selected.calories} kcal / 100g</div>
            </div>
            <label className="block text-sm">
              Grams
              <input
                type="number"
                inputMode="decimal"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                autoFocus
                className="block w-full bg-card rounded-md px-3 py-2 mt-1"
              />
            </label>
            {canAdd && (
              <div className="text-xs text-muted">
                = {Math.round(selected.calories * (gramsNum / 100))} kcal,{' '}
                {Math.round(selected.protein * (gramsNum / 100))}p ·{' '}
                {Math.round(selected.carbs * (gramsNum / 100))}c ·{' '}
                {Math.round(selected.fat * (gramsNum / 100))}f
              </div>
            )}
            <button
              onClick={handleAdd}
              disabled={!canAdd}
              className="w-full bg-accent text-black font-bold rounded-xl py-3 text-sm disabled:opacity-40"
            >
              Log to Today
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire AddFoodSheet into TodayScreen**

Replace the disabled button at the bottom of `src/screens/TodayScreen.tsx` and add state. Find:
```tsx
      <button
        type="button"
        className="w-full bg-accent text-black font-bold rounded-xl py-3 text-sm"
        disabled
        title="Add Food (added in a later task)"
      >
        + Add Food
      </button>
```

Replace with:
```tsx
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="w-full bg-accent text-black font-bold rounded-xl py-3 text-sm"
      >
        + Add Food
      </button>

      <AddFoodSheet
        open={sheetOpen}
        date={today}
        onClose={() => setSheetOpen(false)}
        onAdd={(entry) => db.logEntries.put(entry)}
      />
```

Add at the top of the file (imports):
```tsx
import { useState } from 'react';
import AddFoodSheet from '../components/AddFoodSheet';
```

Add inside the component body (before `return`):
```tsx
  const [sheetOpen, setSheetOpen] = useState(false);
```

- [ ] **Step 3: Run dev server and verify**

Run: `npm run dev`
Expected: From Today, tap "+ Add Food". Sheet slides up. Search filters foods. Tap a food → grams field appears (pre-filled with default serving) → tap "Log to Today" → entry appears in food log, ring and bars update. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/components/AddFoodSheet.tsx src/screens/TodayScreen.tsx
git commit -m "feat(today): add-food sheet — pick from library and log with grams"
```

---

## Phase 9: USDA Food Search

### Task 20: USDA API client

**Files:**
- Create: `src/lib/usda.ts`, `tests/lib/usda.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/usda.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchUsda } from '../../src/lib/usda';

const sampleResponse = {
  foods: [
    {
      fdcId: 123,
      description: 'Chicken Breast, raw',
      foodNutrients: [
        { nutrientId: 1003, value: 23.1 }, // protein
        { nutrientId: 1004, value: 1.65 }, // fat
        { nutrientId: 1005, value: 0 },    // carbs
        { nutrientId: 1008, value: 114 },  // energy kcal
      ],
    },
  ],
};

describe('searchUsda', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed results from the USDA API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleResponse,
    }));

    const results = await searchUsda('chicken', 'DEMO_KEY');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fdcId: 123,
      name: 'Chicken Breast, raw',
      calories: 114,
      protein: 23.1,
      carbs: 0,
      fat: 1.65,
    });
  });

  it('throws a friendly error when the API returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    }));
    await expect(searchUsda('chicken', 'DEMO_KEY')).rejects.toThrow(/USDA/);
  });

  it('returns an empty array when there are no foods', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ foods: [] }),
    }));
    const results = await searchUsda('nothing', 'DEMO_KEY');
    expect(results).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: Tests fail with "Cannot find module".

- [ ] **Step 3: Implement usda.ts**

Create `src/lib/usda.ts`:
```ts
export interface UsdaResult {
  fdcId: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const NUTRIENT_IDS = {
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  calories: 1008,
} as const;

function getNutrient(food: { foodNutrients: { nutrientId: number; value: number }[] }, id: number): number {
  return food.foodNutrients.find((n) => n.nutrientId === id)?.value ?? 0;
}

export async function searchUsda(query: string, apiKey: string): Promise<UsdaResult[]> {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', query);
  url.searchParams.set('pageSize', '20');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`USDA search failed (${res.status} ${res.statusText})`);
  }
  const data = (await res.json()) as { foods?: { fdcId: number; description: string; foodNutrients: { nutrientId: number; value: number }[] }[] };
  return (data.foods ?? []).map((f) => ({
    fdcId: f.fdcId,
    name: f.description,
    calories: getNutrient(f, NUTRIENT_IDS.calories),
    protein: getNutrient(f, NUTRIENT_IDS.protein),
    carbs: getNutrient(f, NUTRIENT_IDS.carbs),
    fat: getNutrient(f, NUTRIENT_IDS.fat),
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All USDA tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/usda.ts tests/lib/usda.test.ts
git commit -m "feat(lib): add USDA FoodData Central search client"
```

---

### Task 21: Plumb USDA API key via env var

**Files:**
- Modify: `src/lib/usda.ts`, `.gitignore` (already excludes .env)
- Create: `.env.example`

- [ ] **Step 1: Create .env.example**

Create `.env.example`:
```
# Get a free API key from https://fdc.nal.usda.gov/api-key-signup.html
# DEMO_KEY works for development but is heavily rate-limited
VITE_USDA_API_KEY=DEMO_KEY
```

- [ ] **Step 2: Update usda.ts to provide a wrapped helper that reads from env**

Append to `src/lib/usda.ts`:
```ts
export function getUsdaApiKey(): string {
  return import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY';
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add .env.example src/lib/usda.ts
git commit -m "feat(lib): plumb USDA API key from Vite env var"
```

---

### Task 22: Add USDA search to Library

**Files:**
- Modify: `src/screens/LibraryScreen.tsx`

- [ ] **Step 1: Add USDA search section to LibraryScreen**

In `src/screens/LibraryScreen.tsx`, add these imports at the top alongside existing imports:
```tsx
import { searchUsda, getUsdaApiKey, type UsdaResult } from '../lib/usda';
```

Add this state declaration block inside the `LibraryScreen` component (next to existing useState calls):
```tsx
  const [usdaResults, setUsdaResults] = useState<UsdaResult[]>([]);
  const [usdaLoading, setUsdaLoading] = useState(false);
  const [usdaError, setUsdaError] = useState<string | null>(null);

  async function runUsdaSearch() {
    if (query.trim().length < 2) return;
    setUsdaLoading(true);
    setUsdaError(null);
    try {
      const results = await searchUsda(query, getUsdaApiKey());
      setUsdaResults(results);
    } catch (e) {
      setUsdaError(e instanceof Error ? e.message : 'Search failed');
      setUsdaResults([]);
    } finally {
      setUsdaLoading(false);
    }
  }

  async function addFromUsda(r: UsdaResult) {
    await add({
      id: crypto.randomUUID(),
      name: r.name,
      calories: r.calories,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      servingSize: 100,
      servingUnit: 'g',
    });
  }
```

In the JSX, replace the existing search input block with the following:
```tsx
      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search foods..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') runUsdaSearch(); }}
          className="flex-1 bg-card rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={runUsdaSearch}
          disabled={query.trim().length < 2 || usdaLoading}
          className="bg-card text-white rounded-lg px-3 text-sm"
          aria-label="Search USDA"
        >
          🔍
        </button>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-accent text-black rounded-lg px-3 text-sm font-bold"
        >
          {showForm ? 'Cancel' : 'New'}
        </button>
      </div>
```

In the JSX, just before the `<div className="text-xs uppercase tracking-wider text-muted">My Foods</div>` line, insert this USDA results section:
```tsx
      {usdaLoading && <div className="text-sm text-subtle">Searching USDA…</div>}
      {usdaError && <div className="text-sm text-fat">{usdaError}</div>}
      {usdaResults.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wider text-muted mb-2">USDA Results</div>
          <div className="space-y-1.5">
            {usdaResults.map((r) => (
              <div key={r.fdcId} className="bg-card rounded-xl p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted">
                    {Math.round(r.calories)} kcal / 100g · {Math.round(r.protein)}p {Math.round(r.carbs)}c {Math.round(r.fat)}f
                  </div>
                </div>
                <button onClick={() => addFromUsda(r)} className="text-accent text-xl leading-none px-1" aria-label={`Add ${r.name} to library`}>+</button>
              </div>
            ))}
          </div>
        </section>
      )}
```

- [ ] **Step 2: Test the USDA flow**

Run: `npm run dev`
Expected: Type "chicken breast" in the search → tap the magnifier → USDA results render (or a friendly error if DEMO_KEY is rate-limited). Tap "+" on a result → added to **My Foods**. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/screens/LibraryScreen.tsx
git commit -m "feat(library): search USDA FoodData Central and add results to library"
```

---

## Phase 10: Barcode Scanning

### Task 23: Open Food Facts client

**Files:**
- Create: `src/lib/openFoodFacts.ts`, `tests/lib/openFoodFacts.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/openFoodFacts.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupBarcode } from '../../src/lib/openFoodFacts';

const sampleResponse = {
  status: 1,
  product: {
    product_name: 'Greek Yogurt',
    nutriments: {
      'energy-kcal_100g': 59,
      'proteins_100g': 10,
      'carbohydrates_100g': 3.6,
      'fat_100g': 0.4,
    },
  },
};

describe('lookupBarcode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed product data for a valid barcode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleResponse,
    }));
    const product = await lookupBarcode('5449000000996');
    expect(product).toEqual({
      barcode: '5449000000996',
      name: 'Greek Yogurt',
      calories: 59,
      protein: 10,
      carbs: 3.6,
      fat: 0.4,
    });
  });

  it('returns null when the product is not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 0 }),
    }));
    const product = await lookupBarcode('0000000000000');
    expect(product).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: Tests fail with "Cannot find module".

- [ ] **Step 3: Implement openFoodFacts.ts**

Create `src/lib/openFoodFacts.ts`:
```ts
export interface OffProduct {
  barcode: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export async function lookupBarcode(barcode: string): Promise<OffProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open Food Facts lookup failed (${res.status})`);
  }
  const data = (await res.json()) as {
    status?: number;
    product?: {
      product_name?: string;
      nutriments?: Record<string, number>;
    };
  };
  if (data.status !== 1 || !data.product) return null;

  const n = data.product.nutriments ?? {};
  return {
    barcode,
    name: data.product.product_name ?? 'Unknown product',
    calories: n['energy-kcal_100g'] ?? 0,
    protein: n['proteins_100g'] ?? 0,
    carbs: n['carbohydrates_100g'] ?? 0,
    fat: n['fat_100g'] ?? 0,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: Open Food Facts tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/openFoodFacts.ts tests/lib/openFoodFacts.test.ts
git commit -m "feat(lib): add Open Food Facts barcode lookup client"
```

---

### Task 24: BarcodeScanner component

**Files:**
- Create: `src/components/BarcodeScanner.tsx`
- Modify: `package.json` (add `@zxing/browser`)

- [ ] **Step 1: Install ZXing**

Run: `npm install @zxing/browser@^0.1.5 @zxing/library@^0.21.3`

- [ ] **Step 2: Create BarcodeScanner component**

Create `src/components/BarcodeScanner.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

export default function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const reader = new BrowserMultiFormatReader();
    let controls: { stop: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const c = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (result && !cancelled) {
            cancelled = true;
            onDetected(result.getText());
            controls?.stop();
            onClose();
          }
        });
        controls = c;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Camera unavailable');
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [open, onDetected, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <h2 className="text-lg font-bold">Scan Barcode</h2>
        <button onClick={onClose} aria-label="Close" className="text-2xl leading-none">×</button>
      </div>
      <div className="flex-1 relative flex items-center justify-center">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-x-8 inset-y-1/3 border-2 border-accent rounded-lg pointer-events-none" />
      </div>
      {error && <div className="p-4 text-fat text-sm">{error}</div>}
      <div className="p-4 text-center text-subtle text-xs">Point camera at a product barcode</div>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/BarcodeScanner.tsx package.json package-lock.json
git commit -m "feat(ui): add BarcodeScanner overlay using @zxing/browser"
```

---

### Task 25: Wire barcode scanning into the Library

**Files:**
- Modify: `src/screens/LibraryScreen.tsx`

- [ ] **Step 1: Wire up scanning**

In `src/screens/LibraryScreen.tsx`, add these imports:
```tsx
import BarcodeScanner from '../components/BarcodeScanner';
import { lookupBarcode } from '../lib/openFoodFacts';
```

Add this state and handler inside the component, alongside existing state:
```tsx
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  async function handleBarcode(barcode: string) {
    setScanError(null);
    try {
      const product = await lookupBarcode(barcode);
      if (!product) {
        setScanError(`No product found for barcode ${barcode}`);
        return;
      }
      await add({
        id: crypto.randomUUID(),
        name: product.name,
        calories: product.calories,
        protein: product.protein,
        carbs: product.carbs,
        fat: product.fat,
        servingSize: 100,
        servingUnit: 'g',
        barcode: product.barcode,
      });
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Lookup failed');
    }
  }
```

Add a scan button into the search row. Replace the `<div className="flex gap-2">` block (the one with search input + search button + new button) with:
```tsx
      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search foods..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') runUsdaSearch(); }}
          className="flex-1 bg-card rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={runUsdaSearch}
          disabled={query.trim().length < 2 || usdaLoading}
          className="bg-card text-white rounded-lg px-3 text-sm"
          aria-label="Search USDA"
        >
          🔍
        </button>
        <button
          onClick={() => setScanning(true)}
          className="bg-card text-white rounded-lg px-3 text-sm"
          aria-label="Scan barcode"
        >
          📷
        </button>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-accent text-black rounded-lg px-3 text-sm font-bold"
        >
          {showForm ? 'Cancel' : 'New'}
        </button>
      </div>
      {scanError && <div className="text-sm text-fat">{scanError}</div>}

      <BarcodeScanner
        open={scanning}
        onClose={() => setScanning(false)}
        onDetected={(b) => handleBarcode(b)}
      />
```

- [ ] **Step 2: Verify dev server**

Run: `npm run dev`
Expected: Tap camera icon → browser prompts for camera permission. Granting opens a scanner overlay. Test on a phone (the dev server URL is on your LAN) — scanning a real barcode adds the product to the library. Note: HTTPS is required on mobile; use `npm run preview` with a tunnel like `cloudflared` or test in dev on localhost. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/screens/LibraryScreen.tsx
git commit -m "feat(library): barcode scan adds Open Food Facts products"
```

---

## Phase 11: Progress — Weight

### Task 26: Weight hook with weekly averages

**Files:**
- Create: `src/hooks/useWeight.ts`, `tests/hooks/useWeight.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/hooks/useWeight.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWeight } from '../../src/hooks/useWeight';
import { db } from '../../src/lib/db';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('useWeight', () => {
  it('adds and lists weight entries', async () => {
    const { result } = renderHook(() => useWeight());
    await waitFor(() => expect(result.current.entries).toBeDefined());

    await act(async () => {
      await result.current.add({ date: '2026-05-15', weight_lbs: 175 });
    });

    await waitFor(() => expect(result.current.entries.length).toBe(1));
    expect(result.current.entries[0].weight_lbs).toBe(175);
  });

  it('returns the latest weekly average', async () => {
    const { result } = renderHook(() => useWeight());
    await waitFor(() => expect(result.current.entries).toBeDefined());

    // Week of May 11–17, 2026 (Mon–Sun)
    await act(async () => {
      await result.current.add({ date: '2026-05-12', weight_lbs: 174 });
      await result.current.add({ date: '2026-05-14', weight_lbs: 175 });
      await result.current.add({ date: '2026-05-16', weight_lbs: 176 });
    });

    await waitFor(() => expect(result.current.entries.length).toBe(3));
    expect(result.current.weeklyAverages.length).toBeGreaterThan(0);
    const latest = result.current.weeklyAverages[result.current.weeklyAverages.length - 1];
    expect(latest.weekStart).toBe('2026-05-11');
    expect(latest.average).toBeCloseTo(175);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: Tests fail with "Cannot find module".

- [ ] **Step 3: Implement useWeight**

Create `src/hooks/useWeight.ts`:
```ts
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { WeightEntry } from '../types';
import { toISODate, weekStart } from '../lib/date';

export interface WeeklyAverage {
  weekStart: string; // YYYY-MM-DD (Monday)
  average: number;
  count: number;
}

export function useWeight() {
  const entries = useLiveQuery(
    () => db.weightEntries.orderBy('date').toArray(),
    [],
    [] as WeightEntry[]
  );

  const weeklyAverages = useMemo<WeeklyAverage[]>(() => {
    const buckets = new Map<string, number[]>();
    for (const e of entries) {
      const wk = toISODate(weekStart(new Date(e.date + 'T00:00:00')));
      const list = buckets.get(wk) ?? [];
      list.push(e.weight_lbs);
      buckets.set(wk, list);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, values]) => ({
        weekStart,
        average: values.reduce((s, v) => s + v, 0) / values.length,
        count: values.length,
      }));
  }, [entries]);

  async function add(input: Omit<WeightEntry, 'id'>) {
    await db.weightEntries.put({ id: crypto.randomUUID(), ...input });
  }

  async function remove(id: string) {
    await db.weightEntries.delete(id);
  }

  return { entries, weeklyAverages, add, remove };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All useWeight tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useWeight.ts tests/hooks/useWeight.test.ts
git commit -m "feat(hooks): add useWeight with weekly average bucketing"
```

---

### Task 27: Install Recharts and build WeightChart

**Files:**
- Create: `src/components/WeightChart.tsx`
- Modify: `package.json`

- [ ] **Step 1: Install Recharts**

Run: `npm install recharts@^2.12.7`

- [ ] **Step 2: Create WeightChart**

Create `src/components/WeightChart.tsx`:
```tsx
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { WeeklyAverage } from '../hooks/useWeight';

interface Props {
  data: WeeklyAverage[];
}

export default function WeightChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="text-sm text-subtle">Log your weight to see the trend.</div>;
  }
  const chartData = data.map((w) => ({ week: w.weekStart.slice(5), avg: Number(w.average.toFixed(1)) }));
  return (
    <div className="h-32 -mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="week" tick={{ fill: '#888', fontSize: 10 }} />
          <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
          <Tooltip
            contentStyle={{ background: '#252525', border: 'none', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#888' }}
          />
          <Line type="monotone" dataKey="avg" stroke="#6ee7b7" strokeWidth={2} dot={{ r: 3, fill: '#6ee7b7' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/WeightChart.tsx package.json package-lock.json
git commit -m "feat(ui): add WeightChart using Recharts"
```

---

## Phase 12: Check-ins (measurements + photos)

### Task 28: Photo resize utility

**Files:**
- Create: `src/lib/photos.ts`

- [ ] **Step 1: Create resize function**

Create `src/lib/photos.ts`:
```ts
const MAX_DIMENSION = 1080;
const JPEG_QUALITY = 0.8;

export async function resizeImageFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const longest = Math.max(width, height);
  const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/photos.ts
git commit -m "feat(lib): add client-side photo resize utility"
```

---

### Task 29: Check-ins hook

**Files:**
- Create: `src/hooks/useCheckIns.ts`

- [ ] **Step 1: Create useCheckIns**

Create `src/hooks/useCheckIns.ts`:
```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { CheckIn } from '../types';

export function useCheckIns() {
  const checkIns = useLiveQuery(
    () => db.checkIns.orderBy('date').toArray(),
    [],
    [] as CheckIn[]
  );

  async function add(input: Omit<CheckIn, 'id'>) {
    await db.checkIns.put({ id: crypto.randomUUID(), ...input });
  }

  async function remove(id: string) {
    await db.checkIns.delete(id);
  }

  return { checkIns, add, remove };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCheckIns.ts
git commit -m "feat(hooks): add useCheckIns"
```

---

### Task 30: CheckInForm component

**Files:**
- Create: `src/components/CheckInForm.tsx`

- [ ] **Step 1: Create CheckInForm**

Create `src/components/CheckInForm.tsx`:
```tsx
import { useState } from 'react';
import { resizeImageFile } from '../lib/photos';
import { toISODate } from '../lib/date';
import type { CheckIn } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (input: Omit<CheckIn, 'id'>) => void;
}

type MeasurementKey = 'chest' | 'waist' | 'hips' | 'arms' | 'thighs';
const MEASUREMENT_FIELDS: { key: MeasurementKey; label: string }[] = [
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'arms', label: 'Arms' },
  { key: 'thighs', label: 'Thighs' },
];

export default function CheckInForm({ open, onClose, onSave }: Props) {
  const [values, setValues] = useState<Record<MeasurementKey, string>>({
    chest: '', waist: '', hips: '', arms: '', thighs: '',
  });
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handlePhoto(file: File) {
    setBusy(true);
    try {
      const dataUrl = await resizeImageFile(file);
      setPhotoDataUrl(dataUrl);
    } finally {
      setBusy(false);
    }
  }

  function handleSave() {
    const measurements: CheckIn['measurements'] = {};
    for (const { key } of MEASUREMENT_FIELDS) {
      const n = parseFloat(values[key]);
      if (!Number.isNaN(n)) measurements[key] = n;
    }
    onSave({
      date: toISODate(new Date()),
      measurements,
      photoDataUrl: photoDataUrl ?? undefined,
    });
    setValues({ chest: '', waist: '', hips: '', arms: '', thighs: '' });
    setPhotoDataUrl(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl p-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">New Check-in</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {MEASUREMENT_FIELDS.map(({ key, label }) => (
            <label key={key} className="block text-sm">
              {label} (in)
              <input
                type="number"
                inputMode="decimal"
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                className="block w-full bg-card rounded-md px-2 py-1 mt-1"
              />
            </label>
          ))}
        </div>

        <div className="mt-4">
          <label className="block">
            <span className="text-sm">Photo (optional)</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }}
              className="block w-full text-sm mt-1"
            />
          </label>
          {busy && <div className="text-xs text-subtle mt-2">Resizing…</div>}
          {photoDataUrl && (
            <img src={photoDataUrl} alt="Check-in preview" className="mt-2 rounded-lg max-h-40 mx-auto" />
          )}
        </div>

        <button
          onClick={handleSave}
          className="mt-4 w-full bg-accent text-black font-bold rounded-xl py-3 text-sm"
        >
          Save Check-in
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CheckInForm.tsx
git commit -m "feat(ui): add CheckInForm with measurements + photo upload"
```

---

### Task 31: Wire up Progress screen

**Files:**
- Modify: `src/screens/ProgressScreen.tsx`

- [ ] **Step 1: Implement ProgressScreen**

Replace `src/screens/ProgressScreen.tsx`:
```tsx
import { useState } from 'react';
import { useWeight } from '../hooks/useWeight';
import { useCheckIns } from '../hooks/useCheckIns';
import { toISODate } from '../lib/date';
import WeightChart from '../components/WeightChart';
import CheckInForm from '../components/CheckInForm';

export default function ProgressScreen() {
  const { entries: weightEntries, weeklyAverages, add: addWeight, remove: removeWeight } = useWeight();
  const { checkIns, add: addCheckIn, remove: removeCheckIn } = useCheckIns();
  const [weightInput, setWeightInput] = useState('');
  const [checkInOpen, setCheckInOpen] = useState(false);

  async function handleWeightSubmit() {
    const w = parseFloat(weightInput);
    if (Number.isNaN(w) || w <= 0) return;
    await addWeight({ date: toISODate(new Date()), weight_lbs: w });
    setWeightInput('');
  }

  const latestAvg = weeklyAverages[weeklyAverages.length - 1];
  const priorAvg = weeklyAverages[weeklyAverages.length - 2];
  const deltaPerWeek = latestAvg && priorAvg ? latestAvg.average - priorAvg.average : null;
  const latestCheckIn = checkIns[checkIns.length - 1];

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold">Progress</h1>

      {/* Weight section */}
      <section>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Weight · Weekly Avg</div>
        <div className="bg-card rounded-xl p-4 space-y-3">
          {latestAvg ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{latestAvg.average.toFixed(1)} <span className="text-xs text-subtle">lb avg</span></div>
                {deltaPerWeek !== null && (
                  <div className={`text-xs ${deltaPerWeek >= 0 ? 'text-accent' : 'text-fat'}`}>
                    {deltaPerWeek >= 0 ? '+' : ''}{deltaPerWeek.toFixed(1)} lb/wk
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-subtle">No weight logged yet.</div>
          )}
          <WeightChart data={weeklyAverages} />
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="Today's weight (lb)"
              className="flex-1 bg-surface rounded-md px-3 py-2 text-sm"
            />
            <button
              onClick={handleWeightSubmit}
              className="bg-accent text-black font-bold rounded-md px-3 text-sm"
            >
              + Weight
            </button>
          </div>
          {weightEntries.length > 0 && (
            <details className="text-xs">
              <summary className="text-subtle cursor-pointer">Recent entries</summary>
              <ul className="mt-2 space-y-1">
                {weightEntries.slice(-7).reverse().map((e) => (
                  <li key={e.id} className="flex justify-between">
                    <span>{e.date}</span>
                    <span className="flex items-center gap-2">
                      {e.weight_lbs.toFixed(1)} lb
                      <button onClick={() => removeWeight(e.id)} aria-label={`Delete weight ${e.date}`} className="text-muted">×</button>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </section>

      {/* Measurements section */}
      <section>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Measurements</div>
        <div className="bg-card rounded-xl p-4">
          {latestCheckIn ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {(['chest', 'waist', 'hips', 'arms', 'thighs'] as const).map((k) => (
                <div key={k}>
                  <div className="text-xs text-muted capitalize">{k}</div>
                  <div>{latestCheckIn.measurements[k] !== undefined ? `${latestCheckIn.measurements[k]} in` : '—'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-subtle">No check-ins yet.</div>
          )}
          <button
            onClick={() => setCheckInOpen(true)}
            className="mt-3 w-full bg-accent text-black font-bold rounded-md py-2 text-sm"
          >
            + Check-in
          </button>
        </div>
      </section>

      {/* Photos section */}
      {checkIns.some((c) => c.photoDataUrl) && (
        <section>
          <div className="text-xs uppercase tracking-wider text-muted mb-2">Photos</div>
          <div className="grid grid-cols-2 gap-2">
            {checkIns.filter((c) => c.photoDataUrl).map((c) => (
              <div key={c.id} className="relative">
                <img src={c.photoDataUrl} alt={`Check-in ${c.date}`} className="rounded-lg w-full" />
                <div className="absolute bottom-1 left-1 text-xs bg-black/60 rounded px-1.5 py-0.5">{c.date}</div>
                <button
                  onClick={() => removeCheckIn(c.id)}
                  aria-label={`Delete check-in ${c.date}`}
                  className="absolute top-1 right-1 bg-black/60 rounded-full w-6 h-6 text-sm leading-none"
                >×</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <CheckInForm
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        onSave={(input) => addCheckIn(input)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run dev server and verify**

Run: `npm run dev`
Expected: Progress tab shows the weight section. Log 175 → entry saved, average shows 175.0. Log another → re-renders. Open Check-in → enter chest/waist → save → values shown. If a photo is attached, it appears in the photos grid. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/screens/ProgressScreen.tsx
git commit -m "feat(progress): weight logging, weekly avg, measurements, photos"
```

---

## Phase 13: PWA

### Task 32: PWA plugin and manifest

**Files:**
- Modify: `vite.config.ts`, `package.json`
- Create: `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`

- [ ] **Step 1: Install vite-plugin-pwa**

Run: `npm install -D vite-plugin-pwa@^0.20.5`

- [ ] **Step 2: Generate icon placeholders**

The icons can be solid-color PNGs with the accent green and a white "N" — generate them programmatically:

Create `scripts/generate-icons.mjs`:
```js
import { writeFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';

// Generates a simple "N" icon SVG at the requested size.
// SVGs are accepted by the PWA manifest; replace with real PNGs before release if desired.
function makeIconSvg(size) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="#111111"/>
  <rect x="${size * 0.1}" y="${size * 0.1}" width="${size * 0.8}" height="${size * 0.8}" rx="${size * 0.15}" fill="#6ee7b7"/>
  <text x="50%" y="58%" text-anchor="middle" font-family="-apple-system, sans-serif" font-weight="700" font-size="${size * 0.5}" fill="#111111">N</text>
</svg>`;
}

await mkdir('public', { recursive: true });
await writeFile('public/icon-192.svg', makeIconSvg(192));
await writeFile('public/icon-512.svg', makeIconSvg(512));
await writeFile('public/apple-touch-icon.svg', makeIconSvg(180));
console.log('Wrote icon SVGs to public/. Replace with PNGs before release.');
```

Run: `node scripts/generate-icons.mjs`
Expected: Three SVG icon files appear under `public/`.

- [ ] **Step 3: Update vite.config.ts with PWA plugin**

Replace `vite.config.ts`:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.svg', 'icon-512.svg', 'apple-touch-icon.svg'],
      manifest: {
        name: 'Nutrition Tracker',
        short_name: 'Nutrition',
        description: 'Lean bulk nutrition tracker for the 4-Day Blueprint',
        theme_color: '#111111',
        background_color: '#111111',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname === 'api.nal.usda.gov',
            handler: 'NetworkFirst',
            options: { cacheName: 'usda-api', networkTimeoutSeconds: 5 },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('openfoodfacts.org'),
            handler: 'NetworkFirst',
            options: { cacheName: 'off-api', networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
```

- [ ] **Step 4: Add apple-touch-icon link to index.html**

Replace `index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#111111" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Nutrition" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
    <link rel="icon" href="/icon-192.svg" />
    <title>Nutrition Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Build and verify PWA assets**

Run: `npm run build`
Expected: Build completes. `dist/` contains `manifest.webmanifest`, `sw.js`, and the icon SVGs.

Run: `npm run preview`
Expected: Open the preview URL (e.g., `http://localhost:4173`) on an iPhone (`Share → Add to Home Screen`). The app installs with the green icon and "Nutrition" label. Tapping the icon opens the app in standalone mode. Stop the preview server.

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts index.html scripts/generate-icons.mjs public/ package.json package-lock.json
git commit -m "feat(pwa): make installable with manifest, icons, and offline shell"
```

---

## Phase 14: Final polish

### Task 33: Empty-state and offline guards on USDA search

**Files:**
- Modify: `src/screens/LibraryScreen.tsx`

- [ ] **Step 1: Guard USDA search when offline**

In `src/screens/LibraryScreen.tsx`, replace the `runUsdaSearch` function with:
```tsx
  async function runUsdaSearch() {
    if (query.trim().length < 2) return;
    if (!navigator.onLine) {
      setUsdaError('Offline — USDA search requires a connection.');
      return;
    }
    setUsdaLoading(true);
    setUsdaError(null);
    try {
      const results = await searchUsda(query, getUsdaApiKey());
      setUsdaResults(results);
    } catch (e) {
      setUsdaError(e instanceof Error ? e.message : 'Search failed');
      setUsdaResults([]);
    } finally {
      setUsdaLoading(false);
    }
  }
```

Apply the same guard to `handleBarcode`. Replace its body with:
```tsx
  async function handleBarcode(barcode: string) {
    setScanError(null);
    if (!navigator.onLine) {
      setScanError('Offline — barcode lookup requires a connection.');
      return;
    }
    try {
      const product = await lookupBarcode(barcode);
      if (!product) {
        setScanError(`No product found for barcode ${barcode}`);
        return;
      }
      await add({
        id: crypto.randomUUID(),
        name: product.name,
        calories: product.calories,
        protein: product.protein,
        carbs: product.carbs,
        fat: product.fat,
        servingSize: 100,
        servingUnit: 'g',
        barcode: product.barcode,
      });
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Lookup failed');
    }
  }
```

- [ ] **Step 2: Verify dev server**

Run: `npm run dev`
Expected: With network disabled, USDA search shows the offline message; barcode scanning shows the same. With network on, both work normally. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/screens/LibraryScreen.tsx
git commit -m "feat(library): friendly offline guards on USDA + barcode lookups"
```

---

### Task 34: Final full-stack smoke test

**Files:** _none_

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass (macros, date, db, usda, openFoodFacts, useSettings, useWeight, CalorieRing, MacroBars).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: Build completes with no errors.

- [ ] **Step 4: Smoke test the production build**

Run: `npm run preview -- --host 0.0.0.0`
Expected (on iPhone, after installing via Add to Home Screen):
1. Open the app from the home screen — opens standalone, no browser chrome.
2. Settings → enter bodyweight 175, surplus 300 → targets calculate correctly.
3. Library → add "Chicken Breast" manually (165/31/0/4 per 100g).
4. Today → "+ Add Food" → pick Chicken Breast → 200g → log → ring and bars update.
5. Library → search "rice" via USDA magnifier → add one result.
6. Library → tap camera → scan a product barcode → product added to library.
7. Progress → log weight 175 → entry persists, average shows 175.0.
8. Progress → "+ Check-in" → enter chest/waist + attach a photo → save → photo appears in grid.
9. Airplane mode on — all logging still works; only USDA/barcode lookups show "offline" messages.
10. Force-quit and reopen — all data is still present.

Stop the preview server.

- [ ] **Step 5: Final commit (only if any docs changed)**

If no changes to commit, skip this step. Otherwise:
```bash
git add -A
git commit -m "chore: post-smoke-test cleanup"
```

---
