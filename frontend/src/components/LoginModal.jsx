import { useState, useContext, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { sendEmailCode, verifyEmailCode } from "../services/emailService";
import { forgotPassword, resetPassword } from "../services/authService";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PasswordEyeIcon = ({ isOpen }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {isOpen ? (
      <>
        <path
          d="M2.5 12C4.5 7.8 7.7 5.7 12 5.7C16.3 5.7 19.5 7.8 21.5 12C19.5 16.2 16.3 18.3 12 18.3C7.7 18.3 4.5 16.2 2.5 12Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      </>
    ) : (
      <>
        <path
          d="M3 12C5.1 15.2 8.1 16.8 12 16.8C15.9 16.8 18.9 15.2 21 12"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M6.5 15.2L5 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10 16.6L9.5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M14 16.6L14.5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M17.5 15.2L19 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    )}
  </svg>
);

const LoginModal = () => {
  const {
    loginModalOpen,
    forgotPasswordModalOpen,
    passwordResetEmail,
    closeLoginModal,
    closeForgotPasswordModal,
    login,
    register,
  } =
    useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState("");
  const [personalDataAccepted, setPersonalDataAccepted] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationStep, setRegistrationStep] = useState(1);

  const [emailVerified, setEmailVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [canResendAt, setCanResendAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);

  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setEmailVerified(false);
    setCodeSent(false);
    setVerificationCode("");
    setRegistrationStep(1);
  };

  const getNormalizedEmail = () => email.trim().toLowerCase();

  const handleSendCode = async () => {
    setError("");
    const normalizedEmail = getNormalizedEmail();

    if (!emailPattern.test(normalizedEmail)) {
      setError("Введите корректный email");
      return false;
    }

    setLoading(true);
    try {
      const response = await sendEmailCode(normalizedEmail);
      setCodeSent(true);
      setRegistrationStep(2);
      if (response.data.canResendAt) {
        setCanResendAt(new Date(response.data.canResendAt));
      }
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Ошибка отправки кода");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError("");
    const normalizedEmail = getNormalizedEmail();

    if (!verificationCode.trim()) {
      setError("Введите код из письма");
      return false;
    }

    setLoading(true);
    try {
      await verifyEmailCode(normalizedEmail, verificationCode);
      setEmailVerified(true);
      setRegistrationStep(3);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Неверный код");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (isRegister && registrationStep === 1) {
      await handleSendCode();
      return;
    }

    if (isRegister && registrationStep === 2) {
      await handleVerifyCode();
      return;
    }

    if (isRegister && !emailVerified) {
      if (!codeSent) {
        await handleSendCode();
      }
      return;
    }

    if (isRegister && password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    if (isRegister && !personalDataAccepted) {
      setError("Для регистрации нужно принять политику обработки персональных данных");
      return;
    }

    setLoading(true);
    const result = isRegister
      ? await register(getNormalizedEmail(), password, name, {
          personalData: personalDataAccepted,
          acceptedAt: new Date().toISOString(),
        })
      : await login(getNormalizedEmail(), password);
    setLoading(false);

    if (!result.success) {
      setError(result.message);
    }
  };

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

  useEffect(() => {
    if (canResendAt) {
      const now = new Date();
      const diff = canResendAt - now;
      setTimeLeft(Math.max(0, Math.floor(diff / 1000)));
    }
  }, [canResendAt]);

  const handleSendResetCode = async () => {
    setError("");
    const normalizedEmail = getNormalizedEmail();

    if (!emailPattern.test(normalizedEmail)) {
      setError("Введите корректный email");
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(normalizedEmail);
      setResetCodeSent(true);
    } catch (err) {
      setError(err.response?.data?.message || "Ошибка отправки кода");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (resetCode.length < 6) {
      setError("Введите код из письма");
      return;
    }

    if (newPassword.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({
        email: getNormalizedEmail(),
        code: resetCode,
        newPassword,
      });
      alert("Пароль успешно изменён. Теперь вы можете войти.");
      setIsForgotPassword(false);
      closeForgotPasswordModal();
      setEmail("");
      setResetCode("");
      setNewPassword("");
      setResetCodeSent(false);
    } catch (err) {
      setError(err.response?.data?.message || "Ошибка восстановления пароля");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loginModalOpen) {
      setEmailVerified(false);
      setCodeSent(false);
      setVerificationCode("");
      setCanResendAt(null);
      setTimeLeft(0);
      setIsForgotPassword(false);
      setResetCodeSent(false);
      setResetCode("");
      setNewPassword("");
      setConfirmPassword("");
      setPersonalDataAccepted(false);
      setRegistrationStep(1);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setShowNewPassword(false);
      setError("");
    }
  }, [loginModalOpen]);

  useEffect(() => {
    if (forgotPasswordModalOpen) {
      setIsRegister(false);
      setIsForgotPassword(true);
      setResetCodeSent(false);
      setResetCode("");
      setNewPassword("");
      setShowNewPassword(false);
      setError("");

      if (passwordResetEmail) {
        setEmail(passwordResetEmail);
      }
    }
  }, [forgotPasswordModalOpen, passwordResetEmail]);

  if (!loginModalOpen) return null;

  const registrationSubmitLabel =
    registrationStep === 3 ? "Зарегистрироваться" : "Далее";

  return (
    <div className="modal-overlay" onClick={closeLoginModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={closeLoginModal}>
          x
        </button>
        <h2>{isRegister ? "Регистрация" : "Вход"}</h2>
        <form onSubmit={handleSubmit}>
          {(!isRegister || registrationStep === 1) && (
            <div className="form-group">
              <label>Email</label>
              <div className="phone-input-wrapper">
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  required
                  placeholder="you@example.com"
                  disabled={emailVerified}
                />
              </div>
            </div>
          )}

          {isRegister && registrationStep === 2 && (
            <div className="form-group">
              <label>Код из письма</label>
              <div className="code-input-wrapper">
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  className="code-input"
                  required
                />
              </div>
              {canResendAt && timeLeft > 0 && (
                <small className="hint">Повторная отправка через {timeLeft} сек.</small>
              )}
              {!canResendAt && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={handleSendCode}
                  disabled={loading}
                >
                  Отправить код ещё раз
                </button>
              )}
            </div>
          )}

          {isRegister && registrationStep === 3 && (
            <div className="form-group">
              <label>Имя</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя (необязательно)"
              />
            </div>
          )}

          {(!isRegister || registrationStep === 3) && (
          <div className="form-group">
            <label>Пароль</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Пароль"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                title={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                <PasswordEyeIcon isOpen={showPassword} />
              </button>
            </div>
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
          )}

          {isRegister && registrationStep === 3 && (
            <div className="form-group">
              <label>Повторите пароль</label>
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Повторите пароль"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? "Скрыть пароль" : "Показать пароль"}
                  title={showConfirmPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  <PasswordEyeIcon isOpen={showConfirmPassword} />
                </button>
              </div>
            </div>
          )}

          {isRegister && registrationStep === 3 && (
            <label className="registration-policy-consent">
              <input
                type="checkbox"
                checked={personalDataAccepted}
                onChange={(e) => setPersonalDataAccepted(e.target.checked)}
                required
              />
              <span>
                Я согласен(на) с{" "}
                <Link to="/personal-data-policy" target="_blank" rel="noopener noreferrer">
                  политикой обработки персональных данных
                </Link>
              </span>
            </label>
          )}

          {error && <p className="error">{error}</p>}

          {isRegister && registrationStep === 3 && emailVerified && (
            <p className="success-message">✓ Email подтверждён</p>
          )}

          <button
            type="submit"
            className={`btn btn-primary ${loading ? "btn-loading" : ""}`}
            disabled={loading || (isRegister && registrationStep === 3 && !personalDataAccepted)}
          >
            {loading ? "" : isRegister ? registrationSubmitLabel : "Войти"}
          </button>
        </form>

        <p className="toggle-mode">
          {isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?"}
          <button
            className="link-btn"
            onClick={() => {
              setIsRegister(!isRegister);
              setEmailVerified(false);
              setCodeSent(false);
              setVerificationCode("");
              setConfirmPassword("");
              setPersonalDataAccepted(false);
              setRegistrationStep(1);
              setShowPassword(false);
              setShowConfirmPassword(false);
              setError("");
            }}
          >
            {isRegister ? "Войти" : "Зарегистрироваться"}
          </button>
        </p>
      </div>

      {isForgotPassword && (
        <div
          className="modal-overlay"
          onClick={() => {
            setIsForgotPassword(false);
            closeForgotPasswordModal();
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => {
                setIsForgotPassword(false);
                closeForgotPasswordModal();
              }}
            >
              x
            </button>
            <h3>Восстановление пароля</h3>
            <p className="hint">
              {!resetCodeSent
                ? "Введите email, и мы отправим код в письме"
                : "Введите код из письма и новый пароль"}
            </p>

            {!resetCodeSent ? (
              <>
                <div className="form-group">
                  <label>Email</label>
                  <div className="phone-input-wrapper">
                    <input
                      type="email"
                      value={email}
                      onChange={handleEmailChange}
                      required
                      placeholder="you@example.com"
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
                      closeForgotPasswordModal();
                      setError("");
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleResetPassword}>
                <div className="form-group">
                  <label>Код из письма</label>
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
                  <div className="password-input-wrapper">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Новый пароль"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={showNewPassword ? "Скрыть пароль" : "Показать пароль"}
                      title={showNewPassword ? "Скрыть пароль" : "Показать пароль"}
                    >
                      <PasswordEyeIcon isOpen={showNewPassword} />
                    </button>
                  </div>
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
                      setShowNewPassword(false);
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
