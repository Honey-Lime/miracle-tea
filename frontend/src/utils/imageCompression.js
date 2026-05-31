const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 0.82;

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось обработать изображение"));
    };
    image.src = url;
  });

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Не удалось сжать изображение"));
    }, type, quality);
  });

export const compressImageFile = async (file) => {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await canvasToBlob(canvas, outputType, outputType === "image/jpeg" ? JPEG_QUALITY : undefined);

  if (blob.size >= file.size) return file;

  const extension = outputType === "image/png" ? "png" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.${extension}`, {
    type: outputType,
    lastModified: Date.now(),
  });
};

export const compressImageFiles = async (files) => {
  const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
  return Promise.all(imageFiles.map(compressImageFile));
};
