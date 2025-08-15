<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { 
  faRocket, 
  faPlay, 
  faStop, 
  faRotate, 
  faExternalLinkAlt,
  faDownload,
  faCheckCircle,
  faExclamationCircle,
  faClock,
  faCode,
  faDatabase,
  faPuzzlePiece,
  faRefresh,
  faEye,
  faTimes,
  faSpinner,
  faSync,
  faRedo,
  faExclamationTriangle,
  faSyncAlt,
  faCopy,
  faCodeBranch,
  faSave
} from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import { rhdhLocalClient } from './api/client';
import type { RHDHStatus, InstallationCheck, RHDHServiceStatus, ConfigurationType, ConfigurationFile } from '/@shared/src/RHDHLocalApi';

/**
 * RHDH Local Status Dashboard
 * Provides comprehensive view and management of RHDH Local instances
 */

let status: RHDHStatus | null = null;
let installationCheck: InstallationCheck | null = null;
let loading = true;
let error: string | null = null;
let refreshInterval: NodeJS.Timeout;

// Actions loading states
let actionLoading: { [key: string]: boolean } = {};

// Tab state for services
let activeServiceTab: string = '';

// Log streaming state
let streamingIntervals: { [serviceName: string]: NodeJS.Timeout } = {};
let streamingLogs: { [serviceName: string]: boolean } = {};
let logLines: { [serviceName: string]: string[] } = {};
let showLogs: { [serviceName: string]: boolean } = {};
let lastLogTimestamp: { [serviceName: string]: Date } = {};

// Configuration state
let configFiles: { [key in ConfigurationType]?: ConfigurationFile } = {};
let configContents: { [key in ConfigurationType]?: string } = {};
let configLoading: { [key in ConfigurationType]?: boolean } = {};
let configSaving: { [key in ConfigurationType]?: boolean } = {};
let configsLoaded = false;

onMount(() => {
  loadStatus();
  // Auto-refresh every 10 seconds
  refreshInterval = setInterval(loadStatus, 10000);
});

onDestroy(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  // Clean up all streaming intervals
  Object.values(streamingIntervals).forEach(interval => {
    clearInterval(interval);
  });
});

async function loadStatus() {
  try {
    error = null;
    const [statusResult, installCheck] = await Promise.all([
      rhdhLocalClient.getStatus(),
      rhdhLocalClient.checkInstallation()
    ]);
    
    status = statusResult;
    installationCheck = installCheck;
    
    // Set initial active tab if not set
    if (status && status.services && Object.keys(status.services).length > 0 && !activeServiceTab) {
      activeServiceTab = Object.keys(status.services)[0];
    }

    // Auto-load configurations if repository is installed and not already loaded
    if (status?.isInstalled && !configsLoaded) {
      await loadAllConfigurations();
    }
    
    loading = false;
  } catch (err) {
    console.error('Failed to load status:', err);
    error = err instanceof Error ? err.message : 'Failed to load status';
    loading = false;
  }
}

async function performAction(actionName: string, action: () => Promise<void>) {
  try {
    actionLoading[actionName] = true;
    await action();
    // Refresh status after action
    await loadStatus();
  } catch (err) {
    console.error(`Failed to ${actionName}:`, err);
    error = err instanceof Error ? err.message : `Failed to ${actionName}`;
  } finally {
    actionLoading[actionName] = false;
  }
}

async function startLogStream(serviceName: string) {
  try {
    // Stop existing stream if any
    if (streamingIntervals[serviceName]) {
      stopLogStream(serviceName);
    }

    actionLoading[`logs-${serviceName}`] = true;
    
    // Trigger Svelte reactivity for all state changes
    streamingLogs = { ...streamingLogs, [serviceName]: true };
    logLines = { ...logLines, [serviceName]: [] };
    showLogs = { ...showLogs, [serviceName]: true };

    // Initial log fetch
    await fetchLogs(serviceName);

    // Set up polling interval for new logs
    const interval = setInterval(async () => {
      if (streamingLogs[serviceName]) {
        await fetchLogs(serviceName);
      } else {
        clearInterval(interval);
        delete streamingIntervals[serviceName];
      }
    }, 3000); // Poll every 3 seconds

    streamingIntervals[serviceName] = interval;

  } catch (err) {
    console.error(`Failed to start log stream for ${serviceName}:`, err);
    streamingLogs = { ...streamingLogs, [serviceName]: false };
    error = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    actionLoading[`logs-${serviceName}`] = false;
  }
}

