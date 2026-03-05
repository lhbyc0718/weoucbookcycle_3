import React, { useState, useRef } from 'react';
import { 
  Settings, 
  ChevronRight, 
  Wallet, 
  BookOpen, 
  ShoppingBag, 
  TrendingUp,
  ShieldCheck,
  Award,
  ChevronLeft,
  MessageCircle,
  MapPin,
  Star,
  Camera
} from 'lucide-react';
import { BookCard } from '../components/BookCard';
import { BookItem, User } from '../data/mockData';

interface UserProfileProps {
  userId: string;
  onBack?: () => void;
  onChat?: () => void;
  onBookClick?: (id: string) => void;
  wishlist?: string[];
  onToggleWishlist?: (id: string) => void;
  user?: User;
  books?: BookItem[];
}

export const UserProfile: React.FC<UserProfileProps> = ({ 
  userId, 
  onBack, 
  onChat, 
  onBookClick, 
  wishlist, 
  onToggleWishlist,
  user: propUser,
  books: propBooks
}) => {
  // Fallback to mock data if props are not provided (though they should be)
  const user = propUser || { id: 'temp', name: 'Loading...', avatar: '', verified: false, rating: 0, ratingCount: 0, sales: 0, trustScore: 0, joinDate: '', rank: '', bio: '', location: '', wishlist: [], listings: [] };
  const books = propBooks || [];
  
  const isMe = userId === 'me';
  const [activeTab, setActiveTab] = useState<'selling' | 'wishlist'>('selling');
  const [avatar, setAvatar] = useState(user.avatar);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userListings = books.filter(b => b.sellerId === user.id);
  
  // Use passed wishlist prop if available (for 'me'), otherwise use user.wishlist from mock
  // Filter books based on wishlist IDs
  const currentWishlist = wishlist || user.wishlist;
  const wishlistItems = books.filter(b => currentWishlist.includes(b.id));

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatar(result);
        user.avatar = result; // Update mock data
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 pb-24 relative overflow-y-auto no-scrollbar">
      {onBack && (
        <button 
          onClick={onBack}
          title="返回"
          className="absolute top-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      <header className="px-4 py-6 flex flex-col items-center relative overflow-hidden">
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-indigo-900/20 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="relative mb-4 mt-8 group">
          <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl relative">
            <img 
              src={avatar} 
              alt={user.name} 
              className="w-full h-full rounded-full object-cover border-4 border-slate-950"
            />
            {isMe && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
          {user.verified && (
            <div className="absolute bottom-0 right-0 bg-blue-500 text-white p-1 rounded-full border-4 border-slate-950 pointer-events-none">
              <ShieldCheck className="w-4 h-4" />
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            aria-label="Upload profile picture"
            onChange={handleAvatarChange}
          />
        </div>
        
        <h1 className="text-2xl font-bold text-white font-display mb-1">{user.name}</h1>
        
        {user.location && (
          <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
            <MapPin className="w-3 h-3" />
            <span>{user.location}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
          <span className="bg-slate-800 px-2 py-0.5 rounded-full border border-white/5">{user.rank}</span>
          <span>•</span>
          <span>Joined {user.joinDate}</span>
        </div>

        {user.bio && (
          <p className="text-sm text-slate-300 text-center max-w-xs mb-6 leading-relaxed">
            {user.bio}
          </p>
        )}

        {!isMe && (
          <button 
            onClick={onChat}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold text-sm shadow-lg shadow-indigo-900/20 transition-all active:scale-95 mb-6"
          >
            <MessageCircle className="w-4 h-4" />
            Chat with {user.name.split(' ')[0]}
          </button>
        )}

        <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-6">
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-3 flex flex-col items-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">信任度</span>
            <span className="text-2xl font-bold text-white font-display">{user.trustScore}</span>
          </div>

          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-3 flex flex-col items-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">评分</span>
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-amber-400 font-display">{user.rating}</span>
              <div className="flex text-amber-400">
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
              </div>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">({user.ratingCount} reviews)</span>
          </div>
        </div>
      </header>

      <div className="px-4 flex-1">
        <div className="flex p-1 bg-slate-900 border border-white/5 rounded-xl mb-6">
          <button 
            onClick={() => setActiveTab('selling')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'selling' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            宣导({userListings.length})
          </button>
          <button 
            onClick={() => setActiveTab('wishlist')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'wishlist' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            心愿单({currentWishlist.length})
          </button>
        </div>

        {activeTab === 'selling' ? (
          <div className="grid grid-cols-2 gap-4">
            {userListings.length > 0 ? (
              userListings.map(book => (
                <BookCard key={book.id} book={book} onClick={onBookClick || (() => {})} />
              ))
            ) : (
              <div className="col-span-2 text-center py-12 text-slate-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>暂无暴料</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {wishlistItems.length > 0 ? (
              wishlistItems.map(book => (
                <BookCard 
                  key={book.id} 
                  book={book} 
                  onClick={onBookClick || (() => {})} 
                  isWishlisted={true}
                  onToggleWishlist={onToggleWishlist ? () => onToggleWishlist(book.id) : undefined}
                />
              ))
            ) : (
              <div className="col-span-2 text-center py-12 text-slate-500">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>心愿单为空</p>
              </div>
            )}
          </div>
        )}

        {isMe && (
          <div className="mt-8 bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">
            <button className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors border-b border-white/5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1 text-left">
                <span className="block text-sm font-bold text-slate-200">\u6211\u7684\u9b51\u5305</span>
              </div>
              <span className="bg-slate-800 px-2 py-1 rounded text-xs font-mono text-indigo-400">¥54.00</span>
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
            
            <button className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
                <Settings className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1 text-left">
                <span className="block text-sm font-bold text-slate-200">\u8bbe\u7f6e</span>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
