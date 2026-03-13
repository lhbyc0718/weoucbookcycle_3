import { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { toast } from 'react-hot-toast';
import { HiRefresh } from 'react-icons/hi';

interface Transaction {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  buyer: {
    username: string;
  };
  seller: {
    username: string;
  };
  listing?: {
    book?: {
      title: string;
    };
  };
}

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res: any = await adminApi.getTransactions({ page, limit, status: statusFilter });
      setTransactions(res.transactions || []);
      setTotal(res.total || 0);
    } catch (error: any) {
      toast.error(error.message || '获取交易列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, statusFilter]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">已完成</span>;
      case 'pending': return <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs">进行中</span>;
      case 'cancelled': return <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs">已取消</span>;
      default: return <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs">{status}</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">交易管理</h1>
        <div className="flex gap-4">
          <select 
            value={statusFilter} 
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="">全部状态</option>
            <option value="pending">进行中</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已取消</option>
          </select>
          <button
            onClick={fetchTransactions}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-2"
          >
            <HiRefresh /> 刷新
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">交易ID</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">书籍</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">金额</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">买家</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">卖家</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">创建时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    暂无交易
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-xs font-mono text-gray-500">{tx.id.substring(0, 8)}...</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{tx.listing?.book?.title || '未知书籍'}</td>
                    <td className="px-6 py-4 text-gray-900">¥{tx.amount}</td>
                    <td className="px-6 py-4 text-gray-500">{tx.buyer?.username || '未知'}</td>
                    <td className="px-6 py-4 text-gray-500">{tx.seller?.username || '未知'}</td>
                    <td className="px-6 py-4">
                      {getStatusLabel(tx.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(tx.created_at).toLocaleString()}
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
