import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as podmanDesktopApi from '@podman-desktop/api';

// Mock the Podman Desktop API
const mockExtensionContext = {
  storagePath: '/mock/storage/path',
  extensionUri: { 
    fsPath: '/mock/extension',
    scheme: 'file',
    authority: '',
    path: '/mock/extension',
    query: '',
    fragment: '',
    with: vi.fn(),
    toJSON: vi.fn(),
  },
  subscriptions: [],
  secrets: {
    get: vi.fn(),
    store: vi.fn(),
    delete: vi.fn(),
    onDidChange: vi.fn(),
  },
} as unknown as podmanDesktopApi.ExtensionContext;

// Mock tray menu registration
const mockTrayRegisterMenuItem = vi.fn();

// Mock podman desktop API
vi.mock('@podman-desktop/api', () => ({
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  commands: {
    registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  },
  tray: {
    registerMenuItem: mockTrayRegisterMenuItem.mockReturnValue({ dispose: vi.fn() }),
  },
  process: {
    exec: vi.fn(),
  },
  env: {
    openExternal: vi.fn(),
  },
  Uri: {
    parse: vi.fn(),
    joinPath: vi.fn().mockReturnValue({ fsPath: '/mock/path' }),
  },
}));

// Mock fs
vi.mock('node:fs', () => ({
  promises: {
    mkdir: vi.fn(),
    access: vi.fn(),
    readFile: vi.fn().mockResolvedValue('<html></html>'),
    writeFile: vi.fn(),
    copyFile: vi.fn(),
    stat: vi.fn(),
    rm: vi.fn(),
  },
  default: {
    promises: {
      readFile: vi.fn().mockResolvedValue('<html></html>'),
    },
  },
}));

// Mock RPC Extension
vi.mock('/@shared/src/messages/MessageProxy', () => ({
  RpcExtension: vi.fn().mockImplementation(() => ({
    registerInstance: vi.fn(),
  })),
}));

