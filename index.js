const app = require("express")();
const server = require("http").createServer(app);

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let socketList = {};

app.use(function (request, response, next) {
  response.header("Access-Control-Allow-Origin", "*");
  response.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("Running ok");
});

// Socket
io.on("connection", (socket) => {
  console.log(`New User connected: ${socket.id}`);
  var channelName = "";

  socket.on("disconnect", () => {
    console.log("disconnect channelName! ", channelName);
    socket.broadcast
      .to(channelName)
      .emit("receive-user-leave", { userId: socket.id, userName: [socket.id] });

    socket.disconnect();
    console.log("User disconnected!");
  });

  socket.on("check-user-exist", ({ roomId, userName }) => {
    let error = false;

    io.sockets.in(roomId).clients((err, clients) => {
      clients.forEach((client) => {
        if (socketList[client].userName == userName) {
          error = true;
        }
      });
      socket.emit("user-exist", { error });
    });
  });

  /**
   * Join Room
   */
  socket.on("join-room", ({ roomId, userName }) => {
    // Socket Join RoomName
    channelName = roomId;
    socket.join(roomId);
    socketList[socket.id] = { userName, video: true, audio: true };

    // Set User List
    io.sockets.in(roomId).clients((err, clients) => {
      try {
        const users = [];
        clients.forEach((client) => {
          // Add User List
          users.push({ userId: client, info: socketList[client] });
        });
        socket.broadcast.to(roomId).emit("list-user-join", users);
      } catch (e) {}
    });
  });

  socket.on("call-user", ({ userToCall, from, signal }) => {
    io.to(userToCall).emit("receive-call", {
      signal,
      from,
      info: socketList[socket.id],
    });
  });

  socket.on("accepted-call", ({ signal, to }) => {
    io.to(to).emit("receive-accepted", {
      signal,
      answerId: socket.id,
    });
  });

  socket.on("call-user-leave", ({ roomId, leaver }) => {
    delete socketList[socket.id];
    // socket.broadcast
    //   .to(roomId)
    //   .emit("receive-user-leave", { userId: socket.id, userName: [socket.id] });
    io.sockets.sockets[socket.id].leave(roomId);
  });

  socket.on("call-toggle-camera-audio", ({ roomId, switchTarget }) => {
    if (switchTarget === "video") {
      socketList[socket.id].video = !socketList[socket.id].video;
    } else {
      socketList[socket.id].audio = !socketList[socket.id].audio;
    }
    socket.broadcast
      .to(roomId)
      .emit("receive-toggle-camera-audio", { userId: socket.id, switchTarget });
  });
});

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
