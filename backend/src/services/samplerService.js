const Setting = require("../models/Setting");

const SAMPLER_SIZE_SETTING = "samplerSizeGrams";
const DEFAULT_SAMPLER_SIZE_GRAMS = 20;

const normalizeSamplerSizeGrams = (value) => {
  const size = Math.floor(Number(value));
  return Number.isFinite(size) && size > 0 ? size : DEFAULT_SAMPLER_SIZE_GRAMS;
};

const getSamplerSizeGrams = async () => {
  const setting = await Setting.findById(SAMPLER_SIZE_SETTING);
  return normalizeSamplerSizeGrams(setting?.value);
};

const setSamplerSizeGrams = async (value) => {
  const size = normalizeSamplerSizeGrams(value);
  await Setting.findByIdAndUpdate(
    SAMPLER_SIZE_SETTING,
    { value: size },
    { upsert: true, new: true, runValidators: true },
  );
  return size;
};

module.exports = {
  DEFAULT_SAMPLER_SIZE_GRAMS,
  getSamplerSizeGrams,
  normalizeSamplerSizeGrams,
  setSamplerSizeGrams,
};
