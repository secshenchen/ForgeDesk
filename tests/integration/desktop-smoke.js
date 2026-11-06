(async () => {
  const assert = (value, label) => { if (!value) throw Error(label); };
  async function until(test) {
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      if (test()) return;
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    throw Error('Desktop state timeout');
  }
  async function route(name) {
    chrome.webview.postMessage('forgedesk:test:stage:' + name);
    await new Promise(resolve => {
      addEventListener('hashchange', resolve, { once: true });
      location.hash = name;
    });
  }
  const button = text => Array.from(document.querySelectorAll('main button')).find(b => b.textContent === text);
  async function exported(text) {
    const click = HTMLAnchorElement.prototype.click;
    const create = URL.createObjectURL;
    let payload;
    URL.createObjectURL = function (blob) {
      payload = blob.text().then(JSON.parse);
      return create.call(URL, blob);
    };
    HTMLAnchorElement.prototype.click = function () {};
    try {
      button(text).click();
      assert(payload, 'Export link missing');
      return await payload;
    } finally {
      HTMLAnchorElement.prototype.click = click;
      URL.createObjectURL = create;
    }
  }
  const set = (input, value) => { input.value = value; input.dispatchEvent(new Event('input')); };
  function select(input, files) {
    const transfer = new DataTransfer();
    files.forEach(file => transfer.items.add(file));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
  }
  try {
    chrome.webview.postMessage('forgedesk:test:stage:start');
    await until(() => document.querySelectorAll('.card').length === 10);
    await route('system');
    await until(() => document.querySelector('main pre')?.textContent.includes('Windows 原生架构'));
    assert((await exported('导出诊断 JSON')).windows.logicalProcessors > 0, 'System export');
    await route('disks');
    button('读取固定卷容量').click();
    await until(() => !button('导出卷容量 JSON').disabled);
    assert(Array.isArray(await exported('导出卷容量 JSON')), 'Volume export');
    assert(!document.querySelector('main pre').textContent.includes('超时'), 'Native volumes');
    await route('files');
    select(document.querySelector('#file-picker'), [new File(['abc'], 'a.txt'), new File(['xyz'], 'b.txt')]);
    button('校验全部匹配文件').click();
    await until(() => document.querySelectorAll('#file-results output').length === 2 &&
      Array.from(document.querySelectorAll('#file-results output')).every(o => /^[a-f0-9]{64}$/.test(o.textContent)));
    await route('data');
    select(document.querySelector('main input[type=file]'), [new File(['a,b\n1,2'], 'x.csv')]);
    await until(() => document.querySelector('.data-preview').textContent.includes('"2"'));
    assert(JSON.stringify(await exported('将匹配记录导出为 JSON')) === '[["a","b"],["1","2"]]', 'CSV export');
    await route('network');
    set(document.querySelector('main input'), '192.168.1.42/24');
    button('计算地址范围').click();
    await until(() => document.querySelector('main pre').textContent.includes('192.168.1.255'));
    await route('developer');
    set(document.querySelector('main textarea'), '{"x":1}');
    button('校验并格式化').click();
    await until(() => document.querySelector('main pre').textContent.includes('"x": 1'));
    await route('security');
    select(document.querySelector('main input[type=file]'), [new File(['abc'], 'a.txt')]);
    set(document.querySelector('main input:not([type=file])'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    button('验证文件').click();
    await until(() => document.querySelector('main pre').textContent.startsWith('匹配'));
    await route('text');
    set(document.querySelector('main input'), 'foo');
    set(document.querySelector('main textarea'), 'abc\nFOO');
    button('搜索匹配行').click();
    await until(() => document.querySelector('main pre').textContent.includes('2: FOO'));
    await route('reports');
    set(document.querySelector('main textarea'), 'a,b\n1,');
    button('生成统计').click();
    await until(() => document.querySelector('main pre').textContent.includes('空单元格：1'));
    await route('extensions');
    set(document.querySelector('main textarea'), '{"name":"test","description":"fixture"}');
    button('保存本地扩展登记').click();
    await until(() => document.querySelector('main pre').textContent.includes('已登记'));
    chrome.webview.postMessage('forgedesk:test:pass');
  } catch (error) {
    console.error(error);
    chrome.webview.postMessage('forgedesk:test:fail:' + location.hash + ':' + error.message);
  }
})();
