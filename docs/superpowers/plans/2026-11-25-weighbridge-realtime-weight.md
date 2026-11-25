# GetPass Mobile — Real-Time Weighbridge Weight Fetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the mobile Weigh Capture screen, show the weighbridge indicator's weight live (auto-updating, no tap required) while the screen is open, and capture it through the indicator source path the backend already supports — instead of today's "tap once, copy the number into a manual-entry text box" flow.

## Current state (read from the code, not assumed)

- Backend already supports a live indicator read: `GET /api/weighbridge/reading` ([Backend/app/routers/weighments.py](Backend/app/routers/weighments.py)) re-reads the physical/mock adapter fresh on every call and is explicitly commented "Live reading for display only; captures re-read the indicator on the server."
- Backend capture (`POST /api/entries/{id}/weighments`) already has a first-class `source: "indicator"` path ([Backend/app/weighing.py](Backend/app/weighing.py) `_resolve_reading` → `_read_indicator()`): when `source` is `"indicator"`, the server **ignores any client-supplied weight** and re-reads the adapter itself, raising `409 Not stable` if the reading isn't stable. No `manual_reason` is required for this path.
- The adapter (`Backend/app/integrations/weighbridge_indicator.py`) is provider-pluggable: `none` (no indicator), `mock` (random local values, for dev), `http` (a real HTTP-exposed indicator gateway). This is unchanged by this plan.
- **The mobile app never uses the indicator source path.** `WeighCaptureScreen.tsx` calls `useReadIndicator()` once on mount (and on a "Read indicator" link tap), copies `weight_kg` into a plain text `weight` state field, and `handleCapture` always posts `source: "manual"` with a required `manual_reason` — even when the number came from the indicator. This is the gap: there is no continuously-live display, and indicator readings are never captured as indicator-sourced records.

**Architecture:** No new endpoints. Mobile switches its indicator usage from a one-shot mutation to a polling `useQuery` (reusing the existing `GET /api/weighbridge/reading`), and `handleCapture` branches: indicator available → POST with `source: "indicator"` (server re-reads and validates stability); indicator unavailable → keep today's manual-entry fallback unchanged. One small backend addition: a short TTL micro-cache on the adapter read so a 1 Hz poll from the screen doesn't turn into a 1 Hz hit on the physical indicator gateway if it's slow, and so two operators with the screen open don't double the device's load.

**Tech Stack:** FastAPI backend (unchanged except the cache), React Native (TypeScript) + TanStack Query on `GetPassMobile`.

## Global Constraints

