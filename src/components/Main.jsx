import React, { useEffect, useState } from "react";
import keys from "../../keys.json"; // Importa las llaves VAPID
import { useNavigate } from "react-router-dom";
import './Main.css'; // Importamos el archivo CSS

function Main() {
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Estado de carga
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");
  const userRole = localStorage.getItem("userRole");
  
  useEffect(() => {
    if (userRole === "admin") {
      fetch("https://backend-be7l.onrender.com/auth/users")
        .then((response) => {
          if (!response.ok) throw new Error("Error al obtener los usuarios");
          return response.json();
        })
        .then((data) => {
          console.log("Usuarios obtenidos:", data); // ✅ Verifica los datos recibidos en la consola
          const usersWithSubscription = data.filter((user) => user.suscripcion !== null && user.suscripcion !== undefined);
          setUsers(usersWithSubscription);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error al cargar los usuarios:", error);
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [userRole]);
  

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", { type: "module" });
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) return;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keys.publicKey,
      });

      if (!userId) return;

      const response = await fetch("https://backend-be7l.onrender.com/auth/suscripcion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, suscripcion: subscription.toJSON() }),
      });

      if (!response.ok) throw new Error(`Error en la solicitud: ${response.status}`);
      console.log("Suscripción guardada en la base de datos:", await response.json());

    } catch (error) {
      console.error("Error en el registro del Service Worker:", error);
    }
  };

  useEffect(() => {
    registerServiceWorker();
  }, []);

  const handleOpenModal = (user) => {
    console.log("Usuario seleccionado:", user);
    setSelectedUser(user);
    setIsModalOpen(true);
  };
  

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setMessage("");
  };

  const handleSendMessage = async () => {
    try {
      if (!selectedUser) {
        throw new Error("No se ha seleccionado un usuario válido.");
      }
  
      if (!selectedUser.suscripcion) {
        throw new Error(`El usuario ${selectedUser.email} no tiene una suscripción válida.`);
      }
  
      if (!message.trim()) {
        throw new Error("El mensaje no puede estar vacío");
      }
  
      console.log("Enviando a suscripción:", selectedUser.suscripcion);
  
      const response = await fetch("https://backend-be7l.onrender.com/auth/suscripcionMod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suscripcion: selectedUser.suscripcion,
          mensaje: message,
        }),
      });
  
      if (!response.ok) throw new Error("Error al enviar el mensaje");
  
      const data = await response.json();
      console.log("Mensaje enviado:", data);
      alert("Mensaje enviado con éxito");
      handleCloseModal();
    } catch (error) {
      console.error("Error al enviar el mensaje:", error);
      alert(error.message);
    }
  };
  

  return (
    <div className="page-container">
      <h2 className="page-title">Bienvenid@</h2>
      {userRole === "admin" ? (
        <div>
          <h2>📋 Usuarios Suscritos</h2>
          {isLoading ? (
            <p>⏳ Cargando usuarios...</p>
          ) : (
            <table className="user-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>📩 Email</th>
                    <th>✉️ Enviar Mensaje</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.map((user, index) => (
                    <tr key={user._id || index}>
                      <td>{user._id}</td>
                      <td>{user.email}</td>
                      <td>
                        <button className="send-message-btn" onClick={() => handleOpenModal(user)}>
                          Enviar
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4">📭 No hay usuarios suscritos</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <p>⚠️ No tienes permisos para ver esta página.</p>
      )}

      {isModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>Enviar mensaje a {selectedUser.email}</h3>
            <textarea
              className="modal-textarea"
              placeholder="Escribe tu mensaje..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="modal-actions">
              <button className="close-btn" onClick={handleCloseModal}>Cerrar</button>
              <button className="send-btn" onClick={handleSendMessage}>Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Main;
