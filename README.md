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


## Requirements

- Podman Desktop 1.17+ (macOS, Windows, or Linux)
- Podman Desktop Compose extension enabled
- Internet access to clone `rhdh-local` and pull container images
- Git available in your PATH (the extension checks this and will warn if missing)


## Installation

Install this extension in Podman Desktop following the official Podman Desktop Extensions documentation for installing from an OCI image (see "Install custom..."): [Podman Desktop Extensions – Install](https://podman-desktop.io/docs/extensions/install).

1. Open Podman Desktop and go to `Extensions`.
2. Click `Install custom...`.
3. In the OCI image field, enter:

   ```
   quay.io/tkral/podman-desktop-extension-rhdh-local:dev
   ```

4. Click `Install` and wait for the installation to complete.
5. The extension will appear under `Installed`. Open `RHDH Local` from the left navigation.

![Install custom button](/images/custom_install.png)

## Using the extension

- **Start/Stop/Restart**: Control the RHDH Local deployment lifecycle.
- **Install Plugins**: Runs the `install-dynamic-plugins` service. After changing `dynamic-plugins.override.yaml`, run Install Plugins and then Restart.
- **Update Repository**: Pull the latest changes from `rhdh-local` (`git pull`).
- **Edit Configuration**: Manage these files directly from the UI:
  - `.env` (environment)
  - `configs/app-config/app-config.local.yaml` (app configuration)
  - `configs/dynamic-plugins/dynamic-plugins.override.yaml` (dynamic plugins)
  - `configs/catalog-entities/users.override.yaml` (catalog users)
  - `configs/catalog-entities/components.override.yaml` (catalog components)
- **When to restart**:
  - Change `app-config.local.yaml`, `users.override.yaml`, or `components.override.yaml` → Restart RHDH.
  - Change `dynamic-plugins.override.yaml` → Install Plugins, then Restart RHDH.
- **Service Status & Logs**: Inspect per-service status, stream logs, and restart individual services.


## Troubleshooting

- "Git is not available" → Install Git and restart Podman Desktop.
- "docker-compose is not available" → Ensure the Podman Desktop Compose extension is installed and enabled; restart Podman Desktop if needed.
- Port 7007 already in use → Stop other services using the port, then Start again.

## Links

- [RHDH Local repository](https://github.com/redhat-developer/rhdh-local)
- [RHDH Local usage guide](https://github.com/redhat-developer/rhdh-local?tab=readme-ov-file#usage)
- [Podman Desktop Extensions – Install](https://podman-desktop.io/docs/extensions/install)

## Contributing

We welcome issues and contributions! See `CONTRIBUTING.md` for local development, testing, and packaging instructions.
