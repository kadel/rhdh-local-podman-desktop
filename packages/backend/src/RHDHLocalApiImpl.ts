import * as podmanDesktopApi from '@podman-desktop/api';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import type {
  RHDHLocalApi,
  InstanceConfig,
  RHDHStatus,
  RHDHLogs,
  LogStreamResponse,
  LogStreamOptions,
  InstallationCheck,
  ConfigurationType,
  ConfigurationFile,
  RHDHServiceStatus,
} from '/@shared/src/RHDHLocalApi';

/**
 * RHDHLocalApiImpl provides the backend implementation for managing RHDH Local instances.
 * This includes repository management, lifecycle operations, and configuration handling.
 */
export class RHDHLocalApiImpl implements RHDHLocalApi {
  private configuration: InstanceConfig;
  private readonly repoUrl = 'https://github.com/redhat-developer/rhdh-local.git';
  private configFilesToCopy: Array<{
    source: string;
    target: string;
    description: string;
    configType: ConfigurationType;
    overrideDefaultContent?: string;
  }>;

  constructor(private readonly extensionContext: podmanDesktopApi.ExtensionContext) {
    const defaultRepoPath = path.join(extensionContext.storagePath, 'rhdh-local');
    this.configuration = {
      repoPath: defaultRepoPath,
      repoUrl: this.repoUrl,
      rhdhUrl: 'http://localhost:7007',
    };

    // Initialize config files to copy
    this.configFilesToCopy = [
      {
        source: path.join(this.configuration.repoPath, 'default.env'),
        target: path.join(this.configuration.repoPath, '.env'),
        description: 'environment variables',
        configType: 'env',
      },
      {
        source: path.join(this.configuration.repoPath, 'configs/app-config/app-config.local.example.yaml'),
        target: path.join(this.configuration.repoPath, 'configs/app-config/app-config.local.yaml'),
        description: 'app configuration overrides',
        configType: 'app-config',
        overrideDefaultContent: `
app:
  title: Red Hat Developer Hub
  baseUrl: $\{BASE_URL\}
  branding:
    # These logo overrides are required for quay.io/rhdh-community/rhdh:1.6
    # if using a different logo, replace this line with your own image
    # it is expected that as of 1.7 they will not be required
    fullLogo: data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDI3LjMuMSwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxvZ29zIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIKCSB2aWV3Qm94PSIwIDAgOTMxLjggMjQ0IiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCA5MzEuOCAyNDQ7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KCiAgICAgIDxwYXRoCiAgICAgICAgZmlsbD0iI2ZmZiIKICAgICAgICBkPSJNMjI4LjcgMjE5LjV2LTcyLjhoMjUuN2M1LjUgMCAxMC43LjkgMTUuNCAyLjggNC43IDEuOSA4LjggNC40IDEyLjIgNy43IDMuNCAzLjMgNiA3LjEgOCAxMS42IDEuOSA0LjUgMi45IDkuMyAyLjkgMTQuNHMtMSA5LjktMi45IDE0LjRjLTEuOSA0LjQtNC42IDguMy04IDExLjUtMy40IDMuMi03LjUgNS44LTEyLjIgNy42LTQuNyAxLjktOS44IDIuOC0xNS40IDIuOGgtMjUuN3ptMjUuOC02M2gtMTV2NTMuMmgxNWMzLjggMCA3LjQtLjcgMTAuNy0yIDMuMy0xLjQgNi4xLTMuMiA4LjUtNS42IDIuNC0yLjQgNC4zLTUuMiA1LjctOC40IDEuNC0zLjIgMi4xLTYuNyAyLjEtMTAuNXMtLjctNy4yLTIuMS0xMC41Yy0xLjQtMy4zLTMuMy02LjEtNS43LTguNS0yLjQtMi40LTUuMi00LjMtOC41LTUuNy0zLjMtMS4zLTYuOC0yLTEwLjctMnpNMzAwLjcgMTkzYzAtMy43LjctNy4zIDItMTAuNiAxLjQtMy4zIDMuMi02LjIgNS42LTguNyAyLjQtMi41IDUuMi00LjQgOC40LTUuOCAzLjItMS40IDYuNy0yLjEgMTAuNS0yLjEgMy42IDAgNyAuNyAxMC4xIDIuMSAzLjIgMS40IDUuOSAzLjQgOC4xIDUuOCAyLjMgMi41IDQgNS40IDUuNCA4LjggMS4zIDMuNCAyIDcgMiAxMC45djNIMzExYy43IDQuNCAyLjcgOCA2IDEwLjkgMy4zIDIuOSA3LjMgNC4zIDExLjkgNC4zIDIuNiAwIDUtLjQgNy40LTEuMiAyLjQtLjggNC40LTIgNi0zLjRsNi43IDYuNmMtMy4xIDIuNC02LjMgNC4yLTkuNiA1LjMtMy4zIDEuMS02LjkgMS43LTEwLjkgMS43LTMuOSAwLTcuNS0uNy0xMC45LTIuMS0zLjQtMS40LTYuMy0zLjMtOC44LTUuOC0yLjUtMi40LTQuNS01LjMtNS45LTguNy0xLjUtMy41LTIuMi03LjEtMi4yLTExem0yNi4zLTE4LjVjLTQgMC03LjUgMS4zLTEwLjQgNC0yLjkgMi42LTQuOCA2LTUuNSAxMC4yaDMxLjRjLS43LTQtMi41LTcuNC01LjQtMTAuMS0yLjktMi43LTYuMy00LjEtMTAuMS00LjF6TTM3Ny43IDIxOS41bC0yMi45LTUyLjloMTEuNGwxNi41IDM5LjYgMTYuNS0zOS42aDExLjFsLTIyLjkgNTIuOWgtOS43ek00MTIuNCAxOTNjMC0zLjcuNy03LjMgMi0xMC42IDEuNC0zLjMgMy4yLTYuMiA1LjYtOC43IDIuNC0yLjUgNS4yLTQuNCA4LjQtNS44IDMuMi0xLjQgNi43LTIuMSAxMC41LTIuMSAzLjYgMCA3IC43IDEwLjEgMi4xIDMuMiAxLjQgNS45IDMuNCA4LjEgNS44IDIuMyAyLjUgNCA1LjQgNS40IDguOCAxLjMgMy40IDIgNyAyIDEwLjl2M2gtNDEuOGMuNyA0LjQgMi43IDggNiAxMC45IDMuMyAyLjkgNy4zIDQuMyAxMS45IDQuMyAyLjYgMCA1LS40IDcuNC0xLjIgMi40LS44IDQuNC0yIDYtMy40bDYuNyA2LjZjLTMuMSAyLjQtNi4zIDQuMi05LjYgNS4zLTMuMyAxLjEtNi45IDEuNy0xMC45IDEuNy0zLjkgMC03LjUtLjctMTAuOS0yLjEtMy40LTEuNC02LjMtMy4zLTguOC01LjgtMi41LTIuNC00LjUtNS4zLTUuOS04LjctMS41LTMuNS0yLjItNy4xLTIuMi0xMXptMjYuMy0xOC41Yy00IDAtNy41IDEuMy0xMC40IDQtMi45IDIuNi00LjggNi01LjUgMTAuMmgzMS40Yy0uNy00LTIuNS03LjQtNS40LTEwLjEtMi45LTIuNy02LjMtNC4xLTEwLjEtNC4xek00ODQuNyAxNDQuNXY3NS4xaC0xMC40di03Mi44bDEwLjQtMi4zek00OTQuNSAxOTNjMC0zLjguNy03LjQgMi4xLTEwLjggMS40LTMuNCAzLjQtNi4zIDUuOS04LjcgMi41LTIuNSA1LjQtNC40IDguOC01LjggMy40LTEuNCA3LTIuMSAxMC44LTIuMSAzLjggMCA3LjQuNyAxMC44IDIuMSAzLjQgMS40IDYuMyAzLjQgOC43IDUuOCAyLjUgMi41IDQuNCA1LjQgNS44IDguNyAxLjQgMy40IDIuMSA3IDIuMSAxMC44IDAgMy45LS43IDcuNS0yLjEgMTAuOS0xLjQgMy40LTMuNCA2LjMtNS44IDguNy0yLjUgMi41LTUuNCA0LjQtOC43IDUuOC0zLjQgMS40LTcgMi4xLTEwLjggMi4xLTMuOCAwLTcuNC0uNy0xMC44LTIuMS0zLjQtMS40LTYuMy0zLjQtOC44LTUuOC0yLjUtMi41LTQuNS01LjQtNS45LTguNy0xLjQtMy40LTIuMS03LTIuMS0xMC45em00NC45IDBjMC01LjEtMS43LTkuNS01LjEtMTMtMy40LTMuNS03LjUtNS4zLTEyLjMtNS4zcy04LjkgMS44LTEyLjMgNS4zYy0zLjQgMy41LTUuMSA3LjktNS4xIDEzczEuNyA5LjUgNSAxMy4xYzMuNCAzLjYgNy41IDUuNCAxMi4zIDUuNCA0LjggMCA4LjktMS44IDEyLjMtNS40IDMuNS0zLjYgNS4yLTcuOSA1LjItMTMuMXpNNTU5LjMgMjQxLjF2LTc0LjVoMTAuM3Y1YzIuMi0xLjkgNC43LTMuMyA3LjUtNC4zczUuNy0xLjUgOC43LTEuNWMzLjcgMCA3LjIuNyAxMC41IDIuMSAzLjMgMS40IDYuMSAzLjQgOC41IDUuOCAyLjQgMi41IDQuMyA1LjQgNS43IDguNyAxLjQgMy4zIDIuMSA2LjkgMi4xIDEwLjYgMCAzLjgtLjcgNy40LTIuMSAxMC43LTEuNCAzLjMtMy4zIDYuMi01LjcgOC43LTIuNCAyLjUtNS4zIDQuNC04LjYgNS44LTMuMyAxLjQtNi45IDIuMS0xMC43IDIuMS0zIDAtNS44LS41LTguNS0xLjQtMi43LS45LTUuMS0yLjItNy4zLTMuOFYyNDFoLTEwLjR6bTI1LTY2LjNjLTMuMSAwLTUuOC42LTguMyAxLjctMi41IDEuMS00LjYgMi42LTYuMyA0LjZ2MjQuMWMxLjcgMS45IDMuOCAzLjQgNi4zIDQuNSAyLjYgMS4xIDUuMyAxLjcgOC4zIDEuNyA1LjEgMCA5LjQtMS44IDEyLjgtNS4zIDMuNC0zLjUgNS4xLTcuOCA1LjEtMTIuOSAwLTUuMi0xLjgtOS42LTUuMy0xMy4xLTMuMy0zLjUtNy42LTUuMy0xMi42LTUuM3pNNjIwIDE5M2MwLTMuNy43LTcuMyAyLTEwLjYgMS40LTMuMyAzLjItNi4yIDUuNi04LjcgMi40LTIuNSA1LjItNC40IDguNC01LjggMy4yLTEuNCA2LjctMi4xIDEwLjUtMi4xIDMuNiAwIDcgLjcgMTAuMSAyLjEgMy4yIDEuNCA1LjkgMy40IDguMSA1LjggMi4zIDIuNSA0IDUuNCA1LjQgOC44IDEuMyAzLjQgMiA3IDIgMTAuOXYzaC00MS44Yy43IDQuNCAyLjcgOCA2IDEwLjkgMy4zIDIuOSA3LjMgNC4zIDExLjkgNC4zIDIuNiAwIDUtLjQgNy40LTEuMiAyLjQtLjggNC40LTIgNi0zLjRsNi43IDYuNmMtMy4xIDIuNC02LjMgNC4yLTkuNiA1LjMtMy4zIDEuMS02LjkgMS43LTEwLjkgMS43LTMuOSAwLTcuNS0uNy0xMC45LTIuMS0zLjQtMS40LTYuMy0zLjMtOC44LTUuOC0yLjUtMi40LTQuNS01LjMtNS45LTguNy0xLjUtMy41LTIuMi03LjEtMi4yLTExem0yNi4zLTE4LjVjLTQgMC03LjUgMS4zLTEwLjQgNC0yLjkgMi42LTQuOCA2LTUuNSAxMC4yaDMxLjRjLS43LTQtMi41LTcuNC01LjQtMTAuMS0yLjktMi43LTYuMy00LjEtMTAuMS00LjF6TTY4MS45IDIxOS41di01Mi45aDEwLjR2Ni42YzEuNy0yLjYgMy45LTQuNiA2LjQtNS44IDIuNi0xLjIgNS4yLTEuOSA4LTEuOSAxLjIgMCAyLjIuMSAzLjEuMi45LjEgMS42LjMgMi4zLjZ2OS40Yy0uOC0uMy0xLjgtLjUtMi45LS44LTEuMS0uMi0yLjItLjQtMy4zLS40LTIuOCAwLTUuNC43LTcuOCAyLjItMi40IDEuNS00LjQgMy45LTUuOCA3LjN2MzUuNWgtMTAuNHpNNzQzLjcgMjE5LjV2LTcyLjhoMTAuOXYzMS4yaDM4Ljd2LTMxLjJoMTAuOXY3Mi44aC0xMC45di0zMS43aC0zOC43djMxLjdoLTEwLjl6TTgyOCAxNjYuNnYzMS41YzAgNC4xIDEuMiA3LjMgMy41IDkuOCAyLjQgMi40IDUuNiAzLjYgOS43IDMuNiAyLjggMCA1LjMtLjYgNy41LTEuOCAyLjItMS4yIDQuMS0yLjkgNS41LTUuMXYtMzguMWgxMC40djUyLjloLTEwLjR2LTUuM2MtMi4xIDIuMS00LjUgMy43LTcuMSA0LjctMi43IDEuMS01LjYgMS42LTguOCAxLjYtNiAwLTExLTEuOS0xNC44LTUuOC0zLjgtMy45LTUuOC04LjgtNS44LTE0Ljl2LTMzLjNIODI4ek05MjkuOSAxOTNjMCAzLjgtLjcgNy40LTIuMSAxMC43LTEuNCAzLjMtMy4zIDYuMi01LjcgOC43LTIuNCAyLjUtNS4zIDQuNC04LjYgNS44LTMuMyAxLjQtNi45IDIuMS0xMC43IDIuMS0zIDAtNS44LS41LTguNS0xLjRzLTUuMi0yLjItNy40LTR2NC41aC0xMC4zdi03Mi44bDEwLjQtMi4zdjI3YzIuMi0xLjkgNC43LTMuMyA3LjQtNC4zczUuNi0xLjUgOC43LTEuNWMzLjcgMCA3LjIuNyAxMC41IDIuMSAzLjMgMS40IDYuMSAzLjQgOC41IDUuOCAyLjQgMi41IDQuMyA1LjQgNS43IDguNyAxLjQgMy42IDIuMSA3LjIgMi4xIDEwLjl6bS0yOC4yLTE4LjJjLTMuMSAwLTUuOC42LTguMyAxLjctMi41IDEuMS00LjYgMi42LTYuMyA0LjZ2MjQuMWMxLjcgMS45IDMuOCAzLjQgNi4zIDQuNSAyLjYgMS4xIDUuMyAxLjcgOC4zIDEuNyA1LjEgMCA5LjQtMS44IDEyLjgtNS4zIDMuNC0zLjUgNS4xLTcuOCA1LjEtMTIuOSAwLTUuMi0xLjgtOS42LTUuMy0xMy4xLTMuMy0zLjUtNy42LTUuMy0xMi42LTUuM3oiCiAgICAgIC8+CiAgPGc+CiAgICAgICAgPHBhdGgKICAgICAgICAgIGQ9Ik0xMjkgODVjMTIuNSAwIDMwLjYtMi42IDMwLjYtMTcuNSAwLTEuMiAwLTIuMy0uMy0zLjRsLTcuNC0zMi40Yy0xLjctNy4xLTMuMi0xMC4zLTE1LjctMTYuNkMxMjYuNCAxMC4yIDEwNS4zIDIgOTkgMmMtNS44IDAtNy41IDcuNS0xNC40IDcuNS02LjcgMC0xMS42LTUuNi0xNy45LTUuNi02IDAtOS45IDQuMS0xMi45IDEyLjUgMCAwLTguNCAyMy43LTkuNSAyNy4yLS4zLjctLjMgMS40LS4zIDEuOUM0NCA1NC44IDgwLjMgODUgMTI5IDg1bTMyLjUtMTEuNGMxLjcgOC4yIDEuNyA5LjEgMS43IDEwLjEgMCAxNC0xNS43IDIxLjgtMzYuNCAyMS44LTQ2LjggMC04Ny43LTI3LjQtODcuNy00NS41IDAtMi44LjYtNS40IDEuNS03LjMtMTYuOC44LTM4LjYgMy44LTM4LjYgMjNDMiAxMDcuMiA3Ni42IDE0NiAxMzUuNyAxNDZjNDUuMyAwIDU2LjctMjAuNSA1Ni43LTM2LjYtLjEtMTIuOC0xMS0yNy4yLTMwLjktMzUuOCIKICAgICAgICAgIGZpbGw9IiNlMDAiCiAgICAgICAgLz4KICAgIDxwYXRoIGQ9Ik0xNjEuNSA3My42YzEuNyA4LjIgMS43IDkuMSAxLjcgMTAuMSAwIDE0LTE1LjcgMjEuOC0zNi40IDIxLjgtNDYuOCAwLTg3LjctMjcuNC04Ny43LTQ1LjUgMC0yLjguNi01LjQgMS41LTcuM2wzLjctOS4xYy0uMy43LS4zIDEuNC0uMyAxLjlDNDQgNTQuOCA4MC4zIDg1IDEyOSA4NWMxMi41IDAgMzAuNi0yLjYgMzAuNi0xNy41IDAtMS4yIDAtMi4zLS4zLTMuNGwyLjIgOS41eiIgLz4KICAgIDxwYXRoCiAgICAgIGZpbGw9IiNmZmYiCiAgICAgIGQ9Ik01ODEuMiA5NC4zYzAgMTEuOSA3LjIgMTcuNyAyMC4yIDE3LjcgMy4yIDAgOC42LS43IDExLjktMS43Vjk2LjVjLTIuOC44LTQuOSAxLjItNy43IDEuMi01LjQgMC03LjQtMS43LTcuNC02LjdWNjkuOGgxNS42VjU1LjZoLTE1LjZ2LTE4bC0xNyAzLjd2MTQuM0g1NzB2MTQuMmgxMS4zdjI0LjV6bS01Mi45LjNjMC0zLjcgMy43LTUuNSA5LjMtNS41IDMuNyAwIDcgLjUgMTAuMSAxLjN2Ny4yYy0zLjIgMS44LTYuOCAyLjYtMTAuNiAyLjYtNS41IDAtOC44LTIuMS04LjgtNS42bTUuMiAxNy42YzYgMCAxMC44LTEuMyAxNS40LTQuM3YzLjRoMTYuOFY3NS42YzAtMTMuNi05LjEtMjEtMjQuNC0yMS04LjUgMC0xNi45IDItMjYgNi4xbDYuMSAxMi41YzYuNS0yLjcgMTItNC40IDE2LjgtNC40IDcgMCAxMC42IDIuNyAxMC42IDguM3YyLjdjLTQtMS4xLTguMi0xLjYtMTIuNi0xLjYtMTQuMyAwLTIyLjkgNi0yMi45IDE2LjcgMCA5LjggNy44IDE3LjMgMjAuMiAxNy4zbS05Mi40LTFoMTguMVY4Mi40aDMwLjN2MjguOGgxOC4xVjM3LjZoLTE4LjF2MjguM2gtMzAuM1YzNy42aC0xOC4xdjczLjZ6bS02OS0yNy44YzAtOCA2LjMtMTQuMSAxNC42LTE0LjEgNC42IDAgOC44IDEuNiAxMS44IDQuM1Y5M2MtMyAyLjktNyA0LjQtMTEuOCA0LjQtOC4yLjEtMTQuNi02LTE0LjYtMTRtMjYuNiAyNy44aDE2LjhWMzMuOWwtMTcgMy43djIwLjljLTQuMi0yLjQtOS0zLjctMTQuMi0zLjctMTYuMiAwLTI4LjkgMTIuNS0yOC45IDI4LjVzMTIuNSAyOC42IDI4LjQgMjguNmM1LjUgMCAxMC42LTEuNyAxNC45LTQuOHY0LjF6bS03Ny4yLTQyLjdjNS40IDAgOS45IDMuNSAxMS43IDguOEgzMTBjMS43LTUuNSA1LjktOC44IDExLjUtOC44bS0yOC43IDE1YzAgMTYuMiAxMy4zIDI4LjggMzAuMyAyOC44IDkuNCAwIDE2LjItMi41IDIzLjItOC40bC0xMS4zLTEwYy0yLjYgMi43LTYuNSA0LjItMTEuMSA0LjItNi4zIDAtMTEuNS0zLjUtMTMuNy04LjhoMzkuNlY4NWMwLTE3LjctMTEuOS0zMC40LTI4LjEtMzAuNC0xNi4xLjEtMjguOSAxMi43LTI4LjkgMjguOW0tMjkuMy0zMC40YzYgMCA5LjQgMy44IDkuNCA4LjNzLTMuNCA4LjMtOS40IDguM2gtMTcuOVY1My4xaDE3Ljl6bS0zNiA1OC4xaDE4LjFWODQuNGgxMy44bDEzLjkgMjYuOGgyMC4ybC0xNi4yLTI5LjRjOC43LTMuOCAxMy45LTExLjcgMTMuOS0yMC43IDAtMTMuMy0xMC40LTIzLjUtMjYtMjMuNWgtMzcuN3Y3My42eiIKICAgIC8+CiAgICAgIDwvZz4KPC9zdmc+Cg==
    iconLogo: data:image/svg+xml;base64,PHN2ZyBpZD0iTGF5ZXJfMSIgZGF0YS1uYW1lPSJMYXllciAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxOTIgMTQ1Ij48ZGVmcz48c3R5bGU+LmNscy0xe2ZpbGw6I2UwMDt9PC9zdHlsZT48L2RlZnM+PHRpdGxlPlJlZEhhdC1Mb2dvLUhhdC1Db2xvcjwvdGl0bGU+PHBhdGggZD0iTTE1Ny43Nyw2Mi42MWExNCwxNCwwLDAsMSwuMzEsMy40MmMwLDE0Ljg4LTE4LjEsMTcuNDYtMzAuNjEsMTcuNDZDNzguODMsODMuNDksNDIuNTMsNTMuMjYsNDIuNTMsNDRhNi40Myw2LjQzLDAsMCwxLC4yMi0xLjk0bC0zLjY2LDkuMDZhMTguNDUsMTguNDUsMCwwLDAtMS41MSw3LjMzYzAsMTguMTEsNDEsNDUuNDgsODcuNzQsNDUuNDgsMjAuNjksMCwzNi40My03Ljc2LDM2LjQzLTIxLjc3LDAtMS4wOCwwLTEuOTQtMS43My0xMC4xM1oiLz48cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik0xMjcuNDcsODMuNDljMTIuNTEsMCwzMC42MS0yLjU4LDMwLjYxLTE3LjQ2YTE0LDE0LDAsMCwwLS4zMS0zLjQybC03LjQ1LTMyLjM2Yy0xLjcyLTcuMTItMy4yMy0xMC4zNS0xNS43My0xNi42QzEyNC44OSw4LjY5LDEwMy43Ni41LDk3LjUxLjUsOTEuNjkuNSw5MCw4LDgzLjA2LDhjLTYuNjgsMC0xMS42NC01LjYtMTcuODktNS42LTYsMC05LjkxLDQuMDktMTIuOTMsMTIuNSwwLDAtOC40MSwyMy43Mi05LjQ5LDI3LjE2QTYuNDMsNi40MywwLDAsMCw0Mi41Myw0NGMwLDkuMjIsMzYuMywzOS40NSw4NC45NCwzOS40NU0xNjAsNzIuMDdjMS43Myw4LjE5LDEuNzMsOS4wNSwxLjczLDEwLjEzLDAsMTQtMTUuNzQsMjEuNzctMzYuNDMsMjEuNzdDNzguNTQsMTA0LDM3LjU4LDc2LjYsMzcuNTgsNTguNDlhMTguNDUsMTguNDUsMCwwLDEsMS41MS03LjMzQzIyLjI3LDUyLC41LDU1LC41LDc0LjIyYzAsMzEuNDgsNzQuNTksNzAuMjgsMTMzLjY1LDcwLjI4LDQ1LjI4LDAsNTYuNy0yMC40OCw1Ni43LTM2LjY1LDAtMTIuNzItMTEtMjcuMTYtMzAuODMtMzUuNzgiLz48L3N2Zz4=
    fullLogoWidth: $\{FULL_LOGO_WIDTH\}
    theme:
      light:
        primaryColor: $\{PRIMARY_LIGHT_COLOR\}
        headerColor1: $\{HEADER_LIGHT_COLOR_1\}
        headerColor2: $\{HEADER_LIGHT_COLOR_2\}
        navigationIndicatorColor: $\{NAV_INDICATOR_LIGHT_COLOR\}
      dark:
        primaryColor: $\{PRIMARY_DARK_COLOR\}
        headerColor1: $\{HEADER_DARK_COLOR_1\}
        headerColor2: $\{HEADER_DARK_COLOR_2\}
        navigationIndicatorColor: $\{NAV_INDICATOR_DARK_COLOR\}
`
      },
      {
        source: path.join(this.configuration.repoPath, 'configs/dynamic-plugins/dynamic-plugins.override.example.yaml'),
        target: path.join(this.configuration.repoPath, 'configs/dynamic-plugins/dynamic-plugins.override.yaml'),
        description: 'dynamic plugins configuration',
        configType: 'dynamic-plugins',
        overrideDefaultContent: `
# Example dynamic plugin override config.
# Copy to dynamic-plugins.override.yaml to activate local plugins.

includes:
  - dynamic-plugins.default.yaml

# # Below you can add custom dynamic plugins, including local ones.
# # EXAMPLES:
# plugins: 
# # loading plugin from host directory
#   - package: ./local-plugins/todo
#     disabled: false
#     pluginConfig:
#       dynamicPlugins:
#         frontend:
#           backstage-community.plugin-todo:
#             mountPoints:
#               - mountPoint: entity.page.todo/cards
#                 importName: EntityTodoContent
#             entityTabs:
#               - path: /todo
#                 title: Todo
#                 mountPoint: entity.page.todo

# # loading image from container image
#   - package: oci://docker.io/tomaskral/simple-chat:v0.0.1!internal-backstage-plugin-simple-chat
#     disabled: false
#     pluginConfig:
#       dynamicPlugins:
#             internal.backstage-plugin-simple-chat:
#               appIcons:
#                 - name: chatIcon
#                   importName: ChatIcon
#               dynamicRoutes:
#                 - path: /simple-chat
#                   importName: SimpleChatPage
#                   menuItem:
#                     text: 'Simple Chat'
#                     icon: chatIcon

# # loading image from tarball URL
#   - disabled: false
#     package: >-
#         https://github.com/redhat-developer/rhdh-plugin-export-backstage-community-plugins/releases/download/v1.2.0/backstage-community-plugin-tech-insights-dynamic-0.3.28.tgz
#     integrity: sha512-cNHXSwPa5fOi2BcNVSe7tfdLyM0JY988CE5t+P9p/XlboP1QpQbMcLBmqPrlXZdpedAyp81Zz3yPQYGnPuy9ww==
#     pluginConfig:
#       dynamicPlugins:
#         techInsights:
#           factRetrievers:
#             entityOwnershipFactRetriever:
#               cadence: '*/15 * * * *'
#               lifecycle: { timeToLive: { weeks: 2 } }
#             entityMetadataFactRetriever:
#               cadence: '*/15 * * * *'
#               lifecycle: { timeToLive: { weeks: 2 } }
#             techdocsFactRetriever:
#               cadence: '*/15 * * * *'
#               lifecycle: { timeToLive: { weeks: 2 } }
#             apiDefinitionFactRetriever:
#               cadence: '*/15 * * * *'
#       lifecycle: { timeToLive: { weeks: 2 } }

# # loading plugin from directory inside the RHDH container
#   - package: ./dynamic-plugins/dist/backstage-community-plugin-rbac
#     disabled: true
#     pluginConfig:
#       dynamicPlugins:
#         frontend:
#           backstage-community.plugin-rbac:
#             mountPoints:
#               - mountPoint: admin.page.rbac/cards
#                 module: RbacPlugin
#                 importName: RbacPage
#                 config:
#                   layout:
#                     gridColumn: "1 / -1"
#                     width: 100vw
#                   props:
#                     useHeader: false
#             dynamicRoutes:
#               - path: /admin/rbac
#                 module: RbacPlugin
#                 importName: RbacPage
`
      },
      {
        source: path.join(this.configuration.repoPath, 'configs/catalog-entities/users.override.example.yaml'),
        target: path.join(this.configuration.repoPath, 'configs/catalog-entities/users.override.yaml'),
        description: 'catalog users configuration',
        configType: 'users',
      },
      {
        source: path.join(this.configuration.repoPath, 'configs/catalog-entities/components.override.example.yaml'),
        target: path.join(this.configuration.repoPath, 'configs/catalog-entities/components.override.yaml'),
        description: 'catalog components configuration',
        configType: 'components',
      },
    ];
  }

