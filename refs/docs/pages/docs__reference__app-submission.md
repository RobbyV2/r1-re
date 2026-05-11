# App Submission & QA Guidelines | Documentation

Source: https://hub.evenrealities.com/docs/reference/app-submission

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

* [Manifest (app.json)](#manifest-app-json "Manifest (app.json)")
* [Store Listing & Visual Assets](#store-listing-visual-assets "Store Listing & Visual Assets")
* [Privacy](#privacy "Privacy")
* [First-Run Experience (no black screens)](#first-run-experience-no-black-screens "First-Run Experience (no black screens)")
* [Locked-Phone Operation](#locked-phone-operation "Locked-Phone Operation")
* [Exit & Lifecycle](#exit-lifecycle "Exit & Lifecycle")
* [Content & Safety](#content-safety "Content & Safety")
* [Final Pre-Submission Sanity Check](#final-pre-submission-sanity-check "Final Pre-Submission Sanity Check")

> **Last updated:** 2026-04-22

Every app submitted to Even Hub goes through a **manual review**. Anything that fails the checklist below is returned to the developer with a rejection note. Running through this list before you submit is the fastest way to clear review on the first pass.

This page is the canonical pre-submission checklist. Pair it with [Packaging & Deployment](/docs/reference/packaging) for the full `app.json` schema and validation errors.

## Manifest (`app.json`) [​](#manifest-app-json)

* **`package_id`** — reverse-domain, lowercase, no hyphens, no underscores, ≥ 2 segments. Every segment must start with a lowercase letter (e.g. `com.acme.weather`).
* **`edition`** — exactly `"202601"` (current edition as of April 22, 2026).
* **`name`** — ≤ 20 characters and **must not contain "Even"** (case-insensitive). Names like `"EvenDoc Reader"` or `"Even Bible"` are auto-rejected as first-party impersonation. Exception: officially affiliated apps with written approval.
* **`version`** — three-part semver `x.y.z`. No `v` prefix, no pre-release suffix.
* **`min_app_version`** and **`min_sdk_version`** — both required. Current SDK floor: `"0.0.10"`.
* **`entrypoint`** — must resolve to a real file inside the build output folder.
* **`permissions`** — array of objects with `name` + `desc` (1–300 chars). `network` entries also need `whitelist`. **Not** a key-value map.
* Every requested permission must actually be **used** in app code. Unused permissions are flagged.
* **New version submissions need a non-empty changelog.**

See [Packaging & Deployment → Field Reference](/docs/reference/packaging#field-reference) for the underlying schema.

## Store Listing & Visual Assets [​](#store-listing-visual-assets)

* Icon is **legible** — no "black scribble" or noisy patterns.
* Both **foreground and background** are supplied (neither `null` nor empty).
* Icon and background image are **monochrome / greyscale only**. Color assets are rejected.
* Screenshots match what the app actually renders on device — capture them via the [simulator's screenshot function](/docs/reference/simulator#screenshot).
* **Display name** matches `app.json` `name` *and* the on-glasses display name (no portal-vs-device mismatch).
* **No impersonation** of existing apps, no unauthorized brand logos, no keyword stuffing in name/description.

## Privacy [​](#privacy)

* Privacy policy covers **every permission** the app requests.
* Backend service domains, if any, are documented and traceable to the developer.

## First-Run Experience (no black screens) [​](#first-run-experience-no-black-screens)

* First launch from glasses when setup is needed (city, API key, player name, …) → on-glasses message **explains what to do**. **Never a black screen.**
* Setup is remembered across launches (use the [`localStorage` API](/docs/guides/device-apis)) — never re-prompt the same setup.
* **CORS headers** correctly configured on any third-party API the app calls. The `app.json` network whitelist is an **Even-side permission check** — it is **not** a CORS bypass. If a request works locally but fails inside the WebView, the remote API is misconfigured for CORS, not an Even bug.

## Locked-Phone Operation [​](#locked-phone-operation)

The Even G2 is designed to be useful while the phone is in your pocket. The review team specifically tests with the phone locked and the Even Realities App backgrounded.

* Phone locked + Even App backgrounded → glasses-launched app renders within reasonable time. **No infinite spinner, no black screen.**
* Phone locked → the **core flow runs end-to-end on glasses + ring input alone**. Every gesture has a visible response, every button has feedback, every image loads.
* Long-running single-shot tasks (Timer, etc.) **continue and complete correctly** while the phone stays locked.
* After **2 minutes idle** the app is still alive and responsive. No freeze, no infinite loop, no crash.
* Unlock → use another phone app → re-lock — the glasses session is **unaffected**.

## Exit & Lifecycle [​](#exit-lifecycle)

* Root-page **double-tap calls `bridge.shutDownPageContainer(1)`** — the system exit confirmation dialog. Mode `0` (immediate exit) is **not acceptable** on the root page. A custom in-app exit confirmation UI is **not acceptable** on the root page either. Apps that exit silently or do nothing on double-tap are rejected.
  + Reference patterns:
    - **Make15** — root double-tap fires the system dialog directly.
    - **Chess** — root double-tap opens an in-app menu containing an "Exit" item that then calls `shutDownPageContainer(1)`.
* After the user confirms exit on glasses, the **phone-side WebView page also closes automatically**. Lingering webviews inside the Even Realities App are rejected.
* After exit, glasses can launch other apps and first-party apps (Conversate, Navigate) **without restart**. Smoke-testing with Conversate alone is sufficient.
* Lifecycle handlers wired correctly:
  + **Cleanup** on `ABNORMAL_EXIT_EVENT` (6) and `SYSTEM_EXIT_EVENT` (7).
  + **Pause / flush** on `FOREGROUND_EXIT_EVENT` (5).
  + **Resume** on `FOREGROUND_ENTER_EVENT` (4).

See [Page Lifecycle](/docs/guides/page-lifecycle) for event timing and handler patterns.

## Content & Safety [​](#content-safety)

* **No medical diagnosis, financial advice, or emergency-routing functionality.** Flag for legal if unavoidable.
* No offensive, explicit, NSFW, or hateful content.

## Final Pre-Submission Sanity Check [​](#final-pre-submission-sanity-check)

Before clicking **Submit**, run through this short loop:

1. `evenhub pack app.json dist -o myapp.ehpk -c` — confirm `package_id` is available and the manifest validates.
2. Sideload via QR with the phone **locked** for 5 minutes — does the app stay alive and responsive?
3. Trigger a root-page double-tap — does the **system exit dialog** appear and the WebView close?
4. Re-launch a first-party app (Conversate) — does it start without restarting glasses?
5. Re-read your privacy policy — does it cover **every** permission in `app.json`?

If all five pass, you are ready to submit.

Pager

[Previous pageCLI](/docs/reference/cli)

[Next pageCommunity Resources](/docs/community/resources)