import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { HiArrowLeft, HiPaperAirplane, HiUser, HiPhotograph, HiEmojiHappy, HiShoppingCart, HiShare } from 'react-icons/hi';
import { chatApi, userApi, uploadApi, transactionApi } from '../services/api';
import TransactionPicker from '@/components/TransactionPicker';
import ConfirmModal from '../components/ConfirmModal';
import { wsService } from '../services/websocket';
import { useChatStore } from '@/store/chatStore';
import EmojiPicker from '@/components/EmojiPicker';
import { toast } from 'react-hot-toast';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  type?: string;
  created_at: string;
}

const TransactionCard = ({ msg, currentUserId, openModal }: { msg: Message, currentUserId: string, openModal: any }) => {
    const [txStatus, setTxStatus] = useState<string>('pending');
    const [realBookId, setRealBookId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const obj = useMemo(() => {
        try {
            return typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
        } catch (e) { return {}; }
    }, [msg.content]);

    useEffect(() => {
        const fetchStatus = async () => {
            const txId = obj.transaction_id || obj.transactionId || obj.tx_id;
            if (!txId) {
                setLoading(false);
                return;
            }
            try {
                // We need a GetTransaction API. If not available, we skip.
                const res = await transactionApi.getMyTransactions();
                const list = (res as any).data || res;
                const found = list.find((t: any) => t.id === txId);
                if (found) {
                    setTxStatus(found.status);
                    // 修复：如果消息中没有正确的 book_id（旧数据可能只有 listing_id），从交易详情中获取
                    if (found.listing && (found.listing.book_id || found.listing.BookID)) {
                        setRealBookId(found.listing.book_id || found.listing.BookID);
                    }
                }
            } catch (e) {
                console.error('fetch tx status failed', e);
            } finally {
                setLoading(false);
            }
        };
        fetchStatus();
    }, [obj.transaction_id, obj.transactionId, obj.tx_id]);

    const title = obj.title || '商品';
    const price = obj.price;
    const cover = obj.cover;
    const txId = obj.transaction_id || obj.transactionId || obj.tx_id;
    // 优先使用从 API 获取的真实 book_id，其次是消息中的 book_id，最后回退到 listing_id（可能会失败）
    const bookId = realBookId || obj.book_id || obj.bookId || obj.listing_id;
    const isMe = msg.sender_id === currentUserId;
    const isRecipient = !isMe; // recipient likely the seller

    const isPending = txStatus === 'pending';
    const isInProgress = txStatus === 'in_progress';
    const isCompleted = txStatus === 'completed';
    const isCancelled = txStatus === 'cancelled';

    return (
        <div className={`p-3 border-0 rounded-xl shadow-md min-w-[200px] text-white ${
            isCancelled ? 'bg-gray-400' : isCompleted ? 'bg-green-600' : 'bg-gradient-to-br from-orange-500 to-pink-600'
        }`}>
            <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-lg bg-white/20 overflow-hidden flex-shrink-0 border border-white/30">
                    {cover ? (
                        <img src={cover} alt={title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl text-white/50">📚</div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate drop-shadow-sm">{title}</div>
                    {price !== undefined && (
                        <div className="text-lg font-black text-yellow-300">¥{price}</div>
                    )}
                </div>
            </div>
            
            <div className="bg-white/10 rounded-lg p-2 mb-3 text-[11px] border border-white/10 backdrop-blur-sm">
                <div className="flex items-center gap-1.5 font-medium">
                    {!isCompleted && !isCancelled && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>}
                    {isCancelled ? '交易已取消' : isCompleted ? '交易已完成' : isMe ? '发起交易请求' : '对方发起了交易请求'}
                </div>
            </div>

            <div className="flex gap-2">
                {isRecipient && isPending && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!txId) {
                                toast.error('交易ID缺失');
                                return;
                            }
                            openModal('确认交易', '确认要接受此交易并将商品标为交易中吗？', '确认', '取消', 'confirm', undefined, txId);
                        }}
                        className="flex-1 py-1.5 bg-white text-orange-600 font-bold rounded-lg text-xs hover:bg-orange-50 transition-colors shadow-sm"
                    >
                        确认交易
                    </button>
                )}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!bookId) {
                      toast.error('无法获取商品信息');
                      return;
                    }
                    window.open(`/books/${bookId}`, '_blank');
                  }} 
                  className={(() => {
                    // Ensure clear, non-conflicting classes so text is always readable
                    if (isRecipient && isPending) {
                      return 'flex-1 py-1.5 px-3 bg-white/20 text-white font-medium rounded-lg text-xs transition-colors border border-white/20 shadow-sm hover:bg-white/30';
                    }
                    return 'w-full py-1.5 px-3 bg-white text-orange-600 font-bold rounded-lg text-xs transition-colors border border-white/20 shadow-sm hover:bg-orange-50';
                  })()}
                >
                  查看商品
                </button>
            </div>
        </div>
    );
};

