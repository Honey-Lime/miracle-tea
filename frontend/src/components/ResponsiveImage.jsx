import imageManifest from "../data/imageManifest.json";

const FORMATS = [
  { type: "image/avif", extension: "avif" },
  { type: "image/webp", extension: "webp" },
];

const ResponsiveImage = ({ name, sizes, alt = "", loading = "lazy", ...imgProps }) => {
  const { width, height, widths } = imageManifest[name];
  const buildSrcSet = (extension) =>
    widths.map((size) => `/img/${name}-${size}.${extension} ${size}w`).join(", ");

  return (
    <picture>
      {FORMATS.map(({ type, extension }) => (
        <source key={type} type={type} srcSet={buildSrcSet(extension)} sizes={sizes} />
      ))}
      <img
        src={`/${name}.png`}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        {...imgProps}
      />
    </picture>
  );
};

export default ResponsiveImage;
