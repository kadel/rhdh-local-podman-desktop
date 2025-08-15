/**
 * RHDHLocalApi provides comprehensive management of Red Hat Developer Hub Local instances.
 * This includes repository management, lifecycle operations, and configuration handling.
 */

export interface InstanceConfig {
  repoPath: string;
  repoUrl: string;
  rhdhUrl: string;
}

export interface RHDHServiceStatus {
  status: 'running' | 'stopped' | 'not-used' | 'error' | 'unknown';
  containerId?: string;
  uptime?: string;
}

export interface RHDHStatus {
  isRunning: boolean;
  isInstalled: boolean; // Whether rhdh-local repo exists
  services: { [serviceName: string]: RHDHServiceStatus };
  url?: string; // http://localhost:7007 when running
  repoPath?: string; // Path to cloned rhdh-local repo
  lastUpdated: Date;
  gitBranch?: string;
  gitCommit?: string;
}

export interface RHDHLogs {
  service: string;
  logs: string;
  timestamp: Date;
}

export interface InstallationCheck {
  installed: boolean;
  path?: string;
  gitAvailable: boolean;
  podmanComposeAvailable: boolean;
  issues: string[];
}

export type ConfigurationType = 'app-config' | 'dynamic-plugins' | 'env' | 'users' | 'components';

export interface ConfigurationFile {
  type: ConfigurationType;
  path: string;
  content: string;
  lastModified?: Date;
}

export abstract class RHDHLocalApi {
  // Installation and setup
  abstract checkInstallation(): Promise<InstallationCheck>;
  abstract cloneRepository(): Promise<void>;
  abstract updateRepository(): Promise<void>; // git pull
  abstract setupConfigFiles(): Promise<void>; // cp env.sample .env if needed

  // Lifecycle management
  abstract getStatus(): Promise<RHDHStatus>;
  abstract start(): Promise<void>; // docker-compose up -d
  abstract stop(): Promise<void>; // docker-compose down
  abstract restart(): Promise<void>; // stop + start
  abstract restartService(serviceName: string): Promise<void>; // restart specific service

  // Service management
  abstract installPlugins(): Promise<void>; // run install-dynamic-plugins
  abstract getLogs(service: string, lines?: number): Promise<RHDHLogs>;

  // Repository management
  abstract getGitStatus(): Promise<{ branch: string; commit: string; isDirty: boolean; unpulledCommits: number }>;
  abstract pullLatest(): Promise<void>;
  abstract resetToClean(): Promise<void>; // git reset --hard HEAD

  // Utilities
  abstract openRHDHInBrowser(): Promise<void>;
  abstract openExternalUrl(url: string): Promise<void>;
  abstract getInstanceConfig(): Promise<InstanceConfig>;
}
