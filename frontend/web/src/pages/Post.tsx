import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiCamera, HiX, HiUpload } from 'react-icons/hi';
import { bookApi } from '../services/api';

export default function Post() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        : ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop'];

      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        images: imagesToSubmit
      };

      await bookApi.createBook(payload);
      navigate('/profile');
    } catch (error) {
      console.error('Failed to create book:', error);
      alert('发布失败，请重试');
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
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                    >
                      <HiX className="text-xs" />
                    </button>
                  </div>
                ))}
                
                {formData.images.length < 9 && (
                  <div className="aspect-square bg-white md:bg-gray-100 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer relative group">
                    <HiCamera className="text-2xl text-gray-400 group-hover:text-blue-500 mb-1" />
                    <span className="text-xs text-gray-400 group-hover:text-blue-500">添加图片</span>
                    <div className="absolute inset-0 opacity-0 cursor-pointer" onClick={() => {
                       const url = prompt("请输入图片URL (暂不支持直接上传):", "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400");
                       if(url) setFormData(prev => ({ ...prev, images: [...prev.images, url] }));
                    }} />
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
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="请输入书名"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">作者</label>
                  <input
                    type="text"
                    name="author"
                    required
                    value={formData.author}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="请输入作者"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ISBN (可选)</label>
                <input
                  type="text"
                  name="isbn"
                  value={formData.isbn}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="扫码或手动输入"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                  <select
                    name="category"
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
                    value={formData.price}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-bold text-red-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="描述书籍的详细情况、版本、笔记等..."
                />
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
