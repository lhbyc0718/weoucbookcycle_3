import React from 'react';
import { Bell } from 'lucide-react';

interface NotificationBellProps {
  count?: number;
  onClick?: () => void;
  title?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ count = 0, onClick, title = '通知' }) => {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="relative w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center border border-white/5"
    >
      <Bell className="w-5 h-5 text-slate-300" />
      {count > 0 ? (
        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
          {count > 99 ? '99+' : count}
        </span>
      ) : (
        <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500 border border-slate-800" aria-hidden="true"></span>
      )}
    </button>
  );
};

export default NotificationBell;
