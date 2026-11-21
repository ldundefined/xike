import { app, BrowserWindow, ipcMain, Menu, nativeImage, nativeTheme, powerMonitor, screen, Tray, dialog, shell } from 'electron';
import { release } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Engine } from '../domain/engine';
import { isClockTime } from '../domain/daily-shutdown';
import { validateSettings } from '../domain/settings';
import { resolveAppearance, supportsAcrylic, supportsSystemBackdrop } from '../domain/appearance';
import { setWindows10Glass } from '../platform/glass';
import { Store } from '../storage/store';
import { createWindowsAdapter } from '../platform/windows';
import { kinds, type Command, type StoredData, type Result } from '../shared/types';

const testMode = process.env.XIKE_TEST === '1';
if (testMode) app.setPath('userData', process.env.XIKE_TEST_PROFILE ?? join(app.getPath('temp'), `xike-test-${process.pid}`));
app.setAppUserModelId('cn.xike.desktop');
const ownsLock = app.requestSingleInstanceLock();
let widget: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let notice: BrowserWindow | null = null;
let tray: Tray | null = null;
let engine: Engine;
let store: Store;
let data: StoredData;
let locked = false, suspended = false, quitting = false;
let nativeMaterialFailed = false;
let timer: ReturnType<typeof setInterval> | undefined;
let positionTimer: ReturnType<typeof setTimeout> | undefined;
const system = createWindowsAdapter(testMode);
const allowed = new Map<number, 'widget' | 'settings' | 'notice'>();
const materialCache = new WeakMap<BrowserWindow, string>();
const opaqueWindows = new WeakSet<BrowserWindow>();
const iconPath = () => join(app.getAppPath(), 'assets', 'icon.png');
const tickInput = () => ({ now: Date.now(), monotonic: performance.now(),
  idleSeconds: powerMonitor.getSystemIdleTime(), locked, suspended });
const appearance = () => resolveAppearance(data.settings, {
  platform: process.platform, release: release(), systemDark: nativeTheme.shouldUseDarkColors,
  highContrast: nativeTheme.shouldUseHighContrastColors, reducedTransparency: nativeTheme.prefersReducedTransparency,
  nativeFailed: nativeMaterialFailed,
});
const snapshot = () => ({ ...engine.snapshot(Date.now(), testMode), version: app.getVersion(), appearance: appearance() });

function applyWindowAppearance(window: BrowserWindow) {
  if (window.isDestroyed()) return;
  let current = appearance();
  if (opaqueWindows.has(window)) current = { ...current, material: 'solid' };
  const key = `${current.material}:${current.theme}`;
  if (materialCache.get(window) === key) return;
  if (supportsAcrylic(process.platform, release())) {
    try {
      if (supportsSystemBackdrop(process.platform, release())) window.setBackgroundMaterial(current.material === 'acrylic' ? 'acrylic' : 'none');
      else setWindows10Glass(window, current.material === 'acrylic', current.theme === 'dark');
    }
    catch {
      nativeMaterialFailed = true;
      current = appearance();
      try { window.setBackgroundMaterial('none'); } catch { /* Solid fallback below. */ }
    }
  }
  window.setBackgroundColor(current.material === 'acrylic' ? '#00000000' : current.theme === 'light' ? '#f3f5f1' : '#272c30');
  materialCache.set(window, `${current.material}:${current.theme}`);
}
function syncAppearance() {
  if (nativeTheme.themeSource !== data.settings.theme) nativeTheme.themeSource = data.settings.theme;
  for (const window of BrowserWindow.getAllWindows()) applyWindowAppearance(window);
}

