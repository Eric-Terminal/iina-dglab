export type Language = 'system' | 'zh-CN' | 'en';
export type Locale = 'zh-CN' | 'en';

// 中文原文作为消息键；运行状态也在显示时翻译，切换语言不影响联动状态。
export const english: Record<string, string> = {
  '郊狼音频联动': 'Coyote Audio Link', '音频联动': 'Audio Link',
  '语言': 'Language', '跟随系统': 'System default',
  '未连接': 'Disconnected', '正在连接': 'Connecting', '连接中…': 'Connecting…',
  '等待 App 配对': 'Waiting for app pairing', 'App 已连接': 'App connected', '连接已断开': 'Connection lost',
  '连接郊狼': 'Connect Coyote', '连接 App': 'Connect app', '断开连接': 'Disconnect',
  '连接后，用官方 App 的 Socket 控制扫码或粘贴地址配对。': 'Pair through Socket Control in the official app using the QR code or address.',
  '连接后，将 Socket 地址粘贴到同一台 Mac 的官方 App。': 'Paste the Socket address into the official app on this Mac.',
  '连接地址': 'Connection address', '配对二维码与连接地址': 'Pairing QR code and address', '本机连接地址': 'Local connection address',
  'DG-LAB 4 → Socket 控制 → 连接服务器': 'DG-LAB 4 → Socket Control → Connect to server',
  '复制下方地址到同一台 Mac 的 App。': 'Copy this address into the app on this Mac.',
  '复制下方地址到同一台 Mac 的 App。重新连接后需使用新地址。': 'Copy this address into the app on this Mac. Reconnecting creates a new address.',
  '手机可扫码；桌面 App 可复制下方地址。': 'Scan with your phone, or paste the address into the desktop app.',
  'Socket 地址': 'Socket address', '复制': 'Copy', '已复制': 'Copied', '请按 ⌘C': 'Press ⌘C',
  '连接方式': 'Connection method', '远程服务器 · 官方或自建': 'Via app · Remote server', '本机中继 · 同一台 Mac': 'Via app · Local relay',
  '连接设置': 'Connection settings',
  '自动启动本机中继，需要 Node.js 22+。仅接受这台 Mac 的连接。': 'Starts a local relay using Node.js 22+. Accepts connections from this Mac only.',
  'Node.js 路径（留空自动查找）': 'Node.js path (leave blank to detect)', 'V4 WebSocket 地址': 'V4 WebSocket URL',
  '默认使用官方中继，也可填写自建 V4 服务地址。': 'Uses the official relay by default. You can enter your own V4 server URL.',
  '输出设备': 'Output device', '等待 App 连接': 'Waiting for app', '等待 App 中的郊狼 3.0 设备': 'Waiting for Coyote 3.0 in the app',
  '选择输出设备': 'Select a device', '离线': 'Offline',
  '当前音源': 'Audio source', '等待音频': 'Waiting for audio',
  '从播放窗口的插件菜单选择「打开音频联动」。': 'Choose “Open Audio Link” from the playback window’s Plugins menu.',
  '请从播放窗口的插件菜单选择音源': 'Select a source from the playback window’s Plugins menu',
  '最近十二秒的音频电平': 'Audio levels over the last twelve seconds', 'App 配对二维码': 'App pairing QR code',
  '峰值': 'Peak', '过零率': 'Zero-crossing rate', '48 kHz 标度': 'Normalized to 48 kHz', '波形预览': 'Waveform level',
  '预览跟随当前播放时间；提前量仅用于设备输出。': 'Preview follows the current playback time. Advance applies only to device output.',
  '映射与通道': 'Mapping and channels', '参数已应用': 'Settings applied', '修改尚未应用': 'Unsaved changes',
  '电平来源': 'Level source', '动态混合 · 响度与起音': 'Dynamic · Level and onset', 'RMS · 平均响度': 'RMS · Average level', 'Peak · 瞬时峰值': 'Peak · Instantaneous level',
  '噪声门限': 'Noise gate', '满幅电平': 'Full-scale level', '波形提前量': 'Waveform advance',
  '默认 0。填 100 表示提前 100 ms；若提示预读不足，请减小数值。': 'Default: 0. Enter 100 to advance by 100 ms. Reduce this if audio look-ahead is insufficient.',
  'A 通道': 'Channel A', 'B 通道': 'Channel B', '强度上限': 'Intensity limit', '等待 App 回传上限': 'Waiting for app limits',
  '曲线与频率': 'Curve and frequency', '自适应底噪门限': 'Adaptive noise gate', '响应指数': 'Response exponent', '波形幅度上限': 'Waveform amplitude limit',
  '过零率下界': 'ZCR lower bound', '过零率上界': 'ZCR upper bound', '高频编码': 'High-frequency code', '低频编码': 'Low-frequency code',
  '编码越小，脉冲越密。ZCR 仅反映声音特征，不识别声音内容。': 'Lower codes produce denser pulses. ZCR describes sound characteristics; it does not identify content.',
  '实际通道强度不会超过 App 回传的上限。': 'Channel intensity is limited by the app’s reported limits.',
  '应用参数': 'Apply settings', '尚未开始联动': 'Audio Link is off', '开始联动': 'Enable Audio Link', '停止输出': 'Stop output',
  '可以先开启联动再播放。暂停、静音、低于门限或采样中断时归零，音频恢复后自动继续。关闭控制台、切换媒体或断连后需重新开启。': 'You can enable Audio Link before playback. Pausing, muting, quiet audio or missing samples stops output; fresh audio resumes it. Re-enable after closing this window, changing media or disconnecting.',
  '打开音频联动（使用当前窗口）': 'Open Audio Link (use this window)', '打开音频联动控制台': 'Open Audio Link controls', '停止郊狼输出': 'Stop Coyote output',
  '已手动停止': 'Stopped manually', '音源已切换，请重新开始联动': 'Source changed. Enable Audio Link again.', '已通过快捷键停止': 'Stopped with keyboard shortcut',
  '控制窗口已关闭': 'Control window closed', '已断开连接': 'Disconnected', '连接发生错误，请检查 App': 'Connection error. Check the app.',
  '连接已断开，请重新连接并开始联动': 'Connection lost. Reconnect and enable Audio Link again.',
  '请选择在线的郊狼 3.0。': 'Select a connected Coyote 3.0.',
  '当前 IINA 缺少控制窗口状态接口，请升级 IINA 后使用联动。': 'This IINA version cannot track the control window. Update IINA to use Audio Link.',
  '请在 IINA 的插件控制窗口中打开此页面。': 'Open this page in IINA’s plugin control window.',
  '请输入 V4 控制端 ws:// 或 wss:// 地址，不要带配对 ID、用户名或片段。': 'Enter a V4 controller ws:// or wss:// URL without a pairing ID, username or fragment.',
  '请在 IINA 插件窗口中启动本机中继。': 'Start the local relay from the IINA plugin window.',
  '本地中继启动超时，请检查 Node.js 路径。': 'Local relay startup timed out. Check the Node.js path.', '本地中继启动失败。': 'Local relay failed to start.',
  '未找到 Node.js。请安装 Node.js 22+，或在连接设置中填写 node 的绝对路径。': 'Node.js was not found. Install Node.js 22+ or enter its absolute path in connection settings.',
  '找不到插件内的本地中继程序，请重新安装插件。': 'The bundled local relay is missing. Reinstall the plugin.',
  '本地中继返回了无效的连接地址。': 'The local relay returned an invalid address.', '本地中继启动已取消。': 'Local relay startup was cancelled.',
  '本地中继已失去响应，请重新连接。': 'The local relay stopped responding. Reconnect.', '本地中继已失去响应，请重新连接': 'The local relay stopped responding. Reconnect.',
  '设备已切换，请重新开始联动': 'Device changed. Enable Audio Link again.', '设备已离线': 'Device disconnected',
  '参数已应用，继续联动': 'Settings applied; Audio Link remains enabled',
  '上次停止操作未获确认，请检查 App 后断开并重新连接。': 'The last stop was not acknowledged. Check the device connection, then disconnect and reconnect.',
  '请先连接 App 并选择在线的郊狼 3.0。': 'Connect and select an online Coyote 3.0 first.',
  '请设置至少一个通道的强度上限，并确认 App 已回传非零上限。': 'Set a positive intensity limit for at least one channel and check its connection limits.',
  '联动已就绪': 'Audio Link is ready', '联动已开启，等待音频': 'Audio Link enabled; waiting for audio',
  '所选通道不可输出，请检查 App 上限和静音状态': 'Selected channels cannot output. Check intensity limits and mute state.',
  '通道状态已改变': 'Channel state changed', '正在跟随音频': 'Following audio', '低于噪声门限': 'Below noise gate', '音频统计不可用': 'Audio statistics unavailable',
  '联动已开启，等待音频恢复': 'Audio Link enabled; waiting for fresh audio', '已停止联动': 'Audio Link is off',
  '停止指令未获确认，请检查 App；本次波形与临时强度任务有时限': 'Stop was not acknowledged. Check the connection; waveform and temporary intensity tasks have time limits.',
  '参数尚未应用，请先点「应用参数」。': 'Changes are pending. Click “Apply settings”.', '联动已开启': 'Audio Link enabled', '正在准备…': 'Preparing…', '请先应用参数': 'Apply settings first',
  '关闭': 'Closed', '通过': 'Open',
  '音频统计滤镜被禁用，请在 IINA 中启用它': 'The audio statistics filter is disabled. Enable it in IINA.',
  '无法打开音频统计文件': 'Cannot open the audio statistics file', '音频统计滤镜挂载失败，请查看插件开发者工具': 'Could not attach the audio statistics filter. Check the plugin developer tools.',
  '尚未播放媒体': 'No media loaded', '播放已暂停': 'Playback paused', '播放器已静音': 'Player muted', '正在缓冲或定位': 'Buffering or seeking', '播放已结束': 'Playback ended',
  '播放进度未更新': 'Playback clock has stalled', '当前音轨未提供 PCM 音频，请检查音轨选择与音频直通设置': 'No PCM audio is available. Check the audio track and passthrough settings.',
  '正在等待音频播放时钟': 'Waiting for the audio playback clock', '正在调整音频预读缓冲': 'Adjusting audio look-ahead buffer',
  '音频预读不足，请减小提前量或等待缓冲': 'Insufficient audio look-ahead. Reduce advance or wait for buffering.',
  '正在等待音频统计，请保持播放': 'Waiting for audio statistics. Keep playback running.',
  '媒体已切换，请重新开始联动': 'Media changed. Enable Audio Link again.', '正在定位': 'Seeking', '播放窗口已关闭': 'Playback window closed',
  '无法读取播放器的音频缓冲设置': 'Cannot read the player’s audio buffer setting', '无法调整音频预读缓冲': 'Cannot adjust audio look-ahead buffer',
  '参数格式无效。': 'Invalid settings format.', '噪声门限必须低于满幅电平。': 'The noise gate must be below the full-scale level.',
  '过零率下界必须小于上界。': 'The ZCR lower bound must be below the upper bound.', '频率编码下界不能大于上界。': 'The lower frequency code cannot exceed the upper code.',
  '电平模式或通道选项无效。': 'Invalid level mode or channel options.',
  'App 当前 {value} / 上限 {limit}': 'App intensity {value} / limit {limit}',
  '门限 {value} dBFS · {state}': 'Gate {value} dBFS · {state}',
  '参数 {name} 必须在 {min}～{max} 之间。': '{name} must be between {min} and {max}.',
  '音频统计滤镜挂载失败：{error}': 'Could not attach the audio statistics filter: {error}',
  '无法读取音频统计：{error}': 'Cannot read audio statistics: {error}', 'App 指令失败：{error}': 'Device command failed: {error}',
};

