export function browserCapabilities() {
  const picker = document.createElement('input');
  picker.type = 'file';
  const fileSelection = picker.type === 'file' && 'files' in picker && typeof File !== 'undefined';
  let storage = false;
  try {
    const key = 'forgedesk.storage-probe';
    const previous = localStorage.getItem(key);
    localStorage.setItem(key, 'ok');
    storage = localStorage.getItem(key) === 'ok';
    if (previous === null) localStorage.removeItem(key);
    else localStorage.setItem(key, previous);
  } catch {
    // The browser may disable storage in the current context.
  }
  return {
    fileSelection,
    download: 'download' in document.createElement('a') && typeof URL.createObjectURL === 'function',
    clipboard: isSecureContext && typeof navigator.clipboard?.writeText === 'function',
    storage,
    fileAccess: isSecureContext && typeof globalThis.showOpenFilePicker === 'function'
  };
}

export function savedTheme() {
  try { return localStorage.getItem('forgedesk.theme'); }
  catch { return null; }
}

export function saveTheme(theme) {
  try {
    localStorage.setItem('forgedesk.theme', theme);
    return true;
  } catch {
    return false;
  }
}
