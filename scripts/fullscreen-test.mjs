import { _electron } from 'playwright';
import electron from 'electron';
import koffi from 'koffi';
import assert from 'node:assert/strict';
import { join } from 'node:path';

if (process.platform !== 'win32') throw new Error('This integration test requires Windows.');
const env = { ...process.env, XIKE_TEST: '1' };
delete env.ELECTRON_RUN_AS_NODE;
delete env.XIKE_DEV_URL;
const packaged = process.env.XIKE_PACKAGED_EXE;
const app = await _electron.launch({ executablePath: packaged ?? electron,
  args: packaged ? ['--test-settings'] : ['.', '--test-settings'], env });
const user32 = koffi.load(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'user32.dll'));
const getTop = user32.func('uintptr_t __stdcall GetTopWindow(uintptr_t parent)');
const getNext = user32.func('uintptr_t __stdcall GetWindow(uintptr_t hwnd, uint32_t cmd)');
const asId = value => BigInt(value).toString();
function zOrder(ids) {
  const found = {}, visited = new Set(); let hwnd = getTop(0n);
  for (let index = 0; hwnd && index < 10000; index++) {
    const id = asId(hwnd); if (visited.has(id)) break; visited.add(id);
    for (const [name, wanted] of Object.entries(ids)) if (id === wanted) found[name] = index;
    if (Object.keys(found).length === Object.keys(ids).length) break;
    hwnd = getNext(hwnd, 2); // GW_HWNDNEXT: inspect actual desktop z-order.
  }
  return found;
}
try {
  const find = async view => {
    for (let i = 0; i < 100; i++) {
      const page = app.windows().find(page => page.url().includes(`view=${view}`));
      if (page) { await page.waitForSelector('main'); return page; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Missing window: ${view}`);
  };
  const widget = await find('widget'); await find('settings');
  await app.evaluate(async ({ BrowserWindow, screen }) => {
    const bounds = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).bounds;
    const fixture = new BrowserWindow({ ...bounds, show: false, frame: false, backgroundColor: '#263b62', skipTaskbar: true });
    globalThis.xikeFullscreenFixture = fixture;
    await fixture.loadURL('data:text/html,' + encodeURIComponent('<body style="background:#263b62;color:white;font:24px Segoe UI;display:grid;place-content:center;height:90vh">Xike fullscreen visibility test</body>'));
    fixture.setAlwaysOnTop(true, 'pop-up-menu'); fixture.show();
    const entered = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Fullscreen fixture did not enter fullscreen')), 10000);
      fixture.once('enter-full-screen', () => { clearTimeout(timeout); resolve(); });
    });
    fixture.setFullScreen(true); await entered; fixture.focus();
  });
  const result = await widget.evaluate(() => window.xike.command({ type: 'start', kind: 'eye' }));
  assert.equal(result.ok, true);
  const notice = await find('notice');
  await notice.getByRole('heading', { name: 'Look a little farther', exact: true }).waitFor();
  const inspect = () => app.evaluate(({ BrowserWindow }) => {
    const notice = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('view=notice'));
    const fixture = globalThis.xikeFullscreenFixture;
    const id = window => {
      const handle = window.getNativeWindowHandle();
      return (handle.length === 8 ? handle.readBigUInt64LE() : BigInt(handle.readUInt32LE())).toString();
    };
    return { ids: { notice: id(notice), fullscreen: id(fixture) }, visible: notice.isVisible(),
      top: notice.isAlwaysOnTop(), full: fixture.isFullScreen(), focused: fixture.isFocused() };
  });
  let info = await inspect();
  assert.equal(info.full, true); assert.equal(info.visible, true); assert.equal(info.top, true);
  let order = zOrder(info.ids);
  assert.ok(Number.isInteger(order.notice) && Number.isInteger(order.fullscreen) && order.notice < order.fullscreen, JSON.stringify(order));
  assert.equal(info.focused, true, 'Automatic reminder must not take keyboard focus from fullscreen content');
  // Simulate a competing fullscreen/topmost app raising itself again.
  await app.evaluate(() => globalThis.xikeFullscreenFixture.moveTop());
  await notice.waitForTimeout(1600);
  info = await inspect(); order = zOrder(info.ids);
  assert.ok(order.notice < order.fullscreen, `Reminder did not regain z-order: ${JSON.stringify(order)}`);
  const hidden = await widget.evaluate(() => window.xike.command({ type: 'close-notice' }));
  assert.equal(hidden.ok, true); await notice.waitForTimeout(1300);
  assert.equal((await inspect()).visible, false, 'Topmost maintenance must not reopen a dismissed reminder');
  const settings = await find('settings');
  const disabled = await settings.evaluate(async () => {
    const state = await window.xike.getState();
    return window.xike.command({ type: 'settings', settings: { ...state.settings, remindersOnTop: false } });
  });
  assert.equal(disabled.ok, true); assert.equal((await inspect()).top, false);
  console.log('FULLSCREEN PASS: real Windows fullscreen fixture, native z-order, competing topmost window, preserved focus, dismissal, and opt-out.');
} finally { await app.close(); }