async function fetchLogs(serviceName: string) {
  try {
    console.log(`[UI] Fetching logs for ${serviceName}...`);
    
    const logResponse = await rhdhLocalClient.getStreamingLogs(serviceName, {
      follow: true,
      tail: 100,
      timestamps: true
    });

    console.log(`[UI] Received log response for ${serviceName}:`, {
      logsLength: logResponse.logs?.length || 0,
      hasMore: logResponse.hasMore,
      error: logResponse.error,
      timestamp: logResponse.timestamp
    });

    if (logResponse.error) {
      console.error(`Log fetch error for ${serviceName}:`, logResponse.error);
      // Still show the error message in logs
    }

    if (logResponse.logs) {
      // Split data into lines and filter out empty ones
      const newLines = logResponse.logs.split('\n').filter(line => line.trim());
      console.log(`[UI] Processing ${newLines.length} log lines for ${serviceName}`);
      
      if (newLines.length > 0) {
        const currentLines = logLines[serviceName] || [];
        
        // Simple deduplication: if this looks like the same log set, don't duplicate
        const isNewData = !lastLogTimestamp[serviceName] || 
                          logResponse.timestamp > lastLogTimestamp[serviceName] ||
                          currentLines.length === 0;
        
        if (isNewData) {
          const updatedLines = [...currentLines, ...newLines].slice(-500);
          
          // Trigger Svelte reactivity
          logLines = { ...logLines, [serviceName]: updatedLines };
          lastLogTimestamp = { ...lastLogTimestamp, [serviceName]: logResponse.timestamp };
          
          console.log(`[UI] Updated ${serviceName} logs, total lines:`, updatedLines.length);
          
          // Auto-scroll to bottom
          setTimeout(() => {
            const logContainer = document.getElementById(`log-container-${serviceName}`);
            if (logContainer) {
              logContainer.scrollTop = logContainer.scrollHeight;
            }
          }, 50);
        } else {
          console.log(`[UI] Skipping duplicate log data for ${serviceName}`);
        }
      }
    }

  } catch (err) {
    console.error(`Failed to fetch logs for ${serviceName}:`, err);
    // Add error message to logs
    const errorLine = `[${new Date().toISOString()}] Error fetching logs: ${err instanceof Error ? err.message : 'Unknown error'}`;
    const currentLines = logLines[serviceName] || [];
    logLines = { ...logLines, [serviceName]: [...currentLines, errorLine].slice(-500) };
  }
}

function stopLogStream(serviceName: string) {
  if (streamingIntervals[serviceName]) {
    clearInterval(streamingIntervals[serviceName]);
    delete streamingIntervals[serviceName];
  }
  streamingLogs = { ...streamingLogs, [serviceName]: false };
  console.log(`[UI] Stopped log streaming for ${serviceName}`);
}

function toggleLogs(serviceName: string) {
  showLogs = { ...showLogs, [serviceName]: !showLogs[serviceName] };
}

function getServiceIcon(serviceName: string) {
  switch (serviceName) {
    case 'rhdh': return faCode;
    case 'postgresql': return faDatabase;
    case 'install-dynamic-plugins': return faPuzzlePiece;
    default: return faCheckCircle;
  }
}

function getStatusColor(serviceStatus: RHDHServiceStatus) {
  switch (serviceStatus.status) {
    case 'running': return 'text-green-500';
    case 'stopped': return 'text-gray-500';
    case 'error': return 'text-red-500';
    case 'not-used': return 'text-yellow-500';
    default: return 'text-gray-400';
  }
}

function getStatusIcon(serviceStatus: RHDHServiceStatus) {
  switch (serviceStatus.status) {
    case 'running': return faCheckCircle;
    case 'stopped': return faStop;
    case 'error': return faExclamationCircle;
    case 'not-used': return faDownload;
    default: return faClock;
  }
}

function formatUptime(uptime?: string): string {
  if (!uptime) return 'N/A';
  return uptime;
}

function renderIcon(icon: any, className: string = '') {
  return `<i class="fas fa-${icon.iconName} ${className}"></i>`;
}

// Configuration functions
const configTypes: ConfigurationType[] = ['env', 'app-config', 'dynamic-plugins', 'users', 'components'];

