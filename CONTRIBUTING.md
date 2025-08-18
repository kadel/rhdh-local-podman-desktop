# Contributing to RHDH Local Podman Desktop Extension

Thank you for your interest in contributing! This document outlines how to set up your development environment, run builds and tests, and package the extension.

## Project Information

The extension leverages the Podman Desktop API and pre-built UI components via [@podman-desktop/ui-svelte](https://www.npmjs.com/package/@podman-desktop/ui-svelte).

**Architecture:**
* **Backend:** TypeScript-based API implementation with comprehensive RHDH Local management
* **Frontend:** Svelte-based UI with pre-made Podman Desktop components
* **Shared:** RPC-based communication layer between frontend and backend



## Prerequisites

- Node.js 22+
- npm 11+
- Podman Desktop 1.17+

## Project layout

```
monorepo/
├── packages/backend/     # Extension backend (Node.js/TypeScript)
├── packages/frontend/    # UI (Svelte 5/TypeScript/TailwindCSS)
├── packages/shared/      # Shared API and types
└── package.json          # Workspace configuration & scripts
```


## Install

```sh
npm install
```

## Build

```sh
npm run build
```

This builds both `packages/frontend` and `packages/backend`, producing webview assets in `packages/backend/media`.

For development with live rebuilds:

```sh
npm run watch
```

## Typecheck, Lint, Format

```sh
npm run typecheck
npm run lint:check
npm run lint:fix
npm run format:check
npm run format:fix
```

## Tests

We use Vitest.

Run all packages:

```sh
npm test
```

Or individually:

```sh
npm run test:backend
npm run test:shared
npm run test:frontend
```

## Load locally in Podman Desktop

1. Open Podman Desktop (1.17+).
2. Enable Development Mode in Settings → Extensions.
3. Extensions → Local extension → Add a local folder..., select `packages/backend`.
4. Confirm it appears under Installed, then open the RHDH Local view.

## Packaging and publishing

See the official docs: `https://podman-desktop.io/docs/extensions/publish`.

We provide a `Containerfile` to build an OCI image suitable for the "Install custom..." workflow.

```sh
podman build -t quay.io/<your-namespace>/podman-desktop-extension-rhdh-local:dev .
podman push quay.io/<your-namespace>/podman-desktop-extension-rhdh-local:dev
```

To install your built image in Podman Desktop, use Extensions → Install custom... and enter your OCI reference.

## Code style and quality

- Prefer explicit, readable TypeScript. Avoid abbreviations and cryptic names.
- Handle errors with helpful messages shown via the Podman Desktop API.
- Keep UI responsive: show loading and error states.

## Commit messages

Use concise, descriptive messages. If you need guidance, keep Conventional Commits style in mind.

## Reporting issues

Please include environment details, Podman Desktop version, steps to reproduce, and logs if available.


