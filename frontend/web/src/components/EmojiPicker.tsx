import { useState, useEffect, useRef } from 'react';
import { HiX } from 'react-icons/hi';

interface Emoji {
  code: string;
  unicode: string;
  description: string;
  category: string;
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('faces');
  const [loading, setLoading] = useState(true);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchEmojis();

    // 点击外部关闭
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const fetchEmojis = async () => {
    try {
      setLoading(true);
      // 获取所有表情和分类
      const [emojisRes, categoriesRes] = await Promise.all([
        fetch('/api/emojis').then(r => r.json()),
        fetch('/api/emojis/categories').then(r => r.json())
      ]);

      // backend may return either lowercase keys or uppercase (Go struct defaults),
      // normalize to our Emoji interface
      const rawEmojis = emojisRes.data || emojisRes || [];
      const normalized = (rawEmojis as any[]).map(e => ({
        code: e.code || e.Code || '',
        unicode: e.unicode || e.Unicode || '',
        description: e.description || e.Description || '',
        category: e.category || e.Category || ''
      }));
      setEmojis(normalized as Emoji[]);

      const cats = categoriesRes.data || categoriesRes || [];
      setCategories(cats);
      if (cats.length > 0) {
        setSelectedCategory(cats[0]);
      }
    } catch (error) {
      console.error('Failed to fetch emojis:', error);
      // 使用默认表情和分类以免界面空白
      const fallback = [
        { code: ':smile:', unicode: '😄', description: '大笑', category: 'faces' },
        { code: ':thumbsup:', unicode: '👍', description: '赞', category: 'people' },
        { code: ':heart:', unicode: '❤️', description: '心形', category: 'symbols' }
      ];
      setEmojis(fallback as any);
      setCategories(['faces', 'people', 'symbols', 'nature', 'objects', 'celebration']);
      setSelectedCategory('faces');
    } finally {
      setLoading(false);
    }
  };

  const filteredEmojis = emojis.filter(e => e.category === selectedCategory);

  return (
    <div
      ref={pickerRef}
      className="bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 w-80 max-h-96 flex flex-col overflow-hidden"
    >
      {/* 头部 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">选择表情</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          aria-label="Close"
        >
          <HiX className="text-xl text-gray-500" />
        </button>
      </div>

      {/* 分类标签 */}
      <div className="flex gap-1 p-2 border-b border-gray-100 overflow-x-auto bg-gray-50">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              selectedCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* 表情网格 */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredEmojis.length > 0 ? (
          <div className="grid grid-cols-6 gap-2">
            {filteredEmojis.map((emoji, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Emoji selected', emoji.unicode);
                  onSelect(emoji.unicode);
                  onClose();
                }}
                title={emoji.description}
                className="text-2xl hover:bg-gray-100 rounded-lg p-1 transition-colors hover:scale-110 transform"
              >
                {emoji.unicode}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            无表情
          </div>
        )}
      </div>
    </div>
  );
}
