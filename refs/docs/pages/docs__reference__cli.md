# CLI | Documentation

Source: https://hub.evenrealities.com/docs/reference/cli

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

* [Installation](#installation "Installation")
* [Commands](#commands "Commands")
* [Shell Completions](#shell-completions "Shell Completions")

The CLI (`v0.1.12`) handles authentication, QR sideloading, and app packaging.

## Installation [​](#installation)

Install globally so the `evenhub` binary is on your `PATH`:

bash

```
npm install -g @evenrealities/evenhub-cli
```

Alternatively, pin the version per-repo:

bash

```
npm install -D @evenrealities/evenhub-cli
```

> **npm:** [@evenrealities/evenhub-cli](https://www.npmjs.com/package/@evenrealities/evenhub-cli)

### `eh` shortcut [​](#eh-shortcut)

The CLI also installs a shorter `eh` binary as an alias for `evenhub`. Both commands are interchangeable:

bash

```
eh login           # same as: evenhub login
eh qr --url ...    # same as: evenhub qr --url ...
eh pack app.json dist
```

All commands documented below work identically with either binary.

## Commands [​](#commands)

### `evenhub login` [​](#evenhub-login)

Authenticate with your Even Hub developer account.

bash

```
evenhub login
evenhub login -e your@email.com
```

| Option | Description |
| --- | --- |
| `-e`, `--email <email>` | Your account email |

### `evenhub init` [​](#evenhub-init)

Generate a starter `app.json` manifest in the current or specified directory.

bash

```
evenhub init
evenhub init -d ./my-project
evenhub init -o ./config/app.json
```

| Option | Description |
| --- | --- |
| `-d`, `--directory <dir>` | Directory to create the file in (default: `./`) |
| `-o`, `--output <path>` | Output file path (overrides `--directory`) |

### `evenhub qr` [​](#evenhub-qr)

Generate a QR code for sideloading your app during development.

bash

```
# Simplest usage — provide the full URL
evenhub qr --url "http://192.168.1.100:5173"

# Or build the URL from parts
evenhub qr -i 192.168.1.100 -p 5173 --path /my-app

# Output to a file instead of terminal
evenhub qr --url "http://192.168.1.100:5173" -e
```

| Option | Description |
| --- | --- |
| `-u`, `--url <url>` | Full URL (ignores other URL options) |
| `-i`, `--ip <ip>` | IP address or hostname |
| `-p`, `--port <port>` | Port number |
| `--path <path>` | URL path |
| `--https` | Use HTTPS instead of HTTP |
| `--http` | Use HTTP (default) |
| `-e`, `--external` | Open QR in external program instead of terminal |
| `-s`, `--scale <n>` | Scale factor for file output (default: 4) |
| `--clear` | Clear cached scheme, IP, port, and path |

Scan the QR code with the **Even Realities App** on your phone. Your app loads on the glasses with hot reload support.

### `evenhub pack` [​](#evenhub-pack)

Package your built app into an `.ehpk` file for distribution.

bash

```
evenhub pack app.json dist -o myapp.ehpk
```

| Argument / Option | Description |
| --- | --- |
| `<json>` | Path to your `app.json` manifest |
| `<project>` | Path to your built output folder (`dist`, `build`, etc.) |
| `-o`, `--output <file>` | Output filename (default: `out.ehpk`) |
| `--no-ignore` | Include hidden files (dotfiles) |
| `-c`, `--check` | Check if the `package_id` is available on Even Hub |

See [Packaging & Deployment](/docs/reference/packaging) for the full `app.json` schema, validation rules, and troubleshooting guide.

## Shell Completions [​](#shell-completions)

Generate completions for your shell:

bash

```
evenhub --completion-bash   # Bash
evenhub --completion-zsh    # Zsh
evenhub --completion-fish   # Fish
```

Pager

[Previous pagePackaging & Deployment](/docs/reference/packaging)

[Next pageApp Submission & QA Guidelines](/docs/reference/app-submission)