  async getInstanceConfig(): Promise<InstanceConfig> {
    return { ...this.configuration };
  }

  async checkInstallation(): Promise<InstallationCheck> {
    const issues: string[] = [];
    let gitAvailable = false;
    let podmanComposeAvailable = false;

    try {
      // Check if git is available
      await this.executeCommand('git', ['--version']);
      gitAvailable = true;
    } catch (error) {
      issues.push('Git is not available. Please install Git to use this extension.');
    }

    try {
      // Check if docker-compose is available
      await this.executeCompose(['--version']);
      podmanComposeAvailable = true;
    } catch (error) {
      issues.push('docker-compose is not available. Please install docker-compose to use this extension.');
    }

    // Check if repository exists
    const installed = await this.isRepositoryInstalled();
    const repoPath = installed ? this.configuration.repoPath : undefined;

    return {
      installed,
      path: repoPath,
      gitAvailable,
      podmanComposeAvailable,
      issues,
    };
  }

  async cloneRepository(): Promise<void> {
    const repoPath = this.configuration.repoPath;

    console.log('Cloning rhdh-local repository to:', repoPath);

    try {
      // Ensure the parent directory exists
      await fs.promises.mkdir(path.dirname(repoPath), { recursive: true });

      // Remove existing directory if it exists but is not a valid git repo
      if (await this.pathExists(repoPath)) {
        const isGitRepo = await this.pathExists(path.join(repoPath, '.git'));
        if (!isGitRepo) {
          await fs.promises.rm(repoPath, { recursive: true, force: true });
        } else {
          throw new Error('Repository already exists. Use updateRepository() to update it.');
        }
      }

      // Clone the repository
      await this.executeCommand('git', ['clone', this.repoUrl, repoPath]);

      // Setup environment file
      await this.setupConfigFiles();

      console.log('RHDH Local repository cloned successfully!');
    } catch (error) {
      const message = `Failed to clone RHDH Local repository: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await podmanDesktopApi.window.showErrorMessage(message);
      throw new Error(message);
    }
  }

  async updateRepository(): Promise<void> {
    if (!(await this.isRepositoryInstalled())) {
      throw new Error('Repository not installed. Please clone it first.');
    }

    try {
      await this.executeCommand('git', ['pull'], { cwd: this.configuration.repoPath });
      console.log('RHDH Local repository updated successfully!');
    } catch (error) {
      const message = `Failed to update repository: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await podmanDesktopApi.window.showErrorMessage(message);
      throw new Error(message);
    }
  }

