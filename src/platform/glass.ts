import koffi from 'koffi';
import type { BrowserWindow } from 'electron';
import { join } from 'node:path';

// Keep undocumented Windows 10 interop isolated here; no renderer can call it.
const AccentPolicy = koffi.struct('XikeAccentPolicy', {
  state: 'int32_t', flags: 'uint32_t', color: 'uint32_t', animation: 'uint32_t',
});
const CompositionData = koffi.struct('XikeCompositionData', {
  attribute: 'int32_t', policy: koffi.pointer(AccentPolicy), size: 'size_t',
});
let setComposition: ReturnType<ReturnType<typeof koffi.load>['func']> | undefined;

export function setWindows10Glass(window: BrowserWindow, enabled: boolean, dark: boolean) {
  if (!setComposition) {
    const user32 = koffi.load(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'user32.dll'));
    setComposition = user32.func('int __stdcall SetWindowCompositionAttribute(uintptr_t hwnd, XikeCompositionData *data)');
  }
  const bytes = window.getNativeWindowHandle();
  const hwnd = bytes.length === 8 ? bytes.readBigUInt64LE() : BigInt(bytes.readUInt32LE());
  // ABGR tint, not a whole-window opacity: text remains fully opaque.
  // Blur-behind stays translucent for inactive desktop widgets on Windows 10.
  // Acrylic state 4 can turn opaque when another app owns focus.
  const policy = { state: enabled ? 3 : 0, flags: 0, color: dark ? 0x552b2927 : 0x55f1f5f3, animation: 0 };
  if (!setComposition(hwnd, { attribute: 19, policy, size: koffi.sizeof(AccentPolicy) }))
    throw new Error('Windows 拒绝应用窗口毛玻璃材质');
}
