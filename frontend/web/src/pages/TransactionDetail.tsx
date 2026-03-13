import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { transactionApi, userApi } from '../services/api';
import { HiArrowLeft } from 'react-icons/hi';
import { toast } from 'react-hot-toast';

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res: any = await transactionApi.getTransaction(id as string);
        const data = res && res.data ? res.data : res;
        setTx(data);
        // 获取当前用户 id，用以判断是否显示操作按钮
        try {
          const me: any = await userApi.getMyProfile();
          const meData = me && me.data ? me.data : me;
          setCurrentUserId(meData?.id || null);
        } catch (e) {
          setCurrentUserId(null);
        }
      } catch (e) {
        console.error(e);
        setErrorMsg(String(e || 'Failed to load transaction'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // 如果交易对象中没有 buyer/seller 的名称，尝试查询用户信息补全显示名
  useEffect(() => {
    if (!tx) return;

    const fetchNames = async () => {
      try {
        if ((!tx.buyer || !tx.buyer.name) && tx.buyer_id) {
          const u: any = await userApi.getUser(tx.buyer_id);
          const udata = u && u.data ? u.data : u;
          setTx((prev: any) => ({ ...prev, buyer: udata }));
        }
      } catch (e) {
        // ignore
      }

      try {
        if ((!tx.seller || !tx.seller.name) && tx.seller_id) {
          const u: any = await userApi.getUser(tx.seller_id);
          const udata = u && u.data ? u.data : u;
          setTx((prev: any) => ({ ...prev, seller: udata }));
        }
      } catch (e) {
        // ignore
      }
    };

    fetchNames();
  }, [tx]);

  if (loading) return <div className="p-8 text-center">加载中...</div>;
  if (errorMsg) return <div className="p-8 text-center text-red-600">加载失败: {errorMsg}</div>;
  if (!tx) return <div className="p-8 text-center">未找到交易</div>;

  const book = tx.listing?.book || tx.listing || {};
  const createdAt = tx.created_at ? new Date(tx.created_at).toLocaleString() : '';
  const statusMap: Record<string, string> = {
    pending: '待确认',
    in_progress: '交易中',
    completed: '已完成',
    cancelled: '已取消',
    confirmed: '已确认',
  };
  const displayStatus = statusMap[tx.status] || tx.status || '';
 

  return (
    <div className="max-w-3xl mx-auto py-8">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <HiArrowLeft /> 返回
      </button>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex gap-4">
            <div className="w-28 h-36 bg-gray-100 rounded overflow-hidden">
            {book.images ? (
              (() => {
                try {
                  const imgs = typeof book.images === 'string' ? JSON.parse(book.images) : book.images;
                  const src = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
                  return src ? <img src={src} alt={book.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">📚</div>;
                } catch (err) {
                  return <div className="w-full h-full flex items-center justify-center">📚</div>;
                }
              })()
            ) : (
              <div className="w-full h-full flex items-center justify-center">📚</div>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{book.title || '未知书籍'}</h2>
            <div className="mt-2 text-gray-600">金额: ¥{tx.amount}</div>
            <div className="mt-1 text-gray-600">状态: {displayStatus}</div>
            <div className="mt-1 text-gray-600">创建时间: {createdAt}</div>
            <div className="mt-1 text-gray-600">买家: {(tx.buyer && (tx.buyer.name || tx.buyer.username || tx.buyer.display_name)) || tx.buyer_id}</div>
            <div className="mt-1 text-gray-600">卖家: {(tx.seller && (tx.seller.name || tx.seller.username || tx.seller.display_name)) || tx.seller_id}</div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h3 className="font-bold mb-2">交易记录</h3>
          <div className="flex items-center gap-2">
            {/* 操作按钮：卖家确认、买家取消等 */}
            {tx.status === 'pending' && currentUserId && currentUserId === tx.seller_id && (
              <button
                onClick={async () => {
                  try {
                    await transactionApi.confirmTransaction(id as string);
                    toast.success('已确认交易');
                    // 刷新
                    const res: any = await transactionApi.getTransaction(id as string);
                    setTx(res && res.data ? res.data : res);
                  } catch (e: any) {
                    console.error(e);
                    toast.error(e?.message || '确认失败');
                  }
                }}
                className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
              >
                确认交易
              </button>
            )}
            {tx.status === 'pending' && currentUserId && currentUserId === tx.buyer_id && (
              <button
                onClick={async () => {
                  try {
                    await transactionApi.cancelTransaction(id as string);
                    toast.success('已取消交易');
                    const res: any = await transactionApi.getTransaction(id as string);
                    setTx(res && res.data ? res.data : res);
                  } catch (e: any) {
                    console.error(e);
                    toast.error(e?.message || '取消失败');
                  }
                }}
                className="px-3 py-1 rounded bg-red-500 text-white text-sm"
              >
                取消交易
              </button>
            )}

            <button onClick={() => setShowRaw(v => !v)} className="text-sm text-gray-600 hover:text-gray-900">
              {showRaw ? '隐藏原始数据' : '查看原始数据'}
            </button>
          </div>
        </div>

        {showRaw ? (
          <div className="mt-4">
            <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">{JSON.stringify(tx, null, 2)}</pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
