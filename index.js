const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");

const app = express();
const port = process.env.PORT || 5000;
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// MongoDB connection
const mongoURI = "mongodb+srv://an7539661:<db_password>@chatappcluster.cllp6.mongodb.net/?retryWrites=true&w=majority&appName=chatAppCluster";
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.connection.once("open", () => {
  console.log("Connected to MongoDB.");
});

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
    clients[id] = socket; // Map the user ID to the socket
  });

  // Send/receive messages
  socket.on("message", async (msg) => {
    const { senderId, targetId, message } = msg;

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
  });

  // User disconnect
  socket.on("disconnect", () => {
    console.log(`Socket ${socket.id} disconnected.`);
    for (const [id, sock] of Object.entries(clients)) {
      if (sock === socket) {
        delete clients[id];
        console.log(`User ${id} removed from active clients.`);
        break;
      }
    }
  });
});

// API to fetch chat history between two users
app.get("/messages/:senderId/:targetId", async (req, res) => {
  const { senderId, targetId } = req.params;

  try {
    // Fetch messages from the database
    const messages = await Message.find({
      $or: [
        { senderId, targetId },
        { senderId: targetId, targetId: senderId },
      ],
    }).sort({ timestamp: 1 }); // Sort by timestamp

    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});
// forchecking
app.route("/check").get((req,res)=>{
  return res.json("The API is working fine");
});
// Start the server
server.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
