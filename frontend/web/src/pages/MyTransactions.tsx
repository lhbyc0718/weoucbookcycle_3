import { useEffect, useState, useMemo } from 'react';
import { transactionApi } from '../services/api';
import { toast } from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { HiCheckCircle, HiClock, HiShoppingBag } from 'react-icons/hi';

interface Tx {
  id: string;
  listing_id?: string;
  buyer_id?: string;
  seller_id?: string;
  amount?: number;
  status?: string;
  listing?: any;
  created_at?: string;
  completed_at?: string;
  is_reviewed?: boolean;
}

export default function MyTransactions() {
  const [activeTab, setActiveTab] = useState<'pending' | 'inprogress' | 'completed'>('pending');
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluatedIds, setEvaluatedIds] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    setCurrentUserId(userInfo.id || null);

    (async () => {
      await loadData();
      // 访问交易页时，尝试清除后端的交易未读标记
      try {
        await transactionApi.clearUnread();
        // 通知全局（MainLayout）将徽章清零
        window.dispatchEvent(new CustomEvent('transactions:cleared'));
      } catch (e) {
        // 忽略错误（后端接口可能尚未实现）
      }
    })();
    // 监听通知打开事件，跳转并定位到指定交易
    const onOpen = (e: any) => {
      const detail = (e as CustomEvent).detail || {};
      const txId = detail.transaction_id || detail.transactionId || detail.id;
      if (!txId) return;
      // 如果数据已加载，尝试滚动到该交易
      setTimeout(() => {
        const el = document.querySelector(`[data-tx-id="${txId}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 600);
    };
    window.addEventListener('notification:open', onOpen as EventListener);
    return () => window.removeEventListener('notification:open', onOpen as EventListener);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await transactionApi.getMyTransactions();
      const data = (res as any).data || res;
      setTxs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error('获取交易失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    openModal('取消交易', '确认要取消此交易吗？取消后双方将不再继续进行本次交易。', '取消交易', '取消', 'cancel', id);
  };

  const handleConfirmReceipt = async (id: string) => {
    openModal('确认收书', '确认已收到书籍吗？此操作将完成交易，卖家会收到通知。', '确认收到', '取消', 'confirmReceipt', id);
  };

  const handleConfirmTransactionAsSeller = async (id: string) => {
    openModal('接受交易', '确认要接受此买家的交易请求吗？接受后书籍将进入“交易中”状态。', '接受请求', '再想想', 'confirmTransaction', id);
  };

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalDesc, setModalDesc] = useState('');
  const [modalConfirmText, setModalConfirmText] = useState('确认');
  const [modalCancelText, setModalCancelText] = useState('取消');
  const [modalAction, setModalAction] = useState<'cancel' | 'confirmReceipt' | 'confirmTransaction' | 'review' | null>(null);
  const [modalTxId, setModalTxId] = useState<string | null>(null);

  // 评价状态
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalTx, setEvalTx] = useState<Tx | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');

  const openModal = (title: string, desc: string, confirmText: string, cancelText: string, action: 'cancel'|'confirmReceipt'|'confirmTransaction'|'review', txId: string) => {
    setModalTitle(title);
    setModalDesc(desc);
    setModalConfirmText(confirmText);
    setModalCancelText(cancelText);
    setModalAction(action);
    setModalTxId(txId);
    setModalOpen(true);
    // 重置评价状态
    if (action === 'review') {
        setReviewRating(5);
        setReviewContent('');
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalAction(null);
    setModalTxId(null);
  };

  const performModalAction = async () => {
    if (!modalAction || !modalTxId) return closeModal();
    try {
      if (modalAction === 'cancel') {
        await transactionApi.cancelTransaction(modalTxId);
        toast.success('已取消交易');
        setTxs(prev => prev.filter(t => t.id !== modalTxId));
      } else if (modalAction === 'confirmReceipt') {
        await transactionApi.confirmReceipt(modalTxId);
        toast.success('确认收书，交易完成');
        setTxs(prev => prev.map(t => t.id === modalTxId ? { ...t, status: 'completed' } : t));
        // 自动弹出评价窗口
        setTimeout(() => {
            openModal('评价交易', '请对本次交易进行评价', '提交评价', '稍后评价', 'review', modalTxId);
        }, 500);
        return; // 不关闭，由 setTimeout 打开新 modal
      } else if (modalAction === 'confirmTransaction') {
        await transactionApi.confirmTransaction(modalTxId);
        toast.success('已接受交易，书籍标为交易中');
        setTxs(prev => prev.map(t => t.id === modalTxId ? { ...t, status: 'in_progress' } : t));
      } else if (modalAction === 'review') {
        await transactionApi.reviewTransaction(modalTxId, { rating: reviewRating, review: reviewContent });
        toast.success('评价成功');
        setEvaluatedIds(prev => [...prev, modalTxId]);
        // 成功评价后从列表中移除（如果是在未评价列表中）
        setTxs(prev => prev.map(t => t.id === modalTxId ? { ...t, is_reviewed: true } : t));
      }
    } catch (e) {
      console.error(e);
      toast.error('操作失败');
    } finally {
      closeModal();
    }
  };

  const handleReview = (id: string) => {
    openModal('评价交易', '请对本次交易进行评价', '提交评价', '取消', 'review', id);
  };

  const incomplete = useMemo(() => txs.filter(t => t.status === 'pending' || t.status === 'in_progress'), [txs]);
  // 过滤掉卖家视角的交易（因为只有买家可以评价）
  const completed = useMemo(() => txs.filter(t => t.status === 'completed' && !t.is_reviewed && !evaluatedIds.includes(t.id) && t.buyer_id === currentUserId), [txs, evaluatedIds, currentUserId]);

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'pending': return '待卖家确认';
      case 'in_progress': return '进行中';
      case 'completed': return '已完成';
      default: return status;
    }
  };

  return (
    <div className="bg-gray-50/50 min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
            <HiShoppingBag className="text-2xl text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">我的交易</h1>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
            <div className="text-gray-400 font-medium">加载交易记录中...</div>
          </div>
        ) : (
          <div className="space-y-10">
            {/* 未完成交易 */}
            <section>
              <div className="flex items-center gap-2 mb-4 px-2">
                <HiClock className="text-xl text-blue-500" />
                <h2 className="text-lg font-bold text-gray-700">正在进行</h2>
                <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full font-bold">
                  {incomplete.length}
                </span>
              </div>
              
              {incomplete.length === 0 ? (
                <div className="p-10 bg-white/60 rounded-[2rem] border-2 border-dashed border-gray-200 text-center text-gray-400 font-medium backdrop-blur-sm">
                  暂无未完成的交易
                </div>
              ) : (
                <div className="grid gap-4">
                  {incomplete.map(tx => {
                    const isSeller = tx.seller_id === currentUserId;
                    const isBuyer = tx.buyer_id === currentUserId;
                    const bookTitle = tx.listing?.book?.title || tx.listing?.title || '未知书籍';
                    const bookCover = tx.listing?.book?.images ? (typeof tx.listing.book.images === 'string' ? JSON.parse(tx.listing.book.images)[0] : tx.listing.book.images[0]) : null;

                    return (
                      <div key={tx.id} data-tx-id={tx.id} className="group p-5 bg-white rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-gray-200/50 border border-gray-100 transition-all duration-300 flex flex-col md:flex-row md:items-center gap-4 relative overflow-hidden">
                        {/* 果冻背景修饰 */}
                        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-blue-50 rounded-full opacity-50 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                        
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden border border-gray-50 shadow-inner flex-shrink-0">
                            {bookCover ? (
                              <img src={bookCover} alt={bookTitle} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl">📚</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-800 text-lg truncate mb-1">{bookTitle}</h3>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${getStatusStyle(tx.status || '')}`}>
                                {getStatusText(tx.status || '')}
                              </span>
                              <span className="text-[10px] text-gray-400 font-medium">
                                {isSeller ? '我是卖家' : '我是买家'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2 md:mt-0 z-10">
                          {/* 卖家操作：确认交易请求 */}
                          {tx.status === 'pending' && isSeller && (
                            <button 
                              onClick={() => handleConfirmTransactionAsSeller(tx.id)} 
                              className="flex-1 md:flex-none px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-2xl hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-200"
                            >
                              确认交易
                            </button>
                          )}
                          
                          {/* 买家操作：确认收书（需卖家已确认，即 in_progress） */}
                          {tx.status === 'in_progress' && isBuyer && (
                            <button 
                              onClick={() => handleConfirmReceipt(tx.id)} 
                              className="flex-1 md:flex-none px-5 py-2.5 bg-green-500 text-white text-sm font-bold rounded-2xl hover:bg-green-600 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-green-100"
                            >
                              确认收书
                            </button>
                          )}

                          <button 
                            onClick={() => handleCancel(tx.id)} 
                            className="flex-1 md:flex-none px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-bold rounded-2xl hover:bg-gray-200 hover:text-red-500 transition-all"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 待评价交易 */}
            <section>
              <div className="flex items-center gap-2 mb-4 px-2">
                <HiCheckCircle className="text-xl text-green-500" />
                <h2 className="text-lg font-bold text-gray-700">待评价</h2>
                <span className="bg-green-100 text-green-600 text-xs px-2 py-0.5 rounded-full font-bold">
                  {completed.length}
                </span>
              </div>

              {completed.length === 0 ? (
                <div className="p-10 bg-white/60 rounded-[2rem] border-2 border-dashed border-gray-200 text-center text-gray-400 font-medium backdrop-blur-sm">
                  暂无待评价的交易
                </div>
              ) : (
                <div className="grid gap-4">
                  {completed.map(tx => {
                    const bookTitle = tx.listing?.book?.title || tx.listing?.title || '未知书籍';
                    const bookCover = tx.listing?.book?.images ? (typeof tx.listing.book.images === 'string' ? JSON.parse(tx.listing.book.images)[0] : tx.listing.book.images[0]) : null;

                    return (
                      <div key={tx.id} className="group p-5 bg-white rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-gray-200/50 border border-gray-100 transition-all duration-300 flex flex-col md:flex-row md:items-center gap-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-green-50 rounded-full opacity-50 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                        
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden border border-gray-50 flex-shrink-0">
                            {bookCover ? (
                              <img src={bookCover} alt={bookTitle} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl">📚</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-800 text-lg truncate mb-1">{bookTitle}</h3>
                            <div className="text-[10px] text-gray-400 font-medium">
                              完成时间：{tx.completed_at ? new Date(tx.completed_at).toLocaleDateString() : '刚刚'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2 md:mt-0 z-10">
                          <button 
                            onClick={() => handleReview(tx.id)} 
                            className="flex-1 md:flex-none px-6 py-2.5 bg-blue-500 text-white text-sm font-bold rounded-2xl hover:bg-blue-600 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                          >
                            <HiCheckCircle className="text-lg" />
                            评价交易
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <ConfirmModal
        open={modalOpen}
        title={modalTitle}
        description={modalDesc}
        confirmText={modalConfirmText}
        cancelText={modalCancelText}
        onConfirm={performModalAction}
        onCancel={closeModal}
        // 传递额外的 props 用于渲染评价表单
        renderContent={modalAction === 'review' ? (
            <div className="py-4">
                <div className="flex justify-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map(star => (
                        <button 
                            key={star}
                            onClick={() => setReviewRating(star)}
                            className={`text-3xl transition-transform hover:scale-110 ${star <= reviewRating ? 'text-yellow-400' : 'text-gray-200'}`}
                        >
                            ★
                        </button>
                    ))}
                </div>
                <div className="text-center text-sm font-bold text-gray-600 mb-4">
                    {reviewRating === 5 ? '非常满意' : reviewRating === 4 ? '满意' : reviewRating === 3 ? '一般' : reviewRating === 2 ? '不满意' : '非常不满意'}
                </div>
                <textarea
                    className="w-full p-3 bg-gray-50 rounded-xl border-0 text-sm focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="写点评价吧..."
                    rows={3}
                    value={reviewContent}
                    onChange={e => setReviewContent(e.target.value)}
                />
            </div>
        ) : undefined}
      />
    </div>
  );
}

