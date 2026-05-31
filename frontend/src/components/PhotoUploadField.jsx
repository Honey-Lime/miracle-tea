import "./PhotoUploadField.css";

const PhotoUploadField = ({
  photos = [],
  onAddFiles,
  onRemovePhoto,
  dragging = false,
  onDragChange,
  label = "Перетащите фото сюда или нажмите, чтобы выбрать",
  note = "JPEG, PNG, WebP или GIF. Максимальный размер фото — 4 МБ.",
  maxCount,
}) => {
  const handleDrop = (event) => {
    event.preventDefault();
    onDragChange?.(false);
    onAddFiles?.(event.dataTransfer.files);
  };

  return (
    <div className="puf-photo-upload-field">
      <label
        className={`puf-dropzone ${dragging ? "dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          onDragChange?.(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          onDragChange?.(true);
        }}
        onDragLeave={() => onDragChange?.(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            onAddFiles?.(event.target.files);
            event.target.value = "";
          }}
        />
        <span className="puf-icon">📎</span>
        <span>{photos.length > 0 ? `Выбрано фото: ${photos.length}${maxCount ? ` / ${maxCount}` : ""}` : label}</span>
        <small>{note}</small>
      </label>
      {photos.length > 0 && (
        <div className="puf-preview-list">
          {photos.map((photo, index) => (
            <div className="puf-preview" key={photo.previewUrl || photo.url || `${photo.name}-${index}`}>
              <img src={photo.previewUrl || photo.url} alt={`Выбранное фото ${index + 1}`} />
              <button type="button" onClick={() => onRemovePhoto?.(index)} aria-label="Удалить фото">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PhotoUploadField;
