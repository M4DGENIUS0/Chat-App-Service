const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for Socket.IO
    methods: ["GET", "POST"],
  },
});

// Use CORS middleware for Express
app.use(cors());

// MongoDB connection
const mongoURI =
  "mongodb+srv://an7539661:6scTholuzRHssQJW@guftago.bnwkn.mongodb.net/mydb?retryWrites=true&w=majority";
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB."))
  .catch((error) => console.error("MongoDB connection error:", error));

// Message schema
const messageSchema = new mongoose.Schema({
  senderId: String,
  targetId: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model("Message", messageSchema);

// Clients map to store active users
const clients = {};

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // User signin
  socket.on("signin", (id) => {
    console.log(`User signed in: ${id}`);

    // Remove any existing socket for the user
    if (clients[id]) {
      console.log(`User ${id} is already connected. Replacing socket.`);
      clients[id].disconnect();
    }

    // Map the user ID to the new socket
    clients[id] = socket;
  });

  // Send/receive messages
  socket.on("message", async (msg) => {
    const { senderId, targetId, message } = msg;

    try {
      // Save the message to MongoDB
      const newMessage = new Message({ senderId, targetId, message });
      await newMessage.save();
      console.log("Message saved to DB:", newMessage);

      // Emit the message to the target user if online
      if (clients[targetId]) {
        clients[targetId].emit("message", newMessage);
        console.log(`Message sent to target ID: ${targetId}`);
      } else {
        console.log(`Target ID ${targetId} is not connected.`);
      }
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  // User disconnect
  socket.on("disconnect", () => {
    console.log(`Socket ${socket.id} disconnected.`);
    for (const [id, sock] of Object.entries(clients)) {
      if (sock === socket) {
        console.log(`Removing client ID: ${id}`);
        delete clients[id];
        break;
      }
    }
  });
});

// API to fetch chat history between two users
app.get("/messages/:senderId/:targetId", async (req, res) => {
  const { senderId, targetId } = req.params;

  console.log("Fetching messages for:", senderId, targetId);

  try {
    // Fetch messages from the database
    const messages = await Message.find({
      $or: [
        { senderId, targetId },
        { senderId: targetId, targetId: senderId },
      ],
    }).sort({ timestamp: 1 }); // Sort by timestamp

    console.log("Messages fetched:", messages);
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Health check API
app.route("/check").get((req, res) => {
  return res.json("The API is working fine");
});

// Start the server
server.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
