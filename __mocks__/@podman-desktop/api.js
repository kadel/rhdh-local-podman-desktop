/**
 * Mock the extension API for vitest.
 * This file is referenced from vitest.config.js file.
 */

// Mock functions that can be spied on in tests
const mockShowInformationMessage = () => Promise.resolve();
const mockShowErrorMessage = () => Promise.resolve();
const mockProcessExec = () => Promise.resolve({ stdout: '', stderr: '', command: '' });
const mockOpenExternal = () => Promise.resolve();
const mockParse = () => ({});

const api = {
  window: {
    showInformationMessage: mockShowInformationMessage,
    showErrorMessage: mockShowErrorMessage,
    createWebviewPanel: () => ({
      webview: {
        asWebviewUri: () => 'mock://uri',
        html: '',
      },
      dispose: () => {},
    }),
  },
  process: {
    exec: mockProcessExec,
  },
  env: {
    openExternal: mockOpenExternal,
  },
  Uri: {
    parse: mockParse,
    joinPath: () => ({ fsPath: '/mock/path' }),
  },
  commands: {
    registerCommand: () => ({ dispose: () => {} }),
  },
  tray: {
    registerMenuItem: () => ({ dispose: () => {} }),
  },
};

module.exports = api;
