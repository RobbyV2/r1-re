# Networking | Documentation

Source: https://hub.evenrealities.com/docs/guides/networking

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

* [The two gates](#the-two-gates "The two gates")
* [Declaring the whitelist](#declaring-the-whitelist "Declaring the whitelist")
* [Why APIs that work locally fail on device](#why-apis-that-work-locally-fail-on-device "Why APIs that work locally fail on device")
* [Required server-side CORS headers](#required-server-side-cors-headers "Required server-side CORS headers")
* [Debugging checklist](#debugging-checklist "Debugging checklist")
* [Related](#related "Related")

Even Hub plugins make HTTP requests the same way any web app does — `fetch()`, `XMLHttpRequest`, WebSockets — from inside the WebView that the Even Realities App hosts on the phone. There are two independent gates a request must clear before it reaches the network, and most "works locally, fails on device" bugs come from confusing one for the other.

## The two gates [​](#the-two-gates)

Every outgoing request must pass **both** of the following checks:

1. **Even-side permission check** — the destination domain must be listed in your `app.json` `network` permission `whitelist`. The Even Realities App enforces this before the request leaves the WebView. Domains not in the whitelist are blocked with no network traffic generated at all.
2. **Browser CORS check** — the browser engine in the WebView (Chromium on Android, WKWebView on iOS) enforces standard CORS. The remote server must return the right `Access-Control-Allow-Origin` (and related) headers, otherwise the response is dropped before your `fetch()` resolves.

:::caution[The whitelist is not a CORS bypass] Adding a domain to `app.json` does **not** override CORS. It only tells the Even Realities App that your plugin is allowed to talk to that domain at all. If the remote server doesn't return the right CORS headers, the browser still blocks the response — exactly as it would in any other web page. :::

## Declaring the whitelist [​](#declaring-the-whitelist)

In your `app.json`, request the `network` permission and list every domain your plugin will hit:

json

```
"permissions": [
  {
    "name": "network",
    "desc": "Fetches weather data and stores user preferences in the cloud.",
    "whitelist": [
      "https://api.weather.com",
      "https://prefs.example.com"
    ]
  }
]
```

Notes:

* One whitelist entry per origin. Use the full origin (`https://api.example.com`) — bare hostnames or wildcards are not supported.
* HTTPS is required in production. Plain `http://` is only useful for local dev (e.g. when sideloaded against a LAN dev server).
* Every domain in the whitelist must actually be used. App review flags unused entries.
* See [Packaging & Deployment → Permissions Format](/docs/reference/packaging#permissions-format) for the full schema.

## Why APIs that work locally fail on device [​](#why-apis-that-work-locally-fail-on-device)

A typical bug report:

> *"My API works in the simulator and from `localhost`, but on real glasses the request hangs / errors out."*

Three things are usually different on device versus localhost:

| Surface | Local dev (`http://localhost:5173`) | Production WebView |
| --- | --- | --- |
| Page origin | `http://localhost:5173` | An origin the Even Realities App injects when loading your `.ehpk` |
| CORS enforcement | Often relaxed by dev proxies (e.g. Vite proxy) | Strict — exactly what the browser engine implements |
| Whitelist gate | Bypassed during sideload (no manifest installed) | Enforced — every request is checked against `app.json` `network` first |

A request that works locally but fails on device almost always falls into one of these buckets:

1. **Domain missing from `whitelist`.** The Even Realities App blocks the request before it leaves the WebView. You'll see no traffic on your server.
2. **Server is missing `Access-Control-Allow-Origin`.** The request reaches your server (you see logs), the server replies, and the browser then drops the response because the headers are wrong.
3. **Preflight (`OPTIONS`) failing.** Non-simple requests (anything with `Content-Type: application/json`, custom headers, `PUT`/`DELETE`/etc.) trigger an `OPTIONS` preflight. The server must respond `200`/`204` with `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers` set appropriately. Many production APIs proxy `OPTIONS` to a 404 by accident.
4. **Mixed content.** An HTTPS WebView origin cannot fetch from `http://`. Use HTTPS end to end.

## Required server-side CORS headers [​](#required-server-side-cors-headers)

For a third-party API to be reachable from the WebView, the server must return at minimum:

http

```
Access-Control-Allow-Origin: *
# or specifically the WebView origin if you can identify it
```

For requests with custom headers, JSON bodies, or non-`GET`/`POST` methods, also handle the preflight:

http

```
# Response to the OPTIONS preflight
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

If the API is third-party and you can't change its CORS configuration, route the call through a server you control that does set the right headers, then add **your** server's domain to the `app.json` whitelist.

## Debugging checklist [​](#debugging-checklist)

When a request fails on device, walk through this list in order:

1. **Confirm the domain is in `app.json` `network.whitelist`.** Re-pack and re-upload if you changed it.
2. **Open the WebView inspector** (Even Realities App → developer menu) and look at the failed request in the Network tab. If it shows `(blocked)` with no status code, you've hit the whitelist gate. If it shows a status code but the response body is empty / `fetch()` rejects, you've hit CORS.
3. **Check the response headers** for `Access-Control-Allow-Origin`. If it's missing or doesn't match your origin, fix it on the server.
4. **Check the OPTIONS preflight** if you're sending JSON or custom headers — it must return 2xx with the right `Allow-Methods`/`Allow-Headers`.
5. **Try the same request from `curl`** to isolate server problems from WebView problems. If `curl` works but the WebView doesn't, it's almost always CORS.
6. **Test on the simulator with the same build.** The simulator runs your code in a regular browser context — CORS still applies, but the whitelist gate is not enforced. A request that works in the simulator but fails on device with a "blocked" error means you forgot the whitelist; one that fails in both means it's CORS.

## Related [​](#related)

* [Packaging & Deployment → Permissions Format](/docs/reference/packaging#permissions-format)
* [App Submission & QA Guidelines → First-Run Experience](/docs/reference/app-submission#first-run-experience-no-black-screens)
* [Architecture](/docs/getting-started/architecture)

Pager

[Previous pageUI/UX Design Guidelines](/docs/guides/design-guidelines)

[Next pageHeadless Testing](/docs/guides/headless-testing)