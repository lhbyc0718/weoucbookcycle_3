import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/api';
import { HiCheckCircle, HiXCircle, HiBookOpen } from 'react-icons/hi';
import { motion } from 'framer-motion';

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

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('正在验证您的邮箱...');

  useEffect(() => {
    const verify = async () => {
      const email = searchParams.get('email');
      const code = searchParams.get('code');

      if (!email || !code) {
        setStatus('error');
        setMessage('验证链接无效，缺少必要参数');
        return;
      }

      // Add a small delay to show the loading state (UX improvement)
      await new Promise(resolve => setTimeout(resolve, 800));

      // Prevent double verification (React Strict Mode can cause double mount)
      const hasVerified = sessionStorage.getItem(`verified_${email}_${code}`);
      if (hasVerified) {
         setStatus('success');
         setMessage('邮箱已验证成功！您现在可以登录了。');
         return;
      }

      try {
        await authApi.verifyEmail({ email, code });
        sessionStorage.setItem(`verified_${email}_${code}`, 'true');
        setStatus('success');
        setMessage('邮箱验证成功！您现在可以登录了。');
      } catch (error: any) {
        console.error(error);
        // Special handling for "already verified" error from backend if applicable
        if (error.message && (error.message.includes('已验证') || error.message.includes('expired'))) {
            // Assume it might be already verified if it says code expired/invalid on a refresh
             setStatus('error'); // Keep it as error but with clearer message
             setMessage(error.message);
        } else {
             setStatus('error');
             setMessage(error.message || '验证失败，链接可能已过期或无效。');
        }
      }
    };

    verify();
  }, [searchParams]);

  return (
    <>
      <RippleBackground />
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full space-y-8 bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-white/50 text-center"
        >
          <div className="flex flex-col items-center">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl shadow-lg mb-4">
               <HiBookOpen className="h-10 w-10 text-white" />
            </div>
            <h2 className="mt-2 text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 font-serif tracking-tight">
              WeOUC Book Cycle
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              邮箱验证
            </p>
          </div>

          <div className="flex flex-col items-center justify-center py-6 bg-gray-50 rounded-xl border border-gray-100">
            {status === 'loading' && (
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
            )}
            {status === 'success' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <HiCheckCircle className="h-20 w-20 text-green-500" />
              </motion.div>
            )}
            {status === 'error' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <HiXCircle className="h-20 w-20 text-red-500" />
              </motion.div>
            )}
            
            <h3 className={`mt-6 text-xl font-medium ${
              status === 'success' ? 'text-green-800' : 
              status === 'error' ? 'text-red-800' : 'text-gray-800'
            }`}>
              {status === 'loading' ? '正在验证...' : 
               status === 'success' ? '验证成功' : '验证失败'}
            </h3>
            
            <p className="mt-2 text-gray-600 max-w-xs mx-auto px-4">
              {message}
            </p>
          </div>

          <div>
            <button
              onClick={() => navigate('/login')}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-md transition-all hover:shadow-lg transform hover:-translate-y-0.5"
            >
              {status === 'success' ? '立即登录' : '返回登录'}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
