import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import "./ChatWidget.css";

const ChatWidget = () => {
  const { user, openLoginModal } = useAuth();
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState(null);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState([]);
  const [dropActive, setDropActive] = useState(false);
  const messagesRef = useRef(null);

  const loadChat = async () => {
    if (!user) return;
    try {
      const response = await api.get("/chats/my");
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
  }, [user]);

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
    photos.forEach((photo) => formData.append("photos", photo));

    try {
      const response = await api.post("/chats/my/messages", formData);
      setChat(response.data);
      setText("");
      setPhotos([]);
    } catch (error) {
      alert(error.response?.data?.message || "Не удалось отправить сообщение");
    }
  };

  const unread = chat?.unreadForUser || 0;

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
            {(chat?.messages || []).map((message) => (
              <div className={`cw-message ${message.sender}`} key={message.id}>
                <small>{message.sender === "admin" ? "Администратор" : "Вы"}</small>
                {message.text && <p>{message.text}</p>}
                {message.photos?.map((photo) => (
                  <a href={photo.url} target="_blank" rel="noreferrer" key={photo.url}>
                    <img src={photo.url} alt="Фото в чате" />
                  </a>
                ))}
              </div>
            ))}
          </div>
          <form className="cw-chat-form" onSubmit={sendMessage}>
            <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Ваше сообщение" rows={2} />
            <label
              className={`cw-file-dropzone ${dropActive ? "dragging" : ""}`}
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
                setPhotos(Array.from(event.dataTransfer.files || []).filter((file) => file.type.startsWith("image/")));
              }}
            >
              <input type="file" accept="image/*" multiple onChange={(event) => setPhotos(Array.from(event.target.files || []))} />
              {photos.length > 0 ? `Выбрано фото: ${photos.length}` : "Перетащите фото сюда или выберите файл"}
            </label>
            <button className="btn btn-primary" type="submit">Отправить</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
