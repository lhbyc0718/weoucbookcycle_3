import React from 'react';

interface Props {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  renderContent?: React.ReactNode;
}

export default function ConfirmModal({ open, title = '确认', description = '', confirmText = '确认', cancelText = '取消', onConfirm, onCancel, renderContent }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm bg-black/30 animate-fade-in">
      <div className="bg-white rounded-[2rem] shadow-2xl shadow-gray-400/20 max-w-sm w-full p-8 border border-white relative overflow-hidden transform animate-pop-in">
        {/* Jelly background accents */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-60"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-pink-50 rounded-full blur-3xl opacity-60"></div>
        
        <div className="relative z-10">
          <h3 className="text-xl font-black text-gray-800 mb-3 tracking-tight">{title}</h3>
          {description && (
            <p className="text-gray-500 text-sm leading-relaxed mb-4 font-medium">
              {description}
            </p>
          )}
          
          {/* 渲染自定义内容（如评价表单） */}
          {renderContent}
          
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button 
              onClick={onCancel} 
              className="px-6 py-3 rounded-2xl bg-gray-100 text-gray-500 text-sm font-bold hover:bg-gray-200 active:scale-95 transition-all"
            >
              {cancelText}
            </button>
            <button 
              onClick={onConfirm} 
              className="px-6 py-3 rounded-2xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 active:scale-95 transition-all"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
