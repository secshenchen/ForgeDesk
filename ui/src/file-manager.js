const maxHashBytes = 32 * 1024 * 1024;
const pageSize = 100;

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function fileManager() {
  const panel = element('section');
  panel.className = 'panel file-manager';
  const filesLabel = element('label', '选择文件 ');
  const input = element('input');
  input.type = 'file';
  input.id = 'file-picker';
  input.multiple = true;
  filesLabel.append(input);

  const folder = element('input');
  folder.type = 'file';
  const folderLabel = element('label', '选择文件夹 ');
  folderLabel.append(folder);
  folderLabel.hidden = !('webkitdirectory' in folder);
  folder.webkitdirectory = true;

  const filterLabel = element('label', '筛选文件名或相对路径 ');
  const filter = element('input');
  filter.id = 'file-filter';
  filter.type = 'search';
  filterLabel.append(filter);
  const sortLabel = element('label', '排序 ');
  const sort = element('select');
  for (const [value, label] of [['name', '名称'], ['size', '大小（从大到小）'], ['date', '修改时间（最新优先）']]) {
    const option = element('option', label);
    option.value = value;
    sort.append(option);
  }
  sortLabel.append(sort);

  const status = element('p');
  status.setAttribute('role', 'status');
  const list = element('ul');
  list.id = 'file-results';
  const previous = element('button', '上一页');
  const next = element('button', '下一页');
  for (const button of [previous, next]) {
    button.className = 'control';
    button.type = 'button';
  }
  const pages = element('div');
  const batch = element('button', '校验全部匹配文件');
  batch.type = 'button';
  batch.className = 'control';
  const batchStatus = element('p');
  batchStatus.setAttribute('role', 'status');
  pages.append(previous, next);
  panel.append(filesLabel, folderLabel, filterLabel, sortLabel, batch, batchStatus, status, list, pages);

  let selected = [];
  let page = 0;
  let hashes = new WeakMap();
  let active = null;
  let batching = false;
  const pathOf = file => file.webkitRelativePath || file.name;
  function matchingFiles() {
    const query = filter.value.trim().toLowerCase();
    return selected.filter(file =>
      pathOf(file).toLowerCase().includes(query));
  }
  const canHash = file => Boolean(globalThis.crypto?.subtle) && file.size <= maxHashBytes;
  async function hash(file, results) {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    results.set(file, Array.from(new Uint8Array(digest), byte =>
      byte.toString(16).padStart(2, '0')).join(''));
  }
  batch.addEventListener('click', async () => {
    if (active || batching) return;
    const results = hashes;
    const matches = matchingFiles();
    const pending = matches.filter(file => canHash(file) && !results.has(file));
    let completed = matches.filter(file => results.has(file)).length;
    let failed = 0;
    batching = true;
    render();
    try {
      for (const file of pending) {
        if (!panel.isConnected || hashes !== results) return;
        try { await hash(file, results); ++completed; }
        catch { ++failed; }
        if (!panel.isConnected || hashes !== results) return;
        batchStatus.textContent = `已完成 ${completed} / ${matches.length}，失败 ${failed}`;
      }
      if (hashes === results) {
        batchStatus.textContent += `，跳过 ${matches.length - completed - failed} 个不支持校验的文件。`;
      }
    } finally {
      batching = false;
      if (panel.isConnected) render();
    }
  });
  function render() {
    const matches = matchingFiles();
    batch.disabled = Boolean(active) || batching || !matches.some(file => canHash(file) && !hashes.has(file));
    matches.sort((a, b) => {
      if (sort.value === 'size' && a.size !== b.size) return b.size - a.size;
      if (sort.value === 'date' && a.lastModified !== b.lastModified) return b.lastModified - a.lastModified;
      return pathOf(a).localeCompare(pathOf(b), undefined, { numeric: true });
    });
    const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
    page = Math.min(page, pageCount - 1);
    status.textContent = selected.length
      ? `${matches.length} / ${selected.length} 个文件 · 第 ${page + 1} / ${pageCount} 页`
      : '请选择文件或文件夹。';
    previous.disabled = page === 0;
    next.disabled = page + 1 >= pageCount;
    list.replaceChildren();
    for (const file of matches.slice(page * pageSize, (page + 1) * pageSize)) {
      const row = element('li');
      const name = pathOf(file);
      row.append(element('span', `${name} · ${file.size.toLocaleString()} 字节`));
      const output = element('output');
      output.textContent = hashes.get(file) || (active === file ? '计算中…' : '');
      const button = element('button', '计算 SHA-256');
      button.className = 'control';
      button.type = 'button';
      button.disabled = Boolean(active) || batching || hashes.has(file);
      if (!globalThis.crypto?.subtle || file.size > maxHashBytes) {
        button.disabled = true;
        output.textContent = file.size > maxHashBytes ? '校验上限为 32 MiB' : '校验需要安全上下文';
      }
      button.addEventListener('click', async () => {
        if (active || batching) return;
        active = file;
        const results = hashes;
        render();
        try {
          await hash(file, results);
        } catch {
          status.textContent = '读取文件失败，请重新选择。';
        } finally {
          active = null;
          if (panel.isConnected) {
            const failed = hashes === results && !results.has(file);
            render();
            if (failed) status.textContent = '读取文件失败，可以重试或重新选择。';
          }
        }
      });
      row.append(button, output);
      list.append(row);
    }
  }

  for (const picker of [input, folder]) {
    picker.addEventListener('change', () => {
      selected = Array.from(picker.files ?? []);
      hashes = new WeakMap();
      batchStatus.textContent = '';
      input.value = '';
      folder.value = '';
      page = 0;
      render();
    });
  }
  filter.addEventListener('input', () => { page = 0; render(); });
  sort.addEventListener('change', () => { page = 0; render(); });
  previous.addEventListener('click', () => { --page; render(); });
  next.addEventListener('click', () => { ++page; render(); });
  render();
  return panel;
}
