import { defaultSettings, type Settings } from '../shared/types';
import { isLanguage } from '../shared/i18n';

export function validateSettings(input: unknown): Settings {
  if (!input || typeof input !== 'object') throw new Error('设置格式无效');
  const value = input as Record<string, unknown>;
  const result = { ...defaultSettings };
  if (!isLanguage(value.language)) throw new Error('请选择有效的界面语言');
  result.language = value.language;
  if (!['light', 'dark', 'system'].includes(value.theme as string)) throw new Error('请选择有效的界面主题');
  result.theme = value.theme as Settings['theme'];
  for (const [key, min, max] of [
    ['eyeMinutes', 1, 240], ['waterMinutes', 1, 240], ['moveMinutes', 1, 240],
    ['eyeSeconds', 10, 300], ['moveSeconds', 30, 1800], ['idleMinutes', 1, 30],
    ['glassTransparency', 0, 100],
  ] as const) {
    const n = value[key];
    if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max)
      throw new Error(`${key} 需要是 ${min}–${max} 之间的整数`);
    result[key] = n;
  }
  for (const key of ['autoStart', 'sound', 'quietEnabled', 'glass'] as const) {
    if (typeof value[key] !== 'boolean') throw new Error('开关设置无效');
    result[key] = value[key];
  }
  for (const key of ['quietStart', 'quietEnd'] as const) {
    if (typeof value[key] !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value[key]))
      throw new Error('请输入有效的时段');
    result[key] = value[key];
  }
  if (result.quietEnabled && result.quietStart === result.quietEnd)
    throw new Error('免打扰开始和结束时间不能相同');
  return result;
}

export function inQuietHours(now: number, settings: Settings): boolean {
  if (!settings.quietEnabled) return false;
  const date = new Date(now);
  const minute = date.getHours() * 60 + date.getMinutes();
  const parse = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const start = parse(settings.quietStart), end = parse(settings.quietEnd);
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}
