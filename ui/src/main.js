import { version, desktop } from './build.js';
import { fileManager } from './file-manager.js';
import { dataWorkshop } from './data-workshop.js';
import { browserCapabilities, savedTheme, saveTheme } from '../platform/browser-services.js';

const modules = [
  ['files', '文件管理中心', '浏览、筛选和校验本地文件'],
  ['data', '数据工坊', '本地 CSV 导入、筛选与 JSON 导出'],
  ['disks', '磁盘实验室', '经授权的磁盘分析和实验'],
  ['system', '系统诊断中心', '系统信息与诊断'],
  ['network', '网络实验室', '网络检查与诊断'],
  ['developer', '开发者工具箱', '开发辅助工具'],
  ['security', '文件安全中心', '完整性与安全分析'],
  ['text', '文本与搜索中心', '文本处理与检索'],
  ['reports', '报告与统计中心', '本地报告与统计'],
  ['extensions', '扩展与插件中心', '扩展管理与受控插件']
];

const main = document.querySelector('main');
const search = document.querySelector('#search');
const navigation = document.querySelector('#navigation');
const notice = document.querySelector('#notice');
const media = matchMedia('(prefers-color-scheme: dark)');
const capabilities = browserCapabilities();
const preferences = ['system', 'light', 'dark'];
const saved = savedTheme();
let preference = preferences.includes(saved) ? saved : 'system';
let cards;
let results;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function link(route, label, className) {
  const node = element('a', label, className);
  node.href = '#' + route;
  return node;
}

function applyTheme() {
  const theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#10151e' : '#f2f5f8';
  document.querySelector('#theme').textContent = theme === 'dark' ? '浅色主题' : '深色主题';
}

function changeTheme(value) {
  preference = value;
  applyTheme();
  if (!saveTheme(value)) notice.textContent = '主题已应用，当前环境无法保存偏好。';
  const selector = document.querySelector('#theme-preference');
  if (selector) selector.value = value;
}

function section(title, description) {
  const node = element('section', undefined, 'panel');
  node.append(element('h2', title), element('p', description));
  return node;
}

function heading(title, detail, badge = 'FORGEDESK WORKSPACE') {
  main.append(element('span', badge, 'eyebrow'), element('h1', title), element('p', detail));
}

function filterModules() {
  if (!cards) return;
  const query = search.value.trim().toLowerCase();
  const matches = modules.filter(module => module.join(' ').toLowerCase().includes(query));
  cards.replaceChildren();
  for (const [id, name, description] of matches) {
    const card = link(id, undefined, 'card');
    card.append(element('h2', name), element('p', description),
      element('span', ['files', 'data'].includes(id) ? '可用' : '计划中', 'badge'));
    cards.append(card);
  }
  results.textContent = matches.length ? `${matches.length} 个功能中心` : '没有匹配的功能中心';
}

function home() {
  heading('技术工作台', '浏览 ForgeDesk 的功能规划、平台能力和基础服务状态。');
  const area = element('section', undefined, 'section');
  results = element('h2');
  results.setAttribute('aria-live', 'polite');
  cards = element('div', undefined, 'cards');
  area.append(results, cards);
  const panels = element('div', undefined, 'panels section');
  const tasks = section('后台任务', '当前界面尚未接入任务服务。');
  const logs = section('日志', '查看当前平台的日志接入状态。');
  logs.append(link('logs', '查看日志状态'));
  panels.append(tasks, logs);
  main.append(area, panels);
  filterModules();
}

function settings() {
  heading('设置', '主题偏好仅保存在当前浏览器或桌面应用配置中。');
  const appearance = section('外观', '切换工作台显示主题。');
  const selector = element('select');
  selector.id = 'theme-preference';
  const label = element('label', '主题 ');
  label.htmlFor = selector.id;
  for (const [value, name] of [['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']]) {
    const option = element('option', name);
    option.value = value;
    selector.append(option);
  }
  selector.value = preference;
  selector.addEventListener('change', () => changeTheme(selector.value));
  appearance.append(label, selector);
  const status = section('平台能力', '能力检测基于当前环境。文件与剪贴板操作仍需浏览器授权。');
  const descriptions = {
    fileSelection: '文件选择', download: '下载文件', clipboard: '剪贴板',
    storage: '本地存储', fileAccess: '受授权文件访问 API'
  };
  const rows = element('dl');
  for (const [key, name] of Object.entries(descriptions)) {
    rows.append(element('dt', name), element('dd', capabilities[key] ? '支持' : '当前环境不支持'));
  }
  status.append(rows);
  const panels = element('div', undefined, 'panels section');
  panels.append(appearance, status);
  main.append(panels);
}

function route() {
  const hash = location.hash.slice(1);
  if (hash === 'main') return;
  const module = modules.find(([id]) => id === hash);
  const page = module || ['settings', 'logs'].includes(hash) ? hash : 'home';
  main.replaceChildren();
  cards = undefined;
  results = undefined;
  for (const item of navigation.querySelectorAll('a')) {
    if (item.getAttribute('href') === '#' + page) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  }
  if (page === 'home') {
    home();
    return;
  }
  main.append(link('home', '← 返回工作台', 'back'));
  if (page === 'settings') settings();
  else if (page === 'logs') heading('日志状态', '当前界面尚未连接日志服务。');
  else if (page === 'files') {
    heading('文件管理中心', '在本机浏览、筛选和校验你选择的文件。');
    main.append(fileManager());
  } else if (page === 'data') {
    heading('数据工坊', '导入 CSV 并在本机筛选、预览与导出记录。');
    main.append(dataWorkshop());
  } else heading(module[1], module[2], '计划中 / Coming Soon');
}

for (const [id, name] of [['home', '工作台'], ...modules, ['settings', '设置'], ['logs', '日志状态']]) {
  navigation.append(link(id, name));
}
document.querySelector('#version').textContent = 'v' + version;
document.querySelector('#platform-status').textContent = desktop ? 'Windows 桌面宿主' : '网页工作台';
document.querySelector('#theme').addEventListener('click', () => {
  changeTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
media.addEventListener('change', applyTheme);
search.addEventListener('input', () => {
  if (cards) filterModules();
  else location.hash = 'home';
});
document.querySelector('#search-form').addEventListener('submit', event => {
  event.preventDefault();
  if (cards) filterModules();
  else location.hash = 'home';
});
addEventListener('hashchange', () => {
  route();
  if (document.activeElement !== search) main.focus();
});
addEventListener('offline', () => { notice.textContent = '当前处于离线状态。'; });
addEventListener('online', () => { notice.textContent = '浏览器报告网络已恢复。'; });
applyTheme();
if (location.hash === '#main') history.replaceState(null, '', '#home');
route();

if (!desktop && isSecureContext && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').then(() => {
    return navigator.serviceWorker.ready;
  }).then(() => {
    notice.textContent = navigator.onLine ? '工作台资源已缓存，可离线访问。' : '正在离线使用工作台。';
  }).catch(() => { notice.textContent = '离线缓存暂不可用。'; });
} else if (!desktop) {
  notice.textContent = '离线安装需要 HTTPS 或 localhost。';
}
