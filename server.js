const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

const { VALID_MOVES } = require("./public/constants.js");

function createGameState() {
  return {
    board: new Array(100).fill(0),
    nextNumber: 1,
    currentPlayer: 1,
    lastRow: -1,
    lastCol: -1,
    gameOver: false,
  };
}

function getValidMoves(state) {
  if (state.lastRow === -1) {
    let moves = [];
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 10; c++)
        if (state.board[r * 10 + c] === 0)
          moves.push({ row: r, col: c });
    return moves;
  }

  let moves = [];
  for (let [dr, dc] of VALID_MOVES) {
    let r = state.lastRow + dr;
    let c = state.lastCol + dc;
    if (r >= 0 && r < 10 && c >= 0 && c < 10 && state.board[r * 10 + c] === 0)
      moves.push({ row: r, col: c });
  }
  return moves;
}

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // ── Create a new game room ──
  socket.on("createRoom", ({ name }) => {
    const roomId = crypto.randomBytes(2).toString("hex");
    rooms[roomId] = {
      ...createGameState(),
      players: [socket.id],
      names: { 1: name || "Player 1" },
      scores: { 1: 0, 2: 0 },
      rematchVotes: new Set(),
    };

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerNumber = 1;

    socket.emit("roomCreated", { roomId, playerNumber: 1 });
    console.log(`Room ${roomId} created by ${name || "Player 1"}`);
  });

  // ── Join an existing room ──
  socket.on("joinRoom", ({ roomId, name }) => {
    const room = rooms[roomId];

    if (!room) {
      socket.emit("error", "Room not found.");
      return;
    }
    if (room.players.length >= 2) {
      socket.emit("error", "Room is full.");
      return;
    }

    room.players.push(socket.id);
    room.names[2] = name || "Player 2";
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerNumber = 2;

    socket.emit("roomJoined", { roomId, playerNumber: 2 });
    io.to(roomId).emit("gameStart", { state: room });
    console.log(`Room ${roomId} — ${name || "Player 2"} joined`);
  });

  // ── A player makes a move ──
  socket.on("makeMove", ({ row, col }) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];

    if (!room || room.gameOver) return;

    const playerNumber = socket.data.playerNumber;
    if (room.currentPlayer !== playerNumber) return;

    const valid = getValidMoves(room);
    const isValid = valid.some(m => m.row === row && m.col === col);
    if (!isValid) return;

    room.board[row * 10 + col] = room.nextNumber;
    room.lastRow = row;
    room.lastCol = col;
    room.nextNumber++;

    room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;

    if (getValidMoves(room).length === 0) {
      room.gameOver = true;
      const winner = room.currentPlayer === 1 ? 2 : 1;
      room.scores[winner]++;
      io.to(roomId).emit("gameUpdate", { state: room, winner });
    } else {
      io.to(roomId).emit("gameUpdate", { state: room, winner: null });
    }
  });

  // ── A player wants a rematch ──
  socket.on("requestRestart", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) {
      socket.emit("error", "Room no longer exists. Please start a new game.");
      return;
    }

    // Preserve names and scores, reset everything else
    const { players, names, scores } = room;
    rooms[roomId] = {
      ...createGameState(),
      players,
      names,
      scores,
    };
    io.to(roomId).emit("gameStart", { state: rooms[roomId] });
  });

  // ── A player goes back to the lobby ──
  socket.on("leaveRoom", () => {
    const roomId = socket.data.roomId;
    if (roomId && rooms[roomId]) {
      socket.to(roomId).emit("playerLeft");
      delete rooms[roomId];
      socket.leave(roomId);
    }
    socket.data.roomId = null;
    socket.data.playerNumber = null;
  });

  // ── Player disconnects ──
  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (roomId && rooms[roomId]) {
      io.to(roomId).emit("playerLeft");
      delete rooms[roomId];
    }
    console.log("Player disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Piège Cent server running at http://localhost:${PORT}`);
});
