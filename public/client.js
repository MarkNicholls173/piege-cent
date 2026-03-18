// ─────────────────────────────────────────────
//  HOW TO PLAY
//  Defined once, used in both the lobby
//  collapsible and the in-game overlay.
// ─────────────────────────────────────────────
const RULES_HTML = `
  <h3>How to Play</h3>
  <ol>
    <li>Players take turns placing the next number on the grid.</li>
    <li>The first player can place <strong>1</strong> anywhere.</li>
    <li>Each number must be placed a <strong>zebra move</strong> from the previous one — 3 squares in one direction and 2 in the other (like an L-shape).</li>
    <li>If it's your turn and every valid square is already filled, you're <strong>trapped</strong> — you lose!</li>
    <li>Blue squares show where you can move. The green square is the last number placed.</li>
  </ol>
`;

// Inject the rules into both containers on page load
document.getElementById("how-to-play-content").innerHTML = RULES_HTML;
document.getElementById("rules-box-content").innerHTML = RULES_HTML;

function toggleHowToPlay() {
  const el = document.getElementById("how-to-play-content");
  el.style.display = el.style.display === "block" ? "none" : "block";
}

function openRules() {
  document.getElementById("rules-overlay").classList.add("open");
}

function closeRules() {
  document.getElementById("rules-overlay").classList.remove("open");
}

// Close the overlay if the user clicks the dark background (not the box itself)
function closeRulesIfOutside(event) {
  if (event.target === document.getElementById("rules-overlay")) closeRules();
}

const socket = io();

let myPlayerNumber = null;
let currentState = null;
let currentRoomId = null;

// On page load: check if the URL contains a room code (from a shared link)
// and pre-fill the join input.
const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get("room");
if (roomFromUrl) {
  document.getElementById("join-input").value = roomFromUrl.toUpperCase();
  setStatus("You've been invited — enter your name and click Join Game");
}

// ─────────────────────────────────────────────
//  LOBBY ACTIONS
// ─────────────────────────────────────────────
function getName() {
  return document.getElementById("name-input").value.trim() || "Anonymous";
}

function createRoom() {
  socket.emit("createRoom", { name: getName() });
}

function joinRoom() {
  const code = document.getElementById("join-input").value.trim().toLowerCase();
  if (code.length !== 4) {
    setStatus("Please enter a 4-character room code.");
    return;
  }
  socket.emit("joinRoom", { roomId: code, name: getName() });
}

function copyLink() {
  const url = `${window.location.origin}/?room=${currentRoomId}`;
  navigator.clipboard.writeText(url).then(() => {
    setStatus("Link copied! Send it to your friend.");
  });
}

function requestRestart() {
  socket.emit("requestRestart");
}

function leaveRoom() {
  socket.emit("leaveRoom");
  showLobby();
}

// ─────────────────────────────────────────────
//  SOCKET EVENT LISTENERS
// ─────────────────────────────────────────────

socket.on("roomCreated", ({ roomId, playerNumber }) => {
  myPlayerNumber = playerNumber;
  currentRoomId = roomId;
  document.getElementById("room-code").textContent = roomId.toUpperCase();
  document.getElementById("room-display").style.display = "block";
  setStatus("You are Player 1 — waiting for your opponent…");
});

socket.on("roomJoined", ({ playerNumber }) => {
  myPlayerNumber = playerNumber;
});

socket.on("gameStart", ({ state }) => {
  currentState = state;
  document.getElementById("btn-new-game").style.display = "none";
  updateScoreboard();
  showGame();
  renderGrid();
  updateTurnStatus();
});

socket.on("gameUpdate", ({ state, winner }) => {
  currentState = state;
  updateScoreboard();
  renderGrid();

  if (winner !== null) {
    const winnerName = state.names[winner];
    const loserName  = state.names[winner === 1 ? 2 : 1];
    if (winner === myPlayerNumber) {
      setStatus(`${loserName} is trapped — you win! 🎉`);
    } else {
      setStatus(`You are trapped — ${winnerName} wins!`);
    }
    document.getElementById("btn-new-game").style.display = "inline-block";
  } else {
    updateTurnStatus();
  }
});

socket.on("playerLeft", () => {
  setStatus("Your opponent left the game.");
  document.getElementById("btn-new-game").style.display = "none";
});

socket.on("error", (message) => {
  setStatus(message);
});

// ─────────────────────────────────────────────
//  UI HELPERS
// ─────────────────────────────────────────────
function showGame() {
  document.getElementById("lobby").style.display = "none";
  document.getElementById("game").style.display = "flex";
}

function showLobby() {
  document.getElementById("game").style.display = "none";
  document.getElementById("lobby").style.display = "flex";
  document.getElementById("room-display").style.display = "none";
  myPlayerNumber = null;
  currentState = null;
  currentRoomId = null;
  setStatus("Welcome");
}

function setStatus(message) {
  document.getElementById("status").textContent = message;
}

function updateTurnStatus() {
  if (!currentState) return;
  const oppName = currentState.names[myPlayerNumber === 1 ? 2 : 1];
  if (currentState.currentPlayer === myPlayerNumber) {
    setStatus(`Your turn — place number ${currentState.nextNumber}`);
  } else {
    setStatus(`${oppName}'s turn…`);
  }
}

function updateScoreboard() {
  if (!currentState) return;
  const opponentNumber = myPlayerNumber === 1 ? 2 : 1;
  document.getElementById("my-name").textContent  = currentState.names[myPlayerNumber] || "You";
  document.getElementById("opp-name").textContent = currentState.names[opponentNumber] || "Opponent";
  document.getElementById("my-score").textContent  = currentState.scores[myPlayerNumber];
  document.getElementById("opp-score").textContent = currentState.scores[opponentNumber];
}

// ─────────────────────────────────────────────
//  GRID RENDERING
// ─────────────────────────────────────────────
function getValidMoves(state) {
  // VALID_MOVES is loaded from constants.js
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

function renderGrid() {
  const gridEl = document.getElementById("grid");
  gridEl.innerHTML = "";

  const isMyTurn = currentState.currentPlayer === myPlayerNumber && !currentState.gameOver;
  const validSet = new Set();
  if (isMyTurn) {
    for (let m of getValidMoves(currentState))
      validSet.add(m.row * 10 + m.col);
  }

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const index = r * 10 + c;
      const value = currentState.board[index];

      const cell = document.createElement("div");
      cell.className = "cell";

      if (value !== 0) {
        cell.textContent = value;
        if (r === currentState.lastRow && c === currentState.lastCol) {
          cell.classList.add("last");
        } else {
          cell.classList.add("filled");
        }
      } else if (validSet.has(index)) {
        cell.classList.add("valid");
        cell.addEventListener("click", () => {
          socket.emit("makeMove", { row: r, col: c });
        });
      }

      gridEl.appendChild(cell);
    }
  }
}
