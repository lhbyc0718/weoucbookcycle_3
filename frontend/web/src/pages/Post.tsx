import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiCamera, HiX, HiUpload } from 'react-icons/hi';
import { bookApi, uploadApi, addressApi } from '../services/api';
import toast from 'react-hot-toast';

export default function Post() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    price: '',
    condition: '全新',
    category: '教材',
    description: '',
    images: [] as string[]
  });
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any | null>(null);

  // 简单防抖
  let addressTimer: any = null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      // API returns the data object directly due to interceptor
      const res: any = await uploadApi.uploadFiles(files);
      
      let newUrls: string[] = [];
      if (res && res.urls && Array.isArray(res.urls)) {
        newUrls = res.urls;
      } else if (res && res.url) {
        newUrls = [res.url];
      }
      
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...newUrls]
      }));
    } catch (error: any) {
      console.error('Upload failed:', error);
      toast.error(error.message || '图片上传失败，请重试');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'address') {
      // 当用户在地址输入框编辑时，认为未选择预设地址
      setSelectedAddress(null);
    }
  };

  const handleAddressInput = (v: string) => {
    setAddressQuery(v);
    setFormData(prev => ({ ...prev, address: v }));
    setSelectedAddress(null);
    if (addressTimer) clearTimeout(addressTimer);
    addressTimer = setTimeout(async () => {
      if (!v || v.trim() === '') {
        setSuggestions([]);
        return;
      }
      try {
        const res: any = await (await import('../services/api')).addressApi.getAddresses({ keyword: v, limit: 8 });
        const data = (res as any).data || res;
        setSuggestions(data.addresses || []);
      } catch (err) {
        setSuggestions([]);
      }
    }, 300);
  };

  const handleRemoveImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const imagesToSubmit = formData.images.length > 0 
        ? formData.images 
        : ['/images/default_book.jpg']; // Use default image if none uploaded

      // if (imagesToSubmit.length === 0) {
      //   alert('请至少上传一张图片');
      //   setLoading(false);
      //   return;
      // }

      const payload: any = {
        ...formData,
        price: parseFloat(formData.price),
        images: imagesToSubmit
      };

      // 地址处理：如果选择了已有地址，直接填写 address_id；否则若填写了自定义地址，先创建用户自定义地址
      if (selectedAddress && selectedAddress.id) {
        payload.address_id = selectedAddress.id;
      } else if ((formData as any).address && (formData as any).address.trim() !== '') {
        try {
          const res: any = await addressApi.createUserAddress({ province: '', city: '', district: '', address: (formData as any).address });
          const data = (res as any).data || res;
          if (data && data.id) {
            payload.address_id = data.id;
          }
        } catch (err) {
          // 若创建自定义地址失败，也继续提交但不传 address_id
          console.warn('Failed to create user address, submitting without address_id', err);
        }
      }

      await bookApi.createBook(payload);
      toast.success('发布成功');
      navigate('/profile');
    } catch (error: any) {
      console.error('Failed to create book:', error);
      toast.error(error.message || '发布失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 md:pb-0 bg-gray-50 md:flex md:items-center md:justify-center">
      {/* Mobile Header */}
      <div className="md:hidden bg-white p-4 shadow-sm sticky top-0 z-30 flex justify-between items-center">
        <h1 className="text-lg font-bold">发布书籍</h1>
        <button 
          onClick={() => navigate(-1)}
          className="text-gray-500 text-sm"
        >
          取消
        </button>
      </div>

      <div className="w-full md:max-w-4xl bg-white md:rounded-2xl md:shadow-lg md:border md:border-gray-100 md:overflow-hidden md:flex">
         
         {/* Left Side: Image Upload (Desktop) */}
         <div className="md:w-1/3 bg-gray-50 p-6 md:border-r border-gray-100">
           <h3 className="font-bold text-gray-800 mb-4 hidden md:block">上传图片</h3>
           <div className="bg-white p-4 rounded-xl shadow-sm md:shadow-none md:bg-transparent">
              <label className="block text-sm font-medium text-gray-700 mb-3 md:hidden">书籍图片</label>
              <div className="grid grid-cols-3 md:grid-cols-2 gap-3">
                {formData.images.map((img, idx) => (
                  <div key={idx} className="aspect-square relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                    <img src={img} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      aria-label="删除图片"
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                    >
                      <HiX className="text-xs" />
                    </button>
                  </div>
                ))}
                
                {formData.images.length < 9 && (
                  <div 
                    className="aspect-square bg-white md:bg-gray-100 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer relative group"
                    onClick={() => !uploading && fileInputRef.current?.click()}
                  >
                    {uploading ? (
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <>
                            <HiCamera className="text-2xl text-gray-400 group-hover:text-blue-500 mb-1" />
                            <span className="text-xs text-gray-400 group-hover:text-blue-500">添加图片</span>
                        </>
                    )}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                        accept="image/*" 
                        multiple 
                        aria-label="上传书籍图片"
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                提示：请上传清晰的书籍封面、封底及内页照片。展示真实细节有助于更快售出。
              </p>
            </div>
         </div>

         {/* Right Side: Form (Desktop) */}
         <div className="md:w-2/3 p-4 md:p-8">
            <div className="flex justify-between items-center mb-6 hidden md:flex">
              <h2 className="text-2xl font-bold text-gray-900">填写书籍信息</h2>
              <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">取消</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">书名</label>
                  <input
                    type="text"
                    name="title"
                    required
                    aria-label="书名"
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                    placeholder="请输入书名 (必填)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">作者</label>
                  <input
                    type="text"
                    name="author"
                    required
                    aria-label="作者"
                    value={formData.author}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                    placeholder="请输入作者 (必填)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ISBN (可选)</label>
                <input
                  type="text"
                  name="isbn"
                  aria-label="ISBN"
                  value={formData.isbn}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                  placeholder="扫码或手动输入"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                  <select
                    name="category"
                    aria-label="选择分类"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                  >
                    <option>教材</option>
                    <option>考研</option>
                    <option>文学</option>
                    <option>小说</option>
                    <option>历史</option>
                    <option>科学</option>
                    <option>商业</option>
                    <option>艺术</option>
                    <option>其他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">成色</label>
                  <select
                    name="condition"
                    aria-label="选择成色"
                    value={formData.condition}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                  >
                    <option>全新</option>
                    <option>九成新</option>
                    <option>八成新</option>
                    <option>七成新</option>
                    <option>其他</option>
                  </select>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">价格 (¥)</label>
                  <input
                    type="number"
                    name="price"
                    required
                    min="0"
                    step="0.01"
                    aria-label="价格"
                    value={formData.price}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-bold text-red-500 bg-white"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  name="description"
                  rows={4}
                  aria-label="书籍描述"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                  placeholder="描述书籍的详细情况、版本、笔记等..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地址 (可选，支持关键字搜索)</label>
                <input
                  type="text"
                  name="address"
                  aria-label="地址"
                  value={(formData as any).address || addressQuery}
                  onChange={(e) => handleAddressInput(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                  placeholder="输入楼号或小区，如：东海苑 6号楼"
                />
                {suggestions.length > 0 && (
                  <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-sm max-h-48 overflow-auto">
                    {suggestions.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => {
                          setSelectedAddress(s);
                          setAddressQuery(s.address);
                          setSuggestions([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50"
                      >
                        {s.address} {s.city ? `· ${s.city}` : ''}
                      </button>
                    ))}
                  </div>
                )}
                {selectedAddress && (
                  <div className="mt-2 text-sm text-gray-500">已选择：{selectedAddress.address}</div>
                )}
                <p className="text-xs text-gray-400 mt-2">提示：可从下拉选择已有地址，或直接输入自定义地址。</p>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-blue-700 hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <HiUpload className="text-xl" />
                      立即发布
                    </>
                  )}
                </button>
              </div>
            </form>
         </div>
      </div>
    </div>
  );
}

// 在表单中加入地址输入 UI（用于移动/桌面）
