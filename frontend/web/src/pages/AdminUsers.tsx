import { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { toast } from 'react-hot-toast';
import { HiSearch, HiBan, HiCheck, HiUser } from 'react-icons/hi';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  status: number;
  created_at: string;
  trust_score: number;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [limit] = useState(10);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res: any = await adminApi.getUsers({ page, limit, keyword });
      setUsers(res.users || []);
      setTotal(res.total || 0);
    } catch (error: any) {
      toast.error(error.message || '获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 1 ? 0 : 1;
    const action = newStatus === 1 ? '启用' : '禁用';
    if (!window.confirm(`确定要${action}用户 ${user.username} 吗？`)) return;

    try {
      await adminApi.updateUserStatus(user.id, newStatus);
      toast.success(`用户已${action}`);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    }
  };

  const handleSetRole = async (user: User) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`确定将用户 ${user.username} 的角色设置为 ${newRole} 吗？`)) return;

    try {
      await adminApi.setUserRole(user.id, newRole);
      toast.success('角色已更新');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索用户名/邮箱..."
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
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">用户</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">角色</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">信任分</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">注册时间</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    暂无用户
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                          <HiUser />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{user.username}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{user.trust_score}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.status === 1
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.status === 1 ? '正常' : '禁用'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleStatus(user)}
                          className={`text-sm font-medium ${
                            user.status === 1 ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'
                          }`}
                          title={user.status === 1 ? '禁用用户' : '启用用户'}
                        >
                          {user.status === 1 ? <HiBan className="text-lg" /> : <HiCheck className="text-lg" />}
                        </button>
                        <button
                          onClick={() => handleSetRole(user)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                          title={user.role === 'admin' ? '降级为普通用户' : '提升为管理员'}
                        >
                          {user.role === 'admin' ? '降级' : '提权'}
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