  /**
   * Setup the config files for the RHDH Local repository.
   * This will copy all example config files to their target locations if they don't exist.
   * Based on the RHDH Local quick start guide configuration setup.
   */
  async setupConfigFiles(): Promise<void> {
    try {
      for (const config of this.configFilesToCopy) {
        // Check if source file exists
        if (!(await this.pathExists(config.source))) {
          const message = `${config.description} example file not found: ${path.basename(config.source)}`;
          await podmanDesktopApi.window.showErrorMessage(`Failed to setup configuration files: ${message}`);
          throw new Error(message);
        }
        // Only copy if target file does not exist
        if (await this.pathExists(config.target)) {
          // Skip if target already exists
          console.log(`Skipping ${config.description} file because it already exists: ${path.basename(config.target)}`);
          continue;
        }
        if (config.overrideDefaultContent !== undefined) {
          // Write override content to the target file
          await fs.promises.writeFile(config.target, config.overrideDefaultContent, 'utf8');
          console.log(`Wrote override content for ${config.description} file: ${path.basename(config.target)}`);
        } else {
          await fs.promises.copyFile(config.source, config.target);
          console.log(`Copied ${config.description} file: ${path.basename(config.target)}`);
        }
      }

      // Show informative message about what was done
      console.log('All required configuration files have been set up successfully.');
    } catch (error) {
      const message = `Failed to setup configuration files: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await podmanDesktopApi.window.showErrorMessage(message);
      throw new Error(message);
    }
  }

  async getStatus(): Promise<RHDHStatus> {
    console.log('[STATUS] Starting getStatus() call...');
    const installed = await this.isRepositoryInstalled();

    if (!installed) {
      console.log('[STATUS] Repository not installed, returning not installed status');
      return {
        isRunning: false,
        isInstalled: false,
        services: {},
        repoPath: this.configuration.repoPath,
        lastUpdated: new Date(),
      };
    }
    
    try {
      console.log('[STATUS] Getting container status with docker-compose ps...');
      // Get status of all services using docker-compose ps -a --format json
      const result = await this.executeCompose(['ps', '-a', '--format', 'json']);
      
      console.log('[STATUS] Raw docker-compose output:', result.stdout);
      console.log('[STATUS] Docker-compose stderr:', result.stderr);
      
      // Parse JSONL format (one JSON object per line)
      const containers = result.stdout 
        ? result.stdout.trim().split('\n')
            .filter(line => line.trim()) // Remove empty lines
            .map(line => {
              console.log('[STATUS] Parsing JSON line:', line);
              return JSON.parse(line);
            })
        : [];

      console.log('[STATUS] Parsed containers:', JSON.stringify(containers, null, 2));

      // Get git information
      const gitStatus = await this.getGitStatus();

      // Build services dynamically from containers
      const services = this.buildServicesFromContainers(containers);
      console.log('[STATUS] Built services:', JSON.stringify(services, null, 2));

      // Determine if the system is running
      // Consider the system running if any core service is running
      // Core services: rhdh, postgres/postgresql  
      const rhdhRunning = services.rhdh?.status === 'running';
      const dbRunning = services.postgresql?.status === 'running' || services.postgres?.status === 'running';
      
      // More flexible logic: system is running if main RHDH service is running
      // Database might start later or have different naming
      const isRunning = rhdhRunning || (Object.keys(services).length > 0 && 
        Object.values(services).some(service => service.status === 'running'));

      console.log('[STATUS] Service status check:');
      console.log('[STATUS]   - Available services:', Object.keys(services));
      console.log('[STATUS]   - RHDH running:', rhdhRunning, '(service status:', services.rhdh?.status, ')');
      console.log('[STATUS]   - DB running:', dbRunning, '(postgresql:', services.postgresql?.status, ', postgres:', services.postgres?.status, ')');
      console.log('[STATUS]   - Any service running:', Object.values(services).some(service => service.status === 'running'));
      console.log('[STATUS]   - Overall running:', isRunning);

      const status = {
        isRunning,
        isInstalled: true,
        services,
        url: isRunning ? this.configuration.rhdhUrl : undefined,
        repoPath: this.configuration.repoPath,
        lastUpdated: new Date(),
        gitBranch: gitStatus.branch,
        gitCommit: gitStatus.commit,
      };

      console.log('[STATUS] Final status result:', JSON.stringify(status, null, 2));
      return status;
    } catch (error) {
      console.log(`[ERROR] Failed to get status: ${error}`);
      console.log('[ERROR] Error stack:', error instanceof Error ? error.stack : 'No stack available');
      
      // If we can't get container status, try to get git status at least
      let gitStatus;
      try {
        gitStatus = await this.getGitStatus();
      } catch (gitError) {
        console.log(`[ERROR] Failed to get git status: ${gitError}`);
      }

      return {
        isRunning: false,
        isInstalled: true,
        services: {},
        repoPath: this.configuration.repoPath,
        lastUpdated: new Date(),
        gitBranch: gitStatus?.branch,
        gitCommit: gitStatus?.commit,
      };
    }
   
  }

  async start(): Promise<void> {
    if (!(await this.isRepositoryInstalled())) {
      throw new Error('Repository not installed. Please clone it first.');
    }
    console.log('Starting RHDH Local...');

    try {
      await this.executeCompose(['up', '-d', "--wait"]);

      
      console.log('RHDH Local started successfully!');
    } catch (error) {
      const message = `Failed to start RHDH Local: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await podmanDesktopApi.window.showErrorMessage(message);
      throw new Error(message);
    }
  }

