# CLAUDE.md - Turn-Based Coup Game Server Documentation

## Project Overview

This is a **WebSocket-based turn-based game server** for the card game **Coup**, built with TypeScript, Node.js, and the `ws` library. The server follows a modular, protocol-agnostic architecture that separates game logic from networking concerns.

**Tech Stack:**
- TypeScript (ES6 modules with `.ts` extensions)
- Node.js with `ws` (WebSocket library)
- `typia` for runtime type validation and JSON parsing
- Jest for testing
- Docker support

## Architecture Overview

### High-Level Architecture

```
Client (WebSocket) 
    ↓
TurnBasedWebSocketServer (Protocol Layer)
    ↓
TurnBasedServer (Game Management Layer)
    ↓
CoupServer (Game Logic Layer)
```

The architecture follows a **layered design pattern** with clear separation of concerns:

1. **Protocol Layer** (`TurnBasedWebSocketServer`): Handles WebSocket connections, identifies clients, sends/receives raw messages
2. **Game Management Layer** (`TurnBasedServer`): Manages rooms, players, clients, game lifecycle (create, join, leave, start)
3. **Game Logic Layer** (`CoupServer`): Implements Coup-specific rules and game state management

### Core Components

#### 1. TurnBasedServer (`src/turn-based-server/server.ts`)
The **stateless, protocol-agnostic entrypoint** that handles:
- Room creation and management (CREATE, JOIN, LEAVE)
- Game lifecycle (START)
- Client connection management (PING, STATUS)
- Routing in-game actions to the appropriate game logic server
- Coordinating responses and state updates

**Key Methods:**
- `handleMessage(clientId, data)`: Entry point for all client messages
- `handleCreate/Join/Leave/Start`: Lifecycle handlers
- Delegates game actions to `gameLogicServer.handleMessage()`

#### 2. TurnBasedWebSocketServer (`src/websocket-server.ts`)
Implements the **WebSocket protocol layer**:
- Manages WebSocket connections on HTTP server
- Assigns unique IDs to WebSocket connections
- Translates between WebSocket messages and TurnBasedServer calls
- Sends responses back to clients via WebSocket

