import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAppearance, supportsAcrylic, supportsSystemBackdrop, type AppearanceEnvironment } from '../src/domain/appearance';
import { validateSettings } from '../src/domain/settings';
import { defaultSettings } from '../src/shared/types';

const env: AppearanceEnvironment = { platform: 'win32', release: '10.0.22621', systemDark: false, highContrast: false, reducedTransparency: false };
test('主题支持浅色、深色及跟随系统，默认浅色', () => {
  assert.equal(resolveAppearance(defaultSettings, env).theme, 'light');
  assert.equal(resolveAppearance({ ...defaultSettings, theme: 'dark' }, env).theme, 'dark');
  assert.equal(resolveAppearance({ ...defaultSettings, theme: 'system' }, { ...env, systemDark: true }).theme, 'dark');
  assert.equal(resolveAppearance({ ...defaultSettings, theme: 'system' }, env).theme, 'light');
});
test('Windows 10 使用合成接口，Windows 11 新版本使用系统材质', () => {
  assert.equal(supportsAcrylic('win32', '10.0.19045'), true);
  assert.equal(supportsAcrylic('win32', '10.0.22000'), true);
  assert.equal(supportsAcrylic('win32', '10.0.17134'), true);
  assert.equal(supportsAcrylic('win32', '10.0.16299'), false);
  assert.equal(supportsSystemBackdrop('win32', '10.0.19045'), false);
  assert.equal(supportsSystemBackdrop('win32', '10.0.22621'), true);
  assert.equal(supportsAcrylic('win32', '10.0.22621'), true);
  assert.equal(supportsAcrylic('win32', '10.0.26100'), true);
  assert.equal(supportsAcrylic('linux', '10.0.26100'), false);
  assert.equal(supportsAcrylic('win32', 'invalid'), false);
  assert.equal(resolveAppearance(defaultSettings, env).material, 'acrylic');
  assert.equal(resolveAppearance({ ...defaultSettings, glass: false }, env).material, 'solid');
});
test('旧系统、无障碍偏好和原生调用失败自动回退', () => {
  for (const override of [{ release: '10.0.16299' }, { highContrast: true }, { reducedTransparency: true }, { nativeFailed: true }]) {
    const result = resolveAppearance(defaultSettings, { ...env, ...override });
    assert.equal(result.material, 'solid'); assert.equal(result.glassAvailable, false); assert.ok(result.glassReason);
  }
});
test('拒绝非法主题及毛玻璃开关', () => {
  assert.throws(() => validateSettings({ ...defaultSettings, theme: 'purple' }));
  assert.throws(() => validateSettings({ ...defaultSettings, glass: 'true' }));
});
