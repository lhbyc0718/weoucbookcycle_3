// 书籍状态工具
export function normalizeBookStatus(s: any): number {
  if (s === null || s === undefined) return 0;
  if (typeof s === 'number') return s;
  if (typeof s === 'string') {
    const n = parseInt(s, 10);
    if (!isNaN(n)) return n;
    const low = s.toLowerCase();
    if (low.includes('sold') || low.includes('已售')) return 0;
    if (low.includes('available') || low.includes('在售')) return 1;
    if (low.includes('offshelf') || low.includes('下架') || low.includes('下架')) return 2;
    if (low.includes('inprogress') || low.includes('交易') || low.includes('预定')) return 3;
  }
  return 0;
}

export function bookStatusLabel(s: any): string {
  const n = normalizeBookStatus(s);
  switch (n) {
    case 0:
      return '已售出';
    case 1:
      return '在售';
    case 2:
      return '已下架';
    case 3:
      return '交易中';
    default:
      return '未知';
  }
}

export function bookStatusBadgeClass(s: any): string {
  const n = normalizeBookStatus(s);
  switch (n) {
    case 0:
      return 'bg-orange-100 text-orange-700';
    case 1:
      return 'bg-green-100 text-green-600';
    case 2:
      return 'bg-gray-100 text-gray-500';
    case 3:
      return 'bg-yellow-100 text-yellow-700';
    default:
      return 'bg-gray-100 text-gray-500';
  }
}
