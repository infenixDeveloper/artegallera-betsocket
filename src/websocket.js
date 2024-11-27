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
        socket.on("message", (room, message) => {
            io.to(room).emit("message", message);
            console.log(`message sent to room ${room}`);
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