function report(message: string) { if (engine) { engine.message = message; broadcast(); } }
function persist() { store.save(data); }
function broadcast() {
  const state = snapshot();
  for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('xike:state', state);
}
function createWindow(role: 'widget' | 'settings' | 'notice', width: number, height: number): BrowserWindow {
  const window = new BrowserWindow({
    width, height, show: false, frame: role === 'settings', resizable: role === 'settings',
    transparent: role !== 'settings' && !supportsSystemBackdrop(process.platform, release()),
    minimizable: role === 'settings', maximizable: false, fullscreenable: false,
    skipTaskbar: role !== 'settings', backgroundColor: appearance().theme === 'light' ? '#f3f5f1' : '#272c30', title: role === 'settings' ? '息刻 · 设置' : '息刻',
    autoHideMenuBar: true, roundedCorners: role !== 'widget', hasShadow: true, icon: iconPath(),
    webPreferences: { preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  if (role === 'settings') opaqueWindows.add(window);
  applyWindowAppearance(window);
  const senderId = window.webContents.id;
  allowed.set(senderId, role);
  window.on('closed', () => allowed.delete(senderId));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  if (process.env.XIKE_DEV_URL && !app.isPackaged) {
    void window.loadURL(`${process.env.XIKE_DEV_URL}/?view=${role}`);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), { query: { view: role } });
  }
  window.webContents.on('render-process-gone', () => {
    if (role === 'notice' && engine.shutdownAt !== null) {
      engine.cancelShutdown(); data.consumedShutdownDate = engine.consumedShutdownDate;
      try { persist(); } catch { /* No shutdown can execute after cancellation in memory. */ }
      report('提醒窗口异常，已跳过本次关机');
    }
  });
  return window;
}
function defaultBounds() {
  const area = screen.getPrimaryDisplay().workArea;
  return { x: area.x + area.width - 312, y: area.y, width: 312, height: area.height };
}
function fitWidget(reset = false) {
  if (!widget) return;
  const bounds = defaultBounds();
  if (!reset && data.position) {
    const display = screen.getDisplayNearestPoint(data.position).workArea;
    bounds.height = display.height;
    bounds.x = display.x + display.width - bounds.width;
    bounds.y = display.y;
  }
  const current = widget.getBounds();
  if (current.x !== bounds.x || current.y !== bounds.y || current.width !== bounds.width || current.height !== bounds.height) widget.setBounds(bounds);
}
function showWidget() { widget?.showInactive(); rebuildTray(); }
function openSettings() {
  if (settingsWindow) { settingsWindow.show(); settingsWindow.focus(); return; }
  const area = screen.getPrimaryDisplay().workArea;
  settingsWindow = createWindow('settings', Math.min(760, area.width - 40), Math.min(830, area.height - 40));
  settingsWindow.once('ready-to-show', () => settingsWindow?.show());
  settingsWindow.on('closed', () => { settingsWindow = null; });
}
function showNotice(focus = false) {
  const area = screen.getDisplayMatching(widget?.getBounds() ?? defaultBounds()).workArea;
  if (!notice) {
    notice = createWindow('notice', 376, 360);
    notice.setAlwaysOnTop(true, 'floating');
    notice.setPosition(area.x + area.width - 396, area.y + area.height - 380);
    notice.once('ready-to-show', () => focus ? notice?.show() : notice?.showInactive());
    notice.on('close', event => {
      if (!quitting) { event.preventDefault(); notice?.hide(); }
    });
    notice.on('closed', () => { notice = null; });
  } else { focus ? notice.show() : notice.showInactive(); }
}
function rebuildTray() {
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: '息刻  V' + app.getVersion(), enabled: false },
    { type: 'separator' },
    { label: '打开设置', click: openSettings },
    { label: widget?.isVisible() ? '隐藏桌面组件' : '显示桌面组件', click: () => {
      if (widget?.isVisible()) widget.hide(); else showWidget(); rebuildTray();
    } },
    { label: engine.manualPaused ? '恢复健康提醒' : '暂停健康提醒', click: () => {
      engine.manualPaused = !engine.manualPaused; pulse(); rebuildTray();
    } },
    { label: '查看当前提醒', click: () => { showNotice(true); broadcast(); } },
    { label: '跳过本次关机', enabled: engine.shutdownAt !== null, click: () => {
      void command({ type: 'cancel-shutdown' }, 'widget');
    } },
    { label: '重置组件到右侧', click: () => { data.position = undefined; fitWidget(true); showWidget(); } },
    { type: 'separator' },
    { label: '退出息刻', click: () => app.quit() },
  ]));
}
async function command(raw: unknown, role: 'widget' | 'settings' | 'notice'): Promise<Result> {
  try {
    if (!raw || typeof raw !== 'object' || typeof (raw as Command).type !== 'string') throw new Error('操作格式无效');
    const cmd = raw as Command;
    switch (cmd.type) {
      case 'appearance': {
        if (role !== 'settings') throw new Error('请在设置窗口切换外观');
        const settings = validateSettings({ ...data.settings, theme: cmd.theme, glass: cmd.glass });
        store.save({ ...data, settings });
        data.settings = settings; engine.updateSettings(settings); syncAppearance();
        engine.message = '外观已应用并保存';
        break;
      }
      case 'pause': engine.manualPaused = !engine.manualPaused; break;
      case 'start':
      case 'snooze':
        if (!kinds.includes(cmd.kind)) throw new Error('提醒类型无效');
        if (cmd.type === 'start') { engine.start(cmd.kind); if (cmd.kind !== 'water') showNotice(); }
        else engine.snooze(cmd.kind);
        break;
      case 'cancel-rest': engine.cancelRest(); break;
      case 'settings': {
        if (role !== 'settings') throw new Error('请在设置窗口修改配置');
        const settings = validateSettings(cmd.settings);
        const previous = data.settings;
        const changed = settings.autoStart !== previous.autoStart;
        if (changed) system.setAutoStart(settings.autoStart);
        try { store.save({ ...data, settings }); }
        catch (error) { if (changed) system.setAutoStart(previous.autoStart); throw error; }
        data.settings = settings;
        engine.updateSettings(settings);
        syncAppearance();
        engine.message = '设置已保存';
        break;
      }
      case 'schedule': {
        if (role !== 'settings') throw new Error('请在设置窗口预约关机');
        const now = Date.now();
        if (!isClockTime(cmd.time)) throw new Error('请选择有效的每日关机时间');
        store.save({ ...data, shutdownTime: cmd.time, consumedShutdownDate: cmd.time === engine.shutdownTime ? engine.consumedShutdownDate : null });
        engine.scheduleDaily(cmd.time, now);
        data.shutdownTime = cmd.time;
        data.consumedShutdownDate = engine.consumedShutdownDate;
        break;
      }
      case 'disable-shutdown':
        if (role !== 'settings') throw new Error('请在设置窗口关闭每日关机');
        engine.disableDaily(); data.shutdownTime = null; persist(); break;
      case 'cancel-shutdown':
        // Cancel in memory first, even if a disk failure prevents persisting it.
        engine.cancelShutdown(); data.consumedShutdownDate = engine.consumedShutdownDate; persist(); break;
      case 'hide-widget': widget?.hide(); break;
      case 'close-notice': notice?.hide(); break;
      case 'reset-position': data.position = undefined; fitWidget(true); showWidget(); persist(); break;
      default: throw new Error('不支持的操作');
    }
    pulse();
    rebuildTray();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '操作失败';
    report(message); rebuildTray();
    return { ok: false, error: message };
  }
}
function pulse() {
  if (quitting) return;
  const hadRest = !!engine.rest;
  const wasPaused = !!engine.pauseReason;
  const effects = engine.tick(tickInput());
  if (effects.shutdownChanged) {
    data.consumedShutdownDate = engine.consumedShutdownDate;
    try { persist(); }
    catch {
      engine.shutdownAt = null; engine.shutdownStatus = 'failed';
      engine.message = '无法保存关机状态，已停止本次关机';
      effects.executeShutdown = false;
    }
    rebuildTray();
  }
  if (effects.warnShutdown) {
    showNotice(true);
    if (engine.settings.sound) shell.beep();
  }
  if (effects.executeShutdown) {
    void system.shutdown().catch(error => { engine.shutdownStatus = 'failed'; report(error.message); });
  }
  if (effects.dueChanged && !engine.pauseReason && !engine.rest) {
    showNotice(); if (engine.settings.sound) shell.beep();
  }
  if (engine.pauseReason && engine.shutdownStatus !== 'warning' && !engine.rest) notice?.hide();
  if (((hadRest && !engine.rest) || (wasPaused && !engine.pauseReason)) && engine.shutdownStatus !== 'warning') {
    if (engine.due.length && !engine.pauseReason) showNotice();
    else notice?.hide();
  }
  if (!engine.due.length && !engine.rest && engine.shutdownStatus !== 'warning') notice?.hide();
  broadcast();
}

