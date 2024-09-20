import TurnBasedServer from "../turn-based-server/server.ts";
import {
    RequestMessage,
    ResponseType,
} from "../turn-based-server/types.ts";
import {
    Deck,
    CARD_TYPES,
    CoupRoom,
    CoupPlayer,
    GameStateResponse,
    COUP_RESPONSE_TYPE,
    CoupPlayerStateData,
    COUP_PRIMARY_ACTION_TYPE,
    CoupAction,
    CoupPrimaryMoveAction,
    COUP_PLAY_STATE,
    TargetedCoupMoveAction,
    AssasinateAction,
    ForeignAidAction,
    IncomeAction,
    StealAction,
    SwapAction,
    TaxAction,
    COUP_SECONDARY_ACTION_TYPE,
    BlockAction,
    ChallengeAction,
    RevealAction,
    challengableActions,
    SwapDecision,
    AcceptAction,
    COUP_PLAY_STATE_V2,
} from "./types.ts";
import { shuffle, removeFirst, getRandomInt, isSubset, removeSubset } from "../utils.ts";
import { ClientStore } from "../client-store/types.ts";
import { RoomStore } from "../room-store/types.ts";

export default class CoupServer extends TurnBasedServer {

    constructor(clientStore:ClientStore, roomStore:RoomStore) {
        super(clientStore, roomStore);
        this.listeners = {
            ...this.listeners,
            [COUP_PRIMARY_ACTION_TYPE.INCOME]: this.handleIncome,
            [COUP_PRIMARY_ACTION_TYPE.COUP]: this.handleCoup,
            [COUP_PRIMARY_ACTION_TYPE.ASSASINATE]: this.handleAssasinate,
            [COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID]: this.handleForeignAid,
            [COUP_PRIMARY_ACTION_TYPE.STEAL]: this.handleSteal,
            [COUP_PRIMARY_ACTION_TYPE.SWAP]: this.handleSwap,
            [COUP_PRIMARY_ACTION_TYPE.TAX]: this.handleTax,
            [COUP_SECONDARY_ACTION_TYPE.BLOCK]: this.handleBlock,
            [COUP_SECONDARY_ACTION_TYPE.CHALLENGE]: this.handleChallenge,
            [COUP_SECONDARY_ACTION_TYPE.REVEAL]: this.handleReveal,
            [COUP_SECONDARY_ACTION_TYPE.SWAP_REVEAL]: this.handleSwapReveal,
            [COUP_SECONDARY_ACTION_TYPE.ACCEPT]: this.handleAccept,
        };
    }

    protected handleStart(clientId: string): void {
        super.handleStart(clientId);

        const coupRoom:CoupRoom = this.roomStore.getClientRoom(clientId) as CoupRoom;

        // Get a shuffled deck
        coupRoom.deck = getShuffledDeck();

        // Give two random cards to each player
        Object.values(coupRoom.players).forEach(player => {
            initPlayer(player, coupRoom);
        });

        // Set the starting player
        coupRoom.currentPlayerIndex = 0;
        coupRoom.currentPrimaryActor = (Object.values(coupRoom.players)[0] as CoupPlayer);
        coupRoom.currentBlockingActor = null;
        coupRoom.currentChallengingActor = null;

        coupRoom.currentState = COUP_PLAY_STATE.WAITING_ON_PRIMARY;
        coupRoom.currentStateV2 = COUP_PLAY_STATE_V2.PRIMARY;

        this.roomStore.put(coupRoom);
        broadcastGameState(this.clientStore, coupRoom);
    }

    getCallerData = (clientId:string):[CoupRoom, CoupPlayer] => {
        const room:CoupRoom = this.roomStore.getClientRoom(clientId) as CoupRoom;
        const player:CoupPlayer = room.players[this.roomStore.getClientPlayerName(clientId)];
        return [room, player];
    }

    saveAndBroadcastRoom = (room:CoupRoom):void => {
        this.roomStore.put(room);
        broadcastGameState(this.clientStore, room);
    }

    handleIncome = (clientId:string, message:RequestMessage):void => {
        const [room, player] = this.getCallerData(clientId);

        handlePrimaryAction(message, player, room);
        const incomeAction = message as IncomeAction;

        player.currentPrimaryAction = incomeAction;
        this.carryOutPrimaryAction(player, room, incomeAction);

        this.saveAndBroadcastRoom(room);
    }

