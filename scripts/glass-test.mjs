import { _electron } from 'playwright';
import electron from 'electron';
import { writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const env = { ...process.env, XIKE_TEST: '1' };
delete env.ELECTRON_RUN_AS_NODE;
delete env.XIKE_DEV_URL;
const packaged = process.env.XIKE_PACKAGED_EXE;
const app = await _electron.launch({ executablePath: packaged ?? electron, args: packaged ? ['--test-settings'] : ['.', '--test-settings'], env });
try {
  let widget, settings;
  for (let i = 0; i < 80; i++) {
    widget = app.windows().find(w => w.url().includes('view=widget'));
    settings = app.windows().find(w => w.url().includes('view=settings'));
    if (widget && settings) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await widget.waitForSelector('.widget'); await settings.waitForSelector('.settings-view');
  await app.evaluate(async ({ BrowserWindow }) => {
    const widget = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('view=widget'));
    const { x, y, width, height } = widget.getBounds();
    const backdrop = new BrowserWindow({ x: x - 15, y: y - 15, width: width + 30, height: height + 30,
      frame: false, skipTaskbar: true, show: false, backgroundColor: '#ffffff' });
    await backdrop.loadURL('data:text/html,' + encodeURIComponent('<html><body style="margin:0;height:100vh;background:repeating-conic-gradient(#71bad5 0% 25%,#f4bd7a 0% 50%) 0 0/40px 40px"></body></html>'));
    globalThis.xikeGlassFixture = backdrop;
    backdrop.setAlwaysOnTop(true); backdrop.showInactive(); widget.show(); widget.setAlwaysOnTop(true); widget.moveTop();
  });
  mkdirSync('docs/screenshots', { recursive: true });
  for (const [name, glass] of [['solid-desktop', false], ['glass-desktop', true]]) {
    const result = await settings.evaluate(glass => window.xike.command({ type: 'appearance', theme: 'light', glass }), glass);
    assert.equal(result.ok, true);
    await widget.waitForTimeout(2000);
    const state = await widget.evaluate(() => window.xike.getState());
    console.log(name, state.appearance);
    if (glass) assert.equal(state.appearance.material, 'acrylic', 'Win10 实机必须启用原生模糊，不能用实色回退冒充');
    const sampleY = await widget.locator('.shutdown-section').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return Math.min(rect.bottom - 45, rect.top + 145);
    });
    const capture = await app.evaluate(async ({ BrowserWindow, desktopCapturer, screen }, sampleY) => {
      const widget = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('view=widget'));
      globalThis.xikeGlassFixture.moveTop();
      widget.moveTop();
      await new Promise(resolve => setTimeout(resolve, 300));
      const b = widget.getBounds(), display = screen.getDisplayMatching(b), scale = display.scaleFactor;
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(display.size.width * scale), height: Math.round(display.size.height * scale) } });
      const source = sources.find(s => s.display_id === String(display.id)) ?? sources[0];
      const cropX = Math.max(0, b.x - display.bounds.x - 10), cropY = Math.max(0, b.y - display.bounds.y - 10);
      const crop = source.thumbnail.crop({ x: Math.round(cropX * scale), y: Math.round(cropY * scale),
        width: Math.round(Math.min(b.width + 20, display.size.width - cropX) * scale), height: Math.round(Math.min(b.height + 20, display.size.height - cropY) * scale) });
      const bitmap = crop.toBitmap(), width = crop.getSize().width;
      const values = []; let maxStep = 0;
      const patchY = b.y - display.bounds.y - cropY + sampleY;
      for (let y = Math.round(patchY * scale); y < Math.round((patchY + 30) * scale); y++) {
        for (let x = Math.round(45 * scale); x < Math.round(270 * scale); x++) {
          const index = (y * width + x) * 4;
          values.push(bitmap[index]);
          maxStep = Math.max(maxStep, Math.abs(bitmap[index] - bitmap[index + 4]));
        }
      }
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
      return { base64: crop.toPNG().toString('base64'), variance, maxStep };
    }, sampleY);
    console.log('桌面背景像素验证', name, capture.variance, capture.maxStep);
    writeFileSync(`docs/screenshots/${name}.png`, Buffer.from(capture.base64, 'base64'));
    if (glass) { assert.ok(capture.variance > 3, '玻璃必须透出桌面测试图案'); assert.ok(capture.maxStep < 35, '桌面图案的边缘必须被模糊'); }
    else assert.ok(capture.variance < 1, '实色模式不应透出桌面图案');
  }
  console.log('已捕获受控棋盘背景上的真实 Windows 桌面合成截图，请目视检查玻璃模糊。');
} finally { await app.close(); }