if (!ownsLock) app.quit();
else {
  app.on('second-instance', () => { showWidget(); openSettings(); });
  app.on('window-all-closed', () => { /* Keep the main scheduler and tray alive. */ });
  app.on('before-quit', () => {
    quitting = true;
    if (timer) clearInterval(timer);
    if (positionTimer) clearTimeout(positionTimer);
    // Recurring preferences and skipped/executed dates survive exit and reboot.
    if (data && store) { try { persist(); } catch { /* report on next load */ } }
    tray?.destroy();
  });
  void app.whenReady().then(() => {
    store = new Store(app.getPath('userData'));
    data = store.load();
    data.settings.autoStart = system.getAutoStart();
    engine = new Engine(data.settings, tickInput());
    engine.restoreDaily(data.shutdownTime, data.consumedShutdownDate, Date.now());
    syncAppearance();
    nativeTheme.on('updated', () => { syncAppearance(); broadcast(); });
    if (store.warning) engine.message = store.warning;
    persist();
    widget = createWindow('widget', 312, 740);
    fitWidget();
    widget.once('ready-to-show', showWidget);
    widget.on('close', event => { if (!quitting) { event.preventDefault(); widget?.hide(); rebuildTray(); } });
    widget.on('moved', () => {
      if (positionTimer) clearTimeout(positionTimer);
      positionTimer = setTimeout(() => {
        if (!widget || quitting) return;
        const { x, y } = widget.getBounds(); data.position = { x, y };
        fitWidget();
        const docked = widget.getBounds(); data.position = { x: docked.x, y: docked.y };
        try { persist(); } catch { report('组件位置保存失败'); }
      }, 500);
    });
    screen.on('display-removed', () => fitWidget());
    screen.on('display-metrics-changed', () => fitWidget());
    tray = new Tray(nativeImage.createFromPath(iconPath()).resize({ width: 20, height: 20 }));
    tray.setToolTip('息刻 · 双击打开设置');
    tray.on('double-click', openSettings);
    rebuildTray();
    powerMonitor.on('lock-screen', () => { locked = true; pulse(); });
    powerMonitor.on('unlock-screen', () => { locked = false; pulse(); });
    powerMonitor.on('suspend', () => { suspended = true; pulse(); });
    powerMonitor.on('resume', () => { suspended = false; pulse(); });
    ipcMain.handle('xike:get-state', event => {
      if (!allowed.has(event.sender.id) || event.senderFrame !== event.sender.mainFrame) throw new Error('窗口无权限');
      return snapshot();
    });
    ipcMain.handle('xike:command', (event, input) => {
      const role = allowed.get(event.sender.id);
      if (!role || event.senderFrame !== event.sender.mainFrame) return { ok: false, error: '窗口无权限' };
      return command(input, role);
    });
    timer = setInterval(pulse, 1000);
    // Test runner uses this switch to inspect the real settings UI without automating the tray.
    if (testMode && process.argv.includes('--test-settings')) openSettings();
  }).catch(error => {
    dialog.showErrorBox('息刻启动失败', String(error)); app.quit();
  });
}
