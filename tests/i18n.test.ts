import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultSettings } from '../src/shared/types';
import { english, translate, formatDate, formatWeekday, isLanguage } from '../src/shared/i18n';
import { validateSettings } from '../src/domain/settings';
import { Engine } from '../src/domain/engine';

test('默认英文，校验只接受内置中英文语言', () => {
  assert.equal(defaultSettings.language, 'en');
  assert.equal(isLanguage('zh-CN'), true); assert.equal(isLanguage('en'), true); assert.equal(isLanguage('fr'), false);
  assert.throws(() => validateSettings({ ...defaultSettings, language: 'fr' }));
});
test('静态界面翻译完整，英文词条非空并保留相同占位符', () => {
  const source = readFileSync(new URL('../src/renderer/main.tsx', import.meta.url), 'utf8');
  for (const match of source.matchAll(/\bt\(\s*(['"])(.*?)\1/g)) {
    const key = match[2];
    if (/[\u3400-\u9fff]/.test(key)) assert.ok(english[key], `Missing translation: ${key}`);
  }
  for (const [key, value] of Object.entries(english)) {
    assert.ok(value.trim());
    assert.deepEqual([...key.matchAll(/\{\w+\}/g)].map(m => m[0]).sort(), [...value.matchAll(/\{\w+\}/g)].map(m => m[0]).sort(), key);
    assert.ok(!/[\u3400-\u9fff]/.test(value), key);
  }
});
test('参数与动态后端消息可正确翻译，日期和星期跟随语言', () => {
  assert.equal(translate('en', '{minutes} 分钟后', { minutes: 50 }), 'In 50 min');
  assert.equal(translate('zh-CN', '{minutes} 分钟后', { minutes: 50 }), '50 分钟后');
  assert.match(translate('en', '每日 23:30 关机已启用，提前 5 分钟提醒'), /23:30/);
  assert.ok(!/[\u3400-\u9fff]/.test(translate('en', 'moveMinutes 需要是 1–240 之间的整数')));
  const date = new Date(2026, 10, 21).getTime();
  assert.equal(formatWeekday('en', date), 'Saturday'); assert.equal(formatWeekday('zh-CN', date), '星期六');
  assert.match(formatDate('en', date), /Nov/); assert.match(formatDate('zh-CN', date), /2026/);
});
test('切换语言不重置提醒计时或每日关机计划', () => {
  const now = Date.now();
  const engine = new Engine({ ...defaultSettings }, { now, monotonic: 0, idleSeconds: 0, locked: false, suspended: false });
  engine.scheduleDaily('23:30', now);
  engine.remaining.eye = 12_345;
  const at = engine.shutdownAt;
  engine.updateSettings({ ...defaultSettings, language: 'zh-CN' });
  assert.equal(engine.remaining.eye, 12_345); assert.equal(engine.shutdownAt, at);
});

test('透明度百分比接受 0–100 整数并拒绝越界值', () => {
  assert.equal(defaultSettings.glassTransparency, 50);
  for (const value of [0, 50, 100]) assert.equal(validateSettings({ ...defaultSettings, glassTransparency: value }).glassTransparency, value);
  for (const value of [-1, 101, 0.5, NaN, '50']) assert.throws(() => validateSettings({ ...defaultSettings, glassTransparency: value }));
});