async function loadConfiguration(configType: ConfigurationType) {
  try {
    configLoading = { ...configLoading, [configType]: true };
    
    const configFile = await rhdhLocalClient.getConfiguration(configType);
    configFiles = { ...configFiles, [configType]: configFile };
    configContents = { ...configContents, [configType]: configFile.content };
  } catch (err) {
    console.error(`Failed to load ${configType} configuration:`, err);
    error = err instanceof Error ? err.message : `Failed to load ${configType} configuration`;
  } finally {
    configLoading = { ...configLoading, [configType]: false };
  }
}

async function saveConfiguration(configType: ConfigurationType) {
  const content = configContents[configType];
  if (content === undefined) return;

  try {
    configSaving = { ...configSaving, [configType]: true };
    
    await rhdhLocalClient.updateConfiguration(configType, content);
    
    // Reload the configuration to get updated metadata
    await loadConfiguration(configType);
  } catch (err) {
    console.error(`Failed to save ${configType} configuration:`, err);
    error = err instanceof Error ? err.message : `Failed to save ${configType} configuration`;
  } finally {
    configSaving = { ...configSaving, [configType]: false };
  }
}

async function loadAllConfigurations() {
  if (!status?.isInstalled) return;
  
  try {
    // Load all configuration files in parallel
    await Promise.all(configTypes.map(configType => loadConfiguration(configType)));
    configsLoaded = true;
  } catch (err) {
    console.error('Failed to load configurations:', err);
    // Individual loadConfiguration functions will handle their own errors
  }
}

function getConfigDisplayName(configType: ConfigurationType): string {
  switch (configType) {
    case 'env': return 'Environment Variables (.env)';
    case 'app-config': return 'App Configuration (app-config.local.yaml)';
    case 'dynamic-plugins': return 'Dynamic Plugins (dynamic-plugins.override.yaml)';
    case 'users': return 'User Entities (users.override.yaml)';
    case 'components': return 'Component Entities (components.override.yaml)';
    default: return configType;
  }
}

function getConfigDescription(configType: ConfigurationType): string {
  switch (configType) {
    case 'env': return 'Environment variables for RHDH Local deployment';
    case 'app-config': return 'Main RHDH application configuration overrides';
    case 'dynamic-plugins': return 'Configuration for dynamic plugins and their settings';
    case 'users': return 'User catalog entities for the RHDH instance';
    case 'components': return 'Component catalog entities for the RHDH instance';
    default: return `Configuration for ${configType}`;
  }
}

function isContentModified(configType: ConfigurationType): boolean {
  const currentContent = configContents[configType];
  const originalContent = configFiles[configType]?.content;
  return currentContent !== undefined && currentContent !== originalContent;
}
</script>

