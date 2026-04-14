# Mac Telemetry Tauri Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current React simulation into a Tauri v2 macOS Apple Silicon desktop app shell that renders only real telemetry or explicit unavailability states.

**Architecture:** Replace the random simulation hook with a telemetry provider interface and a truthful metric-state model. Keep the sci-fi SoC chamber UI, but drive it from a browser-safe fallback provider on Windows and a Tauri-native provider on macOS. Add a minimal Rust Tauri scaffold so the frontend can later consume Apple Silicon telemetry without rewriting the UI again.

**Tech Stack:** React 19, Vite 6, TypeScript, Vitest, React Testing Library, Tauri v2, Rust

---

### Task 1: Add telemetry domain model and failing provider tests

**Files:**
- Modify: `F:/Code/Work/IOT/desktop/MacVdesktop/package.json`
- Create: `F:/Code/Work/IOT/desktop/MacVdesktop/src/domain/telemetry/types.ts`
- Create: `F:/Code/Work/IOT/desktop/MacVdesktop/src/domain/telemetry/browserSnapshot.ts`
- Create: `F:/Code/Work/IOT/desktop/MacVdesktop/src/domain/telemetry/layout.ts`
- Create: `F:/Code/Work/IOT/desktop/MacVdesktop/src/integrations/telemetry/provider.ts`
- Test: `F:/Code/Work/IOT/desktop/MacVdesktop/src/domain/telemetry/browserSnapshot.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { createBrowserTelemetrySnapshot } from './browserSnapshot'

describe('createBrowserTelemetrySnapshot', () => {
  it('marks mac-only telemetry modules as unavailable in browser mode', () => {
    const snapshot = createBrowserTelemetrySnapshot()

    expect(snapshot.runtime.kind).toBe('browser')
    expect(snapshot.modules.find((module) => module.id === 'cpu-cluster')?.primaryMetric.state).toBe('unavailable')
    expect(snapshot.modules.find((module) => module.id === 'thermal-state')?.primaryMetric.reason).toContain('Requires macOS Tauri host')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/domain/telemetry/browserSnapshot.test.ts`
Expected: FAIL with module-not-found or exported symbol missing for `createBrowserTelemetrySnapshot`

- [ ] **Step 3: Write minimal implementation**

```ts
export type MetricState =
  | { state: 'available'; value: number; unit: string; updatedAt: string; source: string }
  | { state: 'unavailable'; unit: string; reason: string; source: string }
  | { state: 'loading'; unit: string; source: string }

export interface TelemetryModule {
  id: string
  name: string
  summary: string
  status: 'live' | 'warning' | 'unavailable'
  x: number
  y: number
  primaryMetric: MetricState
}

export function createBrowserTelemetrySnapshot() {
  return {
    runtime: { kind: 'browser', label: 'Browser development mode' },
    modules: [
      {
        id: 'cpu-cluster',
        name: 'CPU Cluster',
        summary: 'Native telemetry unavailable in browser mode',
        status: 'unavailable',
        x: 10,
        y: 10,
        primaryMetric: {
          state: 'unavailable',
          unit: '%',
          reason: 'Requires macOS Tauri host',
          source: 'browser-provider',
        },
      },
      {
        id: 'thermal-state',
        name: 'Thermal State',
        summary: 'Thermal state unavailable outside macOS desktop runtime',
        status: 'unavailable',
        x: 12,
        y: 10,
        primaryMetric: {
          state: 'unavailable',
          unit: 'state',
          reason: 'Requires macOS Tauri host',
          source: 'browser-provider',
        },
      },
    ],
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/domain/telemetry/browserSnapshot.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json src/domain/telemetry/types.ts src/domain/telemetry/browserSnapshot.ts src/domain/telemetry/layout.ts src/integrations/telemetry/provider.ts src/domain/telemetry/browserSnapshot.test.ts
git commit -m "test: add truthful telemetry provider contract"
```

### Task 2: Refactor the dashboard to consume telemetry instead of simulation