    handleCoup = (clientId:string, message:RequestMessage):void => {
        const [room, player] = this.getCallerData(clientId);

        handlePrimaryAction(message, player, room);
        handleTargetedAction(message, room);

        const coupAction = message as CoupAction;

        if (player.coins < 7) {
            throw new Error("Cannot coup with < 7 coins");
        }
        player.coins -= 7;
        const targetedPlayer = room.players[coupAction.details.target];
    
        player.currentPrimaryAction = coupAction;
        room.currentDiscardingActor = targetedPlayer;
        room.currentState = COUP_PLAY_STATE.WAITING_ON_SECONDARY;
        room.currentStateV2 = COUP_PLAY_STATE_V2.DISCARD;
    
        this.saveAndBroadcastRoom(room);
    }

    handleAssasinate = (clientId:string, message:RequestMessage):void => {
        const [room, player] = this.getCallerData(clientId);

        handlePrimaryAction(message, player, room);
        handleTargetedAction(message, room);

        const assasinateAction = message as AssasinateAction;
    
        if (player.coins < 3) {
            throw new Error("Cannot assasinate with < 3 coins");
        }
        player.coins -= 3;
    
        player.currentPrimaryAction = assasinateAction;
        room.currentState = COUP_PLAY_STATE.WAITING_ON_SECONDARY;
        room.currentStateV2 = COUP_PLAY_STATE_V2.SECONDARY;
    
        this.saveAndBroadcastRoom(room);
    }

    handleForeignAid = (clientId:string, message:RequestMessage):void => {
        const [room, player] = this.getCallerData(clientId);

        handlePrimaryAction(message, player, room);

        const foreignAidAction = message as ForeignAidAction;
    
        player.currentPrimaryAction = foreignAidAction;
        room.currentState = COUP_PLAY_STATE.WAITING_ON_SECONDARY;
        room.currentStateV2 = COUP_PLAY_STATE_V2.SECONDARY;
    
        this.saveAndBroadcastRoom(room);
    }

    handleSteal = (clientId:string, message:RequestMessage):void => {
        const [room, player] = this.getCallerData(clientId);

        handlePrimaryAction(message, player, room);
        handleTargetedAction(message, room);

        const stealAction = message as StealAction;
        const targetPlayer = room.players[stealAction.details.target];
    
        if (targetPlayer.coins <= 0) throw new Error("Cannot steal when target has <= 0 coins");
    
        player.currentPrimaryAction = stealAction;
        room.currentState = COUP_PLAY_STATE.WAITING_ON_SECONDARY;
        room.currentStateV2 = COUP_PLAY_STATE_V2.SECONDARY;
    
        this.roomStore.put(room);
        broadcastGameState(this.clientStore, room);
    }

    handleSwap = (clientId:string, message:RequestMessage):void => {
        const [room, player] = this.getCallerData(clientId);

        handlePrimaryAction(message, player, room);

        const swapAction = message as SwapAction;
    
        player.currentPrimaryAction = swapAction;
        room.currentState = COUP_PLAY_STATE.WAITING_ON_SECONDARY;
        room.currentStateV2 = COUP_PLAY_STATE_V2.SECONDARY;
    
        this.saveAndBroadcastRoom(room);
    }

    handleTax = (clientId:string, message:RequestMessage):void => {
        const [room, player] = this.getCallerData(clientId);

        handlePrimaryAction(message, player, room);

        const taxAction = message as TaxAction;
    
        player.currentPrimaryAction = taxAction;
        room.currentState = COUP_PLAY_STATE.WAITING_ON_SECONDARY;
        room.currentStateV2 = COUP_PLAY_STATE_V2.SECONDARY;
    
        this.saveAndBroadcastRoom(room);
    }

