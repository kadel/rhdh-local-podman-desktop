# RHDH Local Podman Desktop Extension

<p align="center">
  <img alt="RHDH Local" src="/images/helloselkie.png" width="50%">
</p>

## Overview

This is a Podman Desktop Extension for managing Red Hat Developer Hub Local (rhdh-local) instances. The extension provides a comprehensive interface for cloning, configuring, and managing RHDH Local deployments using Podman Compose.

The extension is built using multiple packages to distinguish between the frontend, backend, and shared code that connects the frontend and backend, following Podman Desktop extension best practices.

**Key Features:**
- **Repository Management**: Clone and update the rhdh-local repository
- **Lifecycle Management**: Start, stop, and restart RHDH Local services
- **Configuration Management**: Edit RHDH configuration files through the UI
- **Service Monitoring**: Real-time status monitoring of all services
- **Tray Integration**: Quick access controls via system tray

The extension leverages the Podman Desktop API and pre-built UI components via [@podman-desktop/ui-svelte](https://www.npmjs.com/package/@podman-desktop/ui-svelte).

**Architecture:**
* **Backend:** TypeScript-based API implementation with comprehensive RHDH Local management
* **Frontend:** Svelte-based UI with pre-made Podman Desktop components
* **Shared:** RPC-based communication layer between frontend and backend

**RHDH Local Integration:**
* Manages the [rhdh-local repository](https://github.com/redhat-developer/rhdh-local) 
* Uses docker-compose provided by Podman Desktop Compose extension for container orchestration
* Handles configuration files: `app-config.local.yaml`, `dynamic-plugins.override.yaml`, `.env`
* Provides tray menu integration for quick access

![RHDH Local Management](/images/helloworld.png)
![Status Notifications](/images/helloworld_notification.png)

## Tech Stack

The tech stack for this extension template includes:

* TypeScript
* Svelte 5
* TailwindCSS
* npm

## Architecture

The extension is organized into three packages:

* `packages/frontend`: A Svelte/Tailwind-based UI for RHDH Local management, built with [@podman-desktop/ui-svelte](https://www.npmjs.com/package/@podman-desktop/ui-svelte) components.
* `packages/backend`: The backend API implementation with RHDH Local integration, repository management, and system tray functionality.
* `packages/shared`: RPC-based communication layer defining the RHDH Local API interface between frontend and backend.

## Development

To build and develop the extension, follow these steps:

1. Clone the project or your fork:
```sh
$ git clone https://github.com/redhat-developer/rhdh-local-podman-desktop
```

2. Run `npm install` to install all relevant packages:
```sh
$ npm install
```

3. Create a build:

Creating a build will generate all required files for Podman Desktop to load the extension:

```sh
$ npm run build
```

In the `package.json` and `vite.config.js` files, we create a directory in `/packages/backend/media` that contains all the webview components. You will see output like the following:

```sh
$ npm run build
...
[0] transforming...
[0] ✓ 140 modules transformed.
[0] rendering chunks...
[0] ../backend/media/index.html                           0.48 kB
[0] ../backend/media/fa-v4compatibility-BX8XWJtE.woff2    4.80 kB
[0] ../backend/media/fa-v4compatibility-B9MWI-E6.ttf     10.84 kB
[0] ../backend/media/fa-regular-400-DgEfZSYE.woff2       25.46 kB
[0] ../backend/media/fa-regular-400-Bf3rG5Nx.ttf         67.98 kB
[0] ../backend/media/fa-brands-400-O7nZalfM.woff2       118.07 kB
[0] ../backend/media/fa-solid-900-DOQJEhcS.woff2        157.19 kB
[0] ../backend/media/fa-brands-400-Dur5g48u.ttf         209.38 kB
[0] ../backend/media/fa-solid-900-BV3CbEM2.ttf          423.68 kB
[0] ../backend/media/index-ChFLTcUn.css                 116.79 kB
[0] ../backend/media/index-B6Ge7rjZ.js                  125.62 kB │ map: 1,670.57 kB
[0] ✓ built in 1.49s
[0] npm run -w packages/frontend build exited with code 0
✨  Done in 3.02s.
```

These files will be loaded from the extension.

Optionally, you can also use `npm run watch` to continuously rebuild after each change, without needing to re-run `npm build`:

```sh
$ npm run watch
```

4. Load the extension within Podman Desktop:

We will load the extension within Podman Desktop to test it. This requires Podman Desktop v1.17+

1. Navigate to the settings and enable `Development Mode` for the `extensions`
1. Click on the `extensions` nav item in the left navigation bar
1. Go to the `Local extension` tab.
1. Click on the 'Add a local folder...' button and select the path of the `packages/backend` folder of this extension and click OK.
1. Now the extension is part of Podman Desktop and you can see it listed in the `installed` tab of the Extensions panel.


5. Confirm that the extension has been loaded:

You will now see a "RHDH Local" webview in the Podman Desktop navbar. The extension will also add tray menu items for quick access to RHDH Local management functions. Check the developer console for any logging information indicating that the extension has been loaded successfully.

Example of extension loading:

![loaded](/images/loaded.png)

## Linter, Typecheck, and Formatter

We include additional tools to assist in development, which can be found in the main `package.json` file.

Formatter:
```sh
$ npm run format:fix
```

Linter:
```sh
$ npm run lint:fix
```

Typechecker:
```sh
$ npm run typecheck
```

## Packaging and Publishing

More information on how to package and publish your extension can be found in our [official publishing documentation](https://podman-desktop.io/docs/extensions/publish).

However, we have provided a pre-made Containerfile in this template for you to try.

1. Package your extension by building the image:

```sh
$ podman build -t quay.io/myusername/myextension .
```

2. Push the extension to an external registry:

```sh
$ podman push quay.io/myusername/myextension
```

3. Install via the Podman Desktop "Install Custom..." button:

![custom install](/images/custom_install.png)
