export const kinds = ['eye', 'water', 'move'] as const;
export type Kind = typeof kinds[number];
export type Theme = 'light' | 'dark' | 'system';
export interface Appearance {
  theme: 'light' | 'dark';
  material: 'solid' | 'acrylic';
  glassAvailable: boolean;
  glassReason: string;
}
export interface Settings {
  theme: Theme;
  glass: boolean;
  eyeMinutes: number;
  waterMinutes: number;
  moveMinutes: number;
  eyeSeconds: number;
  moveSeconds: number;
  idleMinutes: number;
  autoStart: boolean;
  sound: boolean;
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
}
export const defaultSettings: Settings = {
  theme: 'light', glass: true,
  eyeMinutes: 20, waterMinutes: 60, moveMinutes: 50,
  eyeSeconds: 20, moveSeconds: 300, idleMinutes: 2,
  autoStart: false, sound: false, quietEnabled: false,
  quietStart: '22:00', quietEnd: '08:00',
};
export interface StoredData {
  schemaVersion: 2;
  settings: Settings;
  shutdownTime: string | null;
  consumedShutdownDate: string | null;
  position?: { x: number; y: number };
}
export type ShutdownStatus = 'none' | 'scheduled' | 'warning' | 'cancelled' | 'expired' | 'executed' | 'failed';
export interface Snapshot {
  version: string;
  appearance: Appearance;
  settings: Settings;
  remaining: Record<Kind, number>;
  due: Kind[];
  rest: { kind: 'eye' | 'move'; remaining: number } | null;
  pauseReason: string | null;
  manualPaused: boolean;
  shutdown: { at: number | null; time: string | null; consumedDate: string | null; status: ShutdownStatus; remaining: number };
  message: string;
  now: number;
  testMode: boolean;
}
export type Command =
  | { type: 'appearance'; theme: Theme; glass: boolean }
  | { type: 'pause' }
  | { type: 'start'; kind: Kind }
  | { type: 'snooze'; kind: Kind }
  | { type: 'cancel-rest' }
  | { type: 'settings'; settings: Settings }
  | { type: 'schedule'; time: string }
  | { type: 'disable-shutdown' }
  | { type: 'cancel-shutdown' }
  | { type: 'hide-widget' }
  | { type: 'close-notice' }
  | { type: 'reset-position' };
export type Result = { ok: true } | { ok: false; error: string };
export interface DesktopApi {
  getState(): Promise<Snapshot>;
  command(command: Command): Promise<Result>;
  subscribe(listener: (snapshot: Snapshot) => void): () => void;
}
declare global { interface Window { xike: DesktopApi } }
