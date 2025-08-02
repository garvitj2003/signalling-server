"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const allowedOrigins = [
    "http://localhost:3000", // for dev
    "https://rekor.vercel.app", // deployed client
];
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    credentials: true,
}));
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true,
    },
});
// Type-safe Maps for rooms and users
const rooms = new Map(); // roomId -> set of socket IDs
const users = new Map(); // socket ID -> roomId
io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
    socket.on("join-room", ({ roomId }) => {
        // Join the user to the specified room in Socket.IO's internal rooms management
        socket.join(roomId);
        // Create the room if it doesn't exist
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        const room = rooms.get(roomId);
        // Check if the room is full (or has 2 people already)
        if (room.size >= 2) {
            console.log(`User ${socket.id} tried to join full room ${roomId}.`);
            socket.emit("room-full");
            return;
        }
        // Add the user to our custom room map
        room.add(socket.id);
        users.set(socket.id, roomId);
        // Announce the presence of the new user to all in the room.
        // This will trigger the signaling logic on the client side.
        const roomSize = room.size;
        // If this is the first user in the room
        if (roomSize === 1) {
            // Tell this user they are the first. They should create the offer.
            // This is the "caller".
            socket.emit("room-joined", { roomSize: 1 });
            console.log(`User ${socket.id} created room ${roomId}`);
        }
        // If this is the second user
        else if (roomSize === 2) {
            // Get the other participant's socket ID
            const otherUserSocketId = Array.from(room).find(id => id !== socket.id);
            // Tell the first user that a new peer has joined.
            // This will trigger the offer creation on their end.
            if (otherUserSocketId) {
                io.to(otherUserSocketId).emit("peer-joined");
                console.log(`User ${socket.id} joined room ${roomId}. Notifying ${otherUserSocketId}.`);
            }
            // Tell the second user they've joined. They will wait for the offer.
            // This is the "callee".
            socket.emit("room-joined", { roomSize: 2 });
        }
    });
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        const roomId = users.get(socket.id);
        if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
                // Remove the user from the room
                room.delete(socket.id);
                // Tell the other user that their peer has disconnected
                const otherUserSocketId = Array.from(room)[0];
                if (otherUserSocketId) {
                    io.to(otherUserSocketId).emit("peer-disconnected");
                }
                // If the room is now empty, delete it
                if (room.size === 0) {
                    rooms.delete(roomId);
                    console.log(`Room ${roomId} is now empty and has been deleted.`);
                }
            }
            users.delete(socket.id);
        }
    });
    // Helper function to forward messages to the other user in the room
    const forwardMessage = (eventName, payload) => {
        const roomId = users.get(socket.id);
        if (!roomId)
            return;
        const room = rooms.get(roomId);
        if (!room)
            return;
        // Send the message to the other user in the room
        for (const userId of room) {
            if (userId !== socket.id) {
                io.to(userId).emit(eventName, payload);
                console.log(`Forwarded ${eventName} from ${socket.id} to ${userId}`);
            }
        }
    };
    // Forwarding all the WebRTC signaling messages
    // We're renaming the events to be more explicit about what they are.
    socket.on("webrtc-offer", ({ sdp }) => {
        forwardMessage("webrtc-offer", { sdp });
    });
    socket.on("webrtc-answer", ({ sdp }) => {
        forwardMessage("webrtc-answer", { sdp });
    });
    socket.on("ice-candidate", ({ candidate }) => {
        forwardMessage("ice-candidate", { candidate });
    });
});
const PORT = process.env.PORT || 1234;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