<div class="flex flex-col h-full p-6 bg-[var(--pd-content-bg)]">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div class="flex items-center gap-3">
      {@html renderIcon(faRocket, 'text-2xl text-purple-500')}
      <div>
        <h1 class="text-2xl font-bold text-[var(--pd-content-header)]">RHDH Local</h1>
        <p class="text-sm text-[var(--pd-content-sub)]">Red Hat Developer Hub Local Management</p>
      </div>
    </div>
    
    <div class="flex gap-2">
      <Button 
        on:click={loadStatus} 
        disabled={loading}
        title="Refresh Status">
        {@html renderIcon(faSyncAlt, loading ? 'animate-spin' : '')}
        Refresh
      </Button>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center h-64">
      <div class="flex flex-col items-center gap-4">
        {@html renderIcon(faSpinner, 'animate-spin text-3xl text-purple-500')}
        <p class="text-[var(--pd-content-sub)]">Loading RHDH Local status...</p>
      </div>
    </div>
  {:else if error}
    <div class="flex items-center justify-center h-64">
      <div class="flex flex-col items-center gap-4 p-6 bg-red-50 dark:bg-red-900/20 rounded-lg">
        {@html renderIcon(faExclamationTriangle, 'text-3xl text-red-500')}
        <p class="text-red-600 dark:text-red-400 text-center">{error}</p>
        <Button on:click={loadStatus}>Try Again</Button>
      </div>
    </div>
  {:else if !installationCheck?.installed}
    <div class="flex items-center justify-center h-64">
      <div class="flex flex-col items-center gap-4 p-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg max-w-md text-center">
        {@html renderIcon(faDownload, 'text-3xl text-yellow-500')}
        <h3 class="text-lg font-semibold text-[var(--pd-content-header)]">RHDH Local Not Installed</h3>
        <p class="text-[var(--pd-content-sub)]">Clone the RHDH Local repository to get started.</p>
        
        {#if installationCheck?.issues && installationCheck.issues.length > 0}
          <div class="text-left w-full">
            <p class="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Requirements Issues:</p>
            <ul class="text-sm text-red-600 dark:text-red-400 space-y-1">
              {#each installationCheck.issues as issue}
                <li>• {issue}</li>
              {/each}
            </ul>
          </div>
        {/if}
        
        <Button 
          on:click={() => performAction('clone', () => rhdhLocalClient.cloneRepository())}
          disabled={actionLoading.clone || !installationCheck?.gitAvailable}
          class="mt-4">
          {#if actionLoading.clone}
            {@html renderIcon(faSpinner, 'animate-spin mr-2')}
          {:else}
            {@html renderIcon(faDownload, 'mr-2')}
          {/if}
          Clone Repository
        </Button>
      </div>
    </div>

  {:else if status}
    <div class="flex-1 overflow-auto space-y-6">
      <!-- Overall Status Card -->
      <div class="bg-[var(--pd-content-card-bg)] rounded-lg p-6 border border-[var(--pd-content-divider)]">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-[var(--pd-content-header)]">Overall Status</h2>
          <div class="flex items-center gap-2">
            <div class={`w-3 h-3 rounded-full ${status.isRunning ? 'bg-green-500' : 'bg-gray-500'}`}></div>
            <span class={`font-medium ${status.isRunning ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {status.isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p class="text-sm text-[var(--pd-content-sub)] mb-1">Access URL</p>
            <div class="flex items-center gap-2">
              <p class="text-sm text-[var(--pd-content-header)]">
                {status.url || 'Not available'}
              </p>
              {#if status.url && status.isRunning}
                <Button 
                  on:click={() => performAction('openBrowser', () => rhdhLocalClient.openRHDHInBrowser())}
                  disabled={actionLoading.openBrowser}
                  title="Open in Browser">
                  {@html renderIcon(faExternalLinkAlt)}
                </Button>
              {/if}
            </div>
          </div>

          <div></div> <!-- Empty div to maintain grid alignment -->
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-wrap gap-2">
          {#if status.isRunning}
            <Button 
              on:click={() => performAction('stop', () => rhdhLocalClient.stop())}
              disabled={actionLoading.stop}
              class="bg-red-500 hover:bg-red-600">
              {#if actionLoading.stop}
                {@html renderIcon(faSpinner, 'animate-spin mr-2')}
              {:else}
                {@html renderIcon(faStop, 'mr-2')}
              {/if}
              Stop
            </Button>
            
            <Button 
              on:click={() => performAction('restart', () => rhdhLocalClient.restart())}
              disabled={actionLoading.restart}>
              {#if actionLoading.restart}
                {@html renderIcon(faSpinner, 'animate-spin mr-2')}
              {:else}
                {@html renderIcon(faRedo, 'mr-2')}
              {/if}
              Restart
            </Button>
          {:else}
            <Button 
              on:click={() => performAction('start', () => rhdhLocalClient.start())}
              disabled={actionLoading.start}
              class="bg-green-500 hover:bg-green-600">
              {#if actionLoading.start}
                {@html renderIcon(faSpinner, 'animate-spin mr-2')}
              {:else}
                {@html renderIcon(faPlay, 'mr-2')}
              {/if}
              Start
            </Button>
          {/if}

          <Button 
            on:click={() => performAction('installPlugins', () => rhdhLocalClient.installPlugins())}
            disabled={actionLoading.installPlugins}>
            {#if actionLoading.installPlugins}
              {@html renderIcon(faSpinner, 'animate-spin mr-2')}
            {:else}
              {@html renderIcon(faPuzzlePiece, 'mr-2')}
            {/if}
            Install Plugins
          </Button>
        </div>
      </div>

      <!-- RHDH-Local Repository -->
      <div class="bg-[var(--pd-content-card-bg)] rounded-lg p-6 border border-[var(--pd-content-divider)]">
        <h2 class="text-lg font-semibold text-[var(--pd-content-header)] mb-4">RHDH-Local Repository</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {#if installationCheck?.path}
            <div>
              <p class="text-sm text-[var(--pd-content-sub)] mb-1">Repository Path</p>
              <div class="flex items-center gap-2">
                <p class="text-sm text-[var(--pd-content-header)] font-mono" title="{installationCheck.path}">
                  {installationCheck.path}
                </p>
                <button 
                  class="text-xs hover:text-purple-500 transition-colors"
                  title="Copy Repository Path"
                  on:click={async () => {
                    try {
                      if (installationCheck?.path) {
                        await navigator.clipboard.writeText(installationCheck.path);
                        console.log('Repository path copied to clipboard');
                      }
                    } catch (err) {
                      console.error('Failed to copy repository path:', err);
                    }
                  }}>
                  {@html renderIcon(faCopy, 'text-xs')}
                </button>
              </div>
            </div>
          {/if}

          {#if status.gitBranch}
            <div>
              <p class="text-sm text-[var(--pd-content-sub)] mb-1">Current Branch</p>
              <div class="flex items-center gap-2">
                {@html renderIcon(faCodeBranch, 'text-purple-500')}
                <p class="text-sm text-[var(--pd-content-header)] font-mono">
                  {status.gitBranch}
                </p>
              </div>
            </div>
          {/if}

          {#if status.gitCommit}
            <div>
              <p class="text-sm text-[var(--pd-content-sub)] mb-1">Latest Commit</p>
              <div class="flex items-center gap-2">
                <p class="text-sm text-[var(--pd-content-header)] font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded"
                   title="Full commit: {status.gitCommit}">
                  {status.gitCommit.substring(0, 8)}
                </p>
                <button 
                  class="text-xs hover:text-purple-500 transition-colors"
                  title="Copy Full Commit Hash"
                  on:click={async () => {
                    try {
                      if (status?.gitCommit) {
                        await navigator.clipboard.writeText(status.gitCommit);
                        console.log('Git commit hash copied to clipboard');
                      }
                    } catch (err) {
                      console.error('Failed to copy git commit hash:', err);
                    }
                  }}>
                  {@html renderIcon(faCopy, 'text-xs')}
                </button>
              </div>
            </div>
          {/if}
        </div>

        <div class="text-sm text-[var(--pd-content-sub)] mb-4">
          Repository URL: <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">https://github.com/redhat-developer/rhdh-local</code>
        </div>

        <!-- Repository Actions -->
        <div class="flex flex-wrap gap-2">
          <Button 
            size="sm"
            on:click={() => performAction('update', () => rhdhLocalClient.updateRepository())}
            disabled={actionLoading.update}
            title="Pull latest changes from remote repository">
            {#if actionLoading.update}
              {@html renderIcon(faSpinner, 'animate-spin mr-2')}
            {:else}
              {@html renderIcon(faSync, 'mr-2')}
            {/if}
            Update Repository
          </Button>

          <Button 
            size="sm"
            on:click={() => performAction('openGitHub', () => rhdhLocalClient.openExternalUrl('https://github.com/redhat-developer/rhdh-local'))}
            disabled={actionLoading.openGitHub}
            title="Open repository in GitHub">
            {#if actionLoading.openGitHub}
              {@html renderIcon(faSpinner, 'animate-spin mr-2')}
            {:else}
              {@html renderIcon(faExternalLinkAlt, 'mr-2')}
            {/if}
            View on GitHub
          </Button>
        </div>
      </div>

      <!-- Configuration Files -->
      {#if configsLoaded}
        <div class="bg-[var(--pd-content-card-bg)] rounded-lg p-6 border border-[var(--pd-content-divider)]">
          <div class="flex items-center gap-3 mb-6">
            {@html renderIcon(faCode, 'text-2xl text-purple-500')}
            <div>
              <h2 class="text-xl font-semibold text-[var(--pd-content-header)]">Configuration Files</h2>
              <p class="text-sm text-[var(--pd-content-sub)]">Edit RHDH Local configuration files</p>
            </div>
          </div>

          <div class="space-y-6">
            {#each configTypes as configType}
              <div class="bg-[var(--pd-content-bg)] rounded-lg p-4 border border-[var(--pd-content-divider)]">
                <div class="flex items-center justify-between mb-4">
                  <div>
                    <h3 class="text-lg font-semibold text-[var(--pd-content-header)]">
                      {getConfigDisplayName(configType)}
                    </h3>
                    <p class="text-sm text-[var(--pd-content-sub)] mt-1">
                      {getConfigDescription(configType)}
                    </p>
                    {#if configFiles[configType]?.lastModified}
                      <p class="text-xs text-[var(--pd-content-sub)] mt-1">
                        Last modified: {configFiles[configType]?.lastModified?.toLocaleString()}
                      </p>
                    {/if}
                  </div>
                  <div class="flex gap-2 items-center">
                    {#if isContentModified(configType)}
                      <span class="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20 px-2 py-1 rounded">
                        Modified
                      </span>
                    {/if}
                    <Button 
                      size="sm"
                      on:click={() => saveConfiguration(configType)}
                      disabled={!isContentModified(configType) || configSaving[configType]}
                      class="bg-green-500 hover:bg-green-600">
                      {#if configSaving[configType]}
                        {@html renderIcon(faSpinner, 'animate-spin mr-2')}
                      {:else}
                        {@html renderIcon(faSave, 'mr-2')}
                      {/if}
                      Save
                    </Button>
                  </div>
                </div>

                {#if configLoading[configType]}
                  <div class="flex items-center justify-center p-8">
                    <div class="flex flex-col items-center gap-2">
                      {@html renderIcon(faSpinner, 'animate-spin text-xl text-purple-500')}
                      <p class="text-sm text-[var(--pd-content-sub)]">Loading configuration...</p>
                    </div>
                  </div>
                {:else if configContents[configType] !== undefined}
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <label class="text-sm font-medium text-[var(--pd-content-sub)]" for="config-{configType}">
                        File Content:
                      </label>
                      <div class="flex items-center gap-2">
                        <span class="text-xs text-[var(--pd-content-sub)]">
                          {configContents[configType]?.split('\n').length || 0} lines
                        </span>
                        {#if configFiles[configType]?.path}
                          <button 
                            class="text-xs hover:text-purple-500 transition-colors"
                            title="Copy File Path"
                            on:click={async () => {
                              try {
                                if (configFiles[configType]?.path) {
                                  await navigator.clipboard.writeText(configFiles[configType]?.path || '');
                                  console.log('Configuration file path copied to clipboard');
                                }
                              } catch (err) {
                                console.error('Failed to copy file path:', err);
                              }
                            }}>
                            {@html renderIcon(faCopy, 'text-xs')}
                          </button>
                        {/if}
                      </div>
                    </div>
                    <textarea 
                      id="config-{configType}"
                      bind:value={configContents[configType]}
                      class="w-full h-64 p-4 bg-gray-900 text-green-400 font-mono text-sm rounded-lg border border-[var(--pd-content-divider)] resize-y focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Configuration content..."
                      spellcheck="false"
                    ></textarea>
                  </div>
                {:else}
                  <div class="text-center p-8 text-[var(--pd-content-sub)]">
                    <p>Configuration file not found or failed to load</p>
                    <Button 
                      size="sm"
                      class="mt-2"
                      on:click={() => loadConfiguration(configType)}>
                      {@html renderIcon(faRefresh, 'mr-2')}
                      Retry
                    </Button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Services Status -->
      <div class="bg-[var(--pd-content-card-bg)] rounded-lg border border-[var(--pd-content-divider)]">
        <h2 class="text-lg font-semibold text-[var(--pd-content-header)] p-6 pb-0">Services</h2>
        
        <!-- Service Tabs Navigation -->
        <div class="flex border-b border-[var(--pd-content-divider)] overflow-x-auto">
          {#each Object.entries(status.services) as [serviceName, serviceStatus]}
            <button
              class={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                activeServiceTab === serviceName 
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/10' 
                  : 'border-transparent text-[var(--pd-content-sub)] hover:text-[var(--pd-content-header)] hover:bg-[var(--pd-content-bg)]'
              }`}
              on:click={() => activeServiceTab = serviceName}
            >
              {@html renderIcon(getServiceIcon(serviceName), 'text-inherit')}
              <span class="capitalize">{serviceName.replace('-', ' ')}</span>
              {@html renderIcon(getStatusIcon(serviceStatus), `ml-1 ${getStatusColor(serviceStatus)}`)}
            </button>
          {/each}
        </div>
        
        <!-- Active Service Tab Content -->
        {#if activeServiceTab && status.services[activeServiceTab]}
          {@const serviceStatus = status.services[activeServiceTab]}
          <div class="p-6">
            <!-- Service Header -->
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-3">
                {@html renderIcon(getServiceIcon(activeServiceTab), 'text-2xl text-purple-500')}
                <div>
                  <h3 class="text-xl font-semibold text-[var(--pd-content-header)] capitalize">
                    {activeServiceTab.replace('-', ' ')}
                  </h3>
                  <div class="flex items-center gap-2 mt-1">
                    <div class={`w-2 h-2 rounded-full ${
                      serviceStatus.status === 'running' ? 'bg-green-500' : 
                      serviceStatus.status === 'error' ? 'bg-red-500' : 
                      serviceStatus.status === 'not-used' ? 'bg-yellow-500' : 'bg-gray-500'
                    }`}></div>
                    <span class={`text-sm capitalize ${getStatusColor(serviceStatus)}`}>
                      {serviceStatus.status}
                    </span>
                  </div>
                </div>
              </div>
              
              <!-- Service Actions -->
              <div class="flex gap-2">
                {#if serviceStatus.status === 'running'}
                  <Button 
                    size="sm"
                    on:click={() => performAction(`restart-${activeServiceTab}`, () => rhdhLocalClient.restartService(activeServiceTab))}
                    disabled={actionLoading[`restart-${activeServiceTab}`]}
                    title="Restart Service">
                    {#if actionLoading[`restart-${activeServiceTab}`]}
                      {@html renderIcon(faSpinner, 'animate-spin mr-2')}
                    {:else}
                      {@html renderIcon(faRedo, 'mr-2')}
                    {/if}
                    Restart
                  </Button>
                {/if}
                
                {#if streamingLogs[activeServiceTab]}
                  <Button 
                    size="sm"
                    on:click={() => {
                      stopLogStream(activeServiceTab);
                      showLogs = { ...showLogs, [activeServiceTab]: false };
                    }}
                    disabled={actionLoading[`logs-${activeServiceTab}`]}
                    title="Stop Log Stream"
                    class="bg-red-500 hover:bg-red-600">
                    {@html renderIcon(faStop, 'mr-2')}
                    Stop Logs
                  </Button>
                {:else}
                  <Button 
                    size="sm"
                    on:click={() => startLogStream(activeServiceTab)}
                    disabled={actionLoading[`logs-${activeServiceTab}`] || !serviceStatus.containerId}
                    title={serviceStatus.containerId ? "Stream Live Logs" : "No container available for log streaming"}>
                    {#if actionLoading[`logs-${activeServiceTab}`]}
                      {@html renderIcon(faSpinner, 'animate-spin mr-2')}
                    {:else}
                      {@html renderIcon(faEye, 'mr-2')}
                    {/if}
                    Stream Logs
                  </Button>
                {/if}
                
                {#if showLogs[activeServiceTab] && logLines[activeServiceTab]?.length > 0}
                  <Button 
                    size="sm"
                    on:click={() => toggleLogs(activeServiceTab)}
                    title="Toggle Log Visibility">
                    {@html renderIcon(faTimes, 'mr-2')}
                    Hide Logs
                  </Button>
                {:else if logLines[activeServiceTab]?.length > 0}
                  <Button 
                    size="sm"
                    on:click={() => toggleLogs(activeServiceTab)}
                    title="Show Logs">
                    {@html renderIcon(faEye, 'mr-2')}
                    Show Logs
                  </Button>
                {/if}
              </div>
            </div>
            
            <!-- Service Details -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div class="space-y-3">
                <h4 class="text-sm font-medium text-[var(--pd-content-sub)] uppercase tracking-wider">Status Information</h4>
                
                <div class="space-y-2">
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-[var(--pd-content-sub)]">Current Status:</span>
                    <span class={`text-sm font-medium capitalize ${getStatusColor(serviceStatus)}`}>
                      {serviceStatus.status}
                    </span>
                  </div>
                  
                  {#if serviceStatus.uptime}
                    <div class="flex justify-between items-center">
                      <span class="text-sm text-[var(--pd-content-sub)]">Uptime:</span>
                      <span class="text-sm font-medium text-[var(--pd-content-header)]">
                        {formatUptime(serviceStatus.uptime)}
                      </span>
                    </div>
                  {/if}
                </div>
              </div>
              
              {#if serviceStatus.containerId}
                <div class="space-y-3">
                  <h4 class="text-sm font-medium text-[var(--pd-content-sub)] uppercase tracking-wider">Container Information</h4>
                  
                  <div class="space-y-2">
                    <div class="flex justify-between items-center">
                      <span class="text-sm text-[var(--pd-content-sub)]">Container ID:</span>
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded" 
                              title="Full Container ID: {serviceStatus.containerId}">
                          {serviceStatus.containerId.substring(0, 12)}
                        </span>
                        <button 
                          class="text-xs hover:text-purple-500 transition-colors p-1"
                          title="Copy Full Container ID"
                          on:click={async () => {
                            try {
                              if (serviceStatus.containerId) {
                                await navigator.clipboard.writeText(serviceStatus.containerId);
                                console.log('Container ID copied to clipboard');
                              }
                            } catch (err) {
                              console.error('Failed to copy container ID:', err);
                            }
                          }}>
                          {@html renderIcon(faCopy, 'text-xs')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
              
              <div class="space-y-3">
                <h4 class="text-sm font-medium text-[var(--pd-content-sub)] uppercase tracking-wider">Service Management</h4>
                
                <div class="space-y-2 text-sm text-[var(--pd-content-sub)]">
                  {#if activeServiceTab === 'rhdh'}
                    <p>Main RHDH service providing the Developer Hub interface.</p>
                  {:else if activeServiceTab === 'postgresql'}
                    <p>Database service for RHDH data persistence.</p>
                  {:else if activeServiceTab === 'install-dynamic-plugins'}
                    <p>Service for installing and managing dynamic plugins.</p>
                  {:else}
                    <p>Service component of the RHDH Local deployment.</p>
                  {/if}
                </div>
              </div>
            </div>
            
            <!-- Log Display Area - Always show when streaming is active or logs exist -->
            {#if streamingLogs[activeServiceTab] || (showLogs[activeServiceTab] && logLines[activeServiceTab]?.length > 0)}
              <div class="mt-6">
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-sm font-medium text-[var(--pd-content-sub)] uppercase tracking-wider">
                    Service Logs
                    {#if streamingLogs[activeServiceTab]}
                      <span class="ml-2 text-green-500 text-xs">● LIVE</span>
                    {/if}
                  </h4>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-[var(--pd-content-sub)]">
                      {logLines[activeServiceTab]?.length || 0} lines
                    </span>
                    <Button 
                      size="sm"
                      on:click={() => {
                        // Trigger Svelte reactivity by reassigning the whole object
                        logLines = { ...logLines, [activeServiceTab]: [] };
                      }}
                      title="Clear Logs">
                      {@html renderIcon(faTimes, 'text-xs')}
                      Clear
                    </Button>
                  </div>
                </div>
                
                <div class="bg-gray-900 text-green-400 rounded-lg p-4 max-h-96 overflow-auto font-mono text-sm border" id="log-container-{activeServiceTab}">
                  {#if logLines[activeServiceTab]?.length > 0}
                    {#each logLines[activeServiceTab] as line, index}
                      <div class="whitespace-pre-wrap break-words leading-tight mb-1">
                        {line.trim()}
                      </div>
                    {/each}
                  {:else}
                    <div class="text-gray-500 text-center py-8">
                      {#if streamingLogs[activeServiceTab]}
                        <div class="flex flex-col items-center gap-2">
                          {@html renderIcon(faSpinner, 'animate-spin text-lg mb-2')}
                          <p>Waiting for logs...</p>
                          <p class="text-xs">Streaming from {activeServiceTab} service</p>
                          <p class="text-xs mt-2">Debug: Stream active = {streamingLogs[activeServiceTab]}</p>
                        </div>
                      {:else}
                        <p>No logs available</p>
                      {/if}
                    </div>
                  {/if}
                  
                  {#if streamingLogs[activeServiceTab]}
                    <div class="flex items-center gap-2 text-blue-400 mt-2 pt-2 border-t border-gray-700">
                      {@html renderIcon(faSpinner, 'animate-spin text-xs')}
                      <span class="text-xs">Streaming logs from {activeServiceTab}...</span>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Last Updated -->
      <div class="text-center text-sm text-[var(--pd-content-sub)]">
        Last updated: {status.lastUpdated.toLocaleString()}
      </div>
    </div>
  {/if}
</div>
