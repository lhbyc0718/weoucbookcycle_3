import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/api';
import { HiLockClosed, HiCheckCircle, HiBookOpen } from 'react-icons/hi';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const RippleBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const ripple = document.createElement('div');
      ripple.className = 'ripple';
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      container.appendChild(ripple);

      setTimeout(() => {
        ripple.remove();
      }, 1000);
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 overflow-hidden -z-10 bg-gradient-to-br from-blue-50 to-indigo-100">
      <style>{`
        .ripple {
          position: absolute;
          width: 20px;
          height: 20px;
          background: rgba(59, 130, 246, 0.3);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          animation: rippleEffect 1s linear;
          pointer-events: none;
        }
        @keyframes rippleEffect {
          0% {
            width: 0px;
            height: 0px;
            opacity: 0.5;
          }
          100% {
            width: 500px;
            height: 500px;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const email = searchParams.get('email');
  const token = searchParams.get('token');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }
    if (password.length < 8) {
      toast.error('密码长度至少需要8位');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({
        email,
        token,
        new_password: password
      });
      setSuccess(true);
      toast.success('密码重置成功');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || '重置失败，链接可能已过期');
    } finally {
      setLoading(false);
    }
  };

  if (!email || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">无效的链接</h2>
          <p className="mt-2 text-gray-600">缺少必要的参数，请检查链接是否完整。</p>
          <button onClick={() => navigate('/login')} className="mt-4 text-blue-600 hover:text-blue-500">
            返回登录
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <>
        <RippleBackground />
        <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full space-y-8 bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-xl text-center"
          >
            <div className="flex flex-col items-center">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-xl shadow-lg mb-4">
                   <HiCheckCircle className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">密码重置成功</h2>
            </div>
            <p className="text-gray-600">
              您的密码已成功更新，请使用新密码登录。
            </p>
            <button 
              onClick={() => navigate('/login')}
              className="w-full mt-6 flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-md transition-all"
            >
              立即登录
            </button>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <RippleBackground />
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full space-y-8 bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-white/50"
        >
          <div className="flex flex-col items-center">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl shadow-lg mb-4">
               <HiBookOpen className="h-10 w-10 text-white" />
            </div>
            <h2 className="mt-2 text-center text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 font-serif tracking-tight">
              WeOUC Book Cycle
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              重置您的账户密码
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  新密码
                </label>
                <div className="relative rounded-md shadow-sm transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiLockClosed className="text-gray-400" />
                  </div>
                  <input
                    type="password"
                    required
                    className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2.5 focus:ring-0 focus:border-transparent"
                    placeholder="请输入新密码（至少8位）"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  确认新密码
                </label>
                <div className="relative rounded-md shadow-sm transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiLockClosed className="text-gray-400" />
                  </div>
                  <input
                    type="password"
                    required
                    className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2.5 focus:ring-0 focus:border-transparent"
                    placeholder="请再次输入新密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl active:scale-[0.99]"
              >
                {loading ? '提交中...' : '重置密码'}
              </button>
            </div>
            
            <div className="text-center">
              <button 
                type="button"
                onClick={() => navigate('/login')}
                className="text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                返回登录
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </>
  );
}
