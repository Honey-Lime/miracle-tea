import { useState, useContext, useEffect, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import { formatPhone, extractPhoneDigits } from "../utils/formatPhone";
import { sendSmsCode, verifySmsCode } from "../services/smsService";
import { forgotPassword, resetPassword } from "../services/authService";

const LoginModal = () => {
  const { loginModalOpen, closeLoginModal, login } = useContext(AuthContext);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Состояния для SMS-верификации
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [canResendAt, setCanResendAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);

  // Состояния для восстановления пароля
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetPhoneVerified, setResetPhoneVerified] = useState(false);

  const handlePhoneChange = (e) => {
    const raw = e.target.value;
    const formatted = formatPhone(raw);
    setPhone(formatted);
    setPhoneVerified(false);
    setCodeSent(false);
  };

  // Отправка кода подтверждения
  const handleSendCode = async () => {
    setError("");
    const phoneDigits = extractPhoneDigits(phone);
    if (phoneDigits.length < 10) {
      setError("Введите корректный номер телефона");
      return;
    }

    setLoading(true);
    try {
      const response = await sendSmsCode(phoneDigits);
      setCodeSent(true);
      if (response.data.canResendAt) {
        setCanResendAt(new Date(response.data.canResendAt));
      }
    } catch (err) {
      setError(err.response?.data?.message || "Ошибка отправки кода");
    } finally {
      setLoading(false);
    }
  };

  // Проверка кода
  const handleVerifyCode = async () => {
    setError("");
    const phoneDigits = extractPhoneDigits(phone);

    setLoading(true);
    try {
      await verifySmsCode(phoneDigits, verificationCode);
      setPhoneVerified(true);
    } catch (err) {
      setError(err.response?.data?.message || "Неверный код");
    } finally {
      setLoading(false);
    }
  };

  // Основная отправка формы
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // При регистрации сначала проверяем телефон
    if (isRegister && !phoneVerified) {
      if (!codeSent) {
        await handleSendCode();
      }
      return;
    }

    // Валидация пароля при регистрации
    if (isRegister && password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }

    setLoading(true);
    const phoneDigits = extractPhoneDigits(phone);
    const result = await login(
      phoneDigits,
      password,
      isRegister ? name : undefined,
    );
    setLoading(false);
    if (!result.success) {
      setError(result.message);
    }
  };

  // Таймер обратного отсчёта для повторной отправки кода
  useEffect(() => {
    if (canResendAt && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
    } else if (canResendAt && timeLeft === 0) {
      setCanResendAt(null);
    }

    return () => clearTimeout(timerRef.current);
  }, [timeLeft, canResendAt]);

  // Обновление таймера при получении canResendAt
  useEffect(() => {
    if (canResendAt) {
      const now = new Date();
      const diff = canResendAt - now;
      setTimeLeft(Math.max(0, Math.floor(diff / 1000)));
    }
  }, [canResendAt]);

  // Отправка кода для восстановления пароля
  const handleSendResetCode = async () => {
    setError("");
    const phoneDigits = extractPhoneDigits(phone);
    if (phoneDigits.length < 10) {
      setError("Введите корректный номер телефона");
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(phoneDigits);
      setResetCodeSent(true);
    } catch (err) {
      setError(err.response?.data?.message || "Ошибка отправки кода");
    } finally {
      setLoading(false);
    }
  };

  // Проверка кода и установка нового пароля
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    const phoneDigits = extractPhoneDigits(phone);

    if (resetCode.length < 6) {
      setError("Введите код из SMS");
      return;
    }

    if (newPassword.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({
        phone: phoneDigits,
        code: resetCode,
        newPassword,
      });
      alert("Пароль успешно изменён. Теперь вы можете войти.");
      setIsForgotPassword(false);
      setPhone("");
      setResetCode("");
      setNewPassword("");
      setResetCodeSent(false);
      setResetPhoneVerified(false);
    } catch (err) {
      setError(err.response?.data?.message || "Ошибка восстановления пароля");
    } finally {
      setLoading(false);
    }
  };

  // Сброс состояния при закрытии модального окна
  useEffect(() => {
    if (!loginModalOpen) {
      setPhoneVerified(false);
      setCodeSent(false);
      setVerificationCode("");
      setCanResendAt(null);
      setTimeLeft(0);
      setIsForgotPassword(false);
      setResetCodeSent(false);
      setResetCode("");
      setNewPassword("");
      setResetPhoneVerified(false);
    }
  }, [loginModalOpen]);

  if (!loginModalOpen) return null;

  return (
    <div className="modal-overlay" onClick={closeLoginModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={closeLoginModal}>
          ×
        </button>
        <h2>{isRegister ? "Регистрация" : "Вход"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Номер телефона</label>
            <div className="phone-input-wrapper">
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                required
                placeholder="+7 (XXX) XXX-XX-XX"
                disabled={phoneVerified}
              />
            </div>
            {isRegister && !phoneVerified && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleSendCode}
                disabled={loading || codeSent}
              >
                {codeSent ? "Отправлено" : "Получить код"}
              </button>
            )}
            {isRegister && !phoneVerified && codeSent && (
              <div className="form-group">
                <label>Код из SMS</label>
                <div className="code-input-wrapper">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    className="code-input"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleVerifyCode}
                    disabled={loading || !verificationCode}
                  >
                    Проверить
                  </button>
                </div>
              </div>
            )}
            {canResendAt && timeLeft > 0 && (
              <small className="hint">
                Повторная отправка через {timeLeft} сек.
              </small>
            )}
            {!canResendAt && codeSent && (
              <button
                type="button"
                className="link-btn"
                onClick={handleSendCode}
              >
                Отправить код повторно
              </button>
            )}
          </div>

          {isRegister && (
            <div className="form-group">
              <label>Имя</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ваше имя"
              />
            </div>
          )}

          <div className="form-group">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Пароль"
            />
            {!isRegister && (
              <button
                type="button"
                className="link-btn forgot-password-btn"
                onClick={() => setIsForgotPassword(true)}
              >
                Забыли пароль?
              </button>
            )}
          </div>

          {error && <p className="error">{error}</p>}

          {isRegister && phoneVerified && (
            <p className="success-message">✓ Номер подтверждён</p>
          )}

          <button
            type="submit"
            className={`btn btn-primary ${loading ? "btn-loading" : ""}`}
            disabled={loading || (isRegister && !phoneVerified)}
          >
            {loading ? "" : isRegister ? "Зарегистрироваться" : "Войти"}
          </button>
        </form>

        <p className="toggle-mode">
          {isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?"}
          <button
            className="link-btn"
            onClick={() => {
              setIsRegister(!isRegister);
              setPhoneVerified(false);
              setCodeSent(false);
              setVerificationCode("");
              setError("");
            }}
          >
            {isRegister ? "Войти" : "Зарегистрироваться"}
          </button>
        </p>
      </div>

      {/* Модальное окно восстановления пароля */}
      {isForgotPassword && (
        <div
          className="modal-overlay"
          onClick={() => setIsForgotPassword(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setIsForgotPassword(false)}
            >
              ×
            </button>
            <h3>Восстановление пароля</h3>
            <p className="hint">
              {!resetCodeSent
                ? "Введите номер телефона, и мы отправим код в SMS"
                : "Введите код из SMS и новый пароль"}
            </p>

            {!resetCodeSent ? (
              // Шаг 1: ввод телефона и отправка кода
              <>
                <div className="form-group">
                  <label>Номер телефона</label>
                  <div className="phone-input-wrapper">
                    <input
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      required
                      placeholder="+7 (XXX) XXX-XX-XX"
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleSendResetCode}
                      disabled={loading}
                    >
                      {loading ? "Отправка..." : "Получить код"}
                    </button>
                  </div>
                </div>
                {error && <p className="error">{error}</p>}
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setError("");
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </>
            ) : (
              // Шаг 2: ввод кода и нового пароля
              <form onSubmit={handleResetPassword}>
                <div className="form-group">
                  <label>Код из SMS</label>
                  <div className="code-input-wrapper">
                    <input
                      type="text"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      placeholder="123456"
                      maxLength={6}
                      className="code-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Новый пароль</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Новый пароль"
                  />
                </div>

                {error && <p className="error">{error}</p>}

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setResetCodeSent(false);
                      setResetCode("");
                      setNewPassword("");
                      setError("");
                    }}
                  >
                    Назад
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Сохранение..." : "Сохранить"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginModal;
