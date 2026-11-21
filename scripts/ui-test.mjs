import { _electron as electronTest } from 'playwright';
import electronPath from 'electron';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const env = { ...process.env, XIKE_TEST: '1' };
delete env.ELECTRON_RUN_AS_NODE;
delete env.XIKE_DEV_URL;
mkdirSync('docs/screenshots', { recursive: true });
const packaged = process.env.XIKE_PACKAGED_EXE;
const launchOptions = { executablePath: packaged ?? electronPath,
  args: packaged ? ['--test-settings'] : ['.', '--test-settings'], cwd: process.cwd(), env, timeout: 30_000 };
let app = await electronTest.launch(launchOptions);
const errors = [];
app.on('window', page => page.on('pageerror', error => errors.push(error.message)));
try {
  const find = async view => {
    for (let i = 0; i < 60; i++) {
      const page = app.windows().find(page => page.url().includes(`view=${view}`));
      if (page) { await page.waitForSelector('.' + (view === 'settings' ? 'settings-view' : view)); return page; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`未出现 ${view} 窗口`);
  };
  const widget = await find('widget'), settings = await find('settings');
  widget.setDefaultTimeout(10_000); settings.setDefaultTimeout(10_000);
  console.log('UI: 窗口已加载');
  const dock = await app.evaluate(({ BrowserWindow, screen }) => {
    const window = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('view=widget'));
    const bounds = window.getBounds();
    return { bounds, area: screen.getDisplayMatching(bounds).workArea };
  });
  assert.equal(dock.bounds.width, 312);
  assert.equal(dock.bounds.x + dock.bounds.width, dock.area.x + dock.area.width);
  assert.equal(dock.bounds.y, dock.area.y);
  assert.equal(dock.bounds.height, dock.area.height);
  assert.ok(await widget.locator('.wall-time').innerText());
  assert.ok(await widget.locator('.wall-date').innerText());
  assert.equal(await widget.getByText('今日记录').count(), 0);
  assert.equal(await widget.getByText('设置', { exact: true }).count(), 0);
  const state = () => widget.evaluate(() => window.xike.getState());
  assert.equal((await state()).testMode, true);
  assert.equal((await state()).settings.theme, 'light');
  const lightBackground = await widget.locator('.widget').evaluate(element => getComputedStyle(element).backgroundColor);
  await settings.getByRole('radio', { name: '深色', exact: true }).click();
  await widget.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  assert.equal((await state()).appearance.theme, 'dark');
  const darkBackground = await widget.locator('.widget').evaluate(element => getComputedStyle(element).backgroundColor);
  assert.notEqual(darkBackground, lightBackground, '点击主题后实际背景颜色必须立即变化，不能只更新选中状态');
  await widget.screenshot({ path: 'docs/screenshots/widget-dark.png' });
  await settings.getByRole('radio', { name: '跟随系统', exact: true }).click();
  await settings.waitForFunction(() => document.querySelector('[data-theme-choice="system"]').getAttribute('aria-checked') === 'true' && !document.querySelector('[data-theme-choice="system"]').disabled);
  await settings.getByRole('checkbox', { name: /原生毛玻璃/ }).click();
  await widget.waitForFunction(() => document.documentElement.dataset.material === 'solid');
  assert.equal((await state()).settings.theme, 'system');
  assert.equal((await state()).appearance.material, 'solid');
  const systemDark = await app.evaluate(({ nativeTheme }) => nativeTheme.shouldUseDarkColors);
  assert.equal((await state()).appearance.theme, systemDark ? 'dark' : 'light');
  await settings.getByRole('radio', { name: '浅色', exact: true }).click();
  await widget.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await settings.waitForFunction(() => !document.querySelector('[data-theme-choice="light"]').disabled);
  await settings.getByRole('checkbox', { name: /原生毛玻璃/ }).click();
  await settings.waitForFunction(() => !document.querySelector('[data-theme-choice="light"]').disabled);
  const appearance = (await state()).appearance;
  console.log('UI: 毛玻璃实际状态', JSON.stringify(appearance));
  if (!appearance.glassAvailable) {
    assert.equal(appearance.material, 'solid');
    await settings.getByText(appearance.glassReason, { exact: true }).waitFor();
  }
  console.log('UI: 三种主题和毛玻璃回退通过');
  await widget.getByTitle('暂停健康提醒', { exact: true }).click();
  assert.equal((await state()).manualPaused, true);
  const before = (await state()).remaining.eye;
  await widget.waitForTimeout(1200);
  assert.equal((await state()).remaining.eye, before);
  await widget.getByTitle('恢复健康提醒', { exact: true }).click();
  console.log('UI: 暂停恢复通过');
  await settings.getByRole('spinbutton', { name: '护眼间隔', exact: true }).fill('1');
  await settings.getByRole('spinbutton', { name: '远眺时长', exact: true }).fill('10');
  await settings.getByRole('checkbox', { name: /开机自动启动/ }).check();
  await settings.getByRole('button', { name: '保存设置' }).click();
  await settings.getByRole('status').filter({ hasText: /^设置已保存$/ }).waitFor();
  assert.equal((await state()).settings.eyeMinutes, 1);
  assert.equal((await state()).settings.autoStart, true);
  console.log('UI: 保存设置通过');
  // Cross-window IPC permission: the widget may cancel a booking, but may not create one.
  const denied = await widget.evaluate(() => window.xike.command({ type: 'schedule', time: '23:30' }));
  assert.equal(denied.ok, false);
  const future = new Date(Date.now() + 12 * 60_000);
  const pad = n => String(n).padStart(2, '0');
  const value = `${pad(future.getHours())}:${pad(future.getMinutes())}`;
  await settings.getByRole('checkbox', { name: /每天自动关机/ }).check();
  await settings.getByLabel('每日关机时间').fill(value);
  console.log('UI: 已填写预约时间');
  await settings.getByRole('button', { name: '保存关机设置', exact: true }).click();
  await widget.getByRole('button', { name: '跳过本次关机' }).waitFor();
  assert.equal((await state()).shutdown.status, 'scheduled');
  console.log('UI: 预约关机通过');
  // Restore production defaults for the visual captures, keeping the harmless test booking.
  await settings.getByRole('spinbutton', { name: '护眼间隔', exact: true }).fill('20');
  await settings.getByRole('spinbutton', { name: '远眺时长', exact: true }).fill('20');
  await settings.getByRole('checkbox', { name: /开机自动启动/ }).uncheck();
  await settings.getByRole('button', { name: '保存设置' }).click();
  await settings.getByRole('status').filter({ hasText: /^设置已保存$/ }).waitFor();
  await widget.screenshot({ path: 'docs/screenshots/widget.png' });
  await settings.screenshot({ path: 'docs/screenshots/settings.png', fullPage: true });
  await settings.locator('.reminders-settings').screenshot({ path: 'docs/screenshots/reminder-groups.png' });
  const overflow = await widget.evaluate(() => ({ scroll: document.documentElement.scrollHeight, height: innerHeight,
    footer: document.querySelector('.widget-footer').getBoundingClientRect().bottom }));
  assert.ok(overflow.scroll <= overflow.height + 1, JSON.stringify(overflow));
  assert.ok(overflow.footer <= overflow.height + 1, JSON.stringify(overflow));
  await widget.getByRole('button', { name: '现在休息', exact: true }).click();
  const notice = await find('notice');
  await notice.getByRole('heading', { name: '把目光放远一点' }).waitFor();
  await notice.screenshot({ path: 'docs/screenshots/rest.png' });
  await notice.getByRole('button', { name: '结束本次休息' }).click();
  assert.equal((await state()).rest, null);
  await widget.getByRole('button', { name: '已喝水', exact: true }).click();
  assert.ok((await state()).remaining.water >= 3_599_000);
  const beforeSkip = (await state()).shutdown.at;
  await widget.getByRole('button', { name: '跳过本次关机' }).click();
  assert.equal((await state()).shutdown.time, value);
  assert.ok((await state()).shutdown.at > beforeSkip);
  await settings.getByRole('checkbox', { name: /每天自动关机/ }).uncheck();
  await settings.getByRole('button', { name: '保存关机设置', exact: true }).click();
  assert.equal((await state()).shutdown.at, null);
  assert.equal((await state()).shutdown.time, null);
  // Check compact layout on smaller Windows work areas without touching screen settings.
  await app.evaluate(({ BrowserWindow }) => {
    const widget = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('view=widget'));
    widget.setResizable(true);
    widget.setSize(312, 560);
    widget.setResizable(false);
  });
  await widget.waitForTimeout(200);
  const small = await widget.evaluate(() => ({ height: innerHeight, footer: document.querySelector('.widget-footer').getBoundingClientRect().bottom }));
  assert.ok(small.height <= 560 && small.footer <= small.height + 1, `小屏布局未通过：${JSON.stringify(small)}`);
  await settings.getByRole('checkbox', { name: /每天自动关机/ }).check();
  await settings.getByRole('button', { name: '保存关机设置', exact: true }).click();
  await widget.getByRole('button', { name: '跳过本次关机' }).waitFor();
  const smallBooked = await widget.evaluate(() => ({ height: innerHeight, footer: document.querySelector('.widget-footer').getBoundingClientRect().bottom,
    cancel: document.querySelector('.shutdown-section button').getBoundingClientRect().bottom }));
  assert.ok(smallBooked.footer <= smallBooked.height + 1 && smallBooked.cancel <= smallBooked.height - 20, `小屏预约布局未通过：${JSON.stringify(smallBooked)}`);
  await widget.screenshot({ path: 'docs/screenshots/widget-compact.png' });
  await widget.getByRole('button', { name: '跳过本次关机' }).click();
  await settings.close();
  assert.ok(await widget.locator('main').isVisible());
  assert.equal((await state()).settings.eyeMinutes, 20);
  const beforeRestart = await state();
  assert.equal(beforeRestart.settings.theme, 'light', '关闭设置前主题必须仍为浅色');
  const profile = await app.evaluate(({ app }) => app.getPath('userData'));
  await app.close();
  app = await electronTest.launch({ ...launchOptions, env: { ...env, XIKE_TEST_PROFILE: profile } });
  const restoredWidget = await find('widget');
  const restored = await restoredWidget.evaluate(() => window.xike.getState());
  console.log('UI: 重启前后外观', beforeRestart.settings.theme, restored.settings.theme, profile);
  assert.equal(restored.settings.theme, 'light');
  assert.equal(restored.shutdown.time, beforeRestart.shutdown.time);
  assert.equal(restored.shutdown.consumedDate, beforeRestart.shutdown.consumedDate);
  assert.equal(restored.shutdown.at, beforeRestart.shutdown.at);
  assert.deepEqual(errors, []);
  console.log('UI PASS: 主题切换、系统主题、毛玻璃回退、每日关机保存/跳过/关闭、退出重启保留计划、暂停/恢复、休息、喝水、小屏布局。');
} catch (error) {
  for (const [index, page] of app.windows().entries()) {
    await page.screenshot({ path: `docs/screenshots/failure-${index}.png` }).catch(() => {});
    console.error(page.url(), (await page.locator('body').innerText().catch(() => '')).slice(0, 2000));
  }
  throw error;
} finally { await app.close(); }
