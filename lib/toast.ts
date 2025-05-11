import toast from 'react-hot-toast';

// 偵測瀏覽器語言（簡單方式）
const isZH = typeof navigator !== 'undefined' && navigator.language.startsWith('zh');

export function showSuccess(action: 'login' | 'email') {
  const messages = {
    login: isZH ? '登入成功！🎉' : 'Successfully signed in! 🎉',
    email: isZH ? '登入連結已寄出 ✉️' : 'Login link sent ✉️',
  };

  toast.success(messages[action]);
}

export function showError(action: 'login' | 'email') {
  const messages = {
    login: isZH ? '登入失敗，請稍後再試' : 'Sign-in failed, please try again',
    email: isZH ? '信件發送失敗，請確認 Email 格式或稍後重試' : 'Email send failed. Please try again later',
  };

  toast.error(messages[action]);
}
