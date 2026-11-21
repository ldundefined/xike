import { app } from 'electron';
import { execFile } from 'node:child_process';
import { join } from 'node:path';

export interface SystemAdapter { setAutoStart(enabled: boolean): void; getAutoStart(): boolean; shutdown(): Promise<void> }
export function createWindowsAdapter(testMode: boolean): SystemAdapter {
  let simulatedAutoStart = false;
  return {
    setAutoStart(enabled) {
      if (testMode) { simulatedAutoStart = enabled; return; }
      if (enabled && !app.isPackaged) throw new Error('开机自启请在安装版中启用');
      app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: ['--background'] });
    },
    getAutoStart() {
      return testMode ? simulatedAutoStart : app.getLoginItemSettings({ path: process.execPath, args: ['--background'] }).openAtLogin;
    },
    shutdown() {
      if (testMode) return Promise.resolve();
      // No /f: give apps a chance to block shutdown for unsaved documents.
      return new Promise((resolve, reject) => execFile(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'shutdown.exe'),
        ['/s', '/t', '0'], { windowsHide: true, timeout: 10_000 }, error => error ? reject(new Error('Windows 未接受关机请求，请检查权限或系统状态')) : resolve()));
    },
  };
}
