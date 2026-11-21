import type { Language } from './types';

/** Chinese source messages are stable keys; English is the default UI language. */
export const english: Record<string, string> = {
  '息刻': 'Xike', '息刻 · 设置': 'Xike · Settings', '息刻 · 温柔提醒': 'Xike · A gentle reminder',
  '息刻 · 双击打开设置': 'Xike · Double-click to open settings', '息刻启动失败': 'Xike could not start',
  '打开设置': 'Open settings', '隐藏桌面组件': 'Hide widget', '显示桌面组件': 'Show widget',
  '恢复健康提醒': 'Resume reminders', '暂停健康提醒': 'Pause reminders', '查看当前提醒': 'Show current reminder',
  '重置组件到右侧': 'Dock widget to the right', '退出息刻': 'Quit Xike',
  '语言': 'Language', '选择语言后立即应用并自动保存。': 'Changes apply immediately and are saved automatically.',
  '界面语言': 'Interface language', '语言已保存': 'Language saved',
  '背景透明度': 'Background transparency', '仅调整背景，文字和按钮保持清晰。': 'Only the background changes. Text and buttons stay clear.',
  '不透明': 'Opaque', '透明': 'Transparent',
  '当前日期和时间': 'Current date and time', '该休息了': 'Time for a break', '{minutes} 分钟后': 'In {minutes} min',
  '已暂停': 'Paused', '待机中': 'Idle', '休息中': 'On a break', '运行中': 'Active',
  '护眼休息': 'Eye break', '喝水提醒': 'Drink water', '起身活动': 'Move around',
  '正在护眼休息': 'Eye break in progress', '下次护眼休息': 'Next eye break',
  '远眺 6 米外 · {seconds} 秒': 'Look 6 m away · {seconds} sec',
  '让眼睛放松一下': 'Rest your eyes', '正在起身活动': 'Movement break in progress', '现在休息': 'Take a break',
  '已喝水': 'Had water', '少量多次': 'Small, regular sips', '活动中': 'Moving', '开始活动': 'Start moving',
  '起来走走 · {minutes} 分钟': 'Get up and move · {minutes} min',
  '每日关机': 'Daily shutdown', '未启用': 'Disabled', '即将关机': 'Shutting down soon', '每天': 'Daily',
  '还剩 {time} · 请保存文件': '{time} left · Save your work', '下次 {date}': 'Next: {date}',
  '启用后提前 5 分钟提醒': 'A 5-minute warning when enabled', '跳过本次关机': 'Skip this shutdown',
  '预览模式 · 不执行真实关机': 'Test mode · No real shutdown', '离开电脑自动暂停': 'Pauses when you are away',
  '找到舒服的节奏': 'Find your everyday rhythm', '提醒轻一点，照顾自己多一点。': 'Gentle reminders. A little more care.',
  '预览模式：关机、自启均为模拟操作': 'Test mode: shutdown and startup actions are simulated.',
  '外观与主题': 'Appearance', '点击即切换，自动保存；无需点击下方的保存设置。': 'Click to apply and save. No extra save button needed.',
  '界面主题': 'Theme', '浅色': 'Light', '深色': 'Dark', '跟随系统': 'System',
  '原生毛玻璃': 'Frosted glass',
  'Windows 10 / 11 桌面组件与提醒背景模糊，即时生效': 'Native blur for the widget and reminders on Windows 10 / 11.',
  '原生毛玻璃已开启，文字保持清晰。': 'Frosted glass is on. Text stays clear.',
  '已使用实色背景，可随时开启毛玻璃。': 'Solid background is on. You can enable frosted glass anytime.',
  '正在应用…': 'Applying…', '外观已应用并保存': 'Appearance applied and saved', '应用失败，请重试': 'Could not apply. Please try again.',
  '提醒节奏': 'Reminder schedule',
  '按实际使用电脑的时长累计；修改间隔后，对应计时重新开始。': 'Based on active computer use. Changing an interval resets its timer.',
  '定期看向远处，让眼睛放松一下。': 'Look into the distance regularly to rest your eyes.',
  '护眼间隔': 'Break interval', '远眺时长': 'Break duration', '分钟': 'min', '秒': 'sec',
  '少量多次，按自己的需要补充水分。': 'Take small sips according to your own needs.', '喝水间隔': 'Water interval',
  '间隔决定多久提醒一次，时长决定每次活动多久。': 'The interval sets how often; the duration sets how long.',
  '活动间隔': 'Move interval', '活动时长': 'Move duration', '通用计时设置': 'Shared timer settings', '无操作后暂停': 'Pause after idle',
  '离开电脑后，三类提醒一起暂停。修改完成后点击下方“保存设置”。': 'All three timers pause when you are away. Click Save settings below when done.',
  '免打扰与偏好': 'Quiet hours & preferences', '开机自动启动': 'Start with Windows',
  '登录 Windows 后启动息刻并显示桌面组件': 'Launch Xike and show the widget when you sign in.',
  '提醒提示音': 'Reminder sound', '健康提醒和关机前提醒时播放系统提示音': 'Play a system sound for breaks and shutdown warnings.',
  '定时免打扰': 'Quiet hours', '暂停健康提醒计时，不影响关机预告': 'Pause health timers without silencing shutdown warnings.',
  '开始': 'From', '至': 'to', '结束': 'Until', '免打扰开始': 'Quiet hours start', '免打扰结束': 'Quiet hours end',
  '保存中…': 'Saving…', '保存设置': 'Save settings', '设置已保存': 'Settings saved', '保存失败，请检查输入': 'Could not save. Check your entries.',
  '每日定时关机': 'Daily shutdown', '提前 5 分钟提醒': '5-minute warning', '每天自动关机': 'Shut down every day',
  '保存一次，每天按固定的本地时间执行': 'Save once to repeat at the same local time every day.', '每日关机时间': 'Shutdown time',
  '已启用：每天 {time} · 下次 {date}': 'Daily at {time} · Next: {date}', '每日关机尚未启用': 'Daily shutdown is disabled.',
  '每日关机设置已保存': 'Daily shutdown settings saved', '保存失败，请检查时间': 'Could not save. Check the time.', '保存关机设置': 'Save shutdown settings',
  '不足 5 分钟预告时从明天开始；跳过本次不影响每日计划。退出后设置保留，但执行时需要息刻运行，建议开启自启。请提前保存文件。': 'Starts tomorrow if less than 5 minutes remain. Skipping one shutdown keeps the daily plan. The plan survives exit, but Xike must be running to execute it. Consider starting with Windows, and save your work.',
  '桌面组件': 'Desktop widget', '回到屏幕右侧': 'Dock to the right', '找不到组件时，可恢复默认位置。': 'Restore the default position if the widget is out of view.',
  '重置位置': 'Reset position', '拖动组件顶部可调整位置。关闭本设置窗口后，息刻继续在托盘运行。': 'Drag the top to move between displays. Closing settings keeps Xike running in the tray.',
  '给专注留一点空隙': 'Make room for a little rest', '本地保存 · 无需账号': 'Local settings · No account',
  '收起提醒': 'Dismiss reminder', '该为今天收尾了': 'Time to wrap up', '把目光放远一点': 'Look a little farther', '起来，走动一下': 'Get up and move',
  '当前没有待办提醒': 'You are all caught up', '将在 {time} 关机，请先保存文件。': 'Shutdown at {time}. Please save your work.',
  '仅跳过这一次，每日关机计划继续保留': 'Only this occurrence is skipped. The daily plan stays enabled.',
  '看向约 6 米外，让眼睛轻轻放松。': 'Look about 6 meters away and relax your eyes.',
  '离开座位，舒展身体，喝一小口水。': 'Step away, stretch gently, and take a sip of water.', '结束本次休息': 'End this break',
  '专注了一会儿，远眺 {seconds} 秒吧。': 'Take a moment to look away for {seconds} seconds.',
  '喝几口水，按自己的需要慢慢补充。': 'Take a few sips at your own pace.',
  '站起来活动 {minutes} 分钟，换个姿势。': 'Stand up and move for {minutes} minutes.',
  '我已喝水': 'I had water', '开始休息': 'Start break', '5 分钟后提醒': 'Remind me in 5 minutes',
  '还有 {count} 项提醒，完成后依次展示': '{count} more reminders will follow.', '照顾好自己，我们下次提醒见。': 'Take care. We will remind you when it is time.', '收起': 'Dismiss',
  '无法连接息刻后台，请重新启动软件': 'Cannot connect to Xike. Please restart the app.', '操作未完成，请重试': 'The action did not complete. Please try again.', '关闭错误提示': 'Dismiss error', '息刻正在准备…': 'Getting Xike ready…',
  '原生毛玻璃需要 Windows 10 1803 或更新版本，当前使用实色背景。': 'Frosted glass requires Windows 10 1803 or later. Using a solid background.',
  '系统高对比度模式下使用实色背景，以保持清晰。': 'Using a solid background for system high-contrast mode.',
  '系统已关闭透明效果，当前使用实色背景。': 'System transparency is off. Using a solid background.',
  '系统背景材质暂不可用，已回退为实色背景。': 'Native background effects are unavailable. Using a solid background.',
  '已取消过期或不足 5 分钟预告时间的关机预约': 'Cancelled a shutdown with an expired or insufficient warning period.',
  '请选择至少 5 分钟后、30 天内的关机时间': 'Choose a shutdown time at least 5 minutes ahead and within 30 days.',
  '已预约关机，提前 5 分钟提醒': 'Shutdown scheduled with a 5-minute warning.', '请选择有效的每日关机时间': 'Choose a valid daily shutdown time.',
  '每日 {time} 关机已启用，提前 5 分钟提醒': 'Daily shutdown at {time} enabled with a 5-minute warning.',
  '每日关机计划已关闭': 'Daily shutdown disabled.', '错过本次关机，已安排下一次每日计划': 'Missed this shutdown. The next daily occurrence is scheduled.',
  '已跳过本次关机，每日计划保留': 'Skipped this shutdown. The daily plan stays enabled.',
  '已取消错过时间的关机预约，请重新设置': 'The missed shutdown was cancelled. Please schedule it again.', '已取消本次关机': 'This shutdown was cancelled.',
  '请先完成或结束当前休息': 'Finish or end the current break first.', '已记录喝水，保持少量多次': 'Water recorded. Keep taking small, regular sips.',
  '已延后 5 分钟提醒': 'Reminder snoozed for 5 minutes.', '本次休息已结束，5 分钟后再次提醒': 'Break ended. We will remind you in 5 minutes.',
  '已向 Windows 发送关机请求': 'Shutdown requested from Windows.', '提醒已暂停': 'Reminders paused', '电脑休眠中': 'Computer is sleeping',
  '锁屏中': 'Screen is locked', '免打扰时段': 'Quiet hours', '离开电脑，计时暂停': 'Away · Timers paused',
  '护眼休息完成，欢迎回来': 'Eye break complete. Welcome back.', '活动完成，继续保持好状态': 'Movement break complete. Keep it up.',
  '设置格式无效': 'Invalid settings format.', '请选择有效的界面主题': 'Choose a valid theme.', '请选择有效的界面语言': 'Choose a supported language.',
  '开关设置无效': 'Invalid toggle value.', '请输入有效的时段': 'Enter valid quiet hours.', '免打扰开始和结束时间不能相同': 'Quiet hours must start and end at different times.',
  '{field} 需要是 {min}–{max} 之间的整数': '{field} must be an integer between {min} and {max}.',
  '配置读取失败，已备份原文件并恢复默认设置；关机预约已清除': 'Could not read settings. The original file was backed up, defaults restored, and shutdown disabled.',
  '开机自启请在安装版中启用': 'Enable startup in the installed version of Xike.', 'Windows 未接受关机请求，请检查权限或系统状态': 'Windows did not accept the shutdown request. Check permissions or system status.',
  'Windows 拒绝应用窗口毛玻璃材质': 'Windows could not apply the frosted-glass effect.',
  '提醒窗口异常，已跳过本次关机': 'The reminder window failed. This shutdown was skipped.',
  '操作格式无效': 'Invalid command format.', '请在设置窗口切换外观': 'Change appearance in the settings window.',
  '提醒类型无效': 'Invalid reminder type.', '请在设置窗口修改配置': 'Change preferences in the settings window.',
  '请在设置窗口预约关机': 'Configure shutdown in the settings window.', '请在设置窗口关闭每日关机': 'Disable daily shutdown in the settings window.',
  '不支持的操作': 'Unsupported action.', '操作失败': 'Action failed.', '无法保存关机状态，已停止本次关机': 'Could not save shutdown state. This shutdown was stopped.',
  '组件位置保存失败': 'Could not save the widget position.', '窗口无权限': 'This window does not have permission.',
};

