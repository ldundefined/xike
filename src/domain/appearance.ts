import type { Appearance, Settings } from '../shared/types';

export interface AppearanceEnvironment {
  platform: string;
  release: string;
  systemDark: boolean;
  highContrast: boolean;
  reducedTransparency: boolean;
  nativeFailed?: boolean;
}

/** Windows 10 1803+ via composition attributes; Windows 11 22H2+ via DWM. */
export function supportsAcrylic(platform: string, release: string): boolean {
  const [major, , build] = release.split('.').map(Number);
  return platform === 'win32' && (major > 10 || (major === 10 && build >= 17134));
}
export function supportsSystemBackdrop(platform: string, release: string): boolean {
  const [major, , build] = release.split('.').map(Number);
  return platform === 'win32' && (major > 10 || (major === 10 && build >= 22621));
}

export function resolveAppearance(settings: Settings, env: AppearanceEnvironment): Appearance {
  const theme = settings.theme === 'system' ? env.systemDark ? 'dark' : 'light' : settings.theme;
  const glassReason = !supportsAcrylic(env.platform, env.release) ? '原生毛玻璃需要 Windows 10 1803 或更新版本，当前使用实色背景。'
    : env.highContrast ? '系统高对比度模式下使用实色背景，以保持清晰。'
    : env.reducedTransparency ? '系统已关闭透明效果，当前使用实色背景。'
    : env.nativeFailed ? '系统背景材质暂不可用，已回退为实色背景。' : '';
  const glassAvailable = glassReason === '';
  return { theme, material: settings.glass && glassAvailable ? 'acrylic' : 'solid', glassAvailable, glassReason };
}
