# Packaging & Deployment | Documentation

Source: https://hub.evenrealities.com/docs/reference/packaging

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

* [The app.json Manifest](#the-app-json-manifest "The app.json Manifest")
* [Building and Packing](#building-and-packing "Building and Packing")
* [Troubleshooting evenhub pack](#troubleshooting-evenhub-pack "Troubleshooting evenhub pack")
* [Distribution](#distribution "Distribution")

Shipping an Even Hub build means validating an `app.json` manifest, bundling assets into an `.ehpk`, and uploading through the developer portal. These sections document the manifest schema, CLI packaging commands, and the validation errors you are most likely to hit before submission succeeds.

## The `app.json` Manifest [​](#the-app-json-manifest)

Every Even Hub app requires an `app.json` manifest. Generate a starter file with:

bash

```
evenhub init
```

This creates the following template:

json

```
{
  "package_id": "com.example.g2demo",
  "edition": "202601",
  "name": "G2 Demo",
  "version": "0.1.0",
  "min_app_version": "2.0.0",
  "min_sdk_version": "0.0.7",
  "entrypoint": "index.html",
  "permissions": [
    {
      "name": "network",
      "desc": "This app needs to access the network in order to ...",
      "whitelist": ["https://example.com"]
    }
  ],
  "supported_languages": ["en"]
}
```

### Field Reference [​](#field-reference)

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `package_id` | string | Yes | Reverse-domain format (e.g., `com.yourname.appname`). Each segment must start with a **lowercase letter** and contain only **lowercase letters or numbers**. Minimum two segments. No hyphens. |
| `edition` | string | Yes | Must be `"202601"` (current edition). |
| `name` | string | Yes | **20 characters or fewer.** |
| `version` | string | Yes | Semver format: **`x.y.z`** (e.g., `"1.0.0"`). |
| `min_app_version` | string | Yes | Minimum Even Realities App version required (e.g., `"2.0.0"`). |
| `min_sdk_version` | string | Yes | Minimum SDK version required (e.g., `"0.0.7"`). |
| `entrypoint` | string | Yes | Path to your HTML entry file relative to the build folder (e.g., `"index.html"`). |
| `permissions` | array | Yes | Array of permission objects (see below). Can be empty `[]`. |
| `supported_languages` | array | Yes | Array of language codes. Valid values: `en`, `de`, `fr`, `es`, `it`, `zh`, `ja`, `ko`. |

### Permissions Format [​](#permissions-format)

Permissions are an **array of objects**, not a key-value map. Each object must have:

| Key | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | Yes | One of: `network`, `location`, `g2-microphone`, `phone-microphone`, `album`, `camera` |
| `desc` | string | Yes | Human-readable reason, **1–300 characters**. |
| `whitelist` | string[] | `network` only | List of allowed domains. Optional, defaults to `[]`. |

Example with multiple permissions:

json

```
"permissions": [
  {
    "name": "network",
    "desc": "Fetches weather data from the API.",
    "whitelist": ["https://api.weather.com"]
  },
  {
    "name": "g2-microphone",
    "desc": "Enables voice commands for hands-free control."
  },
  {
    "name": "location",
    "desc": "Shows nearby points of interest on the display."
  }
]
```

:::caution[Common mistake] The permissions field must be an **array of objects** — not a key-value map. This format is incorrect and will fail validation:

json

```
"permissions": { "network": ["example.com"] }
```

:::

---

## Building and Packing [​](#building-and-packing)

### Step 1: Build your web app [​](#step-1-build-your-web-app)

bash

```
npm run build
```

This produces your output directory (typically `dist/` or `build/`).

### Step 2: Pack into `.ehpk` [​](#step-2-pack-into-ehpk)

bash

```
evenhub pack app.json dist -o myapp.ehpk
```

| Argument | Description |
| --- | --- |
| `app.json` | Path to your manifest file |
| `dist` | Path to your **built** output folder |
| `-o myapp.ehpk` | Output filename (defaults to `out.ehpk`) |
| `--no-ignore` | Include hidden files (dotfiles) — excluded by default |
| `-c`, `--check` | Check if your `package_id` is available on Even Hub |

TIP

The `entrypoint` in your `app.json` must point to a file that **exists inside the build folder**. If your manifest says `"entrypoint": "index.html"` but the build folder doesn't contain `index.html`, packing will fail with:

```
Entrypoint file not found: dist/index.html
```

---

## Troubleshooting `evenhub pack` [​](#troubleshooting-evenhub-pack)

When packing fails, the CLI prints specific validation errors. Here are the most common ones and how to fix them:

### `Invalid package id` [​](#invalid-package-id)

```
package_id: must be a valid package name (e.g., com.example.app).
Each segment must start with a lowercase letter and contain only
lowercase letters or numbers. Two or more segments are required.
```

**Fix:** Use lowercase reverse-domain format with at least two segments. No hyphens, no uppercase, no leading numbers in any segment.

| Invalid | Valid |
| --- | --- |
| `My-App` | `com.myname.myapp` |
| `com.my-app.v2` | `com.myapp.v2` |
| `myapp` | `com.example.myapp` |
| `com.2fast.app` | `com.twofast.app` |

### `name: must be 20 characters or fewer` [​](#name-must-be-20-characters-or-fewer)

**Fix:** Shorten your app name. Use the `tagline` or `description` fields for longer text.

### `version: must be in x.y.z format` [​](#version-must-be-in-x-y-z-format)

**Fix:** Use three-part semver: `"1.0.0"`, not `"1.0"` or `"v1.0.0"`.

### `min_app_version / min_sdk_version: expected string, received undefined` [​](#min-app-version-min-sdk-version-expected-string-received-undefined)

**Fix:** Both fields are **required**. Add them to your `app.json`:

json

```
"min_app_version": "2.0.0",
"min_sdk_version": "0.0.7"
```

### `permissions: each permission must be an object with "name" ...` [​](#permissions-each-permission-must-be-an-object-with-name)

**Fix:** Permissions must be an array of objects with `name` and `desc` keys. See the [Permissions Format](#permissions-format) section above.

### `supported_languages: invalid language` [​](#supported-languages-invalid-language)

**Fix:** Use lowercase ISO codes from the supported set: `en`, `de`, `fr`, `es`, `it`, `zh`, `ja`, `ko`.

### `Entrypoint file not found` [​](#entrypoint-file-not-found)

**Fix:** Make sure the file referenced by `entrypoint` exists inside your build folder. If your Vite output goes to `dist/` and your entrypoint is `index.html`, check that `dist/index.html` exists.

### `Project folder not found` [​](#project-folder-not-found)

**Fix:** The second argument to `evenhub pack` must be a **path to an existing directory** containing your built files. Run your build step first (`npm run build`).

---

## Distribution [​](#distribution)

Once submitted, your app becomes available on **Even Hub**. Users can:

* **Download** your app from the Even Hub page
* **Launch** it from the glasses menu or through the Even Realities App on their phone

Pager

[Previous pageSimulator](/docs/reference/simulator)

[Next pageCLI](/docs/reference/cli)