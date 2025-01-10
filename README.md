## Turn-Server

This is a bare-bones server for running turn-based games.

## High-Level Overview

### TurnServer
The TurnServer is a stateless, protocol-agnostic entrypoint to all other game logic. It accepts events in a prespecified format, and deals with the following responsibilities:
1. Processing events related to creating, joining, or leaving a lobby. 
2. Processing events related to client connections, disconnections and re-connections (in a protocol-agnostic way).
3. Processing events related to ping (in a protocol-agnostic way).
4. Processing events related to starting a match.
5. Processing in-game action events. These will be fanned out to the appropriate game-logic server based on the type of room the caller is in.

#### In-Game Action Events
In-game action events will typically cause an update to the game-state. Some actions might warrant a response message sent to the caller, or a state-update message broadcast to the entire room. The individual game-logic modules will handle in-game action events and return an updated game-state, as well as a list of messages to be sent out to player(s). The TurnServer will then handle saving the new game state as well as communicating those messages back to clients.

### GameModule
Each game will be processed by a module handling the logic specifically related to the game. Logic should be broken up into handlers for each type of in-game action that players might send. Each handler will then return a new game-state based on the incoming event, as well as a list of messages to be sent out to player(s).
