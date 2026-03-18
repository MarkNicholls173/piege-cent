// Shared between server.js and client.js.
// If you change the move set, this is the only place to update.
const VALID_MOVES = [
  [-3, -2], [-3, +2],
  [-2, -3], [-2, +3],
  [+2, -3], [+2, +3],
  [+3, -2], [+3, +2],
];

// In Node.js this file is require()'d — export the constant.
// In the browser it is loaded via <script> — the const becomes a global.
if (typeof module !== "undefined") {
  module.exports = { VALID_MOVES };
}
