import { useEffect, useState } from 'react';
import { userApi } from '../services/api';
import { HiUsers, HiDatabase, HiChip, HiLightningBolt, HiRefresh } from 'react-icons/hi';
import { toast } from 'react-hot-toast';

interface SystemStats {
  goroutines: number;
  online_users: number;
  websocket_clients: number;
  db_open_conns: number;
  redis_hit_rate: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await userApi.admin.getStats();
      setStats((data as any).data || data);
      toast.success('系统状态已更新');
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      toast.error('无法获取系统状态，请确认您有管理员权限');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!stats && loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">管理员控制台</h1>
          <p className="text-gray-500 mt-1">实时监控系统运行状态</p>
        </div>
        <button 
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <HiRefresh className={`text-lg ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="在线用户" 
          value={stats?.online_users || 0} 
          icon={<HiUsers className="text-blue-600" />} 
          color="bg-blue-50"
        />
        <StatCard 
          title="WebSocket 连接" 
          value={stats?.websocket_clients || 0} 
          icon={<HiLightningBolt className="text-yellow-600" />} 
          color="bg-yellow-50"
        />
        <StatCard 
          title="Goroutines" 
          value={stats?.goroutines || 0} 
          icon={<HiChip className="text-purple-600" />} 
          color="bg-purple-50"
        />
        <StatCard 
          title="DB 连接数" 
          value={stats?.db_open_conns || 0} 
          icon={<HiDatabase className="text-green-600" />} 
          color="bg-green-50"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">系统详情</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailItem label="Redis 命中率" value={stats?.redis_hit_rate || 'N/A'} />
          <DetailItem label="服务器时间" value={new Date().toLocaleString()} />
          <DetailItem label="数据一致性检查" value="运行中 (每小时)" />
          <DetailItem label="系统版本" value="v1.0.0" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: number | string, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4 transition-transform hover:-translate-y-1">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
