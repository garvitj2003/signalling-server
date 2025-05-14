"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "http://localhost:3000",
    },
});
// Type-safe Maps for rooms and users
const rooms = new Map(); // roomId -> set of socket IDs
const users = new Map(); // socket ID -> roomId
io.on("connection", (socket) => {
    console.log("a user connected", socket.id);
    socket.on("join", ({ roomId }) => {
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        const room = rooms.get(roomId);
        if (room.size >= 2) {
            socket.emit("room_full");
            return;
        }
        room.add(socket.id);
        users.set(socket.id, roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });
    socket.on("disconnect", () => {
        const roomId = users.get(socket.id);
        if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
                room.delete(socket.id);
                if (room.size === 0) {
                    rooms.delete(roomId);
                    console.log("room deleted");
                }
            }
            users.delete(socket.id);
        }
        console.log("User disconnected", socket.id);
    });
    socket.on("localDescription", ({ description }) => {
        const roomId = users.get(socket.id);
        if (!roomId)
            return;
        const room = rooms.get(roomId);
        if (!room)
            return;
        for (const userId of room) {
            if (userId !== socket.id) {
                io.to(userId).emit("localDescription", { description });
            }
        }
    });
    socket.on("remoteDescription", ({ description }) => {
        const roomId = users.get(socket.id);
        if (!roomId)
            return;
        const room = rooms.get(roomId);
        if (!room)
            return;
        for (const userId of room) {
            if (userId !== socket.id) {
                io.to(userId).emit("remoteDescription", { description });
            }
        }
    });
    socket.on("iceCandidate", ({ candidate }) => {
        const roomId = users.get(socket.id);
        if (!roomId)
            return;
        const room = rooms.get(roomId);
        if (!room)
            return;
        for (const userId of room) {
            if (userId !== socket.id) {
                io.to(userId).emit("iceCandidate", { candidate });
            }
        }
    });
    socket.on("iceCandidateReply", ({ candidate }) => {
        const roomId = users.get(socket.id);
        if (!roomId)
            return;
        const room = rooms.get(roomId);
        if (!room)
            return;
        for (const userId of room) {
            if (userId !== socket.id) {
                io.to(userId).emit("iceCandidateReply", { candidate });
            }
        }
    });
});
server.listen(1234, () => {
    console.log("Server listening on port 1234");
});