- No automated test suite in this repo (deliberate choice, see `docs/superpowers/plans/2026-08-19-gatepass-weighbridge-workflow.md`). Verify manually with `WEIGHBRIDGE_PROVIDER=mock` end to end; do not add pytest/vitest as part of this plan.
- Keep the existing manual-entry fallback working byte-for-byte when `available: false` — operators without a connected indicator still need to type a weight and reason.
- A recapture (there's already a gross or tare weighment for this entry) still requires a `supersede_reason`, indicator-sourced or not — this plan does not change that rule.
- Poll only while the screen is focused and the app is foregrounded, to avoid draining battery/data and to avoid hammering the indicator when the operator has navigated away.

---

### Task 1: Backend — short TTL cache on the indicator adapter read

**Files:**
- Modify: `Backend/app/integrations/weighbridge_indicator.py`

**Why:** Once the mobile screen polls `GET /api/weighbridge/reading` on an interval (Task 3), every connected operator's screen will call it roughly once a second. For `MockIndicator`/`NoIndicator` this is free, but `HttpIndicator` makes a real network call to a physical gateway on every read; multiple screens polling independently could exceed what that device can serve. A read that's a few hundred milliseconds stale is indistinguishable to an operator from a fresh one, so a short cache removes the redundant load without changing behavior anyone can observe.

**Interfaces:**
- Consumes: nothing new.
- Produces: `get_indicator_adapter().read()` keeps its existing return shape (`dict` with `weight_kg`, `stable`, `frame_ref`, `raw_frame`); callers (`weighments.py`, `weighing.py`) are unchanged.

- [ ] **Step 1: Wrap each adapter's `read()` with a short-TTL cache**

```python
import time

CACHE_TTL_SECONDS = 0.5


class _CachedReadMixin:
    """Caches the last reading for CACHE_TTL_SECONDS so frequent polling (live display,
    multiple operators) doesn't multiply calls to a possibly-slow physical gateway."""

    _cached_at: float = 0.0
    _cached_value: Optional[dict] = None

    def read_cached(self, read_fn) -> dict:
        now = time.monotonic()
        if self._cached_value is not None and (now - self._cached_at) < CACHE_TTL_SECONDS:
            return self._cached_value
        value = read_fn()
        self._cached_value = value
        self._cached_at = now
        return value
```

Apply it only inside `HttpIndicator.read()` (mock/none are already cheap and a cache would hide mock's intentional randomness/instability used for dev testing):

```python
class HttpIndicator(_CachedReadMixin):
    available = True

    def __init__(self, url: str, api_key: str, timeout: float):
        self._url = url
        self._headers = {"Authorization": f"Bearer {api_key}"}
        self._timeout = timeout

    def read(self) -> dict:
        return self.read_cached(self._read_uncached)

    def _read_uncached(self) -> dict:
        try:
            response = httpx.get(self._url, headers=self._headers, timeout=self._timeout)
            response.raise_for_status()
            body = response.json()
            weight_kg = float(body["weight_kg"])
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            raise AdapterError("Weighbridge indicator request failed") from exc
        raw = body.get("raw_frame")
        return {
            "weight_kg": weight_kg,
            "stable": bool(body.get("stable")),
            "frame_ref": _clip(body.get("frame_ref"), MAX_FRAME_REF_LENGTH),
            "raw_frame": _clip(raw if isinstance(raw, str) else response.text, MAX_RAW_FRAME_LENGTH),
        }
```

- [ ] **Step 2: Verify manually** — set `WEIGHBRIDGE_PROVIDER=http` against a local stub server that logs each request's timestamp; call `GET /api/weighbridge/reading` in a tight loop (e.g. `for i in 1..10; curl ...; sleep 0.2`) and confirm the stub only sees a new request roughly every 0.5s, not every 0.2s.

---

### Task 2: Mobile — live-polling query hook for the indicator reading

**Files:**
- Modify: `GetPassMobile/src/queries/useWeighmentQueries.ts`

**Interfaces:**
- Consumes: `readIndicator()` from `GetPassMobile/src/api/weighments.ts` (unchanged).
- Produces: `useLiveIndicatorReading(enabled: boolean)` — a query hook returning `{ data, isFetching, dataUpdatedAt, error }`, consumed by Task 3.

- [ ] **Step 1: Add the polling hook, keep `useReadIndicator` removed (nothing else references it)**

```typescript
import { useQuery } from '@tanstack/react-query';
// ...existing imports...

const LIVE_READING_POLL_MS = 1000;

/**
 * Polls the indicator while `enabled` (screen focused, app foregrounded) so the
 * operator sees the weight update live, the way a physical indicator display does.
 * Capture still re-reads the indicator itself server-side (see useCaptureWeighment) —
 * this hook is for display only, matching the backend endpoint's own doc comment.
 */
export function useLiveIndicatorReading(enabled: boolean) {
  return useQuery({
    queryKey: ['weighbridge', 'liveReading'],
    queryFn: readIndicator,
    enabled,
    refetchInterval: enabled ? LIVE_READING_POLL_MS : false,
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 0,
  });
}
```

Remove the now-unused `useReadIndicator` export (grep confirms `WeighCaptureScreen.tsx` is its only caller, replaced in Task 3).

- [ ] **Step 2: Verify manually** — temporarily log `dataUpdatedAt` in the console from a throwaway screen; confirm it ticks roughly once a second while `enabled` and stops when `enabled` flips to `false`.

---

### Task 3: Mobile — live display + indicator-sourced capture in `WeighCaptureScreen`

**Files:**
- Modify: `GetPassMobile/src/screens/weighbridge/WeighCaptureScreen.tsx`

**Why:** Replace the one-shot "Read indicator" link and manual-entry-only capture with: a continuously-updating weight shown while the indicator is available, and a Capture action that posts `source: "indicator"` so the server's authoritative, stability-checked reading is what actually gets saved (closing the gap described in "Current state" above).

**Interfaces:**
- Consumes: `useLiveIndicatorReading` (Task 2), `useIsFocused` from `@react-navigation/native` (already used the same way in `DashboardScreen.tsx`), `AppState` from `react-native` for foreground/background.
- Produces: no change to `WeighmentCreate`/`WeighmentOut` types or any other screen.

- [ ] **Step 1: Track focus + foreground state and drive the live query**

```typescript
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useLiveIndicatorReading, useCaptureWeighment } from '../../queries/useWeighmentQueries';

// inside WeighCaptureScreen:
const isFocused = useIsFocused();
const [isForeground, setIsForeground] = useState(AppState.currentState === 'active');
useEffect(() => {
  const subscription = AppState.addEventListener('change', state => setIsForeground(state === 'active'));
  return () => subscription.remove();
}, []);

const livePolling = isFocused && isForeground;
const liveReading = useLiveIndicatorReading(livePolling);
const indicatorAvailable = liveReading.data?.available ?? false;
const isStable = indicatorAvailable && liveReading.data?.stable === true && liveReading.data?.weight_kg != null;
```

- [ ] **Step 2: Replace `indicatorMessage`/`tryIndicator` with derived display state**

Remove `indicatorMessage` state, `tryIndicator`, and the mount-time `useEffect` that calls it (lines ~277, ~295-321 of the current file) — the live query now drives this directly:

```typescript
const indicatorStatusText = !liveReading.isFetched
  ? 'Checking weighbridge indicator...'
  : !indicatorAvailable
    ? 'No weighbridge indicator is connected. Enter weights manually.'
    : liveReading.data?.weight_kg == null
      ? 'Indicator is connected, but no weight is available.'
      : isStable
        ? 'Stable — ready to capture.'
        : 'Reading... keep the vehicle still.';
```

Render the live number itself (e.g. near the existing `indicatorNotice` block) as `{formatWeight(liveReading.data?.weight_kg)}` with a badge that's green when `isStable`, amber otherwise — same visual language as the existing `historyBadge`/`indicatorBadge` styles, no new design system needed.

- [ ] **Step 3: Branch `handleCapture` on indicator availability**

```typescript
async function handleCapture() {
  setErrorMessage(null);
  setSuccessMessage(null);
  try {
    const payload = indicatorAvailable
      ? {
          kind,
          source: 'indicator' as const,
          supersede_reason: hasExisting ? supersedeReason.trim() : undefined,
        }
      : {
          kind,
          source: 'manual' as const,
          weight: numericWeight,
          unit,
          manual_reason: manualReason.trim(),
          supersede_reason: hasExisting ? supersedeReason.trim() : undefined,
        };
    await captureWeighmentMutation.mutateAsync({ entryId, payload });
    setSuccessMessage(`${kind === 'gross' ? 'Gross' : 'Tare'} weight captured for ${vehicleNumber}.`);
    setWeight('');
    setManualReason('');
    setSupersedeReason('');
  } catch (error) {
    // A 409 here means the reading went unstable between display and capture — the
    // generic message already covers it; the operator just waits for it to re-stabilize.
    setErrorMessage(extractErrorMessage(error, 'Could not capture the weight.'));
  }
}
```

Update `canSubmit` so the indicator path doesn't require the manual weight/reason fields:

```typescript
const canSubmit = indicatorAvailable
  ? isStable && (!hasExisting || supersedeReason.trim().length >= 3) && !isCapturing
  : weight.trim().length > 0 &&
    Number.isFinite(numericWeight) &&
    numericWeight > 0 &&
    manualReason.trim().length >= 3 &&
    (!hasExisting || supersedeReason.trim().length >= 3) &&
    !isCapturing;
```

- [ ] **Step 4: Hide the manual weight/unit/reason inputs while the indicator is available**

Keep them mounted but conditionally rendered (`{!indicatorAvailable && (...)}`) so an operator can still fall back to manual entry if the indicator later reports `available: false` mid-session (e.g. the gateway drops) — the fields should reappear, not require a screen reload.

- [ ] **Step 5: Verify manually (no automated tests in this repo)**
  - `WEIGHBRIDGE_PROVIDER=mock`: open Weigh Capture, confirm the weight number changes roughly every second without tapping anything, confirm the stability badge flips as `mock_data.MOCK_UNSTABLE_ONE_IN` produces unstable reads, confirm Capture is disabled until stable and succeeds when stable.
  - `WEIGHBRIDGE_PROVIDER=none`: confirm it falls straight back to today's manual-entry UI with no live number shown.
  - Navigate away from the screen (back button) and confirm (via a temporary log or network inspector) that polling stops; return to the screen and confirm it resumes.
  - Background the app (home button) while the screen is open and confirm polling stops; foreground it again and confirm it resumes.
  - Recapture flow: with an existing gross weighment, confirm the supersede-reason field is still required before Capture is enabled, indicator or manual.

---

### Task 4: Docs — record the new flow

**Files:**
- Modify: `DEVELOPMENT.md`

- [ ] **Step 1: Update the mobile weighbridge note**

In the section around line 259 (`Mobile's Weighbridge screen is a simpler placeholder...`), add a line noting that `WeighCaptureScreen` now polls the indicator live while focused/foregrounded and captures via the `source: "indicator"` path when available, falling back to manual entry otherwise — so the next person reading this file doesn't re-discover the gap this plan closed.
