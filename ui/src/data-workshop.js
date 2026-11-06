const maxBytes = 5 * 1024 * 1024;
const previewLimit = 100;

export function parseCsv(input, delimiter = ',') {
  if (input.length > maxBytes) throw new Error('表格超过 5 MiB 字符限制。');
  if (![',', ';', '\t'].includes(delimiter)) throw new Error('不支持该分隔符。');
  const text = input.replace(/^\ufeff/, '');
  if (!text) return [];
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let closed = false;

  for (let i = 0; i < text.length; ++i) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') {
        field += '"';
        ++i;
      } else {
        quoted = false;
        closed = true;
      }
    } else if (char === delimiter || char === '\r' || char === '\n') {
      row.push(field);
      field = '';
      closed = false;
      if (char !== delimiter) {
        rows.push(row);
        if (rows.length > 100000) throw new Error('表格记录超过 100,000 条。');
        row = [];
        if (char === '\r' && text[i + 1] === '\n') ++i;
      }
    } else if (closed || (char === '"' && field.length)) {
      throw new Error(`第 ${rows.length + 1} 条记录的引号格式不正确。`);
    } else if (char === '"') {
      quoted = true;
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error(`第 ${rows.length + 1} 条记录的引号未闭合。`);
  if (row.length || field.length || closed) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function dataWorkshop() {
  const panel = element('section');
  panel.className = 'panel file-manager';
  const picker = element('input');
  picker.type = 'file';
  picker.accept = '.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain';
  const label = element('label', '选择 UTF-8 表格文件 ');
  label.append(picker);
  const delimiterLabel = element('label', '导入分隔符 ');
  const delimiter = element('select');
  for (const [value, text] of [[',', '逗号'], [';', '分号'], ['\t', '制表符']]) {
    const option = element('option', text);
    option.value = value;
    delimiter.append(option);
  }
  delimiterLabel.append(delimiter);
  const query = element('input');
  query.type = 'search';
  const filterLabel = element('label', '筛选包含文字的记录 ');
  filterLabel.append(query);
  const status = element('p', '选择文件开始。文件仅在本机处理。');
  status.setAttribute('role', 'status');
  const download = element('button', '将匹配记录导出为 JSON');
  download.className = 'control';
  download.type = 'button';
  download.disabled = true;
  const preview = element('pre');
  preview.className = 'data-preview';
  panel.append(delimiterLabel, label, filterLabel, download, status, preview);

  let rows = null;
  let filtered = [];
  let generation = 0;
  function render() {
    if (!rows) return;
    const term = query.value.trim().toLowerCase();
    filtered = rows.filter(row => row.some(cell => cell.toLowerCase().includes(term)));
    preview.textContent = JSON.stringify(filtered.slice(0, previewLimit), null, 2).slice(0, 24000);
    status.textContent = `${filtered.length} / ${rows.length} 条记录 · 预览最多 ${previewLimit} 条、24,000 字符`;
    download.disabled = !filtered.length;
  }

  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    const current = ++generation;
    const separator = delimiter.value;
    picker.value = '';
    if (!file || file.size > maxBytes) {
      status.textContent = '请选择 5 MiB 以内的数据文件。已有数据仍可使用。';
      return;
    }
    status.textContent = '读取中…';
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      if (generation !== current) return;
      rows = parseCsv(text, separator);
      render();
    } catch (error) {
      if (generation === current) status.textContent = `导入失败。 ${error.message} 已有数据仍可使用。`;
    }
  });
  query.addEventListener('input', render);
  download.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = element('a');
    anchor.href = url;
    anchor.download = 'forgedesk-rows.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return panel;
}
