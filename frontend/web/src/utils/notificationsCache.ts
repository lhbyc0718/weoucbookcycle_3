const DB_NAME = 'weouc_notifications_db_v1';
const STORE_KEY = 'notifications_list';
const STORE = 'kv';
const MAX_ITEMS = 100;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getKV(key: string): Promise<any> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const r = store.get(key);
      r.onsuccess = () => resolve(r.result ? r.result.value : null);
      r.onerror = () => reject(r.error);
    });
  } catch (e) {
    // fallback to localStorage
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }
}

async function setKV(key: string, value: any): Promise<void> {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const r = store.put({ key, value });
      r.onsuccess = () => resolve(undefined);
      r.onerror = () => reject(r.error);
    });
  } catch (e) {
    // fallback
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
}

export async function loadNotificationsFromCache(): Promise<any[]> {
  try {
    const data = await getKV(STORE_KEY);
    if (!data) return [];
    if (!Array.isArray(data)) return [];
    return data.slice(0, MAX_ITEMS);
  } catch (e) {
    console.error('failed to read notifications cache', e);
    return [];
  }
}

export async function saveNotificationsToCache(items: any[]) {
  try {
    const slice = (items || []).slice(0, MAX_ITEMS);
    await setKV(STORE_KEY, slice);
  } catch (e) {
    console.error('failed to write notifications cache', e);
  }
}

export async function prependNotificationToCache(item: any) {
  try {
    const cur = (await loadNotificationsFromCache()) || [];
    const exists = cur.find((i: any) => i.id === item.id);
    const arr = exists ? cur.map((i: any) => i.id === item.id ? item : i) : [item, ...cur];
    await saveNotificationsToCache(arr);
  } catch (e) {
    console.error('failed to prepend notification cache', e);
  }
}

export async function markNotificationReadInCache(id: string) {
  try {
    const cur = (await loadNotificationsFromCache()) || [];
    const arr = cur.map((i: any) => i.id === id ? { ...i, is_read: true } : i);
    await saveNotificationsToCache(arr);
  } catch (e) {
    console.error('failed to mark read in cache', e);
  }
}
