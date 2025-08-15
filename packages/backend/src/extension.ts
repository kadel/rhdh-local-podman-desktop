import type { ExtensionContext } from '@podman-desktop/api';
import * as extensionApi from '@podman-desktop/api';
import fs from 'node:fs';
import { RpcExtension } from '/@shared/src/messages/MessageProxy';
import { RHDHLocalApiImpl } from './api-impl';

/**
 * Below is the "typical" extension.ts file that is used to activate and deactrivate the extension.
 * this file as well as package.json are the two main files that are required to develop a Podman Desktop extension.
 */

// Initialize the activation of the extension.
export async function activate(extensionContext: ExtensionContext): Promise<void> {
  console.log('starting RHDH Local extension');

  // A web view panel is created to display the index
  // we use the 'media' folder that contains the bread-and-butter of the webview.
  // it is assumed that index.html is the main file that is being displayed and all other files have already been generated.
  //
  // The 'index.html' and all other files are built with the `yarn build` command within packages/frontend which can also be ran with the
  // `yarn build` command in the main directory, which will also build the backend and shared packages.
  const panel = extensionApi.window.createWebviewPanel('rhdhLocal', 'RHDH Local', {
    localResourceRoots: [extensionApi.Uri.joinPath(extensionContext.extensionUri, 'media')],
  });
  extensionContext.subscriptions.push(panel);

  // Set the index.html file for the webview.
  const indexHtmlUri = extensionApi.Uri.joinPath(extensionContext.extensionUri, 'media', 'index.html');
  const indexHtmlPath = indexHtmlUri.fsPath;
  let indexHtml = await fs.promises.readFile(indexHtmlPath, 'utf8');

  // TEMPORARY. This is a workaround to replace the src of the script tag in the index.html file so that links work correctly.
  // In the content <script type="module" crossorigin src="./index-RKnfBG18.js"></script> replaces src with webview.asWebviewUri
  const scriptLink = indexHtml.match(/<script.*?src="(.*?)".*?>/g);
  if (scriptLink) {
    scriptLink.forEach(link => {
      const src = link.match(/src="(.*?)"/);
      if (src) {
        const webviewSrc = panel.webview.asWebviewUri(
          extensionApi.Uri.joinPath(extensionContext.extensionUri, 'media', src[1]),
        );
        indexHtml = indexHtml.replace(src[1], webviewSrc.toString());
      }
    });
  }

  // TEMPORARY. We do the same for the css link
  const cssLink = indexHtml.match(/<link.*?href="(.*?)".*?>/g);
  if (cssLink) {
    cssLink.forEach(link => {
      const href = link.match(/href="(.*?)"/);
      if (href) {
        const webviewHref = panel.webview.asWebviewUri(
          extensionApi.Uri.joinPath(extensionContext.extensionUri, 'media', href[1]),
        );
        indexHtml = indexHtml.replace(href[1], webviewHref.toString());
      }
    });
  }

  // Update the webview panel with the new index.html file with corrected links.
  panel.webview.html = indexHtml;

  // We now register the 'api' for the webview to communicate to the backend
  const rpcExtension = new RpcExtension(panel.webview);
  const RHDHLocalApi = new RHDHLocalApiImpl(extensionContext);
  
  rpcExtension.registerInstance<RHDHLocalApiImpl>(RHDHLocalApiImpl, RHDHLocalApi);

  // Automatically clone repository if not installed
  try {
    const installationCheck = await RHDHLocalApi.checkInstallation();
    if (!installationCheck.installed) {
      console.log('RHDH Local repository not found, cloning automatically...');
      await RHDHLocalApi.cloneRepository();
      console.log('RHDH Local repository cloned and configured automatically');
    } else {
      console.log('RHDH Local repository already exists at:', installationCheck.path);
    }
  } catch (error) {
    console.error('Failed to automatically clone RHDH Local repository:', error);
    // Continue with extension activation even if cloning fails
  }

  // Register tray icon commands for RHDH Local management
  const startCommand = extensionApi.commands.registerCommand('rhdh-local.start', async () => {
    try {
      await RHDHLocalApi.start();
    } catch (error) {
      console.error('Failed to start RHDH Local:', error);
    }
  });

  const stopCommand = extensionApi.commands.registerCommand('rhdh-local.stop', async () => {
    try {
      await RHDHLocalApi.stop();
    } catch (error) {
      console.error('Failed to stop RHDH Local:', error);
    }
  });

  const restartCommand = extensionApi.commands.registerCommand('rhdh-local.restart', async () => {
    try {
      await RHDHLocalApi.restart();
    } catch (error) {
      console.error('Failed to restart RHDH Local:', error);
    }
  });

  const statusCommand = extensionApi.commands.registerCommand('rhdh-local.status', async () => {
    try {
      const status = await RHDHLocalApi.getStatus();
      
      // Build services status dynamically
      const servicesStatus = Object.entries(status.services)
        .map(([serviceName, serviceStatus]) => `- ${serviceName}: ${serviceStatus.status}`)
        .join('\n');
      
      const message = `RHDH Local Status:
- Running: ${status.isRunning ? 'Yes' : 'No'}
- Installed: ${status.isInstalled ? 'Yes' : 'No'}
- Repo Path: ${status.repoPath ?? 'N/A'}
${status.url ? `- URL: ${status.url}` : ''}
${status.gitBranch ? `- Branch: ${status.gitBranch}` : ''}
${status.gitCommit ? `- Commit: ${status.gitCommit}` : ''}

Services:
${servicesStatus || '- No services found'}`;
      
      await extensionApi.window.showInformationMessage(message);
    } catch (error) {
      console.error('Failed to get RHDH Local status:', error);
    }
  });

  const openBrowserCommand = extensionApi.commands.registerCommand('rhdh-local.openBrowser', async () => {
    try {
      await RHDHLocalApi.openRHDHInBrowser();
    } catch (error) {
      console.error('Failed to open RHDH in browser:', error);
    }
  });

  const openWorkingDirectoryCommand = extensionApi.commands.registerCommand('rhdh-local.openWorkingDirectory', async () => {
    try {
      await RHDHLocalApi.openWorkingDirectory();
    } catch (error) {
      console.error('Failed to open file browser:', error);
    }
  });

  extensionContext.subscriptions.push(startCommand, stopCommand, restartCommand, statusCommand, openBrowserCommand, openWorkingDirectoryCommand);

  // Register tray menu items for RHDH Local management
  let currentTrayMenus: extensionApi.Disposable[] = [];

  const updateTrayMenus = async () => {
    // Dispose of existing menu items
    currentTrayMenus.forEach(menu => menu.dispose());
    currentTrayMenus = [];

    try {
      const status = await RHDHLocalApi.getStatus();
      
      // Build submenu items array
      const submenuItems: extensionApi.MenuItem[] = [];

      if (status.isInstalled) {
        // Repository is installed - show combined start/stop with status indicator
        if (status.isRunning) {
          // RHDH is running - show stop option with green indicator
          submenuItems.push({
            id: 'rhdh-local.stop',
            label: '🟢 Stop RHDH Local',
          });

          // Show restart options when running
          submenuItems.push({
            id: 'rhdh-local.restart',
            label: '🔄 Restart RHDH Local',
          });
        } else {
          // RHDH is stopped - show start option with red indicator
          submenuItems.push({
            id: 'rhdh-local.start',
            label: '🔴 Start RHDH Local',
          });
        }

        // Always show status details when installed
        submenuItems.push({
          id: 'rhdh-local-separator-2',
          type: 'separator',
        });

        submenuItems.push({
          id: 'rhdh-local.status',
          label: '📊 Show Detailed Status',
        });
      } else {
        // Repository not installed (rare case due to auto-cloning, might be in progress)
        submenuItems.push({
          id: 'rhdh-local.status',
          label: '⚠️ Repository Installing - Show Status',
        });
      }

      // Always show utility options (regardless of running status or installation)
      submenuItems.push({
        id: 'rhdh-local-separator-3',
        type: 'separator',
      });

      submenuItems.push({
        id: 'rhdh-local.openBrowser',
        label: '🌐 Open RHDH in Browser',
      });

      submenuItems.push({
        id: 'rhdh-local.openWorkingDirectory',
        label: '📁 Open RHDH Local working directory',
      });

      // Create the main submenu item that contains all RHDH Local items
      const rhdhSubmenu = extensionApi.tray.registerMenuItem({
        id: 'rhdh-local-submenu',
        label: 'RHDH Local',
        type: 'submenu',
        submenu: submenuItems,
      });
      
      currentTrayMenus.push(rhdhSubmenu);

      // Add all menu items to subscriptions for cleanup
      currentTrayMenus.forEach(menu => extensionContext.subscriptions.push(menu));

    } catch (error) {
      console.error('Failed to update tray menus:', error);
      
      // Fallback menu when status can't be determined - also in submenu
      const errorSubmenu = extensionApi.tray.registerMenuItem({
        id: 'rhdh-local-submenu',
        label: 'RHDH Local',
        type: 'submenu',
        submenu: [{
          id: 'rhdh-local.status',
          label: '❌ Error - Show Status Details',
        }, {
          id: 'rhdh-local-separator-error',
          type: 'separator',
        }, {
          id: 'rhdh-local.openBrowser',
          label: '🌐 Open RHDH in Browser',
        }, {
          id: 'rhdh-local.openWorkingDirectory',
          label: '📁 Open RHDH Local working directory',
        }],
      });
      currentTrayMenus.push(errorSubmenu);
      extensionContext.subscriptions.push(errorSubmenu);
    }
  };


  // Initial tray menu setup
  await updateTrayMenus();

  // Update tray menus periodically (every 30 seconds)
  const trayUpdateInterval = setInterval(updateTrayMenus, 30000);
  extensionContext.subscriptions.push({
    dispose: () => clearInterval(trayUpdateInterval)
  });

  // Update tray menus after any RHDH operation
  const originalStart = RHDHLocalApi.start.bind(RHDHLocalApi);
  const originalStop = RHDHLocalApi.stop.bind(RHDHLocalApi);
  const originalRestart = RHDHLocalApi.restart.bind(RHDHLocalApi);

  RHDHLocalApi.start = async () => {
    await originalStart();
    setTimeout(updateTrayMenus, 2000); // Wait 2 seconds for services to stabilize
  };

  RHDHLocalApi.stop = async () => {
    await originalStop();
    setTimeout(updateTrayMenus, 2000);
  };

  RHDHLocalApi.restart = async () => {
    await originalRestart();
    setTimeout(updateTrayMenus, 3000); // Wait longer for restart
  };
}

export async function deactivate(): Promise<void> {
  console.log('stopping RHDH Local extension');
}