export const isLanguage = (value: unknown): value is Language => value === 'en' || value === 'zh-CN';
export const localeFor = (language: Language) => language === 'zh-CN' ? 'zh-CN' : 'en-US';
export function translate(language: Language, text: string, params: Record<string, string | number> = {}): string {
  // Localize the two legacy messages whose values are interpolated in domain code.
  const daily = /^每日 (\d{2}:\d{2}) 关机已启用，提前 5 分钟提醒$/.exec(text);
  if (daily) return translate(language, '每日 {time} 关机已启用，提前 5 分钟提醒', { time: daily[1] });
  const range = /^(\w+) 需要是 (\d+)–(\d+) 之间的整数$/.exec(text);
  if (range) {
    const fields: Record<string, string> = { eyeMinutes: '护眼间隔', waterMinutes: '喝水间隔', moveMinutes: '活动间隔', eyeSeconds: '远眺时长', moveSeconds: '活动时长', idleMinutes: '无操作后暂停', glassTransparency: '背景透明度' };
    return translate(language, '{field} 需要是 {min}–{max} 之间的整数', { field: translate(language, fields[range[1]] ?? range[1]), min: range[2], max: range[3] });
  }
  const template = language === 'zh-CN' ? text : english[text] ?? text;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match));
}
export const translator = (language: Language) => (text: string, params?: Record<string, string | number>) => translate(language, text, params);
export const formatTime = (language: Language, at: number) => new Date(at).toLocaleTimeString(localeFor(language), { hour: '2-digit', minute: '2-digit', hour12: false });
export const formatDate = (language: Language, at: number) => new Date(at).toLocaleDateString(localeFor(language), { year: 'numeric', month: language === 'en' ? 'short' : 'long', day: 'numeric' });
export const formatWeekday = (language: Language, at: number) => new Date(at).toLocaleDateString(localeFor(language), { weekday: 'long' });
export const formatDateTime = (language: Language, at: number) => `${new Date(at).toLocaleDateString(localeFor(language), { month: 'short', day: 'numeric' })} ${formatTime(language, at)}`;
