const express = require("express");

let io;

module.exports = {
  init: (server) => {
    io = require("socket.io")(server, {
      cors: {
        origin: "*", // Puedes restringir el origen según tu frontend
        methods: ["GET", "POST"]
      }
    });

    io.on("connection", (socket) => {
      console.log("Nuevo cliente conectado: " + socket.id);

      // Escuchamos un evento 'join' para que el cliente se una a una sala (room)
      // donde el nombre de la sala será el ID del usuario.
      socket.on("join", (userId) => {
        socket.join(userId);
        console.log(`Socket ${socket.id} se unió a la sala: ${userId}`);
      });

      socket.on("disconnect", () => {
        console.log("Cliente desconectado: " + socket.id);
      });
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error("Socket.io no ha sido inicializado!");
    }
    return io;
  }
};
