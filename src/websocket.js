const lastMessageTime = {}; // Inicialización del registro de tiempos

module.exports = (io) => {
    io.on("connection", (socket) => {
        console.log("new connection");

        socket.on("disconnect", () => {
            console.log("user disconnected");
        });

        socket.on("join", (room) => {
            socket.join(room);
            console.log(`user joined room ${room}`);
        });

        socket.on("leave", (room) => {
            socket.leave(room);
            console.log(`user left room ${room}`);
        });

        socket.on("message", (room, data) => {
            console.log("Datos recibidos:", data);

            if (!data || typeof data !== "object" || !data.username || !data.message) {
                console.log("Usuario o mensaje inválido");
                return;
            }

            const { username, message } = data;

            const now = Date.now();

            if (lastMessageTime[username]) {
                const timeSinceLastMessage = now - lastMessageTime[username];

                if (timeSinceLastMessage < 30 * 60 * 1000) {
                    const timeRemaining = Math.ceil(
                        (30 * 60 * 1000 - timeSinceLastMessage) / 1000
                    );
                    socket.emit(
                        "messageRejected",
                        `Debes esperar ${timeRemaining} segundos antes de enviar otro mensaje.`,
                        timeRemaining
                    );
                    console.log(`Usuario ${username} intentó enviar un mensaje antes de tiempo.`);
                    return;
                }
            }

            lastMessageTime[username] = now;

            io.to(room).emit("message", `${username}: ${message}`);
            console.log(`Mensaje enviado a la sala ${room} por ${username}`);
        });

        socket.on("typing", (room, username) => {
            io.to(room).emit("typing", username);
            console.log(`typing detected in room ${room}`);
        });

        socket.on("stopTyping", (room, username) => {
            io.to(room).emit("stopTyping", username);
            console.log(`typing stopped in room ${room}`);
        });
    });
};
