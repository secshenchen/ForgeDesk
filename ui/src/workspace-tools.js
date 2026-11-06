import { parseCsv } from './data-workshop.js';

function node(tag, text) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
}

function form(label, action, run, multiline = true) {
  const panel = node('section');
  panel.className = 'panel file-manager';
  const field = node('label', label);
  const input = node(multiline ? 'textarea' : 'input');
  if (multiline) input.rows = 8;
  field.append(input);
  const button = node('button', action);
  button.type = 'button';
  button.className = 'control';
  const output = node('pre');
  output.className = 'data-preview';
  output.setAttribute('aria-live', 'polite');
  button.addEventListener('click', async () => {
    button.disabled = true;
    try { output.textContent = await run(input.value); }
    catch (error) { output.textContent = error.message; }
    finally { button.disabled = false; }
  });
  panel.append(field, button, output);
  return { panel, input, output };
}

export function subnet(value) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(value.trim());
  if (!match) throw new Error('请输入 IPv4/CIDR，例如 192.168.1.42/24。');
  const parts = match.slice(1).map(Number);
  const prefix = parts.pop();
  if (prefix > 32 || parts.some(part => part > 255)) throw new Error('IPv4 地址或前缀超出范围。');
  const ip = parts.reduce((value, part) => value * 256 + part, 0);
  const count = 2 ** (32 - prefix);
  const start = Math.floor(ip / count) * count;
  const format = n => [24, 16, 8, 0].map(bits => (n >>> bits) & 255).join('.');
  return { network: format(start), last: format(start + count - 1), count };
}

export function textSearch(text, query) {
  const term = query.toLowerCase();
  return text.split(/\r?\n/).flatMap((line, index) =>
    line.toLowerCase().includes(term) ? [`${index + 1}: ${line}`] : []);
}

function downloadReport(name, report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = node('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function action(label) {
  const button = node('button', label);
  button.className = 'control';
  button.type = 'button';
  return button;
}

function nativeDiagnostics(volumes = false) {
  const bridge = globalThis.chrome?.webview;
  if (!bridge) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const receive = event => {
      if (event.data?.type === (volumes ? 'volumes' : 'diagnostics')) finish(resolve, event.data);
    };
    const finish = (callback, value) => {
      clearTimeout(timer);
      bridge.removeEventListener('message', receive);
      callback(value);
    };
    const timer = setTimeout(() => finish(reject, new Error('Windows 诊断响应超时。')), 5000);
    bridge.addEventListener('message', receive);
    try { bridge.postMessage(volumes ? 'forgedesk:volumes' : 'forgedesk:diagnostics'); }
    catch (error) { finish(reject, error); }
  });
}

const gib = bytes => `${(bytes / 2 ** 30).toFixed(2)} GiB`;

export function inventory(files) {
  const groups = new Map();
  let total = 0n;
  const entries = Array.from(files, file => {
    const path = file.webkitRelativePath || file.name;
    const dot = file.name.lastIndexOf('.');
    const extension = dot > 0 && dot < file.name.length - 1
      ? file.name.slice(dot + 1).toLowerCase() : '无扩展名';
    const group = groups.get(extension) ?? { count: 0, bytes: 0n };
    ++group.count;
    group.bytes += BigInt(file.size);
    groups.set(extension, group);
    total += BigInt(file.size);
    return { path, bytes: file.size };
  });
  return {
    count: entries.length,
    bytes: total.toString(),
    largest: entries.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path)).slice(0, 20),
    byExtension: Array.from(groups, ([extension, group]) => ({
      extension, count: group.count, bytes: group.bytes.toString()
    })).sort((a, b) => a.bytes === b.bytes ? a.extension.localeCompare(b.extension)
      : BigInt(a.bytes) > BigInt(b.bytes) ? -1 : 1)
  };
}

