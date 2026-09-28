# Basket Random Online — V7

Built from the supplied Basket Random Construct HTML5 export. The original game assets/runtime are retained; multiplayer is added as a wrapper/server layer.

## Render
- Runtime: Node.js
- Build: npm install
- Start: npm start
- Root directory: repository root

The Render service runs `server.js`, serves the game over HTTPS, and accepts WebSocket connections at the same host over WSS.

## iPad
Open the HTTPS Render URL on both iPads.
- iPad 1: CREATE ROOM
- iPad 2: JOIN ROOM

V7 handles Create/Join with pointer/touch capture before Construct's global touch handlers and queues the action if the WebSocket is still connecting.