export default function ChatDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('userId');
  
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sentShare, setSentShare] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetUser, setTargetUser] = useState<any>(null);
  const { clearUnreadCount, setActiveChat } = useChatStore();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showTxPicker, setShowTxPicker] = useState(false);

  useEffect(() => {
    initChat();
    wsService.connect();
    
    // 清理：离开时清除activeChat
    return () => {
      setActiveChat(null);
    };
  }, [id, targetUserId]);

  // 如果带有分享参数（来自书籍详情页），在会话创建后发送商品预览消息一次
  useEffect(() => {
    const shareListingId = searchParams.get('shareListingId');
    const shareTitle = searchParams.get('shareTitle');
    if (!shareListingId || sentShare) return;

    // Only attempt to send when we have a valid chat id (not 'new')
    if (id && id !== 'new') {
      const contentObj = { listing_id: shareListingId, title: shareTitle };
      sendMessage(JSON.stringify(contentObj), 'transaction_preview');
      setSentShare(true);
    }
  }, [id, searchParams, sentShare]);

  useEffect(() => {
    const handleMessage = (data: any) => {
      // 检查是否是当前会话的消息
      if (data.chat_id === id) {
        setMessages(prev => {
            // 去重：统一将ID转成字符串再比较
            const incomingId = String(data.id || data._id || Date.now().toString());
            console.log('WS message received', incomingId, data);
            if (prev.some(m => String(m.id) === incomingId)) {
                return prev;
            }
            let content = data.content;
            // 如果是图片且URL是相对路径, 添加 API_BASE 前缀
            if ((data.msg_type == "image" || data.type == "image") && typeof content === 'string' && content.startsWith('/')) {
                const base = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8080`;
                content = base.replace(/\/+$/, '') + content;
            }
            const newMsg: Message = {
                id: incomingId,
                sender_id: data.from || data.sender_id,
                content: content,
                type: data.msg_type || data.type || 'text',
                created_at: data.created_at || new Date(data.timestamp * 1000).toISOString()
            };
            return [...prev, newMsg];
        });

        // 收到消息时，如果当前在聊天界面，立即清除未读数
        if (id && id !== 'new') {
            // 延迟一点以确保状态更新
            setTimeout(() => {
                clearUnreadCount();
                chatApi.markAsRead(id).catch(() => {});
            }, 100);
        }
      } else {
        // 如果是其他会话的消息，触发全局未读数更新（需配合 MainLayout 或 Store 实现）
        // 这里简单触发一个自定义事件，通知 Layout 刷新
        window.dispatchEvent(new CustomEvent('chat:new-message', { detail: { chatId: data.chat_id } }));
      }
    };

    wsService.subscribe('message', handleMessage);
    
    return () => {
      wsService.unsubscribe('message', handleMessage);
    };
  }, [id, clearUnreadCount]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initChat = async () => {
    try {
      const profileData = await userApi.getMyProfile();
      const currentUser = (profileData as any).data || profileData;
      setCurrentUserId(currentUser.id);
      setCurrentUser(currentUser);

      if (id === 'new' && targetUserId) {
        try {
          const userRes = await userApi.getUser(targetUserId);
          const userData = (userRes as any).data || userRes;
          setTargetUser(userData);
        } catch (e: any) {
          console.error(e);
          // 如果被对方拉黑或无权限查看，提示并返回上一页
          const msg = (e && e.message) ? e.message : '';
          if (msg.includes('权限') || msg.includes('没有权限')) {
            toast.error('无法查看该用户资料，可能已被对方拉黑');
            navigate(-1);
            return;
          }
        }

        const chatsRes = await chatApi.getChats();
        // 处理后端返回的ChatResponse数组或包装对象
        let chats: any[] = [];
        if (Array.isArray(chatsRes)) {
          chats = chatsRes;
        } else if ((chatsRes as any).chats) {
          chats = (chatsRes as any).chats;
        } else if ((chatsRes as any).data) {
          const dataField = (chatsRes as any).data;
          chats = Array.isArray(dataField) ? dataField : (dataField.chats || []);
        }
        
        // 查找是否已经有与targetUserId的聊天
        const existingChat = chats.find((chat: any) => {
            const chatObj = chat.chat || chat;
            const users = chatObj.users || chatObj.Users || [];
            return users.some((u: any) => {
                const uid = u.user_id || u.id || u.UserID;
                return String(uid) === String(targetUserId);
            });
        });
        
        // 如果已存在，导航到该聊天
        if (existingChat) {
          const chatObj = existingChat.chat || existingChat;
          navigate(`/chats/${chatObj.id || chatObj.ID}`, { replace: true });
          return;
        }
        
        setLoading(false);
      } else if (id && id !== 'new') {
        const chatRes = await chatApi.getChat(id);
        const chatData = (chatRes as any).data || chatRes;
        
        const users = chatData.users || chatData.Users || [];
        const otherChatUser = users.find((u: any) => {
            const uid = u.user_id || u.id || u.UserID;
            return String(uid) !== String(currentUser.id);
        });
        const other = otherChatUser?.user || otherChatUser?.User || otherChatUser;
        
        if (other) setTargetUser(other);

        // 获取消息 - 后端现在直接返回消息数组
        const msgsRes = await chatApi.getMessages(id);
        const msgs = Array.isArray(msgsRes) ? msgsRes : 
                     ((msgsRes as any)?.data && Array.isArray((msgsRes as any).data)) ? (msgsRes as any).data :
                     ((msgsRes as any)?.messages || []);
        
        // 确保消息按时间正序排列（旧消息在上，新消息在下）
        const sortedMsgs = msgs.sort((a: Message, b: Message) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        setMessages(sortedMsgs);
        setLoading(false);
        
        // 设置当前活跃聊天，防止未读数增加
        if (id && id !== 'new') {
          setActiveChat({
            id: id,
            name: targetUser?.username || '未知用户',
            avatar: targetUser?.avatar,
            last_message: chatData.last_message || '',
            updated_at: chatData.updated_at,
            unread_count: 0
          });
        }
        
        // Clear unread count in store
        if (id) {
            clearUnreadCount();
            // 同时也通知后端标记为已读，解决会话列表已读数不变的问题
            chatApi.markAsRead(id).catch(e => console.error('mark read failed', e));
        }

        // 检查该聊天是否有未读交易标记，若有则提示卖家
        try {
          const chatsRes = await chatApi.getChats();
          const chatsList: any[] = Array.isArray(chatsRes) ? chatsRes : ((chatsRes as any).chats || (chatsRes as any).data || []);
          const found = chatsList.find((c: any) => (c.chat || c).id === id || (c.id === id));
          const hasUnreadTx = !!(found && (found.has_unread_transaction || found.HasUnreadTransaction || (found.chat && (found.chat.has_unread_transaction || found.chat.HasUnreadTransaction))));
          if (hasUnreadTx) {
            // 弹出提示，提示用户查看交易
            openModal('有未读交易', '对方发起了交易请求，是否查看并处理？', '查看交易', '忽略', 'viewTransaction', id as string);
          }
        } catch (e) {
          // 忽略错误
        }
      }
    } catch (error) {
      console.error('Failed to init chat:', error);
      setLoading(false);
    }
  };

  const sendMessage = async (content: string, type: string = 'text') => {
    if (sending) return;
    
    setSending(true);
    try {
      let currentChatId = id;

      if (id === 'new' && targetUserId) {
         // 先创建会话
         try {
           const res = await chatApi.createChat({ targetId: targetUserId });
           const newChat = (res as any).data || res;
           
           // 提取chatId，支持多种返回格式
           currentChatId = newChat.id || newChat.ID || 
                          (newChat.data && (newChat.data.id || newChat.data.ID));
           
           if (!currentChatId) {
               console.error('Failed to extract chat ID from response:', newChat);
               toast.error('创建聊天失败，请重试');
               setSending(false);
               return;
           }
           
           // 略等待一下，确保数据库操作完全完成
           await new Promise(resolve => setTimeout(resolve, 100));
           navigate(`/chats/${currentChatId}`, { replace: true });
         } catch (error) {
           console.error('Failed to create chat:', error);
           toast.error('创建聊天失败，请重试');
           setSending(false);
           return;
         }
      }

      if (currentChatId && currentChatId !== 'new') {
        try {
          console.log('Sending message to API', { chat: currentChatId, content, type });
          await chatApi.sendMessage(currentChatId, { content, type });
          // 不做乐观更新，等待 WebSocket 广播来刷新消息
          if (type === 'text') setNewMessage('');
          toast.success('消息已发送');
        } catch (error) {
          console.error('Failed to send message:', error);
          toast.error('发送失败，请重试');
        }
      }
    } catch (error) {
      console.error('Unexpected error in sendMessage:', error);
      toast.error('发送失败');
    } finally {
        setSending(false);
    }
  };

  // Modal for confirming transaction actions
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalDesc, setModalDesc] = useState('');
  const [modalConfirmText, setModalConfirmText] = useState('确认');
  const [modalCancelText, setModalCancelText] = useState('取消');
  const [modalAction, setModalAction] = useState<'create'|'confirm'|'viewTransaction'|null>(null);
  const [modalTxListingId, setModalTxListingId] = useState<string | null>(null);
  const [modalTxId, setModalTxId] = useState<string | null>(null);

  const openModal = (title: string, desc: string, confirmText: string, cancelText: string, action: 'create'|'confirm'|'viewTransaction', listingOrChatId?: string, txId?: string) => {
    setModalTitle(title);
    setModalDesc(desc);
    setModalConfirmText(confirmText);
    setModalCancelText(cancelText);
    setModalAction(action);
    setModalTxListingId(listingOrChatId || null);
    setModalTxId(txId || null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalAction(null);
    setModalTxListingId(null);
    setModalTxId(null);
  };

  const performModalAction = async () => {
    if (!modalAction) return closeModal();
    try {
      if (modalAction === 'create' && modalTxListingId) {
        await transactionApi.createTransaction({ listing_id: modalTxListingId, chat_id: id || undefined });
        toast.success('已发起交易，卖家会收到提醒');
      } else if (modalAction === 'confirm' && modalTxId) {
        await transactionApi.confirmTransaction(modalTxId);
        toast.success('已确认交易，书籍已标为交易中');
      } else if (modalAction === 'viewTransaction') {
        // 跳到底部查看交易消息
        scrollToBottom();
      }

      // 触发全局清除交易未读（后端清除全量 unread_tx）
      try {
        await transactionApi.clearUnread();
        window.dispatchEvent(new CustomEvent('transactions:cleared'));
      } catch (e) {
        // ignore
      }
    } catch (e) {
      console.error(e);
      toast.error('操作失败');
    } finally {
      closeModal();
    }
  };

  const handleTextSend = () => {
      if (!newMessage.trim()) return;
      sendMessage(newMessage, 'text');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedFormats.includes(file.type)) {
        toast.error('仅支持 JPG、PNG、GIF、WebP 格式');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        toast.error('图片大小不能超过5MB');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
        // Simulate upload progress
        const progressInterval = setInterval(() => {
            setUploadProgress(prev => Math.min(prev + Math.random() * 30, 90));
        }, 200);

        const res = await uploadApi.uploadFile(file);
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        // Handle response format properly
        const responseData = (res as any);
        let imageUrl = null;
        
        if (responseData.code === 20000 && responseData.data) {
            imageUrl = responseData.data.url || responseData.data.urls?.[0];
        } else if (responseData.url) {
            imageUrl = responseData.url;
        } else if (typeof responseData === 'string') {
            imageUrl = responseData;
        }
        
        if (imageUrl) {
            toast.success('图片上传成功');
            await sendMessage(imageUrl, 'image');
        } else {
            toast.error('图片上传失败: 无法获取URL');
            console.error('Invalid response format:', res);
        }
    } catch (error) {
        console.error('Failed to upload image:', error);
        const errorMsg = error instanceof Error ? error.message : '上传失败，请重试';
        toast.error(`图片上传失败: ${errorMsg}`);
    } finally {
        setIsUploading(false);
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups: Record<string, Message[]>, message) => {
    const date = new Date(message.created_at).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  const renderMessageContent = (msg: Message) => {
      if (msg.type === 'image') {
          return (
              <img 
                  src={msg.content} 
                  alt="图片消息" 
                  className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(msg.content, '_blank')}
                  style={{ maxHeight: '300px' }}
              />
          );
      }
      // render transaction preview (buyer sent a product link)
      if (msg.type === 'transaction_preview') {
          try {
              const obj = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
              const title = obj.title || '商品';
              const bookId = obj.book_id || obj.bookId || obj.listing_id;
              const isSender = msg.sender_id === currentUserId;
              return (
                  <div className="p-3 border rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
                      <div className="font-bold text-gray-800 mb-1">{title}</div>
                      <div className="text-[10px] text-gray-500 mb-3 flex items-center gap-1">
                          <HiShare className="text-blue-500" /> 商品链接已分享
                      </div>
                      <div className="flex gap-2">
                        {isSender && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!id || id === 'new') {
                                toast.error('请先创建会话后再发起交易');
                                return;
                              }
                              openModal('确认发起交易', '确定要发起该商品的交易吗？', '发起交易', '取消', 'create', obj.listing_id || bookId);
                            }}
                            className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors shadow-sm"
                          >
                            发起交易
                          </button>
                        )}
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/books/${bookId}`, '_blank');
                            }} 
                            className={`py-1.5 px-3 ${isSender ? 'bg-gray-100' : 'w-full bg-blue-50 text-blue-600'} hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors border border-gray-200`}
                        >
                            查看商品
                        </button>
                      </div>
                  </div>
              );
          } catch (e) {
              return <div className="text-sm text-gray-700">{msg.content}</div>;
          }
      }

      // render actual transaction message (created by backend)
      if (msg.type === 'transaction') {
          return <TransactionCard msg={msg} currentUserId={currentUserId} openModal={openModal} />;
      }
      return <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>;
  };

  return (
    <div className="bg-gray-50 h-screen flex flex-col md:bg-gray-100 md:p-8">
      <div className="flex-1 flex flex-col bg-white md:max-w-4xl md:mx-auto md:rounded-2xl md:shadow-lg md:border md:border-gray-200 overflow-hidden w-full">
        {/* Header */}
        <div className="bg-white px-4 py-3 shadow-sm flex items-center gap-3 z-10 border-b border-gray-100">
          <button onClick={() => navigate(-1)} aria-label="返回" className="p-1 -ml-1 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <HiArrowLeft className="text-xl" />
          </button>
          <div className="flex items-center gap-3">
            <div
              role="button"
              onClick={(e) => { e.stopPropagation(); if (targetUser?.id) navigate(`/users/${targetUser.id}`); }}
              className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-gray-100 cursor-pointer"
              aria-label="查看用户主页"
            >
              {targetUser?.avatar ? (
                <img src={targetUser.avatar} alt={targetUser.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600 font-bold text-lg">
                  {targetUser?.username?.[0]?.toUpperCase() || <HiUser />}
                </div>
              )}
            </div>
            <span className="font-bold text-gray-800 text-lg">{targetUser?.username || 'Chat'}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50">
          {loading ? (
            <div className="text-center text-gray-400 py-10 flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                加载中...
            </div>
          ) : messages.length === 0 ? (
             <div className="text-center text-gray-400 py-20">暂无消息，开始聊天吧！</div>
          ) : (
            Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date} className="space-y-4">
                <div className="flex justify-center sticky top-0 z-0 py-2">
                  <span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full shadow-sm opacity-80 backdrop-blur-sm">
                    {date === new Date().toLocaleDateString() ? '今天' : date}
                  </span>
                </div>
                {msgs.map((msg) => {
                  const isMe = msg.sender_id === currentUserId;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2 group animate-fade-in`}>
                      {!isMe && (
                        <div
                          role="button"
                          aria-label="查看发送者主页"
                          onClick={() => {
                            if (targetUser?.id) navigate(`/users/${targetUser.id}`);
                          }}
                          className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden border border-gray-100 cursor-pointer flex-shrink-0"
                        >
                          {targetUser?.avatar ? (
                            <img src={targetUser.avatar} alt={targetUser?.username || '用户头像'} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600 font-bold text-xs">
                              {targetUser?.username?.[0]?.toUpperCase() || <HiUser />}
                            </div>
                          )}
                        </div>
                      )}
                      <div 
                        className={`max-w-[75%] md:max-w-[60%] rounded-2xl px-4 py-3 text-sm shadow-sm relative transition-all ${
                          isMe 
                            ? 'bg-blue-600 text-white rounded-tr-sm hover:bg-blue-700' 
                            : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        {renderMessageContent(msg)}
                        <div className={`text-[10px] mt-1 text-right opacity-70 select-none flex justify-end items-center gap-1 ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {isMe && (
                        <div
                          role="button"
                          aria-label="查看发送者主页"
                          onClick={() => {
                            if (currentUser?.id) navigate(`/users/${currentUser.id}`);
                          }}
                          className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden border border-gray-100 cursor-pointer flex-shrink-0"
                        >
                          {currentUser?.avatar ? (
                            <img src={currentUser.avatar} alt={currentUser?.username || '我的头像'} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600 font-bold text-xs">
                              {currentUser?.username?.[0]?.toUpperCase() || <HiUser />}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white p-4 border-t border-gray-200 flex items-center gap-3 sticky bottom-0 z-20 relative">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleImageUpload}
            disabled={sending}
            aria-label="发送图片"
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || isUploading}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={isUploading ? `上传中 ${uploadProgress}%` : "发送图片"}
          >
            <HiPhotograph className="text-xl" />
          </button>
          
          {/* Emoji button - improved with EmojiPicker integration */}
          <div className="relative">
            <button 
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="表情"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={sending}
            >
              <HiEmojiHappy className="text-xl" />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-2">
                <EmojiPicker 
                  onSelect={handleEmojiSelect}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
            )}
          </div>

          {/* Transaction picker button */}
          <div className="relative">
            <button
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="发起交易"
              onClick={() => setShowTxPicker(true)}
              disabled={sending}
            >
              <HiShoppingCart className="text-xl" />
            </button>
          </div>

          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              disabled={sending}
              aria-label="消息内容"
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleTextSend()}
              placeholder={isUploading ? `上传中 ${Math.round(uploadProgress)}%` : "发送消息..."}
              className="w-full bg-gray-100 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white transition-all border border-transparent focus:border-blue-200 disabled:opacity-70 disabled:cursor-not-allowed"
            />
            {/* Upload progress indicator */}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="absolute bottom-0 left-0 h-1 bg-blue-500 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            )}
          </div>
          <button 
            onClick={handleTextSend}
            disabled={!newMessage.trim() || sending}
            aria-label="发送消息"
            className="p-3 bg-blue-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 active:scale-95 transition-all shadow-sm flex items-center justify-center w-11 h-11"
          >
            {sending || isUploading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
                <HiPaperAirplane className="transform rotate-90 text-lg" />
            )}
          </button>
        </div>

        <TransactionPicker
          open={showTxPicker}
          sellerId={targetUser?.id}
          chatId={id && id !== 'new' ? id : undefined}
          onClose={() => setShowTxPicker(false)}
          onCreated={async (txs: any[] | any, createdChatId?: string) => {
            // 支持 txs 为单个对象或数组
            try {
              // 注意：后端 TransactionService 会在提供 chat_id 时自动发送一条 transaction 类型的消息
              // 我们不再这里手动 setMessages 乐观更新，因为 WebSocket 会很快广播回来真正的消息。
              // 这样可以彻底解决“一条交易发两条”的问题。
              
              // 如果弹窗创建了新的 chatId（在新会话场景），跳转到该会话
              if ((!id || id === 'new') && createdChatId) {
                navigate(`/chats/${createdChatId}`, { replace: true });
              }
              // 尝试清除未读交易标记
              try { await transactionApi.clearUnread(); window.dispatchEvent(new CustomEvent('transactions:cleared')); } catch(e){ }
            } catch (e) {
              console.error('onCreated processing failed', e);
            }
          }}
        />
        <ConfirmModal
          open={modalOpen}
          title={modalTitle}
          description={modalDesc}
          confirmText={modalConfirmText}
          cancelText={modalCancelText}
          onConfirm={performModalAction}
          onCancel={closeModal}
        />
      </div>
    </div>
  );
}