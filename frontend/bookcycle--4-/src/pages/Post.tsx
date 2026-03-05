import React, { useState, useRef } from 'react';
import { Camera, X, ChevronRight, Upload, Sparkles, AlertTriangle, Plus, Check } from 'lucide-react';
import { BookItem, User } from '../data/mockData';

interface PostProps {
  onBack: () => void;
  user?: User;
  onPostBook: (book: BookItem) => void;
}

export const Post: React.FC<PostProps> = ({ onBack, user: propUser, onPostBook }) => {
  const user = propUser || { 
    id: '', name: 'Unknown', avatar: '', verified: false, rating: 0, ratingCount: 0, 
    sales: 0, trustScore: 80, joinDate: '', rank: '', bio: '', location: '', wishlist: [], listings: [] 
  };
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [price, setPrice] = useState(45);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (user.trustScore <= 60) {
    return (
      <div className="flex flex-col h-full bg-slate-950 p-6 items-center justify-center text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">\u8d26\u6237\u53d7\u9650</h2>
        <p className="text-slate-400 mb-8 max-w-xs">
          \u4f60\u7684\u4fe1\u4efb\u5ea6\u5df2\u964d\u81f3{user.trustScore}\u3002\u4f60\u76ee\u524d\u65e0\u6cd5\u53d1\u5e03\u65b0\u4e66\u5355\u3002
        </p>
        <button 
          onClick={onBack}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
        >
          \u8fd4\u56de
        </button>
      </div>
    );
  }

  const categories = [
    'Used Books', 
    'Textbook', 
    'Non-Textbook', 
    'New Book', 
    'QR Code for English Books',
    'Literature',
    'Science',
    'History',
    'Art'
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handlePublish = () => {
    if (!title.trim() || !author.trim()) {
      alert('Please enter book title and author');
      return;
    }
    if (selectedTags.length === 0) {
      alert('Please select at least one category/tag');
      return;
    }
    
    // In a real app, this would be an API call
    const newBook: BookItem = {
      id: `b${Date.now()}`,
      title: title,
      author: author,
      cover: images[0] || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop',
      price: price,
      condition: 'Good', // And condition input
      sellerId: 'me',
      description: 'Newly listed book.',
      category: selectedTags[0], // Primary category
      tags: selectedTags,
      location: user.location || 'Unknown',
      shippingTime: 'Ships within 24h',
      images: images.length > 0 ? images : ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&h=1200&fit=crop'],
    };

    onPostBook(newBook);
    
    alert('Book published successfully!');
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 pb-24 relative overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute top-0 left-0 w-full h-96 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-full h-96 bg-amber-600/5 blur-[100px] rounded-full pointer-events-none translate-y-1/2"></div>

      <header className="relative z-10 px-4 py-4 flex items-center justify-between border-b border-white/5 bg-slate-900/50 backdrop-blur-xl">
        <button onClick={onBack} title="\u53d6\u6d88\u5e76\u8fd4\u56de" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all">
          <X className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-white font-display tracking-tight">\u53d1\u5e03\u4e66\u7c4d</h1>
        <button 
          onClick={handlePublish}
          title="\u53d1\u5e03\u8fd9\u4e2a\u4e66\u5355"
          className="text-indigo-400 font-semibold text-sm px-4 py-2 rounded-full hover:bg-indigo-500/10 transition-all"
        >
          Publish
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 relative z-10">
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-xl font-bold text-white font-display tracking-tight">\u56fe\u7247</h2>
          </div>
          <p className="text-sm text-slate-400 mb-6 font-light">\u4e0a\u4f20\u9ad8\u8d28\u91cf\u7684\u4e66\u7c4d\u7167\u7247\u3002</p>
          
          <div className="relative w-full aspect-[4/3] bg-slate-900/50 rounded-3xl overflow-hidden border border-white/10 mb-4 group cursor-pointer shadow-2xl shadow-black/20 transition-all hover:border-indigo-500/30">
            <img 
              src={images[0] || "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&h=600&fit=crop"} 
              alt="Cover" 
              className={`w-full h-full object-cover transition-opacity duration-500 scale-105 group-hover:scale-100 ${images.length > 0 ? 'opacity-100' : 'opacity-60 group-hover:opacity-80'}`}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/5 backdrop-blur-xl px-6 py-3 rounded-full flex items-center gap-3 border border-white/10 shadow-lg group-hover:scale-105 transition-transform duration-300"
              >
                <span className="text-sm font-medium text-white tracking-wide">{images.length > 0 ? 'Change Cover' : 'Add Cover Image'}</span>
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Camera className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              aria-label="Upload book images"
              onChange={handleImageUpload}
            />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <button 
              onClick={() => fileInputRef.current?.click()}
              title="\u6dfb\u52a0\u53e6\u4e00\u5f20\u7167\u7247"
              className="aspect-square rounded-2xl bg-slate-900/50 border border-dashed border-slate-700 flex flex-col items-center justify-center gap-2 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                <Plus className="w-4 h-4 text-slate-400 group-hover:text-indigo-400" />
              </div>
              <span className="text-[10px] text-slate-500 font-medium group-hover:text-indigo-400">\u6dfb\u52a0\u7167\u7247</span>
            </button>
            {images.map((img, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-slate-800 overflow-hidden relative border border-white/5 group shadow-lg">
                <img 
                  src={img} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  alt="Preview" 
                />
                <button 
                  onClick={() => removeImage(i)}
                  title="\u79fb\u9664\u8fd9\u4e2a\u7167\u7247"
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center hover:bg-red-500/80 transition-colors border border-white/10"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-6 font-display tracking-tight">\u4fe1\u606f</h2>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm text-slate-400 font-medium ml-1 mb-2 block">\u4e66\u540d</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="\u8f93\u5165\u4e66\u540d"
                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 font-medium ml-1 mb-2 block">\u4f5c\u8005</label>
              <input 
                type="text" 
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="\u8f93\u5165\u4f5c\u8005\u540d\u5b57"
                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
              />
            </div>
          </div>

          <div className="bg-slate-900/40 backdrop-blur-md rounded-3xl p-6 border border-white/5 mb-6 shadow-xl">
            <div className="flex justify-between items-center mb-8">
              <span className="text-sm text-slate-300 font-medium">\u9500\u552e\u4ef7\u683c</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl text-indigo-400 font-bold">¥</span>
                <span className="text-5xl text-white font-bold font-display tracking-tighter">{price.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="relative mb-2">
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" 
                  style={{ width: `${(price / 200) * 100}%` }}
                ></div>
              </div>
              <input 
                type="range" 
                min="0" 
                max="200" 
                value={price} 
                onChange={(e) => setPrice(Number(e.target.value))}
                aria-label="Set selling price"
                className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
              />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg border-2 border-indigo-500 pointer-events-none transition-all"
                style={{ left: `calc(${(price / 200) * 100}% - 12px)` }}
              ></div>
            </div>
            
            <div className="flex justify-between mt-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              <span>Free</span>
              <span>Premium</span>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm text-slate-400 font-medium ml-1">\u5206\u7c7b\u4e0e\u6807\u7b7e</h3>
            <div className="flex flex-wrap gap-2.5">
              {categories.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button 
                    key={tag} 
                    onClick={() => toggleTag(tag)}
                    className={`px-4 py-2 rounded-2xl text-xs font-medium transition-all duration-300 border flex items-center gap-2 ${
                      isSelected 
                        ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/25 scale-105' 
                        : 'bg-slate-800/50 text-slate-400 border-white/5 hover:bg-slate-800 hover:border-white/10 hover:text-slate-200'
                    }`}
                  >
                    {tag}
                    {isSelected && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <div className="mt-8 mb-4">
          <button 
            onClick={handlePublish}
            className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-lg shadow-indigo-500/25 transition-all active:scale-95"
          >
            Publish Book
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper icon component
const PlusIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);
