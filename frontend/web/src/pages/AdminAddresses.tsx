import { useEffect, useState } from 'react';
import { addressApi } from '../services/api';
import { HiPlus, HiTrash } from 'react-icons/hi';
import toast from 'react-hot-toast';

export default function AdminAddresses() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ province: '', city: '', district: '', address: '' });
  const [query, setQuery] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const res: any = await addressApi.getAddresses({ keyword: query, limit: 100 });
      const data = (res as any).data || res;
      setAddresses(data.addresses || []);
    } catch (err: any) {
      console.error('Failed to fetch addresses', err);
      toast.error(err.message || '无法获取地址列表');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  const handleCreate = async () => {
    if (!form.address) {
      toast.error('请输入地址内容');
      return;
    }
    try {
      await addressApi.createAddress(form);
      toast.success('创建成功');
      setForm({ province: '', city: '', district: '', address: '' });
      fetch();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该地址？')) return;
    try {
      await addressApi.deleteAddress(id);
      toast.success('删除成功');
      fetch();
    } catch (err: any) {
      console.error(err);
      toast.error('删除失败');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">官方地址管理</h1>
          <p className="text-gray-500">在这里你可以添加或删除官方地址供用户选择。</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索关键字"
            className="px-3 py-2 border rounded-lg"
          />
          <button onClick={fetch} className="px-3 py-2 bg-white border rounded-lg">搜索</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input placeholder="省份" value={form.province} onChange={e => setForm({ ...form, province: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <input placeholder="城市" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <input placeholder="区/街道" value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <input placeholder="详细地址，例如：东海苑六号楼" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="px-3 py-2 border rounded-lg" />
        </div>
        <div className="mt-3 text-right">
          <button onClick={handleCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg">
            <HiPlus /> 创建官方地址
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="font-medium mb-3">地址列表 {loading ? '(加载中...)' : ''}</h2>
        <div className="divide-y">
          {addresses.map(a => (
            <div key={a.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">{a.address}</div>
                <div className="text-sm text-gray-500">{[a.province, a.city, a.district].filter(Boolean).join(' / ')}</div>
              </div>
              <div>
                <button onClick={() => handleDelete(a.id)} className="inline-flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded-lg">
                  <HiTrash /> 删除
                </button>
              </div>
            </div>
          ))}
          {addresses.length === 0 && !loading && (
            <div className="py-6 text-center text-gray-500">暂无地址</div>
          )}
        </div>
      </div>
    </div>
  );
}
