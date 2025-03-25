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
  
  console.log(localStorage,userRole);
  
  useEffect(() => {
    if (userRole === "admin") {
      fetch("https://backend-be7l.onrender.com/auth/users")
        .then((response) => {
          if (!response.ok) throw new Error("Error al obtener los usuarios");
          return response.json();
        })
        .then((data) => {
          const usersWithSubscription = data.filter((user) => user.suscripcion);
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

      const json = subscription.toJSON();

      const response = await fetch('https://backend-be7l.onrender.com/auth/suscripcion', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, suscripcion: json }),
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
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setMessage("");
  };

  const handleSendMessage = async () => {
    try {
      // Enviar la suscripción y el mensaje al backend
      const response = await fetch("https://backend-be7l.onrender.com/auth/suscripcionMod", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suscripcion: selectedUser.suscripcion, // Enviar la suscripción del usuario
          mensaje: message // Enviar el mensaje
        })
      });

      if (!response.ok) {
        throw new Error('Error al enviar el mensaje');
      }
  
      const data = await response.json();
      console.log('Mensaje enviado:', data);
      alert('Mensaje enviado con éxito');
      handleCloseModal();
    } catch (error) {
      console.error('Error al enviar el mensaje:', error);
      alert('Hubo un error al enviar el mensaje');
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
                        <button onClick={() => handleSendMessage(user)}>
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
    </div>
  );
}

export default Main;
