import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors({
  origin: ["http://localhost:3000", "https://rekor.vercel.app"],
  credentials: true
}));
const server = http.createServer(app);

// enabled cors for all routes for now to be changed in prod
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://rekor.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true
  },
});
// Type-safe Maps for rooms and users
const rooms = new Map<string, Set<string>>(); // roomId -> set of socket IDs
const users = new Map<string, string>(); // socket ID -> roomId

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);

  socket.on("join", ({ roomId }: { roomId: string }) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    const room = rooms.get(roomId)!;

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

  socket.on("localDescription", ({ description }: { description: any }) => {
    const roomId = users.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    for (const userId of room) {
      if (userId !== socket.id) {
        io.to(userId).emit("localDescription", { description });
      }
    }
  });

  socket.on("remoteDescription", ({ description }: { description: any }) => {
    const roomId = users.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    for (const userId of room) {
      if (userId !== socket.id) {
        io.to(userId).emit("remoteDescription", { description });
      }
    }
  });

  socket.on("iceCandidate", ({ candidate }: { candidate: any }) => {
    const roomId = users.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    for (const userId of room) {
      if (userId !== socket.id) {
        io.to(userId).emit("iceCandidate", { candidate });
      }
    }
  });

  socket.on("iceCandidateReply", ({ candidate }: { candidate: any }) => {
    const roomId = users.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

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
