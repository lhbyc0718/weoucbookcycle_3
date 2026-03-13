import { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { toast } from 'react-hot-toast';
import { HiSearch, HiTrash, HiEye, HiEyeOff } from 'react-icons/hi';

interface Book {
  id: string;
  title: string;
  author: string;
  price: number;
  status: number;
  created_at: string;
  seller: {
    username: string;
  };
}

export default function AdminBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [limit] = useState(10);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const res: any = await adminApi.getBooks({ page, limit, keyword });
      setBooks(res.books || []);
      setTotal(res.total || 0);
    } catch (error: any) {
      toast.error(error.message || '获取书籍列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBooks();
  };

  const handleToggleStatus = async (book: Book) => {
    const newStatus = book.status === 2 ? 1 : 2; // 2=下架, 1=上架
    const action = newStatus === 1 ? '上架' : '下架';
    if (!window.confirm(`确定要${action}书籍《${book.title}》吗？`)) return;

    try {
      await adminApi.updateBookStatus(book.id, newStatus);
      toast.success(`书籍已${action}`);
      fetchBooks();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    }
  };

  const handleDelete = async (book: Book) => {
    if (!window.confirm(`确定要彻底删除书籍《${book.title}》吗？此操作不可恢复！`)) return;

    try {
      await adminApi.deleteBook(book.id);
      toast.success('书籍已删除');
      fetchBooks();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    }
  };

  const getStatusLabel = (status: number) => {
    switch (status) {
      case 0: return <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded text-xs">已售</span>;
      case 1: return <span className="text-green-600 bg-green-100 px-2 py-0.5 rounded text-xs">可售</span>;
      case 2: return <span className="text-red-600 bg-red-100 px-2 py-0.5 rounded text-xs">下架</span>;
      case 3: return <span className="text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded text-xs">交易中</span>;
      default: return <span className="text-gray-500">未知</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">书籍管理</h1>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索书名/作者/ISBN..."
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <HiSearch /> 搜索
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">书名</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">作者</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">价格</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">卖家</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">发布时间</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : books.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    暂无书籍
                  </td>
                </tr>
              ) : (
                books.map((book) => (
                  <tr key={book.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{book.title}</td>
                    <td className="px-6 py-4 text-gray-500">{book.author}</td>
                    <td className="px-6 py-4 text-gray-900">¥{book.price}</td>
                    <td className="px-6 py-4 text-gray-500">{book.seller?.username || '未知'}</td>
                    <td className="px-6 py-4">
                      {getStatusLabel(book.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(book.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleStatus(book)}
                          className={`text-sm font-medium ${
                            book.status === 2 ? 'text-green-600 hover:text-green-800' : 'text-yellow-600 hover:text-yellow-800'
                          }`}
                          title={book.status === 2 ? '上架' : '下架'}
                        >
                          {book.status === 2 ? <HiEye /> : <HiEyeOff />}
                        </button>
                        <button
                          onClick={() => handleDelete(book)}
                          className="text-sm font-medium text-red-600 hover:text-red-800"
                          title="删除"
                        >
                          <HiTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            共 {total} 条记录
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
            >
              上一页
            </button>
            <span className="px-3 py-1 text-gray-700">第 {page} 页</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * limit >= total}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