export function workspaceTool(id) {
  if (id === 'disks') {
    const panel = node('section');
    panel.className = 'panel file-manager';
    const picker = node('input');
    picker.type = 'file';
    picker.multiple = true;
    const label = node('label', '选择文件 ');
    label.append(picker);
    const folder = node('input');
    folder.type = 'file';
    const folderLabel = node('label', '选择文件夹 ');
    folderLabel.hidden = !('webkitdirectory' in folder);
    folder.webkitdirectory = true;
    folderLabel.append(folder);
    const output = node('pre', '统计所选文件的大小和最大文件。');
    output.className = 'data-preview';
    output.setAttribute('aria-live', 'polite');
    const save = action('导出统计 JSON');
    save.disabled = true;
    let report;
    for (const input of [picker, folder]) input.addEventListener('change', () => {
      if (!input.files?.length) return;
      report = inventory(input.files);
      input.value = '';
      save.disabled = false;
      const bytes = value => BigInt(value).toLocaleString();
      output.textContent = `${report.count} 个文件，${bytes(report.bytes)} 字节\n\n最大文件\n` +
        report.largest.map(file => `${bytes(file.bytes)} 字节  ${file.path}`).join('\n') +
        '\n\n按扩展名汇总（最多显示 30 类）\n' +
        report.byExtension.slice(0, 30).map(group =>
          `${group.extension}：${group.count} 个，${bytes(group.bytes)} 字节`).join('\n');
    });
    save.addEventListener('click', () => downloadReport('forgedesk-inventory.json', report));
    panel.append(label, folderLabel, save, output);
    if (globalThis.chrome?.webview) {
      const probe = action('读取固定卷容量');
      const exportVolumes = action('导出卷容量 JSON');
      exportVolumes.disabled = true;
      const capacity = node('pre', '读取当前 Windows 固定卷的容量与可用空间。');
      capacity.className = 'data-preview';
      capacity.setAttribute('aria-live', 'polite');
      let snapshot;
      probe.addEventListener('click', async () => {
        probe.disabled = true;
        try {
          const report = await nativeDiagnostics(true);
          snapshot = report.volumes;
          capacity.textContent = snapshot.map(({ drive, space, predictFailure }) => {
            const sizes = space
              ? `容量 ${gib(space.capacity)} · 空闲 ${gib(space.free)} · 本账户可用 ${gib(space.available)}`
              : '无法读取容量';
            const health = predictFailure === null ? '故障预测不可用'
              : predictFailure ? '驱动报告故障预测' : '驱动当前未报告故障预测';
            return `${drive} ${sizes} · ${health}`;
          }).join('\n') || '没有可读取的固定卷。';
          exportVolumes.disabled = false;
        } catch (error) {
          capacity.textContent = error.message;
        } finally { probe.disabled = false; }
      });
      exportVolumes.addEventListener('click', () => downloadReport('forgedesk-volumes.json', snapshot));
      panel.prepend(probe, exportVolumes, capacity);
    }
    return panel;
  }
  if (id === 'system') {
    const panel = node('section');
    panel.className = 'panel file-manager';
    const output = node('pre');
    output.className = 'data-preview';
    output.setAttribute('aria-live', 'polite');
    const refresh = action('刷新环境诊断');
    const save = action('导出诊断 JSON');
    save.disabled = true;
    let report;
    const inspect = async () => {
      if (refresh.disabled) return;
      refresh.disabled = true;
      const estimate = await navigator.storage?.estimate?.().catch(() => null);
      let writableStorage = false;
      try {
        const key = 'forgedesk.diagnostics-probe';
        const storage = sessionStorage;
        const prior = storage.getItem(key);
        storage.setItem(key, 'ok');
        writableStorage = storage.getItem(key) === 'ok';
        if (prior === null) storage.removeItem(key);
        else storage.setItem(key, prior);
      } catch { /* Storage may be restricted by the host. */ }
      report = {
        capturedAt: new Date().toISOString(),
        runtime: navigator.userAgent,
        logicalThreads: navigator.hardwareConcurrency ?? null,
        language: navigator.language,
        viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio },
        secureContext: isSecureContext,
        onlineHint: navigator.onLine,
        sha256Available: typeof crypto?.subtle?.digest === 'function',
        writableSessionStorage: writableStorage,
        storage: estimate ? { usage: estimate.usage ?? null, quota: estimate.quota ?? null } : null
      };
      let nativeMessage = '';
      try {
        const native = await nativeDiagnostics();
        if (native) {
          const { architecture, logicalProcessors, uptimeMs, memory } = native;
          report.windows = { architecture, logicalProcessors, uptimeMs, memory };
          const arch = { 0: 'x86', 5: 'ARM', 9: 'x64', 12: 'ARM64' }[architecture] ?? '未知';
          nativeMessage = `Windows 原生架构：${arch}\nWindows 逻辑处理器：${logicalProcessors}\n` +
            `系统已运行：${Math.floor(uptimeMs / 60000)} 分钟\n物理内存：${memory
              ? `${gib(memory.available)} 可用 / ${gib(memory.total)} 总量` : '不可用'}`;
        }
      } catch (error) {
        nativeMessage = error.message;
      }
      output.textContent = [
        `运行环境：${navigator.userAgent}`, `逻辑线程：${navigator.hardwareConcurrency || '未知'}`,
        `语言：${navigator.language}`, `窗口：${innerWidth} × ${innerHeight}`,
        `安全上下文：${isSecureContext ? '是' : '否'}`,
        `应用存储：${report.storage?.usage != null && report.storage?.quota != null
          ? `${report.storage.usage} / ${report.storage.quota} 字节` : '不可用'}`,
        `会话存储读写：${writableStorage ? '通过' : '不可用'}`,
        `SHA-256：${report.sha256Available ? '可用' : '不可用'}`,
        `网络状态提示：${report.onlineHint ? '在线' : '离线'}`,
        nativeMessage
      ].filter(Boolean).join('\n');
      refresh.disabled = false;
      save.disabled = false;
    };
    refresh.addEventListener('click', inspect);
    save.addEventListener('click', () => downloadReport('forgedesk-diagnostics.json', report));
    panel.append(refresh, save, output);
    inspect();
    return panel;
  }
  if (id === 'network') {
    const view = form('IPv4/CIDR ', '计算地址范围', input => {
      const result = subnet(input);
      return `起始地址：${result.network}\n结束地址：${result.last}\n地址总数：${result.count}`;
    }, false);
    return view.panel;
  }
  if (id === 'developer') return form('JSON 输入', '校验并格式化', value =>
    JSON.stringify(JSON.parse(value), null, 2)).panel;
  if (id === 'security') {
    const picker = node('input');
    picker.type = 'file';
    const view = form('预期 SHA-256 ', '验证文件', async input => {
      const expected = input.trim().toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(expected)) throw new Error('请输入 64 位十六进制 SHA-256。');
      const file = picker.files?.[0];
      if (!file || file.size > 32 * 1024 * 1024) throw new Error('请选择 32 MiB 以内的文件。');
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      return `${actual === expected ? '匹配' : '不匹配'}\n${actual}`;
    }, false);
    const label = node('label', '选择文件 ');
    label.append(picker);
    view.panel.prepend(label);
    return view.panel;
  }
  if (id === 'text') {
    const query = node('input');
    const view = form('待搜索文本', '搜索匹配行', input => {
      if (!query.value) throw new Error('请输入搜索词。');
      const matches = textSearch(input, query.value);
      return `${matches.length} 行匹配\n${matches.slice(0, 200).join('\n')}`;
    });
    const label = node('label', '搜索词 ');
    label.append(query);
    view.panel.prepend(label);
    return view.panel;
  }
  if (id === 'reports') return form('粘贴 CSV 数据', '生成统计', input => {
    const rows = parseCsv(input);
    if (!rows.length) return '没有可统计的记录。';
    let cells = 0;
    let widest = 0;
    let empty = 0;
    for (const row of rows) {
      cells += row.length;
      widest = Math.max(widest, row.length);
      empty += row.filter(value => value.trim() === '').length;
    }
    return `记录：${rows.length}\n最大列数：${widest}\n单元格：${cells}\n空单元格：${empty}`;
  }).panel;
  const view = form('扩展配置 JSON（名称和说明）', '保存本地扩展登记', input => {
    const value = JSON.parse(input);
    if (!value || typeof value.name !== 'string' || !value.name.trim() ||
        typeof value.description !== 'string') throw new Error('请填写 name 和 description。');
    const record = { name: value.name.trim().slice(0, 100), description: value.description.slice(0, 1000) };
    localStorage.setItem('forgedesk.extension-record', JSON.stringify(record));
    return `已登记：${record.name}\n${record.description}`;
  });
  try {
    view.input.value = localStorage.getItem('forgedesk.extension-record') ||
      JSON.stringify({ name: '', description: '' }, null, 2);
  } catch { view.output.textContent = '当前环境无法使用本地存储。'; }
  return view.panel;
}
