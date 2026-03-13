import { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { toast } from 'react-hot-toast';
import { HiCheck, HiX, HiRefresh } from 'react-icons/hi';

interface Report {
  id: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;
  reporter_id: string;
  reported_user_id: string;
  book_id?: string;
}

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res: any = await adminApi.getReports({ status: statusFilter });
      setReports(res.reports || []);
    } catch (error: any) {
      toast.error(error.message || '获取举报列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  const handleResolve = async (report: Report, action: 'approve' | 'reject') => {
    const promptText = action === 'approve' 
      ? '请输入扣除的信任分 (0-100):' 
      : '请输入拒绝理由 (可选):';
    
    const input = window.prompt(promptText, action === 'approve' ? '10' : '');
    if (input === null) return;

    const data: any = { action };
    if (action === 'approve') {
      data.deduct_points = parseInt(input) || 0;
    } else {
      data.note = input;
    }

    try {
      await adminApi.resolveReport(report.id, data);
      toast.success('处理成功');
      fetchReports();
    } catch (error: any) {
      toast.error(error.message || '处理失败');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">举报处理</h1>
        <div className="flex gap-4">
          <select 
            title="选择举报状态"
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="pending">待处理</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
          </select>
          <button
            onClick={fetchReports}
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
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">举报ID</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">原因</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">详情</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">举报人ID</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">被举报人ID</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">时间</th>
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
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    暂无举报记录
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-xs font-mono text-gray-500">{report.id.substring(0, 8)}...</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{report.reason}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={report.details}>
                      {report.details}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">{report.reporter_id}</td>
                    <td className="px-6 py-4 text-xs text-gray-500">{report.reported_user_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(report.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {report.status === 'pending' && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleResolve(report, 'approve')}
                            className="text-sm font-medium text-green-600 hover:text-green-800"
                            title="通过举报（扣分）"
                          >
                            <HiCheck className="text-lg" />
                          </button>
                          <button
                            onClick={() => handleResolve(report, 'reject')}
                            className="text-sm font-medium text-red-600 hover:text-red-800"
                            title="驳回举报"
                          >
                            <HiX className="text-lg" />
                          </button>
                        </div>
                      )}
                      {report.status !== 'pending' && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          report.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {report.status === 'approved' ? '已通过' : '已驳回'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
