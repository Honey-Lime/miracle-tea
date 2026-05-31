import { useEffect, useState } from "react";
import api from "../../services/api";
import AdminUserMenu from "../../components/AdminUserMenu";
import { compressImageFiles } from "../../utils/imageCompression";

const ChatsPage = () => {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState([]);
  const [dropActive, setDropActive] = useState(false);
  const [photoViewer, setPhotoViewer] = useState(null);

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

  const loadChats = async () => {
    const response = await api.get("/admin/chats");
    setChats(response.data);
    if (!selectedChat && response.data[0]) setSelectedChat(response.data[0]);
  };

  useEffect(() => {
    loadChats();
    const intervalId = setInterval(loadChats, 15000);
    return () => clearInterval(intervalId);
  }, []);

  const openChat = async (chatId) => {
    const response = await api.get(`/admin/chats/${chatId}`);
    setSelectedChat(response.data);
    setChats((prev) => prev.map((chat) => (chat.id === chatId ? response.data : chat)));
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!selectedChat) return;
    const formData = new FormData();
    formData.append("text", text);
    photos.forEach((photo) => formData.append("photos", photo.file));
    try {
      const response = await api.post(`/admin/chats/${selectedChat.id}/messages`, formData);
      setSelectedChat(response.data);
      setChats((prev) => prev.map((chat) => (chat.id === response.data.id ? response.data : chat)));
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
    <section className="ap-chats-page">
      <h1>Чаты с клиентами</h1>
      <div className="ap-chats-layout">
        <aside className="ap-chats-list">
          {chats.length === 0 && <p>Чатов пока нет</p>}
          {chats.map((chat) => (
            <button type="button" className={selectedChat?.id === chat.id ? "active" : ""} key={chat.id} onClick={() => openChat(chat.id)}>
              <strong><AdminUserMenu user={chat.user} /></strong>
              <span>{chat.user?.email || "без email"}</span>
              {chat.unreadForAdmin > 0 && <em>{chat.unreadForAdmin}</em>}
            </button>
          ))}
        </aside>
        <div className="ap-chat-window">
          {!selectedChat ? (
            <p>Выберите чат</p>
          ) : (
            <>
              <div className="ap-chat-messages">
                {selectedChat.messages.map((message) => (
                  <div className={`ap-chat-message ${message.sender}`} key={message.id}>
                    <small>{message.sender === "admin" ? "Администратор" : <AdminUserMenu user={selectedChat.user} />}</small>
                    {message.text && <p>{message.text}</p>}
                    {message.photos?.map((photo, index) => (
                      <button
                        className="ap-chat-photo-thumb"
                        type="button"
                        key={photo.url}
                        onClick={() => setPhotoViewer({ photos: message.photos, index })}
                      >
                        <img src={photo.url} alt="Фото в чате" />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <form className="ap-chat-form" onSubmit={sendMessage}>
                <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} placeholder="Ответ клиенту" />
                <label
                  className={`ap-chat-file-dropzone ${dropActive ? "dragging" : ""}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDropActive(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropActive(true);
                  }}
                  onDragLeave={() => setDropActive(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDropActive(false);
                    addSelectedPhotos(event.dataTransfer.files);
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => {
                      addSelectedPhotos(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  {photos.length > 0 ? `Выбрано фото: ${photos.length}` : "Перетащите фото сюда или выберите файл"}
                  <small>Крупные фото автоматически уменьшаются перед отправкой.</small>
                </label>
                {photos.length > 0 && (
                  <div className="ap-chat-selected-photos">
                    {photos.map((photo, index) => (
                      <div className="ap-chat-selected-photo" key={photo.previewUrl}>
                        <img src={photo.previewUrl} alt={`Выбранное фото ${index + 1}`} />
                        <button type="button" onClick={() => removeSelectedPhoto(index)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <button className="btn btn-primary" type="submit">Отправить</button>
              </form>
            </>
          )}
        </div>
      </div>
      {photoViewer && (
        <div className="ap-chat-photo-modal" onClick={closePhotoViewer}>
          <div className="ap-chat-photo-modal-content" onClick={(event) => event.stopPropagation()}>
            <button className="ap-chat-photo-close" type="button" onClick={closePhotoViewer}>×</button>
            <button className="ap-chat-photo-nav prev" type="button" onClick={showPrevPhoto}>‹</button>
            <img src={photoViewer.photos[photoViewer.index].url} alt={`Фото в чате ${photoViewer.index + 1}`} />
            <button className="ap-chat-photo-nav next" type="button" onClick={showNextPhoto}>›</button>
            <div className="ap-chat-photo-counter">
              {photoViewer.index + 1} / {photoViewer.photos.length}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ChatsPage;