**Files:**
- Modify: `F:/Code/Work/IOT/desktop/MacVdesktop/src/App.tsx`
- Modify: `F:/Code/Work/IOT/desktop/MacVdesktop/src/components/Dashboard.tsx`
- Modify: `F:/Code/Work/IOT/desktop/MacVdesktop/src/components/MetricsPanel.tsx`
- Modify: `F:/Code/Work/IOT/desktop/MacVdesktop/src/components/ServerRoom.tsx`
- Modify: `F:/Code/Work/IOT/desktop/MacVdesktop/src/components/ServerRack.tsx`
- Modify: `F:/Code/Work/IOT/desktop/MacVdesktop/src/types.ts`
- Create: `F:/Code/Work/IOT/desktop/MacVdesktop/src/hooks/useTelemetry.ts`
- Create: `F:/Code/Work/IOT/desktop/MacVdesktop/src/domain/telemetry/summary.ts`
- Test: `F:/Code/Work/IOT/desktop/MacVdesktop/src/components/Dashboard.test.tsx`
- Test: `F:/Code/Work/IOT/desktop/MacVdesktop/src/components/MetricsPanel.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from '@testing-library/react'
import { Dashboard } from './Dashboard'

vi.mock('../hooks/useTelemetry', () => ({
  useTelemetry: () => ({
    snapshot: {
      runtime: { kind: 'browser', label: 'Browser development mode' },
      modules: [],
      generatedAt: '2026-04-13T00:00:00.000Z',
    },
    status: 'ready',
    error: null,
  }),
}))

test('shows browser-mode warning instead of fake telemetry status', () => {
  render(<Dashboard />)
  expect(screen.getByText(/Browser development mode/i)).toBeInTheDocument()
  expect(screen.getByText(/Requires macOS Tauri host/i)).toBeInTheDocument()
})
```

```tsx
import { render, screen } from '@testing-library/react'
import { MetricsPanel } from './MetricsPanel'

test('renders unavailable metric reasons', () => {
  render(
    <MetricsPanel
      module={{
        id: 'thermal-state',
        name: 'Thermal State',
        summary: 'Not available',
        status: 'unavailable',
        x: 0,
        y: 0,
        primaryMetric: {
          state: 'unavailable',
          unit: 'state',
          reason: 'Requires macOS Tauri host',
          source: 'browser-provider',
        },
        metrics: [],
        detailLines: [],
      }}
    />,
  )

  expect(screen.getByText(/Requires macOS Tauri host/i)).toBeInTheDocument()
  expect(screen.getByText(/Unavailable/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/components/Dashboard.test.tsx src/components/MetricsPanel.test.tsx`
Expected: FAIL because `useTelemetry` and the new metric-aware props do not exist yet

- [ ] **Step 3: Write minimal implementation**

```ts
export function useTelemetry() {
  const [snapshot, setSnapshot] = useState(createBrowserTelemetrySnapshot())

  useEffect(() => {
    setSnapshot(createBrowserTelemetrySnapshot())
  }, [])

  return { snapshot, status: 'ready', error: null }
}
```

```tsx
const runtimeLabel = snapshot.runtime.label
const selectedModule = snapshot.modules.find((module) => module.id === selectedModuleId) ?? null

return (
  <div>
    <header>
      <span>{runtimeLabel}</span>
      <span>Requires macOS Tauri host for live telemetry</span>
    </header>
    <ServerRoom modules={snapshot.modules} onSelectModule={setSelectedModuleId} selectedModuleId={selectedModuleId} />
    <MetricsPanel module={selectedModule} />
  </div>
)
```

```tsx
{module.primaryMetric.state === 'available' ? (
  <span>{Math.round(module.primaryMetric.value)}{module.primaryMetric.unit}</span>
) : (
  <span>Unavailable</span>
)}
<p>{module.primaryMetric.state === 'unavailable' ? module.primaryMetric.reason : module.summary}</p>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- --run src/components/Dashboard.test.tsx src/components/MetricsPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/Dashboard.tsx src/components/MetricsPanel.tsx src/components/ServerRoom.tsx src/components/ServerRack.tsx src/types.ts src/hooks/useTelemetry.ts src/domain/telemetry/summary.ts src/components/Dashboard.test.tsx src/components/MetricsPanel.test.tsx
git commit -m "feat: replace simulation UI with truthful telemetry states"
```

