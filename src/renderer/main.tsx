import React, { useEffect, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Eye, CupSoda, PersonStanding, Power, Leaf, Check, X, Bell, Timer, ShieldCheck, ArrowUpRight, Moon, Sun, Palette, Monitor, GripHorizontal } from 'lucide-react';
import type { Command, Kind, Settings, Snapshot } from '../shared/types';
import './style.css';
import './themes.css';

const labels: Record<Kind, string> = { eye: '护眼休息', water: '喝水提醒', move: '起身活动' };
const icons = { eye: Eye, water: CupSoda, move: PersonStanding };
const clock = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
const time = (at: number) => new Date(at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
const dateTime = (at: number) => `${new Date(at).getMonth() + 1}月${new Date(at).getDate()}日 ${time(at)}`;

function App() {
  const [state, setState] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const view = new URLSearchParams(location.search).get('view') ?? 'widget';
  useEffect(() => {
    const off = window.xike.subscribe(setState);
    void window.xike.getState().then(setState).catch(() => setError('无法连接息刻后台，请重新启动软件'));
    return off;
  }, []);
  useLayoutEffect(() => {
    if (!state) return;
    document.documentElement.dataset.theme = state.appearance.theme;
    document.documentElement.dataset.material = view === 'settings' ? 'solid' : state.appearance.material;
    document.documentElement.dataset.view = view;
  }, [state?.appearance.theme, state?.appearance.material]);
  const send = async (command: Command) => {
    try {
      const result = await window.xike.command(command);
      setError(result.ok ? '' : result.error);
      return result.ok;
    } catch { setError('操作未完成，请重试'); return false; }
  };
  if (!state) return <div className="loading"><Leaf size={32} /><span>{error || '息刻正在准备…'}</span></div>;
  return <>
    {view === 'settings' ? <SettingsView state={state} send={send} /> : view === 'notice'
      ? <Notice state={state} send={send} /> : <Widget state={state} send={send} />}
    {error && <div className="error-toast" role="alert">{error}<button aria-label="关闭错误提示" onClick={() => setError('')}><X size={14} /></button></div>}
  </>;
}
type ViewProps = { state: Snapshot; send(command: Command): Promise<boolean> };

function Widget({ state, send }: ViewProps) {
  const rest = state.rest;
  const eyeRest = rest?.kind === 'eye';
  const ratio = Math.min(1, Math.max(0, 1 - state.remaining.eye / (state.settings.eyeMinutes * 60_000)));
  const next = (kind: Kind) => state.due.includes(kind) ? '该休息了' : `${Math.ceil(state.remaining[kind] / 60_000)} 分钟后`;
  const active = state.shutdown.at !== null;
  const wallDate = new Date(state.now);
  return <main className="widget">
    <section className="widget-clock drag" aria-label="当前日期和时间">
      <time className="wall-time" dateTime={wallDate.toISOString()}>{time(state.now)}<span className="wall-seconds">:{String(wallDate.getSeconds()).padStart(2, '0')}</span></time>
      <div className="wall-calendar"><span className="wall-date">{wallDate.getFullYear()}年{wallDate.getMonth() + 1}月{wallDate.getDate()}日</span><span className="wall-weekday">{wallDate.toLocaleDateString('zh-CN', { weekday: 'long' })}</span></div>
    </section>
    <header className="widget-header drag">
      <div className="brand"><Leaf size={23} fill="currentColor" /><span>息刻</span></div>
      <button className={'status no-drag ' + (state.pauseReason ? 'muted' : '')} onClick={() => void send({ type: 'pause' })}
        title={state.manualPaused ? '恢复健康提醒' : '暂停健康提醒'}>
        <i />{state.manualPaused ? '已暂停' : state.pauseReason ? '待机中' : rest ? '休息中' : '运行中'}
      </button>
    </header>
    <section className="eye-section">
      <div className="section-label"><Eye size={21} />{eyeRest ? '正在护眼休息' : '下次护眼休息'}</div>
      <div className={'big-countdown ' + (eyeRest ? 'mint' : '')}>{clock(eyeRest ? rest.remaining : state.remaining.eye)}</div>
      <p className="description">远眺 6 米外 · {state.settings.eyeSeconds} 秒</p>
      <div className="progress"><span style={{ width: `${ratio * 100}%` }} /></div>
      <button className="primary wide" disabled={!!rest} onClick={() => void send({ type: 'start', kind: 'eye' })}>
        {eyeRest ? '让眼睛放松一下' : rest ? '正在起身活动' : '现在休息'}
      </button>
    </section>
    <section className="compact-section">
      <div className="section-label"><CupSoda size={21} />喝水提醒</div>
      <div className="inline-row"><strong className="next-time">{next('water')}</strong>
        <button className="outline small" onClick={() => void send({ type: 'start', kind: 'water' })}>已喝水</button></div>
      <p className="description indent">少量多次</p>
    </section>
    <section className="compact-section">
      <div className="section-label"><PersonStanding size={21} />起身活动</div>
      <div className="inline-row"><strong className="next-time">{rest?.kind === 'move' ? clock(rest.remaining) : next('move')}</strong>
        <button className="outline small" disabled={!!rest} onClick={() => void send({ type: 'start', kind: 'move' })}>{rest?.kind === 'move' ? '活动中' : '开始活动'}</button></div>
      <p className="description indent">起来走走 · {Math.round(state.settings.moveSeconds / 60 * 10) / 10} 分钟</p>
    </section>
    <section className={'shutdown-section ' + (state.shutdown.status === 'warning' ? 'warning-active' : '')}>
      <div className="section-label"><Power size={21} className="amber" />每日关机</div>
      <div className="shutdown-time-row"><strong className={'shutdown-time ' + (!active ? 'inactive' : '')}>{active ? time(state.shutdown.at!) : '未启用'}</strong>
        {active && <span className="badge amber">{state.shutdown.status === 'warning' ? '即将关机' : '每天'}</span>}</div>
      <p className="description">{active ? state.shutdown.status === 'warning' ? `还剩 ${clock(state.shutdown.remaining)} · 请保存文件`
        : `下次 ${dateTime(state.shutdown.at!)}` : '启用后提前 5 分钟提醒'}</p>
      {active && <button className="outline wide" onClick={() => void send({ type: 'cancel-shutdown' })}>跳过本次关机</button>}
    </section>
    <footer className="widget-footer" title={state.message || undefined}>
      {state.testMode ? '预览模式 · 不执行真实关机' : state.pauseReason || '离开电脑自动暂停'}
      <GripHorizontal size={15} className="drag" />
    </footer>
  </main>;
}

function SettingsView({ state, send }: ViewProps) {
  const [draft, setDraft] = useState<Settings>({ ...state.settings });
  const [dailyTime, setDailyTime] = useState(state.shutdown.time ?? '23:30');
  const [dailyEnabled, setDailyEnabled] = useState(!!state.shutdown.time);
  const [dailyFeedback, setDailyFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [appearanceBusy, setAppearanceBusy] = useState(false);
  const [appearanceFeedback, setAppearanceFeedback] = useState('');
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => { setDraft(current => ({ ...current, [key]: value })); setFeedback(''); };
  const applyAppearance = async (theme: Settings['theme'], glass: boolean) => {
    setAppearanceBusy(true);
    const ok = await send({ type: 'appearance', theme, glass });
    if (ok) setDraft(current => ({ ...current, theme, glass }));
    setAppearanceFeedback(ok ? '外观已应用并保存' : '应用失败，请重试');
    setAppearanceBusy(false);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    const okay = await send({ type: 'settings', settings: draft });
    setFeedback(okay ? '设置已保存' : '保存失败，请检查输入'); setBusy(false);
  };
  const numeric = (label: string, key: 'eyeMinutes' | 'waterMinutes' | 'moveMinutes' | 'eyeSeconds' | 'moveSeconds' | 'idleMinutes', unit: string, min: number, max: number) =>
    <label className="number-field" key={key}><span>{label}</span><div><input aria-label={label} type="number" min={min} max={max} required value={Number.isNaN(draft[key]) ? '' : draft[key]} onChange={e => set(key, e.target.valueAsNumber)} /><span>{unit}</span></div></label>;
  return <main className="settings-view">
    <header className="settings-header"><div className="brand"><Leaf size={25} fill="currentColor" /><span>息刻</span><span className="version">V{state.version}</span></div>
      <h1>找到舒服的节奏</h1><p>提醒轻一点，照顾自己多一点。</p></header>
    {state.testMode && <div className="test-banner"><ShieldCheck size={16} />预览模式：关机、自启均为模拟操作</div>}
    <form onSubmit={save}>
      <section className="settings-card appearance-settings"><div className="card-heading"><Palette size={19} /><h2>外观与主题</h2></div>
        <p className="card-caption">点击即切换，自动保存；无需点击下方的保存设置。</p>
        <div className="theme-options" role="radiogroup" aria-label="界面主题">
          {([{ value: 'light', label: '浅色', Icon: Sun }, { value: 'dark', label: '深色', Icon: Moon }, { value: 'system', label: '跟随系统', Icon: Monitor }] as const).map(({ value, label, Icon }) =>
            <button type="button" role="radio" aria-label={label} aria-checked={draft.theme === value} data-theme-choice={value} key={value} disabled={appearanceBusy} onClick={() => void applyAppearance(value, draft.glass)} className={'theme-option ' + (draft.theme === value ? 'selected' : '')}>
              <span className={'theme-swatch swatch-' + value}><Icon size={20} /><i /><i /></span><span>{label}</span>
            </button>)}
        </div>
        <Toggle label="原生毛玻璃" description="Windows 10 / 11 桌面组件与提醒背景模糊，即时生效" disabled={appearanceBusy} checked={draft.glass} change={v => void applyAppearance(draft.theme, v)} />
        <p className="material-note">{state.appearance.glassAvailable ? (state.appearance.material === 'acrylic' ? '原生毛玻璃已开启，文字保持清晰。' : '已使用实色背景，可随时开启毛玻璃。') : state.appearance.glassReason}</p>
        <p className="appearance-feedback" role="status">{appearanceBusy ? '正在应用…' : appearanceFeedback}</p>
      </section>
      <section className="settings-card reminders-settings"><div className="card-heading"><Bell size={19} /><h2>提醒节奏</h2></div>
        <p className="card-caption">按实际使用电脑的时长累计；修改间隔后，对应计时重新开始。</p>
        <div className="reminder-groups">
          <fieldset className="reminder-group">
            <legend><Eye size={17} />护眼休息</legend>
            <p className="reminder-group-caption">定期看向远处，让眼睛放松一下。</p>
            <div className="reminder-fields">
              {numeric('护眼间隔', 'eyeMinutes', '分钟', 1, 240)}
              {numeric('远眺时长', 'eyeSeconds', '秒', 10, 300)}
            </div>
          </fieldset>
          <fieldset className="reminder-group">
            <legend><CupSoda size={17} />喝水提醒</legend>
            <p className="reminder-group-caption">少量多次，按自己的需要补充水分。</p>
            <div className="reminder-fields single-field">
              {numeric('喝水间隔', 'waterMinutes', '分钟', 1, 240)}
            </div>
          </fieldset>
          <fieldset className="reminder-group">
            <legend><PersonStanding size={17} />起身活动</legend>
            <p className="reminder-group-caption">间隔决定多久提醒一次，时长决定每次活动多久。</p>
            <div className="reminder-fields">
              {numeric('活动间隔', 'moveMinutes', '分钟', 1, 240)}
              {numeric('活动时长', 'moveSeconds', '秒', 30, 1800)}
            </div>
          </fieldset>
        </div>
        <div className="reminder-common">
          <div className="reminder-common-heading"><Timer size={16} /><span>通用计时设置</span></div>
          {numeric('无操作后暂停', 'idleMinutes', '分钟', 1, 30)}
          <p className="fine-print">离开电脑后，三类提醒一起暂停。修改完成后点击下方“保存设置”。</p>
        </div>
      </section>
      <section className="settings-card"><div className="card-heading"><Moon size={19} /><h2>免打扰与偏好</h2></div>
        <Toggle label="开机自动启动" description="登录 Windows 后启动息刻并显示桌面组件" checked={draft.autoStart} change={v => set('autoStart', v)} />
        <Toggle label="提醒提示音" description="健康提醒和关机前提醒时播放系统提示音" checked={draft.sound} change={v => set('sound', v)} />
        <Toggle label="定时免打扰" description="暂停健康提醒计时，不影响关机预告" checked={draft.quietEnabled} change={v => set('quietEnabled', v)} />
        {draft.quietEnabled && <div className="quiet-range"><label>开始<input aria-label="免打扰开始" type="time" required value={draft.quietStart} onChange={e => set('quietStart', e.target.value)} /></label><span>至</span><label>结束<input aria-label="免打扰结束" type="time" required value={draft.quietEnd} onChange={e => set('quietEnd', e.target.value)} /></label></div>}
        <div className="save-row"><span role="status" className="save-feedback">{feedback}</span><button type="submit" className="primary" disabled={busy}>{busy ? '保存中…' : '保存设置'}</button></div>
      </section>
    </form>
    <form className="settings-card shutdown-settings" onSubmit={async event => {
      event.preventDefault();
      const ok = await send(dailyEnabled ? { type: 'schedule', time: dailyTime } : { type: 'disable-shutdown' });
      setDailyFeedback(ok ? '每日关机设置已保存' : '保存失败，请检查时间');
    }}><div className="card-heading"><Power size={19} className="amber" /><h2>每日定时关机</h2><span className="badge amber">提前 5 分钟提醒</span></div>
      <Toggle label="每天自动关机" description="保存一次，每天按固定的本地时间执行" checked={dailyEnabled} change={v => { setDailyEnabled(v); setDailyFeedback(''); }} />
      <label className="schedule-field">每日关机时间<input aria-label="每日关机时间" type="time" required disabled={!dailyEnabled} value={dailyTime} onChange={e => { setDailyTime(e.target.value); setDailyFeedback(''); }} /></label>
      <p className="card-caption daily-next">{state.shutdown.at ? `已启用：每天 ${state.shutdown.time} · 下次 ${dateTime(state.shutdown.at)}` : '每日关机尚未启用'}</p>
      <div className="schedule-actions"><span className="save-feedback" role="status">{dailyFeedback}</span>
        <button type="submit" className="primary">保存关机设置</button></div>
      <p className="fine-print">不足 5 分钟预告时从明天开始；跳过本次不影响每日计划。退出后设置保留，但执行时需要息刻运行，建议开启自启。请提前保存文件。</p>
    </form>
    <section className="settings-card desktop-settings"><div className="card-heading"><Monitor size={19} /><h2>桌面组件</h2></div>
      <div className="preference-row"><div><strong>回到屏幕右侧</strong><p>找不到组件时，可恢复默认位置。</p></div><button className="outline" onClick={() => void send({ type: 'reset-position' })}>重置位置</button></div>
      <p className="fine-print">拖动组件顶部可调整位置。关闭本设置窗口后，息刻继续在托盘运行。</p>
    </section>
    <footer className="settings-footer"><Leaf size={14} />给专注留一点空隙<span>本地保存 · 无需账号</span></footer>
  </main>;
}

function Toggle({ label, description, checked, change, disabled = false }: { label: string; description: string; checked: boolean; change(v: boolean): void; disabled?: boolean }) {
  return <label className="preference-row"><div><strong>{label}</strong><p>{description}</p></div><input type="checkbox" className="toggle" disabled={disabled} checked={checked} onChange={e => change(e.target.checked)} /></label>;
}

function Notice({ state, send }: ViewProps) {
  const shutdown = state.shutdown.status === 'warning';
  const kind = state.rest?.kind ?? state.due[0];
  const Icon = shutdown ? Power : kind ? icons[kind] : Check;
  const resting = !!state.rest;
  return <main className={'notice ' + (shutdown ? 'shutdown-notice' : '')}>
    <header className="notice-header drag"><span><Leaf size={16} />息刻 · 温柔提醒</span><button className="icon-button no-drag" aria-label="收起提醒" onClick={() => void send({ type: 'close-notice' })}><X size={17} /></button></header>
    <div className="notice-icon"><Icon size={30} /></div>
    <h1>{shutdown ? '该为今天收尾了' : resting ? kind === 'eye' ? '把目光放远一点' : '起来，走动一下' : kind ? labels[kind] : '当前没有待办提醒'}</h1>
    {shutdown ? <><div className="notice-countdown amber">{clock(state.shutdown.remaining)}</div><p>将在 {time(state.shutdown.at!)} 关机，请先保存文件。</p>
      <button className="primary wide" onClick={() => void send({ type: 'cancel-shutdown' })}>跳过本次关机</button><span className="notice-queue">仅跳过这一次，每日关机计划继续保留</span></>
      : resting ? <><div className="notice-countdown mint">{clock(state.rest!.remaining)}</div><p>{kind === 'eye' ? '看向约 6 米外，让眼睛轻轻放松。' : '离开座位，舒展身体，喝一小口水。'}</p>
        <button className="outline wide" onClick={() => void send({ type: 'cancel-rest' })}>结束本次休息</button></>
      : kind ? <><p className="notice-explanation">{kind === 'eye' ? `专注了一会儿，远眺 ${state.settings.eyeSeconds} 秒吧。` : kind === 'water' ? '喝几口水，按自己的需要慢慢补充。' : `站起来活动 ${Math.round(state.settings.moveSeconds / 60 * 10) / 10} 分钟，换个姿势。`}</p>
        <div className="notice-actions"><button className="primary wide" onClick={() => void send({ type: 'start', kind })}>{kind === 'water' ? '我已喝水' : '开始休息'}<ArrowUpRight size={16} /></button><button className="text-button" onClick={() => void send({ type: 'snooze', kind })}><Timer size={14} />5 分钟后提醒</button></div>
        {state.due.length > 1 && <span className="notice-queue">还有 {state.due.length - 1} 项提醒，完成后依次展示</span>}</>
      : <><p>照顾好自己，我们下次提醒见。</p><button className="outline wide" onClick={() => void send({ type: 'close-notice' })}>收起</button></>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
