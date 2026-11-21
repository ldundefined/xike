import { kinds, type Kind, type Settings, type Snapshot, type ShutdownStatus } from '../shared/types';
import { inQuietHours } from './settings';
import metadata from '../../package.json';
import { isClockTime, localDateKey, nextDailyOccurrence } from './daily-shutdown';

export interface TickInput { now: number; monotonic: number; idleSeconds: number; locked: boolean; suspended: boolean }
export interface Effects { warnShutdown: boolean; executeShutdown: boolean; shutdownChanged: boolean; dueChanged: boolean }
const minute = 60_000;
export const warningMs = 5 * minute;

/** Pure scheduling state. No Electron, filesystem, registry or process side effects. */
export class Engine {
  remaining: Record<Kind, number>;
  due: Kind[] = [];
  rest: { kind: 'eye' | 'move'; remaining: number } | null = null;
  manualPaused = false;
  pauseReason: string | null = null;
  shutdownAt: number | null = null;
  shutdownTime: string | null = null;
  consumedShutdownDate: string | null = null;
  shutdownStatus: ShutdownStatus = 'none';
  message = '';
  private last: TickInput;
  private warned = false;
  constructor(public settings: Settings, initial: TickInput, shutdownAt: number | null = null) {
    this.last = initial;
    this.remaining = { eye: this.interval('eye'), water: this.interval('water'), move: this.interval('move') };
    if (shutdownAt !== null) {
      if (shutdownAt - initial.now >= warningMs) {
        this.shutdownAt = shutdownAt;
        this.shutdownStatus = 'scheduled';
      } else {
        this.shutdownStatus = 'expired';
        this.message = '已取消过期或不足 5 分钟预告时间的关机预约';
      }
    }
  }
  interval(kind: Kind) { return this.settings[`${kind}Minutes`] * minute; }
  updateSettings(settings: Settings) {
    for (const kind of kinds) if (settings[`${kind}Minutes`] !== this.settings[`${kind}Minutes`]) {
      this.remaining[kind] = settings[`${kind}Minutes`] * minute;
      this.due = this.due.filter(k => k !== kind);
    }
    this.settings = settings;
  }
  schedule(at: number, now: number) {
    if (!Number.isFinite(at) || at - now < warningMs || at - now > 30 * 24 * 60 * minute)
      throw new Error('请选择至少 5 分钟后、30 天内的关机时间');
    this.shutdownAt = at;
    this.shutdownStatus = 'scheduled';
    this.warned = false;
    this.message = '已预约关机，提前 5 分钟提醒';
  }
  restoreDaily(time: string | null, consumedDate: string | null, now: number) {
    this.shutdownTime = time;
    this.consumedShutdownDate = consumedDate;
    this.shutdownAt = time ? nextDailyOccurrence(time, now, consumedDate) : null;
    this.shutdownStatus = time ? 'scheduled' : 'none';
    this.warned = false;
  }
  scheduleDaily(time: string, now: number) {
    if (!isClockTime(time)) throw new Error('请选择有效的每日关机时间');
    // Preserve the skip/execution date when saving the same plan again.
    this.restoreDaily(time, time === this.shutdownTime ? this.consumedShutdownDate : null, now);
    this.message = `每日 ${time} 关机已启用，提前 5 分钟提醒`;
  }
  disableDaily() {
    this.shutdownTime = null; this.shutdownAt = null; this.shutdownStatus = 'none'; this.warned = false;
    this.message = '每日关机计划已关闭';
  }
  private consumeOccurrence(now: number) {
    if (this.shutdownTime && this.shutdownAt !== null) {
      const date = localDateKey(this.shutdownAt);
      this.consumedShutdownDate = !this.consumedShutdownDate || date > this.consumedShutdownDate ? date : this.consumedShutdownDate;
      this.shutdownAt = nextDailyOccurrence(this.shutdownTime, now, this.consumedShutdownDate);
      this.warned = false;
    }
  }
  cancelShutdown(status: ShutdownStatus = 'cancelled', now = this.last.now) {
    if (this.shutdownTime) {
      this.consumeOccurrence(now);
      this.shutdownStatus = 'scheduled';
      this.message = status === 'expired' ? '错过本次关机，已安排下一次每日计划' : '已跳过本次关机，每日计划保留';
      return;
    }
    this.shutdownAt = null;
    this.shutdownStatus = status;
    this.warned = false;
    this.message = status === 'expired' ? '已取消错过时间的关机预约，请重新设置' : '已取消本次关机';
  }
  start(kind: Kind) {
    if (kind !== 'water' && this.rest) throw new Error('请先完成或结束当前休息');
    this.due = this.due.filter(k => k !== kind);
    if (kind === 'water') { this.remaining.water = this.interval('water'); this.message = '已记录喝水，保持少量多次'; }
    else {
      this.rest = { kind, remaining: this.settings[kind === 'eye' ? 'eyeSeconds' : 'moveSeconds'] * 1000 };
      this.message = '';
    }
  }
  snooze(kind: Kind) { this.due = this.due.filter(k => k !== kind); this.remaining[kind] = 5 * minute; this.message = '已延后 5 分钟提醒'; }
  cancelRest() {
    if (!this.rest) return;
    const kind = this.rest.kind;
    this.rest = null;
    this.remaining[kind] = this.interval(kind);
    this.message = '本次休息已结束，下次按设置的间隔提醒';
  }
  tick(input: TickInput): Effects {
    const effects: Effects = { warnShutdown: false, executeShutdown: false, shutdownChanged: false, dueChanged: false };
    const wallDelta = input.now - this.last.now;
    const monoDelta = input.monotonic - this.last.monotonic;
    // An event-loop gap or clock change is never treated as normal active time.
    const gap = monoDelta < 0 || monoDelta > 15_000 || wallDelta < 0 || Math.abs(wallDelta - monoDelta) > 5_000;
    const elapsed = gap || input.suspended || this.last.suspended ? 0 : Math.max(0, monoDelta);

    if (this.shutdownAt !== null) {
      const left = this.shutdownAt - input.now;
      if (left <= 0) {
        if (gap || input.suspended || this.last.suspended || !this.warned) this.cancelShutdown('expired', input.now);
        else {
          if (this.shutdownTime) { this.consumeOccurrence(input.now); this.shutdownStatus = 'scheduled'; }
          else { this.shutdownAt = null; this.shutdownStatus = 'executed'; }
          this.message = '已向 Windows 发送关机请求';
          effects.executeShutdown = true;
        }
        effects.shutdownChanged = true;
      } else if (left <= warningMs && !this.warned) {
        // If resume/clock-jump skipped the warning boundary, require a fresh booking.
        if (gap || this.last.suspended || input.suspended) {
          this.cancelShutdown('expired', input.now);
        } else {
          this.warned = true;
          this.shutdownStatus = 'warning';
          effects.warnShutdown = true;
        }
        effects.shutdownChanged = true;
      }
    }

    this.pauseReason = this.manualPaused ? '提醒已暂停' : input.suspended ? '电脑休眠中' : input.locked ? '锁屏中'
      : inQuietHours(input.now, this.settings) ? '免打扰时段'
      : input.idleSeconds >= this.settings.idleMinutes * 60 ? '离开电脑，计时暂停' : null;
    if (this.rest) {
      this.rest.remaining = Math.max(0, this.rest.remaining - elapsed);
      if (this.rest.remaining === 0) {
        const kind = this.rest.kind;
        this.rest = null;
        this.remaining[kind] = this.interval(kind);
        this.message = kind === 'eye' ? '护眼休息完成，欢迎回来' : '活动完成，继续保持好状态';
      }
    } else if (!this.pauseReason && !this.last.locked && !this.last.suspended &&
        this.last.idleSeconds < this.settings.idleMinutes * 60 && !inQuietHours(this.last.now, this.settings)) {
      for (const kind of kinds) {
        if (this.due.includes(kind)) continue;
        this.remaining[kind] = Math.max(0, this.remaining[kind] - elapsed);
        if (this.remaining[kind] === 0) { this.due.push(kind); effects.dueChanged = true; }
      }
    }
    this.last = input;
    return effects;
  }
  snapshot(now: number, testMode = false): Omit<Snapshot, 'appearance'> {
    return {
      version: metadata.version, settings: { ...this.settings }, remaining: { ...this.remaining }, due: [...this.due],
      rest: this.rest ? { ...this.rest } : null, pauseReason: this.pauseReason, manualPaused: this.manualPaused,
      shutdown: { at: this.shutdownAt, time: this.shutdownTime, consumedDate: this.consumedShutdownDate, status: this.shutdownStatus, remaining: Math.max(0, (this.shutdownAt ?? now) - now) },
      message: this.message, now, testMode,
    };
  }
}
