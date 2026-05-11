# Headless Testing | Documentation

Source: https://hub.evenrealities.com/docs/guides/headless-testing

[Skip to content](#VPContent)

[![](/docs/imgs/icon.svg)Documentation](/docs/getting-started/overview)

Search`⌘``Ctrl``K`

 Main Navigation [Portal](https://evenhub.evenrealities.com)

Menu

On this page

 Sidebar Navigation 

## Getting-started

[Overview](/docs/getting-started/overview)

[Installation](/docs/getting-started/installation)

[Your First App](/docs/getting-started/first-app)

[Architecture](/docs/getting-started/architecture)

## Guides

[Page Lifecycle](/docs/guides/page-lifecycle)

[Input & Events](/docs/guides/input-events)

[Display & UI System](/docs/guides/display)

[Device APIs](/docs/guides/device-apis)

[UI/UX Design Guidelines](/docs/guides/design-guidelines)

[Networking](/docs/guides/networking)

[Headless Testing](/docs/guides/headless-testing)

## AI-tooling

[### Claude Code](/docs/AI-tooling/claude%20code/index)

[Skill Catalog](/docs/AI-tooling/claude%20code/skill-catalog)

## Reference

[Simulator](/docs/reference/simulator)

[Packaging & Deployment](/docs/reference/packaging)

[CLI](/docs/reference/cli)

[App Submission & QA Guidelines](/docs/reference/app-submission)

## Community

[Community Resources](/docs/community/resources)

On this page

* [When to reach for this](#when-to-reach-for-this "When to reach for this")
* [Boot the simulator with a control plane](#boot-the-simulator-with-a-control-plane "Boot the simulator with a control plane")
* [The end-to-end loop](#the-end-to-end-loop "The end-to-end loop")
* [Patterns and pitfalls](#patterns-and-pitfalls "Patterns and pitfalls")
* [Related](#related "Related")

The EvenHub Simulator (`v0.7.0+`) ships an HTTP control plane that lets you drive the simulated glasses from any process that can talk to a local socket — Python, Node, a CI script, or your own QA harness. This guide walks through one complete loop: boot the simulator, wait for the app to become responsive, screenshot the framebuffer, send a `double_click`, and assert that the system exit dialog appeared.

> **Reference:** the full endpoint table lives in [Simulator → Headless Automation](/docs/reference/simulator#headless-automation).

## When to reach for this [​](#when-to-reach-for-this)

* **Pre-submission checks** — assert the rules from [App Submission & QA Guidelines](/docs/reference/app-submission) (lit pixels in the framebuffer, system exit dialog on root double-tap, no console errors at boot) before uploading a new `.ehpk`.
* **Genesis Day judging automation** — score submissions without manually clicking through every entry.
* **Internal QA harness** — regression-test SDK upgrades by replaying a journey across many apps.
* **CI smoke tests** — run a tiny "did the app even boot" check on every PR.

## Boot the simulator with a control plane [​](#boot-the-simulator-with-a-control-plane)

Pass `--automation-port` when you launch the simulator. Pick any free port:

bash

```
evenhub-simulator http://localhost:5173 --automation-port 9898
# → control plane on http://127.0.0.1:9898
```

Verify it's up:

bash

```
curl http://127.0.0.1:9898/api/ping
# pong
```

## The end-to-end loop [​](#the-end-to-end-loop)

The shape of every test is the same:

1. **Boot** the simulator pointing at your dev server (or an `.ehpk` URL).
2. **Wait for ready.** The simulator silently drops input until your first event-capturing container exists, so poll `GET /api/console` for an "app ready" log line (or your own readiness signal). Allow ~4 s minimum after launch (SDK init + `createStartUpPageContainer`).
3. **Snapshot the state** — `GET /api/screenshot/glasses` for the framebuffer, `GET /api/console` for log entries.
4. **Send input** — `POST /api/input` with `{ "action": "click" | "double_click" | "up" | "down" }`.
5. **Snapshot again and assert.**

### Python example [​](#python-example)

python

```
import time
import io
import sys
from urllib.request import Request, urlopen
import json
from PIL import Image

BASE = "http://127.0.0.1:9898"
READY_MARKER = "[my-app] ready"  # whatever your app logs once mounted
TIMEOUT_S = 30


def get_json(path: str):
    with urlopen(f"{BASE}{path}") as r:
        return json.loads(r.read())


def get_png(path: str) -> Image.Image:
    with urlopen(f"{BASE}{path}") as r:
        return Image.open(io.BytesIO(r.read()))


def post_json(path: str, body: dict):
    req = Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(req) as r:
        return r.read()


def wait_for_ready(timeout: float = TIMEOUT_S):
    """Poll the console buffer until the app prints its ready marker."""
    deadline = time.time() + timeout
    since_id = 0
    while time.time() < deadline:
        data = get_json(f"/api/console?since_id={since_id}")
        for entry in data.get("entries", []):
            since_id = max(since_id, entry["id"])
            if READY_MARKER in entry.get("message", ""):
                return
        time.sleep(0.25)
    raise TimeoutError(f"App did not log {READY_MARKER!r} within {timeout}s")


def lit_pixel_count(img: Image.Image) -> int:
    """LVGL framebuffer is RGBA; treat any pixel with alpha > 0 as lit."""
    assert img.mode == "RGBA", f"expected RGBA, got {img.mode}"
    return sum(1 for px in img.getdata() if px[3] > 0)


def main() -> int:
    # 1. Health check
    assert get_json("/api/ping") in ("pong", {"message": "pong"}), "simulator not up"

    # 2. Wait for the app to mount
    wait_for_ready()

    # 3. Confirm something is actually drawn
    boot = get_png("/api/screenshot/glasses")
    assert lit_pixel_count(boot) > 100, "framebuffer is blank after ready"

    # 4. Drive the root double-tap → expect the system exit dialog
    post_json("/api/input", {"action": "double_click"})
    time.sleep(0.5)  # let the dialog render

    after = get_png("/api/screenshot/glasses")
    delta = abs(lit_pixel_count(after) - lit_pixel_count(boot))
    assert delta > 50, "framebuffer did not change after double_click — exit dialog missing?"

    print("OK — app booted, rendered, and produced an exit dialog on double-tap")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

### Node example [​](#node-example)

typescript

```
const BASE = 'http://127.0.0.1:9898'
const READY_MARKER = '[my-app] ready'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json() as Promise<T>
}

async function getPng(path: string): Promise<Uint8Array> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

async function postJson(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
}

interface ConsoleEntry { id: number; message: string }
interface ConsoleResponse { entries: ConsoleEntry[]; total: number }

async function waitForReady(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let sinceId = 0
  while (Date.now() < deadline) {
    const data = await getJson<ConsoleResponse>(`/api/console?since_id=${sinceId}`)
    for (const entry of data.entries) {
      sinceId = Math.max(sinceId, entry.id)
      if (entry.message.includes(READY_MARKER)) return
    }
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error(`App did not log "${READY_MARKER}" within ${timeoutMs}ms`)
}

async function main(): Promise<void> {
  await getJson('/api/ping')
  await waitForReady()

  const boot = await getPng('/api/screenshot/glasses')
  if (boot.byteLength < 1000) throw new Error('framebuffer is suspiciously small')

  await postJson('/api/input', { action: 'double_click' })
  await new Promise(r => setTimeout(r, 500))

  const after = await getPng('/api/screenshot/glasses')
  if (Math.abs(after.byteLength - boot.byteLength) < 100) {
    throw new Error('framebuffer did not change after double_click — exit dialog missing?')
  }

  console.log('OK — app booted, rendered, and produced an exit dialog on double-tap')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

> **Tip:** the Node example uses byte-length deltas as a coarse "did anything change" check. For real assertions, decode the PNG (e.g. with [`sharp`](https://www.npmjs.com/package/sharp)) and use the same `alpha > 0` lit-pixel rule as the Python example.

## Patterns and pitfalls [​](#patterns-and-pitfalls)

### Read startup logs **before** clearing [​](#read-startup-logs-before-clearing)

Simulator boot logs (SDK init, manifest load, first `createStartUpPageContainer` result) are emitted exactly once. A common mistake:

python

```
# DON'T do this
post_json('/api/input', {'action': 'click'})  # implicit assume the app is up
clear_console()                                # wipes the boot logs you needed
```

Always poll for the ready marker (or read the log buffer) **first**, then clear:

python

```
wait_for_ready()
boot_logs = get_json('/api/console')
post_json('/api/console', {})  # safe to clear now (DELETE works too)
```

### Use `since_id` for incremental polling [​](#use-since-id-for-incremental-polling)

Re-reading the entire console buffer on every tick wastes work and risks duplicate-handling. Track the highest `id` you've seen and pass it back:

python

```
data = get_json(f'/api/console?since_id={last_seen}')
for entry in data['entries']:
    last_seen = max(last_seen, entry['id'])
    handle(entry)
```

### Keep screenshots in RGBA [​](#keep-screenshots-in-rgba)

`/api/screenshot/glasses` returns RGBA on purpose. The Even G2 framebuffer renders both background and foreground in pure green; converting to RGB collapses them and your "lit pixel" check stops working. Test with `pixel.alpha > 0`, not by comparing RGB channels.

### Wait for input capture [​](#wait-for-input-capture)

Posting input before `createStartUpPageContainer` has run is silently dropped — there is no error. Always wait for your readiness signal first. ~4 s after launch is a reasonable lower bound; keying off a log line is more reliable than sleeping.

### Cleaning up [​](#cleaning-up)

The control plane has no `shutdown` endpoint — kill the simulator process when you're done. In CI, wrap the simulator launch in a child-process supervisor that you can `SIGTERM` from your test runner's `afterAll` hook.

## Related [​](#related)

* [Simulator → Headless Automation](/docs/reference/simulator#headless-automation) — full endpoint reference
* [App Submission & QA Guidelines](/docs/reference/app-submission) — what to assert in your tests
* [Page Lifecycle](/docs/guides/page-lifecycle) — events you can use as readiness / exit signals

Pager

[Previous pageNetworking](/docs/guides/networking)

[Next pageClaude Code](/docs/AI-tooling/claude%20code/index)