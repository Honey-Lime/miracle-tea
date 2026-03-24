import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { formatPhone, extractPhoneDigits } from "../utils/formatPhone";
import "./LoginModal.css";

const LoginModal = () => {
  const { loginModalOpen, closeLoginModal, login } = useContext(AuthContext);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePhoneChange = (e) => {
    const raw = e.target.value;
    const formatted = formatPhone(raw);
    setPhone(formatted);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
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
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              required
              placeholder="+7 (XXX) XXX-XX-XX"
            />
            <small className="hint">
              Можно вводить без +7 (например, 9201231212)
            </small>
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
              placeholder="Пароль"
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button
            type="submit"
            className={`btn btn-primary ${loading ? "btn-loading" : ""}`}
            disabled={loading}
          >
            {loading ? "" : isRegister ? "Зарегистрироваться" : "Войти"}
          </button>
        </form>
        <p className="toggle-mode">
          {isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?"}
          <button
            className="link-btn"
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister ? "Войти" : "Зарегистрироваться"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginModal;
