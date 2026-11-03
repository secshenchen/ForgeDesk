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
  pages.append(previous, next);
  panel.append(filesLabel, folderLabel, filterLabel, status, list, pages);

  let selected = [];
  let page = 0;
  function render() {
    const query = filter.value.trim().toLowerCase();
    const matches = selected.filter(file =>
      (file.webkitRelativePath || file.name).toLowerCase().includes(query));
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
      const name = file.webkitRelativePath || file.name;
      row.append(element('span', `${name} · ${file.size.toLocaleString()} 字节`));
      const output = element('output');
      const button = element('button', '计算 SHA-256');
      button.className = 'control';
      button.type = 'button';
      if (!globalThis.crypto?.subtle || file.size > maxHashBytes) {
        button.disabled = true;
        output.textContent = file.size > maxHashBytes ? '校验上限为 32 MiB' : '校验需要安全上下文';
      }
      button.addEventListener('click', async () => {
        button.disabled = true;
        output.textContent = '计算中…';
        try {
          const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
          output.textContent = Array.from(new Uint8Array(digest), byte =>
            byte.toString(16).padStart(2, '0')).join('');
        } catch {
          output.textContent = '读取文件失败，请重新选择。';
          button.disabled = false;
        }
      });
      row.append(button, output);
      list.append(row);
    }
  }

  for (const picker of [input, folder]) {
    picker.addEventListener('change', () => {
      selected = Array.from(picker.files ?? []);
      input.value = '';
      folder.value = '';
      page = 0;
      render();
    });
  }
  filter.addEventListener('input', () => { page = 0; render(); });
  previous.addEventListener('click', () => { --page; render(); });
  next.addEventListener('click', () => { ++page; render(); });
  render();
  return panel;
}