    handleBlock = (clientId:string, message:RequestMessage):void => {
        const [room, player] = this.getCallerData(clientId);

        handleSecondaryAction(player, room);

        const blockAction = message as BlockAction;
        const primaryPlayer = room.currentPrimaryActor;
    
        if (room.currentBlockingActor) throw new Error("A block has already been submitted");
        if (room.currentChallengingActor) throw new Error("A challenge has already been submitted");
        if (room.currentDiscardingActor) throw new Error("Waiting on a discard");
    
        switch (primaryPlayer.currentPrimaryAction?.type) {
            case COUP_PRIMARY_ACTION_TYPE.ASSASINATE: {
                const assassinateAction = (primaryPlayer.currentPrimaryAction as AssasinateAction);
                const target = room.players[assassinateAction.details.target];
                if (player !== target) {
                    throw new Error("Cannot block assasination when you are not the target");
                }
                break;
            }
            case COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID:
            case COUP_PRIMARY_ACTION_TYPE.STEAL:
                break;
            default:
                throw new Error("Cannot block a non-blockable action");
        }
    
        player.currentSecondaryAction = blockAction;
        room.currentBlockingActor = player;
        room.currentState = COUP_PLAY_STATE.WAITING_ON_SECONDARY;
        room.currentStateV2 = COUP_PLAY_STATE_V2.REACTION_TO_BLOCK;
        for (const player of Object.values(room.players)) {
            if (player.currentSecondaryAction && player.currentSecondaryAction.type == COUP_SECONDARY_ACTION_TYPE.ACCEPT) {
                player.currentSecondaryAction = null;
            }
        }

        this.saveAndBroadcastRoom(room);
    }

    handleChallenge = (clientId:string, message:RequestMessage):void => {
        const [room, player] = this.getCallerData(clientId);

        handleSecondaryAction(player, room);

        const challengeAction = message as ChallengeAction;
    
        if (room.currentChallengingActor) throw new Error("A challenge has already been submitted");
        if (room.currentDiscardingActor) throw new Error("Waiting on a discard");
    
        const challengedAction = room.currentBlockingActor === null ? 
            room.currentPrimaryActor.currentPrimaryAction : room.currentBlockingActor?.currentSecondaryAction;
        if (!challengedAction || !challengableActions.includes(challengedAction.type)) {
            throw new Error("Unexpected challenge");
        }
    
        player.currentSecondaryAction = challengeAction;
        room.currentChallengingActor = player;
        room.currentState = COUP_PLAY_STATE.WAITING_ON_SECONDARY;
        if (room.currentBlockingActor) {
            room.currentStateV2 = COUP_PLAY_STATE_V2.REACTION_TO_BLOCK_CHALLENGE;
        } else {
            room.currentStateV2 = COUP_PLAY_STATE_V2.REACTION_TO_CHALLENGE;
        }
        for (const player of Object.values(room.players)) {
            if (player.currentSecondaryAction && player.currentSecondaryAction.type == COUP_SECONDARY_ACTION_TYPE.ACCEPT) {
                player.currentSecondaryAction = null;
            }
        }
    
        this.saveAndBroadcastRoom(room);
    }

    handleReveal = (clientId:string, message:RequestMessage):void => {
        const [room, player] = this.getCallerData(clientId);

        handleSecondaryAction(player, room);

        const revealAction = message as RevealAction;
        const primaryAction = room.currentPrimaryActor.currentPrimaryAction as CoupPrimaryMoveAction;
    
        if (room.currentDiscardingActor && room.currentDiscardingActor === player) {
            // Valid discard reveal
            removeCard(player, room, revealAction.details.card);
            if (player === room.currentPrimaryActor || 
                (room.currentBlockingActor && 
                room.currentChallengingActor && 
                room.currentDiscardingActor === room.currentChallengingActor) ||
                (room.currentPrimaryActor.currentPrimaryAction.type === COUP_PRIMARY_ACTION_TYPE.ASSASINATE &&
                room.currentStateV2 === COUP_PLAY_STATE_V2.DISCARD)) { // Primary player lost challenge or block-challenge failed or assasination target is discarding
                incrementTurn(room);    
            } else { // Primary player won challenge
                this.carryOutPrimaryAction(room.currentPrimaryActor, room, primaryAction);
            }
        } else if (room.currentBlockingActor === player &&
            room.currentChallengingActor && 
            room.currentChallengingActor !== player) {
            // Valid block-challenge reveal
            const blockingActor:CoupPlayer = room.currentBlockingActor as CoupPlayer;
            const blockAction:BlockAction = blockingActor.currentSecondaryAction as BlockAction;
            if (isRevealValid(room, primaryAction, revealAction, blockAction)) {
                // Reveal succeeds
                replaceCard(blockingActor, room, revealAction.details.card);
                room.currentDiscardingActor = room.currentChallengingActor;
                room.currentStateV2 = COUP_PLAY_STATE_V2.DISCARD;
            } else {
                // Reveal fails
                removeCard(blockingActor, room, revealAction.details.card);
                this.carryOutPrimaryAction(room.currentPrimaryActor, room, primaryAction);
            }
    
        } else if (room.currentPrimaryActor === player && 
            room.currentChallengingActor !== null && 
            room.currentBlockingActor === null) {
            // Valid primary-challenge reveal
            if (isRevealValid(room, primaryAction, revealAction)) {
                // Reveal succeeds
                replaceCard(player, room, revealAction.details.card);
                if (room.currentChallengingActor.hand.length > 0) {
                    room.currentDiscardingActor = room.currentChallengingActor;
                    if (room.currentPrimaryActor.currentPrimaryAction.type === COUP_PRIMARY_ACTION_TYPE.ASSASINATE) {
                        room.currentStateV2 = COUP_PLAY_STATE_V2.DISCARD_ASSASINATE_CHALLENGE;
                    } else {
                        room.currentStateV2 = COUP_PLAY_STATE_V2.DISCARD;
                    }
                }
            } else {
                // Reveal fails
                removeCard(player, room, revealAction.details.card);
                incrementTurn(room);
            }
        } else {
            throw new Error("Unexpected reveal");
        }
    
        this.saveAndBroadcastRoom(room);
    }

