import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultSettings, type StoredData } from '../shared/types';
import { validateSettings } from '../domain/settings';
import { isClockTime } from '../domain/daily-shutdown';

export class Store {
  readonly path: string;
  warning = '';
  constructor(directory: string) { mkdirSync(directory, { recursive: true }); this.path = join(directory, 'settings.json'); }
  load(): StoredData {
    const fallback: StoredData = { schemaVersion: 2, settings: { ...defaultSettings }, shutdownTime: null, consumedShutdownDate: null };
    if (!existsSync(this.path)) return fallback;
    try {
      const raw = JSON.parse(readFileSync(this.path, 'utf8'));
      if (raw.schemaVersion !== 1 && raw.schemaVersion !== 2) throw new Error('未知的配置版本');
      // V0.1.x configs have no appearance fields. Add only the new defaults;
      // existing invalid reminder fields must still fail validation.
      const settings = validateSettings({ language: defaultSettings.language, theme: defaultSettings.theme, glass: defaultSettings.glass, glassTransparency: defaultSettings.glassTransparency, remindersOnTop: defaultSettings.remindersOnTop, ...raw.settings });
      // Never silently convert an old one-off booking into a recurring plan.
      const time = raw.schemaVersion === 1 ? null : raw.shutdownTime;
      const consumedDate = raw.schemaVersion === 1 ? null : raw.consumedShutdownDate;
      if (time !== null && !isClockTime(time)) throw new Error('每日关机时间无效');
      if (consumedDate !== null && (typeof consumedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(consumedDate) || !Number.isFinite(new Date(`${consumedDate}T12:00:00`).getTime()))) throw new Error('关机执行日期无效');
      const position = raw.position && Number.isFinite(raw.position.x) && Number.isFinite(raw.position.y)
        ? { x: Math.round(raw.position.x), y: Math.round(raw.position.y) } : undefined;
      return { schemaVersion: 2, settings, shutdownTime: time, consumedShutdownDate: consumedDate, position };
    } catch {
      copyFileSync(this.path, `${this.path}.invalid-${Date.now()}`);
      this.warning = '配置读取失败，已备份原文件并恢复默认设置；关机预约已清除';
      return fallback;
    }
  }
  save(data: StoredData) {
    const temp = `${this.path}.tmp`;
    writeFileSync(temp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
    renameSync(temp, this.path);
  }
}