describe('Tray Menu Integration', () => {
  let activationCompleted = false;

  beforeEach(async () => {
    if (!activationCompleted) {
      const extensionApi = await import('@podman-desktop/api');
      
      // Mock the window.createWebviewPanel to return a mock panel
      const mockPanel = {
        webview: {
          asWebviewUri: vi.fn().mockReturnValue('mock://uri'),
          html: '',
        },
        dispose: vi.fn(),
      };
      
      vi.mocked(extensionApi.window).createWebviewPanel = vi.fn().mockReturnValue(mockPanel);
      vi.mocked(extensionApi.commands.registerCommand).mockReturnValue({ dispose: vi.fn() });

      // Import the activation function after mocks are set up
      const { activate } = await import('./extension');

      // Activate the extension once
      await activate(mockExtensionContext);
      activationCompleted = true;
    }
  });

  it('should register tray menu items and commands', async () => {
    const extensionApi = await import('@podman-desktop/api');

    // Verify that commands were registered
    expect(extensionApi.commands.registerCommand).toHaveBeenCalledWith('rhdh-local.start', expect.any(Function));
    expect(extensionApi.commands.registerCommand).toHaveBeenCalledWith('rhdh-local.stop', expect.any(Function));
    expect(extensionApi.commands.registerCommand).toHaveBeenCalledWith('rhdh-local.restart', expect.any(Function));
    expect(extensionApi.commands.registerCommand).toHaveBeenCalledWith('rhdh-local.status', expect.any(Function));
    expect(extensionApi.commands.registerCommand).toHaveBeenCalledWith('rhdh-local.openBrowser', expect.any(Function));
    expect(extensionApi.commands.registerCommand).toHaveBeenCalledWith('rhdh-local.openWorkingDirectory', expect.any(Function));

    // Verify that tray menu items were registered
    expect(mockTrayRegisterMenuItem).toHaveBeenCalled();
    
    // Check that we have the main RHDH Local submenu registered
    const calls = mockTrayRegisterMenuItem.mock.calls;
    const menuItems = calls.map(call => call[0]);
    expect(menuItems.some(item => item.id === 'rhdh-local-submenu')).toBe(true);
    
    // Check that the submenu has the expected label
    const submenuItem = menuItems.find(item => item.id === 'rhdh-local-submenu');
    expect(submenuItem?.label).toBe('RHDH Local');
    expect(submenuItem?.type).toBe('submenu');
    expect(submenuItem?.submenu).toBeDefined();
  });

  it('should properly configure menu items with correct properties', () => {
    // Verify that tray menu items were registered with proper structure
    expect(mockTrayRegisterMenuItem).toHaveBeenCalled();
    
    const calls = mockTrayRegisterMenuItem.mock.calls;
    const menuItems = calls.map(call => call[0]);

    // Should have at least one menu item (the main submenu)
    expect(menuItems.length).toBeGreaterThan(0);

    // Check the main submenu item
    const submenuItem = menuItems.find(item => item.id === 'rhdh-local-submenu');
    expect(submenuItem).toBeDefined();
    expect(submenuItem?.id).toBe('rhdh-local-submenu');
    expect(submenuItem?.label).toBe('RHDH Local');
    expect(submenuItem?.type).toBe('submenu');
    expect(Array.isArray(submenuItem?.submenu)).toBe(true);

    // Check that submenu items have required properties
    if (submenuItem?.submenu) {
      submenuItem.submenu.forEach((item: any) => {
        expect(item).toHaveProperty('id');
        expect(typeof item.id).toBe('string');
        
        // Only check label for non-separator items
        if (item.type !== 'separator') {
          expect(item).toHaveProperty('label');
          expect(typeof item.label).toBe('string');
        }
        
        // Menu items may have enabled/disabled state
        if ('enabled' in item) {
          expect(typeof item.enabled).toBe('boolean');
        }
      });

      // Verify that the old separate status header is no longer present
      const statusHeaderItem = submenuItem.submenu.find((item: any) => item.id === 'rhdh-local-status' && item.enabled === false);
      expect(statusHeaderItem).toBeUndefined();
    }
  });

  it('should have proper command IDs in submenu items', () => {
    const calls = mockTrayRegisterMenuItem.mock.calls;
    const menuItems = calls.map(call => call[0]);

    // Get the main submenu
    const submenuItem = menuItems.find(item => item.id === 'rhdh-local-submenu');
    expect(submenuItem).toBeDefined();
    expect(submenuItem?.submenu).toBeDefined();

    if (!submenuItem?.submenu) return;

    // Get items with command IDs (those that match registered commands)
    const commandIds = [
      'rhdh-local.start',
      'rhdh-local.stop', 
      'rhdh-local.restart',
      'rhdh-local.status',
      'rhdh-local.openBrowser',
      'rhdh-local.openWorkingDirectory',
    ];
    
    // Check that command IDs are used as submenu item IDs
    const submenuItemsWithCommandIds = submenuItem.submenu.filter((item: any) => 
      commandIds.includes(item.id)
    );
    
    // Should have at least some submenu items with command IDs
    expect(submenuItemsWithCommandIds.length).toBeGreaterThan(0);
    
    // Each command ID submenu item should have proper structure
    submenuItemsWithCommandIds.forEach((item: any) => {
      expect(item.id).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(commandIds).toContain(item.id);
    });
  });

  it('should use proper status icons for different states', () => {
    // Verify that the combined start/stop menu item uses proper status indicators
    const calls = mockTrayRegisterMenuItem.mock.calls;
    const menuItems = calls.map(call => call[0]);
    
    // Get the main submenu
    const submenuItem = menuItems.find(item => item.id === 'rhdh-local-submenu');
    expect(submenuItem).toBeDefined();
    expect(submenuItem?.submenu).toBeDefined();

    if (!submenuItem?.submenu) return;
    
    // Check that start/stop items use green/red indicators
    const startStopItems = submenuItem.submenu.filter((item: any) => 
      item.id === 'rhdh-local.start' || item.id === 'rhdh-local.stop'
    );
    
    // Should have at least one start/stop item
    expect(startStopItems.length).toBeGreaterThan(0);
    
    // Each start/stop item should have green or red indicator
    startStopItems.forEach((item: any) => {
      const label = item.label || '';
      if (item.id === 'rhdh-local.start') {
        expect(label).toContain('🔴'); // Red for stopped state
        expect(label).toContain('Start');
      } else if (item.id === 'rhdh-local.stop') {
        expect(label).toContain('🟢'); // Green for running state  
        expect(label).toContain('Stop');
      }
    });

    // Check that service status items still contain expected emojis
    const serviceStatusItems = submenuItem.submenu.filter((item: any) => 
      item.id?.includes('service') && item.label?.includes(':')
    );
    
    // Service status items should still have emoji indicators
    serviceStatusItems.forEach((item: any) => {
      const label = item.label || '';
      const hasStatusEmoji = /[🟢🔴❌⚪]/.test(label);
      expect(hasStatusEmoji).toBe(true);
    });
  });
});