    handleSwapReveal = (clientId:string, message:RequestMessage):void => {
        const [room, player] = this.getCallerData(clientId);

        handleSecondaryAction(player, room);

        const swapDecision:SwapDecision = message as SwapDecision;

        if (room.currentPrimaryActor !== player ||
            room.currentPrimaryActor.currentPrimaryAction?.type !== COUP_PRIMARY_ACTION_TYPE.SWAP ||
            room.currentPrimaryActor.hand.length <= 2) {
            throw new Error("Unexpected swap decision");
        }
        if (!isSubset(swapDecision.details.cards, room.currentPrimaryActor.hand)) {
            throw new Error("Invalid swap decision cards");
        }
        const leftOver:CARD_TYPES[] = removeSubset(swapDecision.details.cards, room.currentPrimaryActor.hand) as CARD_TYPES[];
        room.currentPrimaryActor.hand = swapDecision.details.cards;
        room.deck = [...room.deck, ...leftOver];
        room.deck = shuffle(room.deck) as Deck;
        incrementTurn(room);

        this.saveAndBroadcastRoom(room);
    }

    handleAccept = (clientId:string, message:RequestMessage):void => {
        const [room, player] = this.getCallerData(clientId);

        handleSecondaryAction(player, room);

        const acceptAction:AcceptAction = message as AcceptAction;

        if (room.currentBlockingActor !== null && !room.currentChallengingActor && room.currentBlockingActor !== player) { // Accepting a block
            player.currentSecondaryAction = acceptAction;
            if (haveOthersAccepted(room, room.currentBlockingActor)) { // Block goes through
                incrementTurn(room);
            }
            this.saveAndBroadcastRoom(room);
        } else if (room.currentPrimaryActor !== player && !room.currentChallengingActor) {
            player.currentSecondaryAction = acceptAction;
            if (haveOthersAccepted(room, room.currentPrimaryActor)) { // Primary goes through
                console.log("All have accepted");
                const primaryAction = room.currentPrimaryActor.currentPrimaryAction as CoupPrimaryMoveAction;
                this.carryOutPrimaryAction(room.currentPrimaryActor, room, primaryAction);
            }
            this.saveAndBroadcastRoom(room);
        } else {
            throw new Error("Unexpected accept");
        }
    }

    carryOutPrimaryAction = (player:CoupPlayer, room:CoupRoom, action:CoupPrimaryMoveAction) => {
        switch (action.type) {
            case COUP_PRIMARY_ACTION_TYPE.INCOME:
                player.coins = player.coins + 1;
                incrementTurn(room);
                break;
            case COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID:
                player.coins = player.coins + 2;
                incrementTurn(room);
                break;
            case COUP_PRIMARY_ACTION_TYPE.COUP:
                incrementTurn(room);
                break;
            case COUP_PRIMARY_ACTION_TYPE.TAX:
                player.coins = player.coins + 3;
                incrementTurn(room);
                break;
            case COUP_PRIMARY_ACTION_TYPE.ASSASINATE: {
                const targetName = (action as AssasinateAction).details.target;
                const targetPlayer = room.players[targetName];
                if (targetPlayer.hand.length > 0) {
                    room.currentDiscardingActor = targetPlayer;
                    room.currentStateV2 = COUP_PLAY_STATE_V2.DISCARD;
                } else {
                    incrementTurn(room);
                }
                // removeRandomCard(room.players[(action as AssasinateAction).details.target], room);
                // incrementTurn(room);
                break;
            }
            case COUP_PRIMARY_ACTION_TYPE.STEAL:
                stealCoins(player, room.players[(action as StealAction).details.target]);
                incrementTurn(room);
                break; 
            case COUP_PRIMARY_ACTION_TYPE.SWAP:
                for (let i = 0; i < 2; i++) {
                    const card = room.deck.pop();
                    if (!card) throw new Error("Ran out of cards in the deck!");
                    player.hand.push(card);
                }
                room.currentStateV2 = COUP_PLAY_STATE_V2.SWAP;
                sendPlayerGameState(this.clientStore, player, room);
                this.roomStore.put(room);
                break;
        }
    }
}