let locale: Locale = 'zh-CN';
export function resolveLanguage(value: unknown, systemLocale: string): Locale {
  if (value === 'en' || value === 'zh-CN') return value;
  return systemLocale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}
export function setLanguage(value: unknown, systemLocale = Intl.DateTimeFormat().resolvedOptions().locale): Locale {
  locale = resolveLanguage(value, systemLocale);
  return locale;
}
export function getLocale(): Locale { return locale; }

const patterns = Object.entries(english).filter(([key]) => key.includes('{')).map(([key, value]) => {
  const fields: string[] = [];
  const escaped = key.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\w+)\}/g, (_, field: string) => { fields.push(field); return '(.*?)'; });
  return { pattern: new RegExp(`^${escaped}$`), value, fields };
});

export function t(message: string): string {
  if (locale === 'zh-CN') return message;
  if (english[message]) return english[message];
  if (message.startsWith('Error: ')) return `Error: ${t(message.slice(7))}`;
  for (const { pattern, value, fields } of patterns) {
    const match = pattern.exec(message);
    if (match) return value.replace(/\{(\w+)\}/g, (_, field: string) => t(match[fields.indexOf(field) + 1]));
  }
  return message;
}

/** 只记录初始静态文案；动态状态由 render 翻译，切换语言不重建表单或连接。 */
export function bindDocumentLanguage(document: Document): () => void {
  const texts: { node: Text; value: string }[] = [];
  const attributes: { node: Element; name: string; value: string }[] = [];
  const walker = document.createTreeWalker(document.documentElement, 4);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.matches('script,style')) continue;
    if (node.textContent?.trim()) texts.push({ node: node as Text, value: node.textContent });
  }
  for (const element of Array.from(document.querySelectorAll('[aria-label],[title],[placeholder]'))) {
    for (const name of ['aria-label', 'title', 'placeholder']) {
      const value = element.getAttribute(name);
      if (value) attributes.push({ node: element, name, value });
    }
  }
  return () => {
    document.documentElement.lang = locale;
    for (const { node, value } of texts) if (node.isConnected) node.nodeValue = value.replace(/\S[\s\S]*\S|\S/, text => t(text));
    for (const { node, name, value } of attributes) node.setAttribute(name, t(value));
  };
}
