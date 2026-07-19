import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";

export const DEFAULT_SAMPLER_SIZE_GRAMS = 20;

const SamplerSettingsContext = createContext({
  samplerSizeGrams: DEFAULT_SAMPLER_SIZE_GRAMS,
});

export const useSamplerSettings = () => useContext(SamplerSettingsContext);

export const SamplerSettingsProvider = ({ children }) => {
  const [samplerSizeGrams, setSamplerSizeGrams] = useState(DEFAULT_SAMPLER_SIZE_GRAMS);

  useEffect(() => {
    api.get("/bonus-settings")
      .then((response) => {
        const size = Math.floor(Number(response.data?.samplerSizeGrams));
        if (Number.isFinite(size) && size > 0) {
          setSamplerSizeGrams(size);
          localStorage.setItem("samplerSizeGrams", String(size));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <SamplerSettingsContext.Provider value={{ samplerSizeGrams }}>
      {children}
    </SamplerSettingsContext.Provider>
  );
};