// /**
//  * Handler for the "game_state" request type
//  * @param client 
//  */
// const handleGameState = (client:CoupClient) => {
//     typia.assert<CoupPlayer>(client.player);
//     const coupPlayer = client.player as CoupPlayer;

//     sendPlayerGameState(coupPlayer);
// }


const handleAction = (player:CoupPlayer) => {
    if (player.hand.length <= 0) throw new Error("Cannot play with 0 influences");
}

const handlePrimaryAction = (message:RequestMessage, player:CoupPlayer, room: CoupRoom) => {
    handleAction(player);

    const primaryActor = room.currentPrimaryActor;
    if (primaryActor !== player) throw new Error("Not your turn!");
    if (room.currentState != COUP_PLAY_STATE.WAITING_ON_PRIMARY) {
        throw new Error("Not waiting on primary action");
    }
    if (player.coins >= 10 && message.type != COUP_PRIMARY_ACTION_TYPE.COUP) {
        throw new Error("Must coup when at >=10 coins");
    }
}

const handleSecondaryAction = (player:CoupPlayer, room: CoupRoom) => {
    handleAction(player);

    if (room.currentState != COUP_PLAY_STATE.WAITING_ON_SECONDARY) {
        throw new Error("Not waiting on secondary action");
    }
}

const handleTargetedAction = (message:RequestMessage, room:CoupRoom) => {
    const targetedCoupMoveAction = message as TargetedCoupMoveAction;
    const targetedPlayer:CoupPlayer = room.players[targetedCoupMoveAction.details.target];

    if (targetedPlayer.hand.length <= 0) {
        throw new Error("Cannot target a player who is out of the game");
    }
}

const haveOthersAccepted = (room:CoupRoom, mainPlayer:CoupPlayer) => {
    let allAccepted = true;
    Object.values(room.players).forEach(player => {
        if (player !== mainPlayer && 
            player.hand.length > 0 && 
            (!player.currentSecondaryAction || player.currentSecondaryAction?.type !== COUP_SECONDARY_ACTION_TYPE.ACCEPT)) {
                allAccepted = false;
                console.log(player);
            }
    });
    return allAccepted;
}

const isRevealValid = (room:CoupRoom, primaryAction:CoupPrimaryMoveAction, revealAction:RevealAction, blockAction?:BlockAction):boolean => {
    let validCards:CARD_TYPES[];
    switch (primaryAction.type) {
        case COUP_PRIMARY_ACTION_TYPE.ASSASINATE:
            validCards = blockAction ? [CARD_TYPES.CONTESSA] : [CARD_TYPES.ASSASIN];
            break;
        case COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID:
            validCards = blockAction ? [CARD_TYPES.DUKE] : [];
            break;
        case COUP_PRIMARY_ACTION_TYPE.STEAL:
            validCards = blockAction ? [CARD_TYPES.CAPTAIN, CARD_TYPES.AMBASSADOR] : [CARD_TYPES.CAPTAIN];
            break;
        case COUP_PRIMARY_ACTION_TYPE.SWAP:
            validCards = blockAction ? [] : [CARD_TYPES.AMBASSADOR];
            break;
        case COUP_PRIMARY_ACTION_TYPE.TAX:
            validCards = blockAction ? [] : [CARD_TYPES.DUKE];
            break;
        default:
            validCards = [];
            break;
    }
    const revealedCard = revealAction.details.card;
    if (!validCards.includes(revealedCard)) return false;
    if (blockAction) {
        if (!room.currentBlockingActor || !room.currentBlockingActor.hand.includes(revealedCard)) {
            throw new Error("Cannot reveal a card that not in your hand");
        }
    } else if (!room.currentPrimaryActor.hand.includes(revealedCard)) {
        throw new Error("Cannot reveal a card that not in your hand");
    }
    return true;
}


