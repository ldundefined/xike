import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine, type TickInput } from '../src/domain/engine';
import { defaultSettings, type Settings } from '../src/shared/types';
import { validateSettings, inQuietHours } from '../src/domain/settings';

const epoch = new Date(2026, 10, 20, 10, 0).getTime();
function harness(settings: Partial<Settings> = {}, at: number | null = null) {
  let input: TickInput = { now: epoch, monotonic: 0, idleSeconds: 0, locked: false, suspended: false };
  const engine = new Engine({ ...defaultSettings, ...settings }, input, at);
  const step = (ms = 1000, values: Partial<TickInput> = {}) => {
    input = { ...input, now: input.now + ms, monotonic: input.monotonic + ms, ...values };
    return engine.tick(input);
  };
  const advance = (ms: number) => { for (let i = 0; i < ms; i += 1000) step(Math.min(1000, ms - i)); };
  return { engine, step, advance, now: () => input.now };
}

test('健康提醒按使用时长触发，多项同时到期不重复入队', () => {
  const h = harness({ eyeMinutes: 1, waterMinutes: 1, moveMinutes: 1 });
  h.advance(60_000);
  assert.deepEqual(h.engine.due, ['eye', 'water', 'move']);
  h.advance(60_000);
  assert.deepEqual(h.engine.due, ['eye', 'water', 'move']);
});
test('手动暂停、锁屏和离开电脑都停止累计，恢复后不补发', () => {
  const h = harness(); h.advance(10_000);
  const left = h.engine.remaining.eye;
  h.engine.manualPaused = true; h.advance(60_000);
  assert.equal(h.engine.remaining.eye, left);
  h.engine.manualPaused = false;
  h.step(1000, { locked: true }); h.advance(60_000);
  assert.equal(h.engine.remaining.eye, left);
  h.step(1000, { locked: false, idleSeconds: 180 }); h.advance(60_000);
  assert.equal(h.engine.remaining.eye, left);
  h.step(1000, { idleSeconds: 0 }); h.advance(5000);
  assert.equal(h.engine.remaining.eye, left - 5000);
});
test('休眠和长时间事件循环停顿不算使用时间', () => {
  const h = harness(); h.advance(5000); const left = h.engine.remaining.eye;
  h.step(1000, { suspended: true }); h.step(3_600_000); h.step(1000, { suspended: false });
  assert.equal(h.engine.remaining.eye, left);
  h.step(60_000); assert.equal(h.engine.remaining.eye, left);
});
test('休息期间暂停其他计时，完成后恢复本类型间隔', () => {
  const h = harness(); h.advance(10_000); const water = h.engine.remaining.water;
  h.engine.start('eye'); h.advance(20_000);
  assert.equal(h.engine.rest, null);
  assert.equal(h.engine.remaining.eye, 20 * 60_000);
  assert.equal(h.engine.remaining.water, water);
  h.advance(1000); assert.equal(h.engine.remaining.water, water - 1000);
});
test('稍后提醒与结束休息都延后五分钟，不标记完成', () => {
  const h = harness({ eyeMinutes: 1 }); h.advance(60_000);
  h.engine.snooze('eye'); assert.equal(h.engine.remaining.eye, 300_000); assert.equal(h.engine.due.length, 0);
  h.engine.start('move'); h.engine.cancelRest();
  assert.equal(h.engine.rest, null); assert.equal(h.engine.remaining.move, 300_000);
});
test('喝水确认只重置喝水计时，不能叠加两次休息', () => {
  const h = harness(); h.advance(5000); h.engine.start('eye');
  assert.throws(() => h.engine.start('move'));
  h.engine.start('water'); assert.equal(h.engine.remaining.water, 3_600_000); assert.equal(h.engine.rest?.kind, 'eye');
});
test('修改一个提醒间隔只重置对应类型', () => {
  const h = harness(); h.advance(10_000); const eye = h.engine.remaining.eye;
  h.engine.updateSettings({ ...h.engine.settings, waterMinutes: 30 });
  assert.equal(h.engine.remaining.water, 30 * 60_000); assert.equal(h.engine.remaining.eye, eye);
});
test('预约关机至少五分钟且不允许无效数值', () => {
  const h = harness();
  for (const at of [NaN, Infinity, epoch, epoch + 299_999, epoch + 31 * 86_400_000]) assert.throws(() => h.engine.schedule(at, epoch));
  h.engine.schedule(epoch + 300_000, epoch); assert.equal(h.engine.shutdownStatus, 'scheduled');
});
test('关机提前五分钟提醒且只执行一次，不受健康提醒暂停影响', () => {
  const h = harness(); h.engine.schedule(epoch + 600_000, epoch); h.engine.manualPaused = true;
  let warnings = 0, executions = 0;
  for (let i = 0; i < 660; i++) {
    const effects = h.step();
    if (effects.warnShutdown) { warnings++; assert.equal(h.now(), epoch + 300_000); }
    if (effects.executeShutdown) executions++;
  }
  assert.equal(warnings, 1); assert.equal(executions, 1); assert.equal(h.engine.shutdownAt, null);
});
test('提前提醒后取消不会执行关机', () => {
  const h = harness(); h.engine.schedule(epoch + 600_000, epoch); h.advance(300_000);
  assert.equal(h.engine.shutdownStatus, 'warning'); h.engine.cancelShutdown();
  for (let i = 0; i < 400; i++) assert.equal(h.step().executeShutdown, false);
  assert.equal(h.engine.shutdownStatus, 'cancelled');
});
test('休眠跨过关机时间后自动过期，已显示过预告也不补执行', () => {
  const h = harness(); h.engine.schedule(epoch + 600_000, epoch); h.advance(300_000);
  h.step(1000, { suspended: true });
  const effect = h.step(600_000, { suspended: false });
  assert.equal(effect.executeShutdown, false); assert.equal(h.engine.shutdownStatus, 'expired');
});
test('休眠跨过预告时间后返回，不足完整预告时间则取消', () => {
  const h = harness(); h.engine.schedule(epoch + 600_000, epoch);
  h.step(1000, { suspended: true }); h.step(400_000, { suspended: false });
  assert.equal(h.engine.shutdownStatus, 'expired');
});
test('启动时清除过期预约以及不足五分钟的预约', () => {
  for (const at of [epoch - 1000, epoch + 299_000]) {
    const h = harness({}, at); assert.equal(h.engine.shutdownAt, null); assert.equal(h.engine.shutdownStatus, 'expired');
  }
  assert.equal(harness({}, epoch + 600_000).engine.shutdownStatus, 'scheduled');
});
test('系统时钟跳变不得触发突发关机', () => {
  const h = harness(); h.engine.schedule(epoch + 600_000, epoch); h.advance(300_000);
  const effects = h.step(1000, { now: epoch + 700_000 });
  assert.equal(effects.executeShutdown, false); assert.equal(h.engine.shutdownStatus, 'expired');
});
test('跨午夜预约按完整日期执行', () => {
  const initial = new Date(2026, 10, 20, 23, 58).getTime();
  const engine = new Engine({ ...defaultSettings }, { now: initial, monotonic: 0, idleSeconds: 0, locked: false, suspended: false });
  engine.schedule(initial + 600_000, initial); let executed = false;
  for (let i = 1; i <= 600; i++) executed ||= engine.tick({ now: initial + i * 1000, monotonic: i * 1000, idleSeconds: 0, locked: false, suspended: false }).executeShutdown;
  assert.equal(executed, true);
});
test('免打扰支持跨午夜与日内区间，边界准确', () => {
  const s = { ...defaultSettings, quietEnabled: true };
  const at = (hour: number, minute = 0) => new Date(2026, 10, 20, hour, minute).getTime();
  assert.equal(inQuietHours(at(22), s), true); assert.equal(inQuietHours(at(7, 59), s), true);
  assert.equal(inQuietHours(at(8), s), false); assert.equal(inQuietHours(at(12), s), false);
  s.quietStart = '09:00'; s.quietEnd = '12:00';
  assert.equal(inQuietHours(at(10), s), true); assert.equal(inQuietHours(at(12), s), false);
});
test('配置拒绝非法间隔、开关和时段', () => {
  assert.deepEqual(validateSettings(defaultSettings), defaultSettings);
  for (const patch of [{ eyeMinutes: 0 }, { waterMinutes: 1.2 }, { autoStart: 'true' }, { quietStart: '24:01' },
    { quietEnabled: true, quietStart: '08:00', quietEnd: '08:00' }, { eyeSeconds: NaN }])
    assert.throws(() => validateSettings({ ...defaultSettings, ...patch }));
});