#### 3. CoupServer (`src/game-logic/coup/coup-server.ts`)
Implements **Coup game rules** as a `GameLogicServer`:
- Handles all primary actions (INCOME, FOREIGN_AID, COUP, TAX, ASSASSINATE, STEAL, SWAP)
- Handles all secondary actions (BLOCK, CHALLENGE, REVEAL, ACCEPT)
- Manages game state transitions
- Validates game rules and constraints
- Generates player-specific game state views (hiding opponents' cards)

**Important:** The `CoupServer` is 774 lines and contains complex state machine logic for different game phases.

#### 4. Storage/Persistence Abstractions

**ClientStore** (`src/client-store/`): Manages WebSocket client connections
- Implementation: `DictClientStore` (in-memory dictionary)
- Interface: `add`, `delete`, `has`, `send`

**RoomStore** (`src/room-store/`): Manages game rooms and player-room associations
- Implementation: `DictRoomStore` (in-memory dictionary)
- Interface: `get`, `put`, `delete`, `getClientRoom`, `addClientToPlayer`, etc.

**DBProxy** (`src/db-proxy/`): Records game actions and state for replay/analytics
- Implementation: `LocalDB` (writes JSON files to disk in `static/local-db-items/`)
- Implementation: `NoopDB` (does nothing)
- Interface: `recordAction`, `recordState`

## Coup Game Implementation

### Game State Representation

The game state is managed through the `CoupRoom` interface which extends the base `Room`:

```typescript
interface CoupRoom extends Room {
    deck: Deck;                              // Remaining cards in deck
    players: {[key: string]: CoupPlayer};    // All players indexed by name
    currentPlayerIndex: number;              // Index of current player
    currentPrimaryActor: CoupPlayer;         // Player taking primary action
    currentChallengingActor: CoupPlayer | null;
    currentBlockingActor: CoupPlayer | null;
    currentDiscardingActor: CoupPlayer | null;
    currentState: COUP_PLAY_STATE;           // Legacy state
    currentStateV2: COUP_PLAY_STATE_V2;      // New state machine
}
```

**Key State Machine:** `COUP_PLAY_STATE_V2` enum with states:
- `PRIMARY`: Waiting on primary actor's turn
- `SECONDARY`: Waiting on other players to react (block/challenge/accept)
- `SWAP`: Waiting on Ambassador swap decision
- `DISCARD`: Waiting on player to reveal/discard a card
- `REACTION_TO_CHALLENGE`: Waiting on challenged player to reveal card
- `REACTION_TO_BLOCK`: Waiting on reaction to a block
- `REACTION_TO_BLOCK_CHALLENGE`: Waiting on challenged blocker to reveal
- `FINISHED`: Game over

### Card Types

```typescript
enum CARD_TYPES {
    DUKE = "duke",           // Tax (3 coins), Blocks Foreign Aid
    ASSASIN = "assasin",     // Assassinate (pay 3 coins)
    CONTESSA = "contessa",   // Blocks Assassination
    CAPTAIN = "captain",     // Steal (2 coins), Blocks Stealing
    AMBASSADOR = "ambassador" // Exchange cards, Blocks Stealing
}
```

### Actions

**Primary Actions** (`COUP_PRIMARY_ACTION_TYPE`):
- `INCOME`: Take 1 coin (always succeeds)
- `FOREIGN_AID`: Take 2 coins (can be blocked by Duke)
- `COUP`: Pay 7 coins, force opponent to lose influence (cannot be blocked/challenged)
- `TAX` (Duke): Take 3 coins
- `ASSASINATE` (Assassin): Pay 3 coins, target loses influence (can be blocked by Contessa)
- `STEAL` (Captain): Take 2 coins from target (can be blocked by Captain/Ambassador)
- `SWAP` (Ambassador): Exchange cards with deck

**Secondary Actions** (`COUP_SECONDARY_ACTION_TYPE`):
- `CHALLENGE`: Challenge a character claim
- `BLOCK`: Block a primary action
- `ACCEPT`: Accept/allow the primary action
- `REVEAL`: Reveal a card (in response to challenge or as penalty)
- `SWAP_REVEAL`: Choose which cards to keep after Ambassador swap

### Critical Game Rules Implemented

1. **Mandatory Coup**: If player has 10+ coins, must Coup (enforced on primary action)
2. **Challenge Resolution**:
   - Challenged player must reveal matching card or lose
   - If card matches: challenger loses influence, challenged player gets new card
   - If card doesn't match: challenged player loses influence
3. **Block-Challenge Chain**: Blocks can themselves be challenged
4. **Losing Influence**: When a player loses all cards (hand.length = 0), they're out
5. **Turn Progression**: `incrementTurn()` advances to next player with cards remaining
6. **Win Condition**: Game ends when only one player has cards remaining

### Message Flow Example

**Client wants to take Tax action:**
1. Client sends: `{ type: "tax" }`
2. `TurnBasedWebSocketServer` receives, calls `TurnBasedServer.handleMessage()`
3. `TurnBasedServer` delegates to `CoupServer.handleMessage()`
4. `CoupServer.handleTax()` validates, updates room state to `SECONDARY`
5. Returns `GameActionHandlerResponse` with `newState` and `messages` array
6. `TurnBasedServer` saves state and sends messages to all players
7. `TurnBasedWebSocketServer` sends via WebSocket to each client

### Player-Specific State Views

The `getStateRepresentationForPlayer()` method ensures players only see their own hand:
```typescript
// Each player gets a state object where only their cards are visible
// Other players' hands are hidden (deleted from the response)
```

## Message Protocol

### Request Message Types (`RequestType`)
```typescript
enum RequestType {
    PING = 'ping',
    CREATE = 'create',    // Create a new room
    JOIN = 'join',        // Join existing room by key
    LEAVE = 'leave',      // Leave current room
    START = 'start',      // Start the game
    STATUS = 'status',    // Get current state
}
```

### Response Message Types (`ResponseType`)
```typescript
enum ResponseType {
    PONG = 'pong',
    INVALID_MESSAGE = 'message_invalid',
    JOIN_FAILURE = 'failed_to_join_room',
    NOT_IN_ROOM = 'not_in_room',
    START_FAILURE = 'failed_to_start_game',
    GAME_STATE = 'game_state',  // Contains current game state
    ROOM_STATE = 'room_state',  // Contains room info (players, started, key)
}
```

### Example Messages

**Create Room:**
```json
{
    "type": "create",
    "data": {
        "name": "PlayerName"
    }
}
```

**Join Room:**
```json
{
    "type": "join",
    "data": {
        "name": "PlayerName",
        "key": "ABCD1"
    }
}
```

**Primary Action (Coup):**
```json
{
    "type": "coup",
    "details": {
        "target": "OpponentName"
    }
}
```

**Secondary Action (Challenge):**
```json
{
    "type": "challenge"
}
```

## Key Design Patterns

### 1. Handler Pattern
Both `TurnBasedServer` and `CoupServer` use a listener/handler pattern:
```typescript
this.listeners = {
    [RequestType.CREATE]: this.handleCreate.bind(this),
    [RequestType.JOIN]: this.handleJoin.bind(this),
    // ...
}
```

### 2. Interface Segregation
The codebase uses TypeScript interfaces to define contracts:
- `GameLogicServer`: Contract for any game implementation
- `ClientStore`, `RoomStore`, `DBProxy`: Storage abstractions
- `TurnBasedProtocolServer`: Contract for protocol implementations

### 3. Type Safety with Typia
Runtime type validation using `typia`:
```typescript
typia.assert<CreateMessage>(message);  // Throws if invalid
typia.json.assertParse<RequestMessage>(data);  // Parse and validate
```

### 4. Message Broadcasting
Pattern for sending messages to multiple players:
```typescript
// Returns array of PlayerBoundMessage
getBroadcastMessages(room): PlayerBoundMessage[]

// Later transformed to ClientBoundMessage for protocol layer
transformPlayerMessagesToClient(messages)
```

## Code Conventions

### File Extensions
**Important:** All TypeScript imports use `.ts` extensions:
```typescript
import TurnBasedServer from "./turn-based-server/server.ts";
```

### Naming Conventions
- **Enums:** SCREAMING_SNAKE_CASE (`COUP_PRIMARY_ACTION_TYPE`, `CARD_TYPES`)
- **Interfaces:** PascalCase (`CoupRoom`, `PlayerBoundMessage`)
- **Functions:** camelCase (`handleMessage`, `incrementTurn`)
- **Private methods:** camelCase with no prefix (`handleCreate`)

### Module Organization
```
src/
  index.ts                    # Entry point
  utils.ts                    # Shared utilities
  websocket-server.ts         # WebSocket protocol layer
  turn-based-server/          # Core game management
    server.ts
    types.ts
    utils.ts
  game-logic/                 # Game-specific logic
    types.ts
    coup/
      coup-server.ts
      types.ts
  client-store/               # Client connection management
  room-store/                 # Room/player management
  db-proxy/                   # Persistence
```

## Testing

Test files in `tests/` directory using Jest:
- `server.test.js`: TurnBasedServer tests
- `websocket-server.test.js`: WebSocket protocol tests
- `src-utils.test.js`: Utility function tests
- `game-logic/`: Game logic tests

Run tests: `npm test`

## Deployment

### Running Locally
```bash
npm run dev-start  # Development with nodemon
npm start          # Production
```

### Docker
```bash
docker build -t turn-server .
docker run -p 8080:8080 turn-server
```

Port configured via `PORT` environment variable (default: 8080)

## Common Patterns for Implementation

### Adding a New Primary Action

1. **Add enum value** in `src/game-logic/coup/types.ts`:
```typescript
export enum COUP_PRIMARY_ACTION_TYPE {
    // ...
    NEW_ACTION = "new_action",
}
```

2. **Define action interface** in same file:
```typescript
export interface NewAction extends CoupMoveAction {
    type: COUP_PRIMARY_ACTION_TYPE.NEW_ACTION,
    details?: { /* action-specific data */ }
}
```

3. **Add handler to CoupServer** in `coup-server.ts` constructor:
```typescript
this.listeners = {
    // ...
    [COUP_PRIMARY_ACTION_TYPE.NEW_ACTION]: this.handleNewAction.bind(this),
}
```

4. **Implement handler method**:
```typescript
handleNewAction = (message: RequestMessage, room: Room, playerName: string): GameActionHandlerResponse => {
    const [coupRoom, player] = this.getCallerData(room, playerName);
    
    // Validate it's this player's turn
    handlePrimaryAction(message, player, coupRoom);
    
    // Cast message
    const newAction = message as NewAction;
    
    // Update game state
    player.currentPrimaryAction = newAction;
    coupRoom.currentStateV2 = COUP_PLAY_STATE_V2.SECONDARY; // or other state
    
    // Return updated state and messages
    return {
        newState: coupRoom,
        messages: getBroadcastMessages(coupRoom),
    }
}
```

5. **Add to challengable/blockable arrays if needed**:
```typescript
export const challengableActions: COUP_ACTION_TYPE[] = [
    // ...
    COUP_PRIMARY_ACTION_TYPE.NEW_ACTION,
];
```

### Adding New State to Game

1. **Add to `COUP_PLAY_STATE_V2` enum**
2. **Update state transition logic in action handlers**
3. **Handle new state in `onPlayerLeft()` for player disconnection**
4. **Update `incrementTurn()` if needed for cleanup**

### Broadcasting Custom Messages

```typescript
// Create player-bound messages
const messages: PlayerBoundMessage[] = Object.values(room.players).map(player => ({
    player: player,
    message: {
        type: ResponseType.GAME_STATE,
        data: { /* custom data */ }
    }
}));

return {
    newState: room,
    messages: messages,
}
```

## Important Implementation Notes

### 1. Card Replacement Bug
There are TODOs in `coup-server.ts` indicating `replaceCard()` and `removeCard()` functions don't work correctly. They need fixing for proper card deck management during challenges.

### 2. Player Disconnection Handling
The `onPlayerLeft()` method in `CoupServer` handles player disconnections gracefully by advancing game state appropriately. This is critical for maintaining game integrity.

### 3. Accept Action Pattern
Players can explicitly "accept" an action without blocking/challenging. The server tracks acceptance state and proceeds when all eligible players accept.

### 4. State Synchronization
After every action, `getBroadcastMessages()` sends updated state to all players. Each player receives their own view (with hidden opponent cards).

### 5. Type Safety
Heavy use of `typia.assert<T>()` for runtime validation. Type guards protect against malformed messages.

## Environment Configuration

- `PORT`: WebSocket server port (default: 8080)
- Uses `LocalDB` by default which writes to `static/local-db-items/`
- Can swap to `NoopDB` for testing

## Extending to Other Games

To add a new game:

1. Create `src/game-logic/your-game/` directory
2. Implement `GameLogicServer` interface:
   - `handleMessage()`: Route game actions
   - `getStateRepresentation()`: Full state view
   - `getStateRepresentationForPlayer()`: Player-specific view
   - `onPlayerLeft()`: Handle disconnections
   - `initGame()`: Initialize game state
3. Define game-specific types extending `Room` and `Player`
4. Register in `src/index.ts`

## Critical Files Reference

- **Entry Point:** `src/index.ts`
- **Core Server:** `src/turn-based-server/server.ts`
- **Coup Logic:** `src/game-logic/coup/coup-server.ts` (774 lines)
- **Coup Types:** `src/game-logic/coup/types.ts` (335 lines)
- **Message Types:** `src/turn-based-server/types.ts`
- **WebSocket Protocol:** `src/websocket-server.ts`

## Debugging Tips

1. **Check state machine:** Verify `currentStateV2` matches expected game phase
2. **Validate actors:** Ensure `currentPrimaryActor`, `currentChallengingActor`, etc. are set correctly
3. **Message flow:** Add console.logs in `handleMessage` to trace action routing
4. **Player hands:** Check `player.hand` array for card tracking issues
5. **Turn progression:** Debug `incrementTurn()` if turns aren't advancing properly

## Known Issues / TODOs

1. **Card replacement bug:** `replaceCard()` and `removeCard()` functions don't work correctly
2. **Legacy state:** `currentState` (COUP_PLAY_STATE) is still present but `currentStateV2` is the source of truth
3. **Commented code:** Some old response types commented out in `types.ts`

## Complete Coup Rules Reference

### Game Components

- **15 Character Cards:** 3 each of Duke, Assassin, Captain, Ambassador, Contessa
- **50 Coins** (Treasury)
- **6 Summary Cards** (player reference)

### Setup

1. Shuffle all character cards and deal **2 face-down cards** to each player
2. Players can look at their cards but must keep them **face down** in front of them
3. Place remaining cards in middle as the **Court deck**
4. Give each player **2 coins** (money must be kept visible)
5. Place remaining coins as the **Treasury**
6. The person who won the last game starts

### Goal

**Eliminate the influence of all other players and be the last survivor.**

### Influence

- Face-down cards represent a player's **influence** at court
- Characters on face-down cards determine which abilities the player can use
- When a player **loses an influence**, they turn over and reveal one of their cards
- Revealed cards remain **face up** and visible to everyone
- Revealed cards **no longer provide influence**
- Each player **always chooses** which card to reveal when losing influence
- When a player loses **all their influence** (both cards revealed), they are **exiled** and out of the game

### Game Play

- Game proceeds in **turns in clockwise order**
- Each turn a player chooses **one action only**
- A player **may not pass**
- After action is chosen, other players can **challenge or counteract**
- If not challenged/counteracted, action **automatically succeeds**
- **Challenges are resolved first** before any action/counteraction
- When a player loses all influence, they **immediately leave** the game (leave cards face up, return coins to Treasury)
- Game ends when **only one player remains**

### Actions

#### General Actions (Always Available)

**Income**
- Take **1 coin** from Treasury
- Cannot be blocked or challenged
- Always available

**Foreign Aid**
- Take **2 coins** from Treasury
- Can be **blocked by Duke**
- Cannot be challenged (no character claim required)

**Coup**
- Pay **7 coins** to Treasury
- Launch Coup against another player
- Target player **immediately loses an influence**
- **Cannot be blocked or challenged**
- Coup is **always successful**
- If you start your turn with **10 or more coins**, you **MUST launch a Coup** (mandatory)

#### Character Actions (Require Character Influence Claim)

Players can **claim** to influence any character. They may be **telling the truth or bluffing**. They don't need to reveal cards unless challenged.

**Duke – Tax**
- Take **3 coins** from Treasury
- Can be challenged

**Assassin – Assassinate**
- Pay **3 coins** to Treasury
- Launch assassination against another player
- If successful, target **immediately loses an influence**
- Can be **blocked by Contessa**
- Can be **challenged**

**Captain – Steal**
- Take **2 coins** from another player
- If target has only 1 coin, take only 1
- Can be **blocked by Ambassador or Captain**
- Can be **challenged**

**Ambassador – Exchange**
- Exchange cards with the Court
- Take **2 random cards** from Court deck
- Choose which (if any) to exchange with your face-down cards
- Return **two cards** to Court deck
- Can be **challenged**

### Counteractions (Blocking)

Players can **claim to influence characters** to block actions. May be bluffing. Don't need to show cards unless challenged.

**Duke – Blocks Foreign Aid**
- Any player claiming Duke may block Foreign Aid
- Player attempting Foreign Aid receives **no coins**
- Can be challenged

**Contessa – Blocks Assassination**
- Player being assassinated may claim Contessa to block
- Assassination **fails** but the **3 coin fee remains spent**
- Can be challenged

**Ambassador/Captain – Blocks Stealing**
- Player being stolen from may claim Ambassador or Captain
- Steal attempt **fails** (no coins transferred)
- Can be challenged

### Challenges

**Who Can Challenge:**
- **Any player** can challenge, regardless of involvement in the action
- Only **character influence claims** can be challenged (not Income, Foreign Aid, or Coup)

**Challengeable Actions:**
- Tax (Duke)
- Assassinate (Assassin)
- Steal (Captain)
- Exchange (Ambassador)
- Block Foreign Aid (Duke)
- Block Assassination (Contessa)
- Block Stealing (Ambassador/Captain)

**Challenge Timing:**
- After action/counteraction is declared, players must be given **opportunity to challenge**
- Once play continues, challenges **cannot be retroactively issued**

**Challenge Resolution:**

1. Challenged player must **prove** they have the required character by showing the relevant face-down card
2. **If they can prove it:**
   - Challenger **loses the challenge**
   - Challenger **loses an influence** (reveals a card)
   - Challenged player **returns card to Court deck**
   - Court deck is **reshuffled**
   - Challenged player takes **random replacement card**
   - Action/counteraction **proceeds as declared**
3. **If they cannot prove it:**
   - Challenged player **loses the challenge**
   - Challenged player **loses an influence** (reveals a card)
   - Action/counteraction **fails completely**
   - Any coins paid for the action are **returned**

### Important Special Rules

**Double Danger of Assassination:**
- You can lose **2 influences in one turn** defending against assassination
- Example 1: Challenge an Assassin and lose → lose 1 influence for lost challenge + 1 for successful assassination
- Example 2: Bluff Contessa block, get challenged and lose → lose 1 influence for lost challenge + 1 for successful assassination

**Mandatory Coup at 10 Coins:**
- Starting turn with **10+ coins** requires launching a Coup as your **only action**

**No Binding Agreements:**
- Any negotiations are allowed but **none are binding**
- Players **cannot reveal cards** to other players
- No coins can be **given or lent** between players
- There is **no second place**

**Challenge Priority:**
- Challenges are resolved **before** the action executes
- If action is successfully challenged, the **entire action fails**
- Coins paid as cost of action are **returned** if challenge succeeds

**Block-Challenge Chain:**
- A block can itself be challenged
- If blocker wins challenge: block succeeds, primary action fails
- If blocker loses challenge: block fails, primary action proceeds

**Card Knowledge:**
- Players can **always look at their own cards**
- Players **must keep cards face down** (hidden from others)
- Only revealed (eliminated) cards are public knowledge

### Example Play Scenario

**3 players, each start with 2 cards and 2 coins:**

**Turn 1 - Natasha:**
- Claims Duke, takes Tax (3 coins)
- No one challenges
- Now has 5 coins

**Turn 1 - Sacha:**
- Claims Ambassador (bluffing)
- No challenge
- Takes 2 cards from Court (Assassin and Duke)
- Keeps Assassin and original Captain
- Returns Duke and Contessa to Court
- Still has 2 coins

**Turn 1 - Haig:**
- Claims Duke, takes Tax (3 coins)
- Sacha **challenges** him
- Haig **shows Duke** (wins challenge)
- Sacha **loses influence** (reveals Assassin)
- Haig returns Duke to Court, shuffles, draws new card (Contessa)
- Haig keeps the 3 coins

**After Round 1:**
- Natasha: 2 cards (Contessa, Duke), 5 coins
- Sacha: 1 card (Captain), 2 coins
- Haig: 2 cards (Assassin, Contessa), 5 coins

**Turn 2 - Natasha:**
- Claims Duke, Tax (3 coins), no challenge
- Now has 8 coins

**Turn 2 - Sacha:**
- Takes Income (1 coin)
- Now has 3 coins

**Turn 2 - Haig:**
- Claims Assassin, pays 3 coins, targets Natasha
- No challenge on Assassin
- Natasha **claims Contessa** to block
- No challenge on Contessa
- Assassination **fails**, 3 coins **remain spent**
- Haig now has 2 coins

**Turn 3 - Natasha:**
- Spends 7 coins to **Coup** Haig
- Cannot be blocked
- Haig loses influence (reveals Contessa)
- Natasha has 1 coin

**Turn 3 - Sacha:**
- Claims Captain to steal 2 coins from Haig
- No challenge on Captain
- Haig claims **Ambassador** to block
- Sacha **challenges** the Ambassador
- Haig **cannot show Ambassador** (loses challenge)
- Haig **loses last influence** (reveals Assassin)
- **Haig is eliminated**
- Steal succeeds, Sacha takes 2 coins
- Sacha now has 5 coins

**Current State:**
- Natasha: 2 cards, 1 coin
- Sacha: 1 card, 5 coins
- Haig: **OUT** (2 Assassins and 1 Contessa revealed)

Game continues until only one player remains!

### Win Condition

The last player with at least one face-down card remaining wins the game.

---

**This documentation should give you complete context for implementing any feature requests, bug fixes, or extensions to the Coup game server.**
