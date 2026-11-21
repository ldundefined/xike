import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/domain/engine';
import { localDateKey, nextDailyOccurrence } from '../src/domain/daily-shutdown';
import { defaultSettings } from '../src/shared/types';

const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime();
function create(now = at(21, 23, 20)) {
  const engine = new Engine({ ...defaultSettings }, { now, monotonic: 0, idleSeconds: 0, locked: false, suspended: false });
  return engine;
}
test('每日固定时间不足五分钟或已错过时安排明天', () => {
  assert.equal(nextDailyOccurrence('23:30', at(21, 23, 20), null), at(21, 23, 30));
  assert.equal(nextDailyOccurrence('23:30', at(21, 23, 25), null), at(21, 23, 30));
  assert.equal(nextDailyOccurrence('23:30', at(21, 23, 26), null), at(22, 23, 30));
  assert.equal(nextDailyOccurrence('23:30', at(21, 23, 40), null), at(22, 23, 30));
  assert.throws(() => nextDailyOccurrence('24:30', at(21, 23), null));
});
test('每日计划执行一次后自动安排下一天，提前五分钟提醒', () => {
  const start = at(21, 23, 20), engine = create(start);
  engine.scheduleDaily('23:30', start); let warnings = 0, executions = 0;
  for (let i = 1; i <= 601; i++) {
    const effect = engine.tick({ now: start + i * 1000, monotonic: i * 1000, idleSeconds: 0, locked: false, suspended: false });
    if (effect.warnShutdown) { warnings++; assert.equal(start + i * 1000, at(21, 23, 25)); }
    if (effect.executeShutdown) executions++;
  }
  assert.equal(warnings, 1); assert.equal(executions, 1);
  assert.equal(engine.shutdownTime, '23:30'); assert.equal(engine.shutdownAt, at(22, 23, 30));
  assert.equal(engine.consumedShutdownDate, '2026-11-21');
});
test('跳过本次保留每日计划，重启或重复保存不恢复已跳过的一次', () => {
  const start = at(21, 23, 20), engine = create(start);
  engine.scheduleDaily('23:30', start); engine.cancelShutdown();
  assert.equal(engine.shutdownAt, at(22, 23, 30)); assert.equal(engine.shutdownTime, '23:30');
  const restored = create(start);
  restored.restoreDaily(engine.shutdownTime, engine.consumedShutdownDate, start);
  assert.equal(restored.shutdownAt, at(22, 23, 30));
  restored.scheduleDaily('23:30', start); assert.equal(restored.shutdownAt, at(22, 23, 30));
  restored.scheduleDaily('23:45', start); assert.equal(restored.shutdownAt, at(21, 23, 45));
});
test('已执行日期可持久化，回拨时钟不重复执行同一天', () => {
  const engine = create(at(21, 22));
  engine.restoreDaily('23:30', '2026-11-22', at(21, 22));
  assert.equal(engine.shutdownAt, at(23, 23, 30));
});
test('休眠错过时只跳过本次，恢复后保留下一日计划', () => {
  const start = at(21, 23, 20), engine = create(start);
  engine.scheduleDaily('23:30', start);
  engine.tick({ now: start + 1000, monotonic: 1000, idleSeconds: 0, locked: false, suspended: true });
  const effect = engine.tick({ now: at(22, 8), monotonic: 9 * 3_600_000, idleSeconds: 0, locked: false, suspended: false });
  assert.equal(effect.executeShutdown, false); assert.equal(engine.shutdownAt, at(22, 23, 30));
  assert.equal(engine.shutdownTime, '23:30');
});
test('每日关机可彻底关闭，跨月使用当地日历日期', () => {
  const engine = create(); engine.scheduleDaily('23:30', at(21, 23, 20)); engine.disableDaily();
  assert.equal(engine.shutdownAt, null); assert.equal(engine.shutdownTime, null);
  const next = nextDailyOccurrence('00:05', new Date(2026, 10, 30, 23, 59).getTime(), null);
  assert.equal(localDateKey(next), '2026-12-01'); assert.equal(new Date(next).getHours(), 0);
});
