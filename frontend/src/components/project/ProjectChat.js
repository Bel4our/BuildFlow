import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import io from 'socket.io-client';
import api from '../../api/axios';
import styles from '../../pages/ProjectDetails.module.css';

const socketUrl = process.env.NODE_ENV === 'production' ? '' : `http://${window.location.hostname}:5000`;
const socket = io(socketUrl);

const CheckMarks = ({ isRead }) => (
  <span className={styles.checkMarks} style={{ color: isRead ? '#4fb14f' : '#999' }}>
    {isRead ? <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/></svg> 
            : <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
  </span>
);

const ProjectChat = ({ projectId }) => {
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [hasUnread, setHasUnread] = useState(false);
  const chatRef = useRef(null);
  
  const scrollToBottom = () => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  };
  
  useEffect(() => {
    const fetchMessages = async () => {
      const chatRes = await api.get(`/projects/${projectId}/messages`);
      setMessages(chatRes.data);
      if (chatRes.data.some(m => !m.isRead && m.senderId !== user.id)) setHasUnread(true);
      setTimeout(scrollToBottom, 100);
    };
    fetchMessages();
    
    socket.emit('join_project', projectId);

    const handleNewMessage = (newMessageData) => {
      setMessages(prev => [...prev, newMessageData]);
      setTimeout(scrollToBottom, 100);
      if (newMessageData.senderId !== user.id) setHasUnread(true);
    };

    const handleMessagesRead = ({ readerId }) => {
      if (readerId !== user.id) {
        setMessages(prev => prev.map(msg => msg.senderId === user.id ? { ...msg, isRead: true } : msg));
      }
    };

    socket.on('message_broadcast', handleNewMessage);
    socket.on('messages_read', handleMessagesRead);

    return () => {
      socket.emit('leave_project', projectId);
      socket.off('message_broadcast', handleNewMessage);
      socket.off('messages_read', handleMessagesRead);
    };
  }, [projectId, user.id]);

  const handleChatInteraction = useCallback(async () => {
    if (hasUnread) {
      try {
        await api.put(`/projects/${projectId}/messages/read`);
        setMessages(prev => prev.map(msg => msg.senderId !== user.id ? { ...msg, isRead: true } : msg));
        setHasUnread(false);
      } catch (error) {}
    }
  }, [hasUnread, projectId, user.id]);
  
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if(!newMessage.trim() || newMessage.length > 500) return;
    await api.post(`/projects/${projectId}/messages`, { text: newMessage });
    setNewMessage('');
    handleChatInteraction();
  };

  const groupedMessages = messages.reduce((acc, m) => {
    const date = new Date(m.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    if (!acc[date]) acc[date] = []; acc[date].push(m); return acc;
  }, {});

  return (
    <div className={`card ${styles.chatContainer}`} onMouseEnter={handleChatInteraction} onClick={handleChatInteraction}>
      <h3 className={styles.chatHeader}>Обсуждение проекта {hasUnread && <span style={{color:'red', fontSize:'0.7em'}}> (Новые)</span>}</h3>
      <div ref={chatRef} className={styles.chatBox}>
        {messages.length === 0 && <p className={styles.noMessages}>Сообщений пока нет...</p>}
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <React.Fragment key={date}>
            <div className={styles.chatDate}><span>{date}</span></div>
            {msgs.map(m => {
              const isMine = m.senderId === user.id;
              return (
                <div key={m.id} className={isMine ? styles.myMessageWrapper : styles.otherMessageWrapper}>
                  {!isMine && <span className={styles.senderName}>{m.sender?.fullName}</span>}
                  <div className={isMine ? styles.myMessage : styles.otherMessage}>
                    {m.text}
                    <div className={styles.messageInfo}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isMine && <CheckMarks isRead={m.isRead} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <form onSubmit={handleSendMessage} className={styles.chatForm}>
        <div className={styles.chatInputWrapper}>
          <input type="text" maxLength={500} value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Написать..." required />
          <button type="submit" style={{borderRadius: '50%', width: '40px', height: '40px', padding: 0, lineHeight: '40px'}}>➤</button>
        </div>
        <div className={styles.charCounter} style={{color: newMessage.length === 500 ? 'red' : '#999'}}>{newMessage.length}/500</div>
      </form>
    </div>
  );
};

export default ProjectChat;