import React, { useEffect, useState } from 'react';
import { notificationApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { loadNotificationsFromCache, saveNotificationsToCache, prependNotificationToCache, markNotificationReadInCache } from '../utils/notificationsCache';
import { motion, AnimatePresence } from 'framer-motion';

const BTN_CLASSES = 'px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm';

export default function Notifications() {
  const [filter, setFilter] = useState<'all'|'initiate'|'cancel'|'confirm'|'new'>('all');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();

  const fetch = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (filter === 'new') params.new = true;
      if (filter === 'initiate' || filter === 'cancel' || filter === 'confirm') params.type = filter;
      const res: any = await notificationApi.list(params);
      const list = Array.isArray(res) ? res : (res && res.data) || [];
      setItems(list);
      // cache latest (async)
      try { await saveNotificationsToCache(list); } catch (e) {}
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [filter]);

  // 请求浏览器通知权限（页面首次打开时）
  useEffect(() => {
    setMounted(true);
    // load cache first (async)
    (async () => {
      try {
        const cached = await loadNotificationsFromCache();
        if (cached && cached.length > 0) setItems(cached);
      } catch (e) {
        console.warn('load cache failed', e);
      }
    })();
    if (window.Notification && Notification.permission === 'default') {
      try {
        Notification.requestPermission();
      } catch (e) {}
    }
  }, []);

  // 监听全局实时通知事件（由 MainLayout 分发）
  useEffect(() => {
    const onReceived = (e: any) => {
      const payload = (e as CustomEvent).detail;
      const data = payload && payload.data ? payload.data : payload;
      // only prepend if matches current filter
      if (!data) return;
      const action = data.action || null;
      if (action === 'created' || action === null) {
        // optionally filter by type
        if (filter === 'all' || filter === 'new' || filter === data.type) {
          setItems(prev => { const next = [data, ...prev].slice(0,50); try { saveNotificationsToCache(next); } catch {} return next; });
          // async prepend
          prependNotificationToCache(data).catch(() => {});
        }
      } else if (action === 'read') {
        setItems(prev => { const next = prev.map(i => i.id === data.id ? { ...i, is_read: true } : i); try { markNotificationReadInCache(data.id); saveNotificationsToCache(next); } catch {} return next; });
      } else if (action === 'mark_all_read') {
        setItems(prev => { const next = prev.map(i => ({ ...i, is_read: true })); try { saveNotificationsToCache(next); } catch {} return next; });
      }
    };
    window.addEventListener('notification:received', onReceived as EventListener);
    window.addEventListener('notification:read', onReceived as EventListener);
    window.addEventListener('notification:marked_all', () => setItems(prev => prev.map(i => ({ ...i, is_read: true }))));
    return () => {
      window.removeEventListener('notification:received', onReceived as EventListener);
      window.removeEventListener('notification:read', onReceived as EventListener);
      window.removeEventListener('notification:marked_all', () => setItems(prev => prev.map(i => ({ ...i, is_read: true }))));
    };
  }, [filter]);

  const onMarkRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setItems(prev => { const next = prev.map(i => i.id === id ? { ...i, is_read: true } : i); try { markNotificationReadInCache(id); saveNotificationsToCache(next); } catch {} return next; });
    } catch (e) { console.error(e); }
  };

  const openTransaction = async (notif: any) => {
    try {
      const data = typeof notif.data === 'string' ? JSON.parse(notif.data || '{}') : (notif.data || {});
      if (data.transaction_id) {
        try {
          await notificationApi.markRead(notif.id);
        } catch (_) {}
        try { await markNotificationReadInCache(notif.id); } catch (_) {}
        setItems(prev => prev.map(i => i.id === notif.id ? { ...i, is_read: true } : i));
        navigate(`/transactions/${data.transaction_id}`);
        return;
      }
    } catch (e) {
      console.error(e);
    }
    const txId = notif.transaction_id || (typeof notif.data === 'string' ? (() => { try { return JSON.parse(notif.data || '{}').transaction_id } catch { return null } })() : notif.data && notif.data.transaction_id);
    if (txId) navigate(`/transactions/${txId}`);
    else navigate('/transactions');
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-4">通知</h1>

      <div className="flex gap-3 mb-6 items-center">
        <button className={`${BTN_CLASSES} ${filter==='all'?'bg-gray-900 text-white':'bg-white text-gray-700'}`} onClick={() => setFilter('all')}>全部</button>
        <button className={`${BTN_CLASSES} ${filter==='new'?'bg-yellow-400 text-white':'bg-white text-gray-700'}`} onClick={() => setFilter('new')}>只看新的</button>
        <button className={`${BTN_CLASSES} ${filter==='initiate'?'bg-blue-600 text-white':'bg-white text-gray-700'}`} onClick={() => setFilter('initiate')}>只看新的发起交易</button>
        <button className={`${BTN_CLASSES} ${filter==='cancel'?'bg-red-600 text-white':'bg-white text-gray-700'}`} onClick={() => setFilter('cancel')}>只看新的取消交易</button>
        <button className={`${BTN_CLASSES} ${filter==='confirm'?'bg-green-600 text-white':'bg-white text-gray-700'}`} onClick={() => setFilter('confirm')}>只看新的确认收书</button>
      </div>

      <div className="space-y-3">
        {loading && <div className="p-4 bg-white rounded shadow text-center">加载中...</div>}
        {!loading && items.length === 0 && <div className="p-6 bg-white rounded shadow text-center text-gray-500">暂无通知</div>}

        <AnimatePresence>
        {items.map((n, idx) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.28, delay: idx * 0.03 }}
            className={`p-4 bg-white rounded-lg shadow-md transform transition-all duration-300 hover:-translate-y-1 hover:shadow-lg flex items-start gap-4 ${n.is_read ? 'opacity-70' : 'border-2 border-yellow-100'}`}
          >
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">{n.type}</div>
                <div className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</div>
              </div>
              <div className="mt-2 text-gray-800 text-base">
                <div className="flex items-center gap-3">
                  {(() => {
                    let d: any = n.data || n;
                    if (typeof d === 'string') {
                      try { d = JSON.parse(d); } catch (e) {}
                    }
                    const cover = d && (d.cover || d.cover_url || d.coverUrl);
                    const title = d && (d.title || d.book_title || n.title) || '查看详情';
                    return (
                      <>
                        {cover ? (
                          <img src={cover} onClick={() => openTransaction(n)} className="w-20 h-28 object-cover rounded cursor-pointer shadow-sm" />
                        ) : (
                          <div onClick={() => openTransaction(n)} className="w-20 h-28 bg-gray-100 rounded flex items-center justify-center cursor-pointer">📚</div>
                        )}
                        <div>
                          <div className="font-bold">{title}</div>
                          <div className="text-sm text-gray-600 mt-1">{d && d.price ? `¥${d.price}` : ''}</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => onMarkRead(n.id)} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">标为已读</button>
                <button onClick={() => openTransaction(n)} className="px-3 py-1 rounded bg-gray-100 text-gray-800 text-sm">查看交易</button>
              </div>
            </div>
          </motion.div>
        ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
