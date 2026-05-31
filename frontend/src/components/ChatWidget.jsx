import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import PhotoUploadField from "./PhotoUploadField";
import { compressImageFiles } from "../utils/imageCompression";
import "./ChatWidget.css";

const ChatWidget = () => {
  const { user, openLoginModal } = useAuth();
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState(null);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState([]);
  const [dropActive, setDropActive] = useState(false);
  const [photoViewer, setPhotoViewer] = useState(null);
  const messagesRef = useRef(null);

  const addSelectedPhotos = async (files) => {
    const compressedFiles = await compressImageFiles(files);
    const allowedFiles = compressedFiles.filter((file) => file.size <= 4 * 1024 * 1024);
    if (allowedFiles.length < compressedFiles.length) {
      alert("Часть фото не прикреплена: после сжатия файл всё ещё больше 4 МБ.");
    }
    const nextPhotos = allowedFiles
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setPhotos((prev) => [...prev, ...nextPhotos]);
  };

  const removeSelectedPhoto = (index) => {
    setPhotos((prev) => {
      const photo = prev[index];
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return prev.filter((_, photoIndex) => photoIndex !== index);
    });
  };

  const handleMessagePaste = (event) => {
    const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;
    event.preventDefault();
    addSelectedPhotos(files);
  };

  const loadChat = async (markRead = open) => {
    if (!user) return;
    try {
      const response = await api.get("/chats/my", { params: { markRead } });
      setChat(response.data);
    } catch (error) {
      console.error("Не удалось загрузить чат", error);
    }
  };

  useEffect(() => {
    loadChat();
    if (!user) return undefined;
    const intervalId = setInterval(loadChat, 15000);
    return () => clearInterval(intervalId);
  }, [user, open]);

  useEffect(() => {
    if (open) messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight });
  }, [open, chat]);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!user) {
      openLoginModal();
      return;
    }

    const formData = new FormData();
    formData.append("text", text);
    photos.forEach((photo) => formData.append("photos", photo.file));

    try {
      const response = await api.post("/chats/my/messages", formData);
      setChat(response.data);
      setText("");
      setPhotos((prev) => {
        prev.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
        return [];
      });
    } catch (error) {
      alert(error.response?.status === 413
        ? "Фото слишком большое для отправки. Попробуйте выбрать фото меньшего размера."
        : error.response?.data?.message || "Не удалось отправить сообщение");
    }
  };

  const unread = chat?.unreadForUser || 0;
  const closePhotoViewer = () => setPhotoViewer(null);
  const showPrevPhoto = () => {
    setPhotoViewer((viewer) => viewer && {
      ...viewer,
      index: viewer.index === 0 ? viewer.photos.length - 1 : viewer.index - 1,
    });
  };
  const showNextPhoto = () => {
    setPhotoViewer((viewer) => viewer && {
      ...viewer,
      index: viewer.index === viewer.photos.length - 1 ? 0 : viewer.index + 1,
    });
  };

  return (
    <div className={`cw-chat-widget ${open ? "open" : ""}`}>
      <button className="cw-chat-toggle" type="button" onClick={() => (user ? setOpen(!open) : openLoginModal())}>
        <span aria-hidden="true">💬</span>
        {unread > 0 && <strong>{unread}</strong>}
      </button>
      {open && user && (
        <div className="cw-chat-panel">
          <div className="cw-chat-header">
            <span>Администратор</span>
            <button type="button" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="cw-chat-messages" ref={messagesRef}>
            {(chat?.messages || []).length === 0 && <p className="cw-empty">Напишите нам, мы ответим здесь.</p>}
            {(chat?.messages || []).map((message) => {
              const isUnreadIncoming = message.sender === "admin" && !message.readByUser;

              return (
                <div className={`cw-message ${message.sender} ${isUnreadIncoming ? "cw-message-unread" : ""}`} key={message.id}>
                  <small>{message.sender === "admin" ? "Администратор" : "Вы"}</small>
                  {message.text && <p>{message.text}</p>}
                  {message.photos?.map((photo, index) => (
                    <button
                      className="cw-photo-thumb"
                      type="button"
                      key={photo.url}
                      onClick={() => setPhotoViewer({ photos: message.photos, index })}
                    >
                      <img src={photo.url} alt="Фото в чате" />
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          <form className="cw-chat-form" onSubmit={sendMessage}>
            <textarea value={text} onChange={(event) => setText(event.target.value)} onPaste={handleMessagePaste} placeholder="Ваше сообщение" rows={2} />
            <PhotoUploadField
              photos={photos}
              onAddFiles={addSelectedPhotos}
              onRemovePhoto={removeSelectedPhoto}
              dragging={dropActive}
              onDragChange={setDropActive}
              label="Перетащите фото, выберите файл или вставьте скриншот Ctrl+V в поле сообщения"
              note="JPEG, PNG, WebP или GIF. Максимальный размер фото после сжатия — 4 МБ."
            />
            <button className="btn btn-primary" type="submit">Отправить</button>
          </form>
        </div>
      )}
      {photoViewer && (
        <div className="cw-photo-modal" onClick={closePhotoViewer}>
          <div className="cw-photo-modal-content" onClick={(event) => event.stopPropagation()}>
            <button className="cw-photo-close" type="button" onClick={closePhotoViewer}>×</button>
            <button className="cw-photo-nav prev" type="button" onClick={showPrevPhoto}>‹</button>
            <img src={photoViewer.photos[photoViewer.index].url} alt={`Фото в чате ${photoViewer.index + 1}`} />
            <button className="cw-photo-nav next" type="button" onClick={showNextPhoto}>›</button>
            <div className="cw-photo-counter">
              {photoViewer.index + 1} / {photoViewer.photos.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