### Task 3: Add runtime detection and Tauri v2 provider stubs

**Files:**
- Modify: `F:/Code/Work/IOT/desktop/MacVdesktop/package.json`
- Modify: `F:/Code/Work/IOT/desktop/MacVdesktop/vite.config.ts`
- Create: `F:/Code/Work/IOT/desktop/MacVdesktop/src/lib/runtime.ts`
- Create: `F:/Code/Work/IOT/desktop/MacVdesktop/src/integrations/telemetry/tauriProvider.ts`
- Create: `F:/Code/Work/IOT/desktop/MacVdesktop/src-tauri/Cargo.toml`
- Create: `F:/Code/Work/IOT/desktop/MacVdesktop/src-tauri/tauri.conf.json`
- Create: `F:/Code/Work/IOT/desktop/MacVdesktop/src-tauri/src/main.rs`
- Create: `F:/Code/Work/IOT/desktop/MacVdesktop/src-tauri/src/telemetry.rs`
- Test: `F:/Code/Work/IOT/desktop/MacVdesktop/src/lib/runtime.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { getRuntimeKind } from './runtime'

describe('getRuntimeKind', () => {
  it('defaults to browser when Tauri globals are absent', () => {
    expect(getRuntimeKind()).toBe('browser')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/runtime.test.ts`
Expected: FAIL because `getRuntimeKind` does not exist yet

- [ ] **Step 3: Write minimal implementation**

```ts
export function getRuntimeKind(): 'browser' | 'tauri' {
  return '__TAURI_INTERNALS__' in window ? 'tauri' : 'browser'
}
```

```ts
import { invoke } from '@tauri-apps/api/core'

export async function getTauriTelemetrySnapshot() {
  return invoke('get_telemetry_snapshot')
}
```

```rust
#[tauri::command]
fn get_telemetry_snapshot() -> telemetry::TelemetrySnapshot {
    telemetry::browser_like_unavailable_snapshot()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/runtime.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json vite.config.ts src/lib/runtime.ts src/integrations/telemetry/tauriProvider.ts src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/src/main.rs src-tauri/src/telemetry.rs src/lib/runtime.test.ts
git commit -m "feat: add tauri runtime scaffold for native telemetry"
```

### Task 4: Remove misleading AI Studio setup and verify the build

**Files:**
- Modify: `F:/Code/Work/IOT/desktop/MacVdesktop/README.md`
- Modify: `F:/Code/Work/IOT/desktop/MacVdesktop/package.json`
- Modify: `F:/Code/Work/IOT/desktop/MacVdesktop/vite.config.ts`
- Delete: `F:/Code/Work/IOT/desktop/MacVdesktop/metadata.json`

- [ ] **Step 1: Write the failing verification expectation**

```txt
Expected browser workflow:
- npm run dev starts the React UI without Gemini/AI Studio env requirements
- npm run test passes
- npm run build passes
```

- [ ] **Step 2: Run the existing checks to verify they fail or are misleading**

Run: `npm run build`
Expected: Either PASS with stale AI Studio config still present, or FAIL after earlier refactors expose stale setup in `vite.config.ts`

- [ ] **Step 3: Write minimal cleanup implementation**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest",
    "lint": "tsc --noEmit"
  }
}
```

```ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

```md
# MacVdesktop

## Windows development
- `npm install`
- `npm run dev`
- Browser mode shows truthful unavailable states for native macOS telemetry

## Future Apple Silicon validation
- Use Tauri dev/build on a real Apple Silicon Mac
- Only supported metrics will render live values
```

- [ ] **Step 4: Run tests and build to verify they pass**

Run: `npm run test -- --run`
Expected: PASS

Run: `npm run build`
Expected: PASS

Run: `npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md package.json vite.config.ts package-lock.json
git rm metadata.json
git commit -m "chore: align project with tauri telemetry workflow"
```