  async stop(): Promise<void> {
    if (!(await this.isRepositoryInstalled())) {
      throw new Error('Repository not installed. Please clone it first.');
    }

    try {
      await this.executeCompose(['down']);
      console.log('RHDH Local stopped successfully!');
    } catch (error) {
      const message = `Failed to stop RHDH Local: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await podmanDesktopApi.window.showErrorMessage(message);
      throw new Error(message);
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    // Wait a moment for services to fully stop
    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.start();
  }

  async restartService(serviceName: string): Promise<void> {
    if (!(await this.isRepositoryInstalled())) {
      throw new Error('Repository not installed. Please clone it first.');
    }

    try {
      await this.executeCompose(['restart', serviceName]);
      console.log(`Service ${serviceName} restarted successfully!`);
    } catch (error) {
      const message = `Failed to restart service ${serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await podmanDesktopApi.window.showErrorMessage(message);
      throw new Error(message);
    }
  }

  async installPlugins(): Promise<void> {
    if (!(await this.isRepositoryInstalled())) {
      throw new Error('Repository not installed. Please clone it first.');
    }

    try {
      await this.executeCompose(['run', '--rm', 'install-dynamic-plugins']);
      console.log('Dynamic plugins installed successfully!');
    } catch (error) {
      const message = `Failed to install plugins: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await podmanDesktopApi.window.showErrorMessage(message);
      throw new Error(message);
    }
  }

  async getLogs(service: string, lines: number = 100): Promise<RHDHLogs> {
    if (!(await this.isRepositoryInstalled())) {
      throw new Error('Repository not installed. Please clone it first.');
    }

    try {
      const result = await this.executeCompose(['logs', '--tail', lines.toString(), service]);

      return {
        service,
        logs: result.stdout || result.stderr || 'No logs available',
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to get logs for service ${service}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getStreamingLogs(service: string, options: LogStreamOptions = {}): Promise<LogStreamResponse> {
    if (!(await this.isRepositoryInstalled())) {
      throw new Error('Repository not installed. Please clone it first.');
    }

    try {
      // Get current logs with specified number of lines
      const logs = await this.getLogs(service, options.tail || 100);
      
      console.log(`[STREAM] Fetched logs for ${service}, length: ${logs.logs?.length || 0}`);
      
      return {
        logs: logs.logs || '',
        hasMore: true, // Assume there might be more logs
        timestamp: logs.timestamp,
      };
    } catch (error) {
      console.error(`[STREAM] Failed to get logs for ${service}:`, error);
      
      return {
        logs: `[${new Date().toISOString()}] Error fetching logs: ${error instanceof Error ? error.message : 'Unknown error'}\n`,
        hasMore: false,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getGitStatus(): Promise<{ branch: string; commit: string; isDirty: boolean; unpulledCommits: number }> {
    if (!(await this.isRepositoryInstalled())) {
      throw new Error('Repository not installed. Please clone it first.');
    }

    try {
      const [branchResult, commitResult, statusResult, unpulledResult] = await Promise.all([
        this.executeCommand('git', ['branch', '--show-current'], { cwd: this.configuration.repoPath }),
        this.executeCommand('git', ['rev-parse', 'HEAD'], { cwd: this.configuration.repoPath }),
        this.executeCommand('git', ['status', '--porcelain'], { cwd: this.configuration.repoPath }),
        this.executeCommand('git', ['rev-list', 'HEAD..origin/main', '--count'], { cwd: this.configuration.repoPath }).catch(() => ({ stdout: '0' })),
      ]);

      return {
        branch: branchResult.stdout.trim(),
        commit: commitResult.stdout.trim().substring(0, 8),
        isDirty: statusResult.stdout.trim().length > 0,
        unpulledCommits: parseInt(unpulledResult.stdout.trim()) || 0,
      };
    } catch (error) {
      throw new Error(`Failed to get git status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async pullLatest(): Promise<void> {
    await this.updateRepository();
  }

  async resetToClean(): Promise<void> {
    if (!(await this.isRepositoryInstalled())) {
      throw new Error('Repository not installed. Please clone it first.');
    }

    try {
      await this.executeCommand('git', ['reset', '--hard', 'HEAD'], { cwd: this.configuration.repoPath });
      console.log('Repository reset to clean state successfully!');
    } catch (error) {
      const message = `Failed to reset repository: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await podmanDesktopApi.window.showErrorMessage(message);
      throw new Error(message);
    }
  }

  async openRHDHInBrowser(): Promise<void> {
    try {
      await this.openExternalUrl(this.configuration.rhdhUrl);
    } catch (error) {
      // Re-throw with RHDH-specific context for better error messaging
      const message = `Failed to open RHDH in browser: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw new Error(message);
    }
  }

  async openExternalUrl(url: string): Promise<void> {
    try {
      await podmanDesktopApi.env.openExternal(podmanDesktopApi.Uri.parse(url));
    } catch (error) {
      const message = `Failed to open URL in browser: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await podmanDesktopApi.window.showErrorMessage(message);
      throw new Error(message);
    }
  }

  async openWorkingDirectory(): Promise<void> {
    try {
      await podmanDesktopApi.env.openExternal(podmanDesktopApi.Uri.parse(`file://${this.configuration.repoPath}`));
    } catch (error) {
      const message = `Failed to open RHDH in browser: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await podmanDesktopApi.window.showErrorMessage(message);
      throw new Error(message);
    }
  }


  private async isRepositoryInstalled(): Promise<boolean> {
    try {
      const repoPath = this.configuration.repoPath;
      const gitPath = path.join(repoPath, '.git');
      const composePath = path.join(repoPath, 'compose.yaml');
      return (await this.pathExists(gitPath)) && (await this.pathExists(composePath));
    } catch {
      return false;
    }
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async executeCommand(
    command: string,
    args: string[],
    options?: { cwd?: string }
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      podmanDesktopApi.process.exec(command, args, options)
        .then((result) => {
          const stdout = result.stdout || '';
          const stderr = result.stderr || '';
          
          // Log all commands and their output
          const fullCommand = `${command} ${args.join(' ')}`;
          const workingDir = options?.cwd ? ` (in ${options.cwd})` : '';
          
          console.log(`[CMD] ${fullCommand}${workingDir}`);
          if (stdout) {
            console.log(`[STDOUT] ${stdout}`);
          }
          if (stderr) {
            console.log(`[STDERR] ${stderr}`);
          }
          console.log(`[CMD COMPLETED] ${fullCommand}`);
          
          resolve({
            stdout,
            stderr,
          });
        })
        .catch((error) => {
          // Log errors for all commands
          const fullCommand = `${command} ${args.join(' ')}`;
          const workingDir = options?.cwd ? ` (in ${options.cwd})` : '';
          console.log(`[CMD ERROR] ${fullCommand}${workingDir}: ${error}`);
          reject(error);
        });
    });
  }

  /**
   * Execute Compose commands with the repository as the working directory by default.
   * @param args Command arguments (without 'docker-compose'), e.g. ['up', '-d'] or ['--version']
   * @param options Additional options, cwd defaults to repository path
   * @returns Promise with stdout and stderr
   */
  private async executeCompose(
    args: string[],
    options?: { cwd?: string }
  ): Promise<{ stdout: string; stderr: string }> {
    const workingDirectory = options?.cwd || this.configuration.repoPath;
    let fileExtension = '';
    if (process.platform === 'win32') {
      fileExtension = '.exe';
    }
    const composeBinary = path.join(this.extensionContext.storagePath,"..","podman-desktop.compose","bin",`docker-compose${fileExtension}`);
    return this.executeCommand(composeBinary, args, { cwd: workingDirectory });
  }

  /**
   * Build services object dynamically from container information
   * @param containers Array of container objects from docker-compose ps --format json
   * @returns Services object with dynamic service statuses
   */
  private buildServicesFromContainers(containers: any[]): { [serviceName: string]: RHDHServiceStatus } {
    const services: { [serviceName: string]: RHDHServiceStatus } = {};

    for (const container of containers) {
      // Extract service name from various possible fields
      let serviceName = container.Service || container.Name;
      
      // If the name is a full container name like "rhdh-local-rhdh-1", extract the service part
      if (serviceName && serviceName.includes('-')) {
        const parts = serviceName.split('-');
        // Try to find the actual service name (usually between project prefix and instance number)
        if (parts.length >= 3) {
          serviceName = parts[parts.length - 2]; // Usually the service name is second to last part
        }
      }
      
      if (!serviceName) continue;

      // Map docker-compose state to our status
      let status: RHDHServiceStatus['status'] = 'unknown';
      
      if (container.State === 'running') {
        status = 'running';
      } else if (container.State === 'exited') {
        // Check exit code - 0 means successful completion, others mean error
        if (container.ExitCode === 0) {
          status = 'stopped';
        } else {
          status = 'error';
        }
      } else if (container.State === 'created' || container.State === 'restarting') {
        status = 'stopped';
      } else if (container.State === 'dead' || container.State === 'removing') {
        status = 'error';
      }

      services[serviceName] = {
        status,
        containerId: container.ID,
        uptime: container.Status, // This usually contains uptime info like "Up 2 minutes"
      };
    }

    return services;
  }

}