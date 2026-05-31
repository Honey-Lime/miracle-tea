import { useEffect, useState } from "react";
import api from "../../services/api";

const ChatsPage = () => {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState([]);
  const [dropActive, setDropActive] = useState(false);

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
    photos.forEach((photo) => formData.append("photos", photo));
    const response = await api.post(`/admin/chats/${selectedChat.id}/messages`, formData);
    setSelectedChat(response.data);
    setChats((prev) => prev.map((chat) => (chat.id === response.data.id ? response.data : chat)));
    setText("");
    setPhotos([]);
  };

  return (
    <section className="ap-chats-page">
      <h1>Чаты с клиентами</h1>
      <div className="ap-chats-layout">
        <aside className="ap-chats-list">
          {chats.length === 0 && <p>Чатов пока нет</p>}
          {chats.map((chat) => (
            <button type="button" className={selectedChat?.id === chat.id ? "active" : ""} key={chat.id} onClick={() => openChat(chat.id)}>
              <strong>{chat.user?.name || "Клиент"}</strong>
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
                    <small>{message.sender === "admin" ? "Администратор" : selectedChat.user?.name || "Клиент"}</small>
                    {message.text && <p>{message.text}</p>}
                    {message.photos?.map((photo) => (
                      <a href={photo.url} target="_blank" rel="noreferrer" key={photo.url}>
                        <img src={photo.url} alt="Фото в чате" />
                      </a>
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
                    setPhotos(Array.from(event.dataTransfer.files || []).filter((file) => file.type.startsWith("image/")));
                  }}
                >
                  <input type="file" accept="image/*" multiple onChange={(event) => setPhotos(Array.from(event.target.files || []))} />
                  {photos.length > 0 ? `Выбрано фото: ${photos.length}` : "Перетащите фото сюда или выберите файл"}
                </label>
                <button className="btn btn-primary" type="submit">Отправить</button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default ChatsPage;