const initPlayer = (player:CoupPlayer, room:CoupRoom) => {
    player.hand = [];
    for (let i = 0; i < 2; i++) {
        const card = room.deck.pop();
        if (!card) throw new Error("Ran out of cards in the deck");
        player.hand.push(card);
    }
    player.coins = 0;
    player.currentPrimaryAction = null;
    player.currentSecondaryAction = null;
}

export const getShuffledDeck = ():Deck => {
    const deck:Deck = [];
    Object.values(CARD_TYPES).forEach(cardType => {
        for (let i = 0; i < 3; i++) deck.push(cardType);
    });
    shuffle(deck);
    return deck;
}

// TODO: this function doesn't actually work
const replaceCard = (player:CoupPlayer, room:CoupRoom, card:CARD_TYPES) => {
    const index = player.hand.findIndex((c) => card === c);
    const newCard = room.deck.pop();
    if (!newCard) throw new Error("Ran out of cards in the deck");
    room.deck.unshift(card);
    player.hand[index] = card;
}

const removeCard = (player:CoupPlayer, room:CoupRoom, card:CARD_TYPES) => {
    player.hand = removeFirst(player.hand, card) as CARD_TYPES[];
    room.deck.unshift(card);
}

const removeRandomCard = (player:CoupPlayer, room:CoupRoom) => {
    if (player.hand.length <= 0) return;
    const card = player.hand[getRandomInt(0, player.hand.length)];
    removeCard(player, room, card);
}

const stealCoins = (theif:CoupPlayer, victim:CoupPlayer) => {
    const numCoins = victim.coins >= 2 ? 2 : 1;
    theif.coins += numCoins;
    victim.coins -= numCoins;
}

const incrementTurn = (room:CoupRoom) => {
    // Check win condition
    let numPlayersAlive = 0;
    const playersList = Object.values(room.players);
    playersList.forEach((player) => {
        player.currentPrimaryAction = null;
        player.currentSecondaryAction = null;
        if (player.hand.length > 0) numPlayersAlive++;
    });
    if (numPlayersAlive <= 1) {
        console.log("Game is over");
        return;
    }

    // Increment the primary player
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % playersList.length;
    while (playersList[room.currentPlayerIndex].hand.length <= 0) {
        room.currentPlayerIndex = (room.currentPlayerIndex + 1) % playersList.length;
    }
    room.currentPrimaryActor = playersList[room.currentPlayerIndex];
    room.currentChallengingActor = null;
    room.currentBlockingActor = null;
    room.currentDiscardingActor = null;
    room.currentState = COUP_PLAY_STATE.WAITING_ON_PRIMARY;
    room.currentStateV2 = COUP_PLAY_STATE_V2.PRIMARY;
}

const broadcastGameState = (clientStore: ClientStore, room:CoupRoom) => {
    Object.values(room.players).forEach(player => {
        sendPlayerGameState(clientStore, player, room);
    });
}

const sendPlayerGameState = (clientStore: ClientStore, player:CoupPlayer, room:CoupRoom) => {
    const playerStates:{[key: string]: CoupPlayerStateData} = {}; 
    Object.entries(room.players).forEach(([n, p]) => {
        const playerState:CoupPlayerStateData = {
            name: n,
            coins: p.coins,
            cards: p.hand.length,
        };
        if (p === player) playerState.hand = p.hand;
        if (p.currentPrimaryAction) playerState.currentPrimaryAction = p.currentPrimaryAction;
        if (p.currentSecondaryAction) playerState.currentSecondaryAction = p.currentSecondaryAction;

        playerStates[n] = playerState;
    });
    const response:GameStateResponse = {
        type: ResponseType.GAME_ACTION,
        data: {
            respType: COUP_RESPONSE_TYPE.GAME_STATE,
            state: {
                currentState: room.currentState,
                currentStateV2: room.currentStateV2,
                currentPrimaryActor: room.currentPrimaryActor?.name,
                currentDiscardingActor: room.currentDiscardingActor?.name,
                currentBlockingActor: room.currentBlockingActor?.name,
                currentChallengingActor: room.currentChallengingActor?.name,
                players: playerStates,
            }
        }
    }
    player.clients.forEach(client => {
        clientStore.send(client, response);
    });
}