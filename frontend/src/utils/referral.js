const STORAGE_KEY = "referralCode";

export const saveReferralCodeFromSearch = (search) => {
  const code = new URLSearchParams(search).get("ref");
  if (!code) return;
  try {
    localStorage.setItem(STORAGE_KEY, code.trim().toUpperCase());
  } catch {
    // localStorage недоступен — привязка по ссылке просто не сработает
  }
};

export const getReferralCode = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

export const clearReferralCode = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};
