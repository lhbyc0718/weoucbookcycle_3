import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HiUser, HiLockClosed, HiPhone, HiMail } from 'react-icons/hi';
import { authApi } from '../services/api';
import toast from 'react-hot-toast';
import axios from 'axios';
import { motion } from 'framer-motion';

// 水波纹背景组件
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

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState(''); // Username/Email/Phone
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaVal, setCaptchaVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [contactMethod, setContactMethod] = useState<'email' | 'phone'>('email');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Get the redirect path from location state, or default to home
  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (location.state?.isRegister) {
      setIsLogin(false);
    }
  }, [location.state]);

  useEffect(() => {
    if (!isLogin && !verificationSent && !showForgotPassword) {
      refreshCaptcha();
    }
  }, [isLogin, verificationSent, showForgotPassword]);

  const refreshCaptcha = async () => {
    try {
      const res = await axios.get('/api/auth/captcha');
      const data = res.data.data;
      if (data.captcha_image && data.captcha_image.length > 50) {
          setCaptchaId(data.captcha_id);
          setCaptchaImage(data.captcha_image);
      } else {
          console.error("Invalid captcha image received");
      }
      setCaptchaVal('');
    } catch (e) {
      console.error("Failed to load captcha", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
      if (isLogin) {
        // Login Logic
        if (!identifier || !password) {
          toast.error('请填写所有必填字段');
          return;
        }
        setLoading(true);
        try {
          const res = await authApi.login({ identifier, password });
          const data = (res as any).data || res;
          localStorage.setItem('authToken', data.token);
          localStorage.setItem('userInfo', JSON.stringify(data.user));
          toast.success('登录成功');
          window.dispatchEvent(new Event('auth:login'));
          navigate(from, { replace: true });
        } catch (error: any) {
          console.error(error);
          toast.error(error.message || '登录失败');
        } finally {
          setLoading(false);
        }
      } else {
        // Register Logic
        if (!username || !password || !captchaVal || (contactMethod === 'email' && !email) || (contactMethod === 'phone' && !phone)) {
          toast.error('请填写所有必填字段');
          return;
        }
        if (username.length < 3) {
          toast.error('用户名至少需要3个字符');
          return;
        }
        if (password.length < 8) {
          toast.error('密码至少需要8个字符');
          return;
        }
        if (password !== confirmPassword) {
          toast.error('两次输入的密码不一致');
          return;
        }
        setLoading(true);
        try {
          await authApi.register({ 
            username, 
            password, 
            email: contactMethod === 'email' ? email : '', 
            phone: contactMethod === 'phone' ? phone : '', 
            captcha_id: captchaId, 
            captcha_val: captchaVal 
          });
          toast.success('验证链接已发送，请查收邮件');
          setVerificationSent(true);
          // 清空验证码输入框，准备接收新的验证码
          setCaptchaVal('');
        } catch (error: any) {
          console.error(error);
          toast.error(error.message || '注册失败');
          refreshCaptcha();
        } finally {
          setLoading(false);
        }
      }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('请输入邮箱地址');
      return;
    }
    if (!captchaVal) {
        toast.error('请输入验证码');
        return;
    }
    
    setLoading(true);
    try {
      await authApi.sendPasswordReset({ 
          email,
          captcha_id: captchaId,
          captcha_val: captchaVal 
      });
      toast.success('如果该邮箱存在，重置链接已发送');
      setShowForgotPassword(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || '请求失败');
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
     return (
      <>
        <RippleBackground />
        <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
           <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full space-y-8 bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-xl"
           >
            <div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">找回密码</h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                请输入您的注册邮箱和验证码，我们将向您发送重置密码的链接。
              </p>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
               <div className="rounded-md shadow-sm -space-y-px">
                <div className="relative mb-4">
                  <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">邮箱地址</label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <HiMail className="text-gray-400" />
                    </div>
                    <input
                      id="reset-email"
                      name="email"
                      type="email"
                      required
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-3"
                      placeholder="请输入邮箱地址"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">验证码</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      className="flex-1 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md py-2.5"
                      placeholder="输入右侧验证码"
                      value={captchaVal}
                      onChange={(e) => setCaptchaVal(e.target.value)}
                    />
                    <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={refreshCaptcha} title="点击刷新">
                      {captchaImage ? (
                        <img src={captchaImage} alt="captcha" className="h-10 rounded border border-gray-200" />
                      ) : (
                        <div className="h-10 w-24 bg-gray-200 animate-pulse rounded"></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4">
                 <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  返回登录
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? '发送中...' : '发送重置链接'}
                </button>
              </div>
            </form>
           </motion.div>
        </div>
      </>
     )
  }

  if (verificationSent) {
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
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                   </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">验证邮件已发送</h2>
            </div>
            
            <p className="text-gray-600 mb-6">
              我们已向您的 {contactMethod === 'email' ? '邮箱' : '手机'} 发送了验证链接。<br/>
              请查收邮件并点击链接完成注册。
            </p>
            
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 text-left">
              <p className="font-medium mb-1">提示：</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700/80">
                <li>链接有效期为1小时</li>
                <li>如果没有收到，请检查垃圾邮件文件夹</li>
                <li>或者尝试重新注册</li>
              </ul>
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="w-full mt-6 flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-md transition-all"
            >
              返回登录
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
          <div>
            <h2 className="mt-6 text-center text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 font-serif tracking-tight filter drop-shadow-sm">
              WeOUC Book Cycle
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {isLogin ? '登录以继续您的阅读之旅' : '加入社区，分享您的爱书'}
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm space-y-4">
              {isLogin ? (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    账号
                  </label>
                  <div className="relative rounded-md shadow-sm transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <HiUser className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      required
                      className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2.5 focus:ring-0 focus:border-transparent"
                      placeholder="用户名 / 邮箱 / 手机号"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                    <div className="relative rounded-md shadow-sm transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <HiUser className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        required
                        className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2.5 focus:ring-0 focus:border-transparent"
                        placeholder="设置用户名"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">联系方式</label>
                    <div className="flex gap-4 mb-3">
                      <button
                        type="button"
                        onClick={() => setContactMethod('email')}
                        className={`flex-1 py-2 px-4 rounded-lg border flex items-center justify-center gap-2 transition-all ${contactMethod === 'email' ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500' : 'border-gray-300 hover:bg-gray-50'}`}
                      >
                        <HiMail className={contactMethod === 'email' ? 'text-blue-500' : 'text-gray-400'} />
                        邮箱注册
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactMethod('phone')}
                        className={`flex-1 py-2 px-4 rounded-lg border flex items-center justify-center gap-2 transition-all ${contactMethod === 'phone' ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500' : 'border-gray-300 hover:bg-gray-50'}`}
                      >
                        <HiPhone className={contactMethod === 'phone' ? 'text-blue-500' : 'text-gray-400'} />
                        手机注册
                      </button>
                    </div>

                    {contactMethod === 'email' ? (
                      <div className="relative rounded-md shadow-sm transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <HiMail className="text-gray-400" />
                        </div>
                        <input
                          type="email"
                          required
                          className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2.5 focus:ring-0 focus:border-transparent"
                          placeholder="请输入邮箱地址"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="relative rounded-md shadow-sm transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <HiPhone className="text-gray-400" />
                        </div>
                        <input
                          type="tel"
                          required
                          className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2.5 focus:ring-0 focus:border-transparent"
                          placeholder="请输入手机号码"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  密码
                </label>
                <div className="relative rounded-md shadow-sm transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiLockClosed className="text-gray-400" />
                  </div>
                  <input
                    type="password"
                    required
                    className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2.5 focus:ring-0 focus:border-transparent"
                    placeholder="密码 (至少8位)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                  />
                </div>
              </div>

              {!isLogin && (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    确认密码
                  </label>
                  <div className="relative rounded-md shadow-sm transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <HiLockClosed className="text-gray-400" />
                    </div>
                    <input
                      type="password"
                      required
                      className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2.5 focus:ring-0 focus:border-transparent"
                      placeholder="请再次输入密码"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {!isLogin && (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">验证码</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      className="flex-1 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md py-2.5"
                      placeholder="输入右侧验证码"
                      value={captchaVal}
                      onChange={(e) => setCaptchaVal(e.target.value)}
                    />
                    <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={refreshCaptcha} title="点击刷新">
                      {captchaImage ? (
                        <img src={captchaImage} alt="captcha" className="h-10 rounded border border-gray-200" />
                      ) : (
                        <div className="h-10 w-24 bg-gray-200 animate-pulse rounded"></div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl active:scale-[0.99]"
              >
                {loading && (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isLogin ? '立即登录' : '发送验证并注册'}
              </button>
            </div>
          </form>
          
          <div className="text-center space-y-3">
              <p className="text-sm text-gray-600">
                {isLogin ? '还没有账号？' : '已有账号？'}
                <button 
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setVerificationSent(false);
                  }}
                  className="font-bold text-blue-600 hover:text-blue-500 ml-1 transition-colors underline decoration-2 underline-offset-2"
                >
                  {isLogin ? '立即注册' : '直接登录'}
                </button>
              </p>
              {isLogin && (
                <p className="text-sm">
                  <button 
                    onClick={() => setShowForgotPassword(true)}
                    className="text-gray-500 hover:text-blue-600 transition-colors"
                  >
                    忘记密码？
                  </button>
                </p>
              )}
            </div>
        </motion.div>
      </div>
    </>
  );
}
