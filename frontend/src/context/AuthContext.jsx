import { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const getErrorMessage = (error, fallbackMessage) => {
  const message = error.response?.data?.message;

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  if (!error.response) {
    return "Не удалось связаться с сервером. Проверьте подключение к интернету.";
  }

  return fallbackMessage;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [forgotPasswordModalOpen, setForgotPasswordModalOpen] = useState(false);
  const [passwordResetEmail, setPasswordResetEmail] = useState("");
  const isAdmin = user?.isAdmin || false;

  const applyAuthResponse = (response) => {
    const { token, user } = response.data;
    localStorage.setItem("token", token);
    setToken(token);
    setUser(user);
    setLoginModalOpen(false);
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post("/api/auth/login", { email, password });
      applyAuthResponse(response);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: getErrorMessage(error, "Не удалось выполнить вход"),
      };
    }
  };

  const register = async (email, password, name, consents) => {
    try {
      const response = await axios.post("/api/auth/register", {
        email,
        password,
        name,
        consents,
      });
      applyAuthResponse(response);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: getErrorMessage(error, "Не удалось завершить регистрацию"),
      };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  const openLoginModal = () => setLoginModalOpen(true);
  const openForgotPasswordModal = (email = "") => {
    setPasswordResetEmail(email);
    setForgotPasswordModalOpen(true);
    setLoginModalOpen(true);
  };
  const closeLoginModal = () => {
    setLoginModalOpen(false);
    setForgotPasswordModalOpen(false);
    setPasswordResetEmail("");
  };
  const closeForgotPasswordModal = () => {
    setForgotPasswordModalOpen(false);
    setPasswordResetEmail("");
  };

  // Проверка токена при загрузке
  useEffect(() => {
    if (token) {
      axios
        .get("/api/auth/profile", {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => setUser(res.data))
        .catch(() => logout());
    }
  }, [token]);

  const value = {
    user,
    token,
    isAdmin,
    login,
    register,
    updateUser,
    logout,
    loginModalOpen,
    forgotPasswordModalOpen,
    passwordResetEmail,
    openLoginModal,
    openForgotPasswordModal,
    closeLoginModal,
    closeForgotPasswordModal,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { AuthContext };
