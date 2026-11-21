import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/storage/store';

test('配置、预约和位置可原子写入并恢复', () => {
  const directory = mkdtempSync(join(tmpdir(), 'xike-store-'));
  try {
    const store = new Store(directory), data = store.load();
    data.settings.eyeMinutes = 30; data.shutdownTime = '23:30'; data.consumedShutdownDate = '2026-11-21'; data.position = { x: -300, y: 100 };
    store.save(data); assert.deepEqual(new Store(directory).load(), data);
    assert.equal(readdirSync(directory).includes('settings.json.tmp'), false);
  } finally { rmSync(directory, { recursive: true }); }
});
test('损坏配置和未知版本会备份并清除关机预约', () => {
  for (const content of ['{invalid', '{"schemaVersion":99,"shutdownAt":123}']) {
    const directory = mkdtempSync(join(tmpdir(), 'xike-store-'));
    try {
      const store = new Store(directory); writeFileSync(store.path, content);
      const data = store.load(); assert.equal(data.shutdownTime, null); assert.equal(data.settings.eyeMinutes, 20);
      const backup = readdirSync(directory).find(name => name.includes('.invalid-'))!;
      assert.equal(readFileSync(join(directory, backup), 'utf8'), content); assert.ok(store.warning);
    } finally { rmSync(directory, { recursive: true }); }
  }
});

test('旧配置迁移保留提醒和位置，补充主题但不把单次预约转成每日计划', () => {
  const directory = mkdtempSync(join(tmpdir(), 'xike-store-'));
  try {
    const store = new Store(directory), data = store.load();
    const { theme, glass, ...legacySettings } = data.settings;
    legacySettings.eyeMinutes = 35;
    writeFileSync(store.path, JSON.stringify({ schemaVersion: 1, settings: legacySettings, shutdownAt: Date.now() + 900_000, position: { x: 12, y: 30 } }));
    const migrated = store.load();
    assert.equal(migrated.schemaVersion, 2); assert.equal(migrated.settings.theme, 'light'); assert.equal(migrated.settings.glass, true);
    assert.equal(migrated.settings.eyeMinutes, 35); assert.deepEqual(migrated.position, { x: 12, y: 30 });
    assert.equal(migrated.shutdownTime, null); assert.equal(store.warning, '');
  } finally { rmSync(directory, { recursive: true }); }
});
