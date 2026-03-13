import React, { useEffect, useState } from 'react';
import { HiX } from 'react-icons/hi';
import { listingApi, chatApi, transactionApi, userApi } from '../services/api';
import { toast } from 'react-hot-toast';

interface Props {
  open: boolean;
  sellerId?: string | null;
  chatId?: string | null;
  onClose: () => void;
  onCreated?: (txs: any[], chatId?: string) => void;
}

export default function TransactionPicker({ open, sellerId, chatId, onClose, onCreated }: Props) {
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    if (!sellerId) return;
    (async () => {
      try {
        setLoading(true);
        // 获取卖家资料，其中包含 Books 和 Listings
        const res: any = await userApi.getUser(sellerId);
        const userData = res.data || res;
        
        // 提取卖家的所有书籍，过滤掉非可售状态的书籍 (status=1 为可售)
        let list: any[] = userData.Books || userData.books || [];
        
        // 规范化书籍信息
        const normalized = list.filter((b: any) => (b.status === 1 || b.Status === 1)).map((b: any) => {
          const out = { 
            ...b,
            id: String(b.id || b.ID || ''),
            title: b.title || b.Title || '未知书籍',
            price: b.price || b.Price || 0,
            author: b.author || b.Author || '',
            condition: b.condition || b.Condition || '',
            seller_id: b.seller_id || b.SellerID || ''
          };
          // 查找该书籍对应的 Listing (如果有)
          const listing = b.listings?.[0] || b.Listings?.[0];
          if (listing) {
            out.listing_id = String(listing.id || listing.ID || '');
          }
          return out;
        });

        setBooks(normalized);
      } catch (e) {
        console.error('load seller books failed', e);
        toast.error('加载卖家商品失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, sellerId]);

  const handleCreate = async () => {
    if (!selected || selected.length === 0) { toast.error('请选择至少一本书'); return; }
    try {
      setCreating(true);
      let currentChatId = chatId as string | undefined;
      if (!currentChatId && sellerId) {
        const res = await chatApi.createChat({ targetId: sellerId });
        const newChat = (res as any).data || res;
        currentChatId = newChat.id || newChat.ID || (newChat.data && (newChat.data.id || newChat.data.ID));
      }

      const createdTxs: any[] = [];
      for (const bookId of selected) {
        try {
          const book = books.find(b => String(b.id) === bookId);
          if (!book) continue;

          let lid = book.listing_id;
          
          // 如果该书还没有对应的 Listing，则先创建一个
          if (!lid) {
            try {
              console.debug('Auto-creating listing for book:', book.id, 'price:', book.price);
              const listingRes: any = await listingApi.createListing({
                book_id: book.id,
                price: Number(book.price) || 0,
                note: 'Auto created during transaction'
              });
              const newListing = listingRes.data || listingRes;
              lid = newListing.id || newListing.ID;
            } catch (e: any) {
              console.error('Failed to create listing for book', bookId, e);
              const errMsg = e.response?.data?.message || e.message || '未知错误';
              toast.error(`无法为书籍 "${book.title}" 创建发布信息: ${errMsg}`);
              continue;
            }
          }

          if (!lid) continue;

          const txRes = await transactionApi.createTransaction({ listing_id: lid, chat_id: currentChatId });
          const txObj = (txRes as any).data || txRes;
          createdTxs.push(txObj);

          // 注意：后端 TransactionService 会在提供 chat_id 时自动发送一条 transaction 类型的消息
          // 包含所有美化所需的信息（price, cover, book_id 等），此处不再手动发送以避免重复
        } catch (e) {
          console.error('create transaction for book failed', bookId, e);
        }
      }

      if (createdTxs.length > 0) {
        toast.success('交易请求已发出');
        if (onCreated) onCreated(createdTxs, currentChatId);
        onClose();
      } else {
        toast.error('未能创建任何交易');
      }
    } catch (e) {
      console.error(e);
      toast.error('发起交易失败');
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-2xl mx-4 rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">选择要发起交易的商品</h3>
          <button 
          onClick={onClose} 
          className="text-gray-500"
            aria-label="Close"
          ><HiX /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="col-span-full text-center py-6">加载中...</div>
          ) : books.length === 0 ? (
            <div className="col-span-full text-center text-gray-500 py-6">该用户暂无可售商品</div>
          ) : (
            books.map(book => {
              const bid = String(book.id || '');
              const isSelected = selected.includes(bid);
              
              // 获取图片
              let cover = '/images/default_book.jpg';
              const images = book.images || book.Images;
              if (images) {
                try {
                  const imgs = typeof images === 'string' ? JSON.parse(images) : images;
                  if (Array.isArray(imgs) && imgs.length > 0) {
                    cover = imgs[0];
                  }
                } catch (e) {}
              }

              return (
                <div key={bid} className={`p-3 border rounded-lg cursor-pointer flex items-center gap-3 ${isSelected ? 'border-blue-500 bg-blue-50' : ''}`} onClick={() => {
                  setSelected(prev => {
                    if (prev.includes(bid)) return prev.filter(x => x !== bid);
                    return [...prev, bid];
                  });
                }}>
                  <img src={cover} alt={book.title} className="w-16 h-20 object-cover rounded" onError={(e: any) => e.target.src = '/images/default_book.jpg'} />
                  <div className="flex-1">
                    <div className="font-medium">{book.title}</div>
                    <div className="text-sm text-gray-500">¥{book.price}</div>
                    <div className="text-[10px] text-gray-400 mt-1">{book.author} · {book.condition}</div>
                  </div>
                </div>
              );
            })
        )}
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-100">取消</button>
          <button onClick={handleCreate} disabled={creating} className="px-4 py-2 rounded bg-green-600 text-white">{creating ? '处理中...' : '发起交易'}</button>
        </div>
      </div>
    </div>
  );
}