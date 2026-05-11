# Architecture | Documentation

Source: https://hub.evenrealities.com/docs/getting-started/architecture

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

* [Connection Model](#connection-model "Connection Model")
* [Testing Your App](#testing-your-app "Testing Your App")
* [PWA as an Alternative](#pwa-as-an-alternative "PWA as an Alternative")
* [The SDK Bridge](#the-sdk-bridge "The SDK Bridge")
* [App Structure](#app-structure "App Structure")

Even Hub apps are **web apps** built with standard web technologies and the Even Hub SDK. You develop them locally, and when ready for distribution, you package and submit them to the **Even Hub platform**, where users can download and run them.

## Connection Model [​](#connection-model)

```
┌──────────────────┐    HTTPS     ┌────────────────────┐   Bluetooth    ┌─────────────────────┐
│  Even Hub Cloud  │ ◄──────────► │  Phone             │ ◄────────────► │  Even G2 Glasses    │
│  (distribution   │              │  (Even Realities   │                │  (display + input)  │
│   & hosting)     │              │   App + WebView)   │                │                     │
└──────────────────┘              └────────────────────┘                └─────────────────────┘
```

* **The phone** runs the Even Realities App (Flutter), which hosts your plugin inside a WebView (Chromium on Android, WKWebView on iOS). Your app logic executes inside this WebView; the Even Realities App relays everything to the glasses over Bluetooth.
* **The glasses** render UI containers and emit input events (presses, scrolls, swipes). Aside from native scroll processing, app logic does not run on the glasses.

:::caution[Network whitelist is not a CORS bypass] The `app.json` `network` whitelist is an **Even-side permission check** — it controls which domains your plugin is allowed to call from the WebView. It does **not** bypass CORS.

In production, `fetch()` requires both:

1. The remote domain listed in your `app.json` `network` whitelist, **and**
2. Correct CORS headers (`Access-Control-Allow-Origin`, etc.) returned by that remote API.

APIs that work on `localhost` but fail inside the WebView are almost always CORS misconfigurations on the remote side, not Even bugs. See [Networking](/docs/guides/networking) for the full request flow and debugging tips. :::

## Testing Your App [​](#testing-your-app)

There are several ways to get your app running on hardware during development:

1. **QR sideloading** — run a local dev server and generate a QR code via the CLI. Scan it with the Even Realities App to load your app directly with hot reload.
2. **Private builds** — package your app via the CLI (`evenhub pack`) and upload it to the developer portal for testing on your own devices.
3. **Simulator** — preview layouts and test logic entirely on your computer, no hardware needed.

## PWA as an Alternative [​](#pwa-as-an-alternative)

If you prefer to keep your app private or distribute it outside of Even Hub, you can build a **Progressive Web App (PWA)** and route users directly to your hosted web app. This approach gives you full control over distribution and hosting, though it does not go through Even Hub's packaging and review process.

## The SDK Bridge [​](#the-sdk-bridge)

The SDK injects a JavaScript bridge (`EvenAppBridge`) into the WebView. Your frontend calls this bridge to control the glasses display and receive input events.

**Web → Glasses:** Your JS calls `bridge.callEvenApp(method, params)` → WebView bridge → Even Realities App → Bluetooth → glasses.

**Glasses → Web:** Input events travel Bluetooth → Even Realities App → `window._listenEvenAppMessage(...)` → your callback.

## App Structure [​](#app-structure)

A typical Even Hub app is a standard web project with an `app.json` manifest for packaging:

```
my-app/
├── src/
│   ├── main.ts              # App entry point
│   └── components/          # Your UI components
├── public/
│   └── assets/              # Static assets (icons, images)
├── index.html               # HTML entry
├── package.json
├── vite.config.ts           # Build config (Vite recommended)
├── tsconfig.json            # TypeScript config (optional)
└── app.json                 # Even Hub manifest (required for packaging)
```

The SDK ([`@evenrealities/even_hub_sdk`](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)) is the only Even-specific dependency. Everything else is standard web tooling.

Pager

[Previous pageYour First App](/docs/getting-started/first-app)

[Next pagePage Lifecycle](/docs/guides/page-lifecycle)