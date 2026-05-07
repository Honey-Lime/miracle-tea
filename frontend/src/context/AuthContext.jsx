import { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loginModalOpen, setLoginModalOpen] = useState(false);
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
        message: error.response?.data?.message || "Ошибка входа",
      };
    }
  };

  const register = async (email, password, name) => {
    try {
      const response = await axios.post("/api/auth/register", {
        email,
        password,
        name,
      });
      applyAuthResponse(response);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Ошибка регистрации",
      };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const openLoginModal = () => setLoginModalOpen(true);
  const closeLoginModal = () => setLoginModalOpen(false);

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
    logout,
    loginModalOpen,
    openLoginModal,
    closeLoginModal,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { AuthContext };
