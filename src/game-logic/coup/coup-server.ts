import {
    Deck,
    CARD_TYPES,
    CoupRoom,
    CoupPlayer,
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
    GameState,
} from "./types.ts";
import { shuffle, removeFirst, isSubset, removeSubset } from "../../utils.ts";
import { GameLogicServer } from "../types.ts";
import { GameActionHandlerMethod, GameActionHandlerResponse, PlayerBoundMessage, RequestMessage, ResponseType, Room } from "../../turn-based-server/types.ts";
import logger from "../../logger.ts";

export default class CoupServer implements GameLogicServer {

    listeners: { [key: string]: GameActionHandlerMethod; };

    constructor() {
        this.listeners = {
            [COUP_PRIMARY_ACTION_TYPE.INCOME]: this.handleIncome.bind(this),
            [COUP_PRIMARY_ACTION_TYPE.COUP]: this.handleCoup.bind(this),
            [COUP_PRIMARY_ACTION_TYPE.ASSASINATE]: this.handleAssasinate.bind(this),
            [COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID]: this.handleForeignAid.bind(this),
            [COUP_PRIMARY_ACTION_TYPE.STEAL]: this.handleSteal.bind(this),
            [COUP_PRIMARY_ACTION_TYPE.SWAP]: this.handleSwap.bind(this),
            [COUP_PRIMARY_ACTION_TYPE.TAX]: this.handleTax.bind(this),
            [COUP_SECONDARY_ACTION_TYPE.BLOCK]: this.handleBlock.bind(this),
            [COUP_SECONDARY_ACTION_TYPE.CHALLENGE]: this.handleChallenge.bind(this),
            [COUP_SECONDARY_ACTION_TYPE.REVEAL]: this.handleReveal.bind(this),
            [COUP_SECONDARY_ACTION_TYPE.SWAP_REVEAL]: this.handleSwapReveal.bind(this),
            [COUP_SECONDARY_ACTION_TYPE.ACCEPT]: this.handleAccept.bind(this),
        };
    }

    handleMessage: GameActionHandlerMethod = (message: RequestMessage, room: Room, playerName: string) => {
        const handlerMethod = this.listeners[message.type];
        if (!handlerMethod) throw new Error("Invalid message type");
        return handlerMethod(message, room, playerName);
    };

    getStateRepresentation(room: Room): GameState {
        const coupRoom = room as CoupRoom
        const playerStates:{[key: string]: CoupPlayerStateData} = {}; 
        Object.entries(coupRoom.players).forEach(([n, p]) => {
            const playerState:CoupPlayerStateData = {
                name: n,
                coins: p.coins,
                cards: p.hand.length,
                hand: p.hand,
            };
            if (p.currentPrimaryAction) playerState.currentPrimaryAction = p.currentPrimaryAction;
            if (p.currentSecondaryAction) playerState.currentSecondaryAction = p.currentSecondaryAction;
            playerStates[n] = playerState;
        });
        return {
            currentState: coupRoom.currentState,
            currentStateV2: coupRoom.currentStateV2,
            currentPrimaryActor: coupRoom.currentPrimaryActor?.name,
            currentDiscardingActor: coupRoom.currentDiscardingActor?.name,
            currentBlockingActor: coupRoom.currentBlockingActor?.name,
            currentChallengingActor: coupRoom.currentChallengingActor?.name,
            players: playerStates,
        } 
    }

    getStateRepresentationForPlayer(r: Room, playerName: string): GameState {
        const state = this.getStateRepresentation(r);
        Object.values(state.players).forEach(p => {
            if (p.name !== playerName) delete p.hand;
        });
        return state;
    }

    onPlayerLeft(room: Room, playerName: string): GameActionHandlerResponse {
        const coupRoom = room as CoupRoom;
        const player = coupRoom.players[playerName];
        if (coupRoom && player) {
            switch (coupRoom.currentStateV2) {
                case COUP_PLAY_STATE_V2.PRIMARY:
                case COUP_PLAY_STATE_V2.REACTION_TO_CHALLENGE:
                case COUP_PLAY_STATE_V2.SWAP:
                    if (coupRoom.currentPrimaryActor === player) {
                        incrementTurn(coupRoom, false);
                    }
                    break;
                case COUP_PLAY_STATE_V2.SECONDARY:
                    if (haveOthersAcceptedExcept(coupRoom, [coupRoom.currentPrimaryActor, player])) {
                        this.carryOutPrimaryAction(coupRoom.currentPrimaryActor, coupRoom, coupRoom.currentPrimaryActor.currentPrimaryAction);
                    }
                    break;
                case COUP_PLAY_STATE_V2.REACTION_TO_BLOCK:
                    if (haveOthersAcceptedExcept(coupRoom, [coupRoom.currentBlockingActor, player])) {
                        incrementTurn(coupRoom, false);
                    }
                    break;
                case COUP_PLAY_STATE_V2.REACTION_TO_BLOCK_CHALLENGE:
                    if (coupRoom.currentBlockingActor === player) {
                        this.carryOutPrimaryAction(coupRoom.currentPrimaryActor, coupRoom, coupRoom.currentPrimaryActor.currentPrimaryAction);
                    }
                    break;
                case COUP_PLAY_STATE_V2.DISCARD:
                case COUP_PLAY_STATE_V2.DISCARD_ASSASINATE_CHALLENGE:
                    if (coupRoom.currentDiscardingActor === player) {
                        incrementTurn(coupRoom, false);
                    }
                    break;
                default:
                    break;
            }
        }
        return {
            newState: coupRoom,
            messages: getBroadcastMessagesExcept(coupRoom, [playerName]),
        }
    }

    initGame(room: Room): CoupRoom {
        const coupRoom = room as CoupRoom;

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

        return coupRoom;
    }

    getCallerData = (room: Room, playerName: string):[CoupRoom, CoupPlayer] => {
        const coupRoom = room as CoupRoom;
        const player = coupRoom.players[playerName];
        return [coupRoom, player];
    }
    
    handleIncome = (message:RequestMessage, room:Room, playerName:string): GameActionHandlerResponse => {
       const [coupRoom, player] = this.getCallerData(room, playerName); 

        handlePrimaryAction(message, player, coupRoom);
        const incomeAction = message as IncomeAction;

        player.currentPrimaryAction = incomeAction;
        this.carryOutPrimaryAction(player, coupRoom, incomeAction);

        return {
            newState: coupRoom,
            messages: getBroadcastMessages(coupRoom),
        }
    }

    handleCoup = (message:RequestMessage, room:Room, playerName:string): GameActionHandlerResponse => {
        const [coupRoom, player] = this.getCallerData(room, playerName);

        handlePrimaryAction(message, player, coupRoom);
        handleTargetedAction(message, coupRoom);

        const coupAction = message as CoupAction;

        if (player.coins < 7) {
            throw new Error("Cannot coup with < 7 coins");
        }
        player.coins -= 7;
        const targetedPlayer = coupRoom.players[coupAction.details.target];
    
        player.currentPrimaryAction = coupAction;
        coupRoom.currentDiscardingActor = targetedPlayer;
        coupRoom.currentState = COUP_PLAY_STATE.WAITING_ON_SECONDARY;
        coupRoom.currentStateV2 = COUP_PLAY_STATE_V2.DISCARD;
    
        return {
            newState: coupRoom,
            messages: getBroadcastMessages(coupRoom),
        }
    }

    handleAssasinate = (message:RequestMessage, rm:Room, playerName:string): GameActionHandlerResponse => {
        const [room, player] = this.getCallerData(rm, playerName);

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
    
        return {
            newState: room,
            messages: getBroadcastMessages(room),
        } 
    }

    handleForeignAid = (message:RequestMessage, rm:Room, playerName:string): GameActionHandlerResponse => {
        const [room, player] = this.getCallerData(rm, playerName);

        handlePrimaryAction(message, player, room);

        const foreignAidAction = message as ForeignAidAction;
    
        player.currentPrimaryAction = foreignAidAction;
        room.currentState = COUP_PLAY_STATE.WAITING_ON_SECONDARY;
        room.currentStateV2 = COUP_PLAY_STATE_V2.SECONDARY;
    
        return {
            newState: room,
            messages: getBroadcastMessages(room),
        }
    }

    handleSteal = (message:RequestMessage, rm:Room, playerName:string): GameActionHandlerResponse => {
        const [room, player] = this.getCallerData(rm, playerName);

        handlePrimaryAction(message, player, room);
        handleTargetedAction(message, room);

        const stealAction = message as StealAction;
        const targetPlayer = room.players[stealAction.details.target];
    
        if (targetPlayer.coins <= 0) throw new Error("Cannot steal when target has <= 0 coins");
    
        player.currentPrimaryAction = stealAction;
        room.currentState = COUP_PLAY_STATE.WAITING_ON_SECONDARY;
        room.currentStateV2 = COUP_PLAY_STATE_V2.SECONDARY;
    
        return {
            newState: room,
            messages: getBroadcastMessages(room),
        }
    }

    handleSwap = (message:RequestMessage, rm:Room, playerName:string): GameActionHandlerResponse => {
        const [room, player] = this.getCallerData(rm, playerName);

        handlePrimaryAction(message, player, room);

        const swapAction = message as SwapAction;
    
        player.currentPrimaryAction = swapAction;
        room.currentState = COUP_PLAY_STATE.WAITING_ON_SECONDARY;
        room.currentStateV2 = COUP_PLAY_STATE_V2.SECONDARY;
    
        return {
            newState: room,
            messages: getBroadcastMessages(room),
        }
    }

    handleTax = (message:RequestMessage, rm:Room, playerName:string): GameActionHandlerResponse => {
        const [room, player] = this.getCallerData(rm, playerName);

        handlePrimaryAction(message, player, room);

        const taxAction = message as TaxAction;
    
        player.currentPrimaryAction = taxAction;
        room.currentState = COUP_PLAY_STATE.WAITING_ON_SECONDARY;
        room.currentStateV2 = COUP_PLAY_STATE_V2.SECONDARY;

        return {
            newState: room,
            messages: getBroadcastMessages(room),
        }
    }

    handleBlock = (message:RequestMessage, rm:Room, playerName:string): GameActionHandlerResponse => {
        const [room, player] = this.getCallerData(rm, playerName);

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

        return {
            newState: room,
            messages: getBroadcastMessages(room),
        }
    }

    handleChallenge = (message:RequestMessage, rm:Room, playerName:string): GameActionHandlerResponse => {
        const [room, player] = this.getCallerData(rm, playerName);

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

        return {
            newState: room,
            messages: getBroadcastMessages(room),
        }
    }

    handleReveal = (message:RequestMessage, rm:Room, playerName:string): GameActionHandlerResponse => {
        const [room, player] = this.getCallerData(rm, playerName);

        handleSecondaryAction(player, room);

        const revealAction = message as RevealAction;
        const primaryAction = room.currentPrimaryActor.currentPrimaryAction as CoupPrimaryMoveAction;
    
        if (room.currentDiscardingActor && room.currentDiscardingActor === player) {
            // Valid discard reveal
            if (!player.hand.includes(revealAction.details.card)) {
                throw new Error("Cannot reveal a card that not in your hand");
            }
            room.currentDiscardingActor.currentSecondaryAction = revealAction;
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
            if (!player.hand.includes(revealAction.details.card)) {
                throw new Error("Cannot reveal a card that not in your hand");
            }
            const blockingActor:CoupPlayer = room.currentBlockingActor as CoupPlayer;
            const blockAction:BlockAction = blockingActor.currentSecondaryAction as BlockAction;
            blockingActor.currentSecondaryAction = revealAction;
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
            if (!player.hand.includes(revealAction.details.card)) {
                throw new Error("Cannot reveal a card that not in your hand");
            }
            room.currentPrimaryActor.currentSecondaryAction = revealAction;
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
                logger.info(`Player ${player.name} failed reveal`);
                incrementTurn(room);
            }
        } else {
            throw new Error("Unexpected reveal");
        }
    
        return {
            newState: room,
            messages: getBroadcastMessages(room),
        }
    }

    handleSwapReveal = (message:RequestMessage, rm:Room, playerName:string): GameActionHandlerResponse => {
        const [room, player] = this.getCallerData(rm, playerName);

        handleSecondaryAction(player, room);

        const swapDecision:SwapDecision = message as SwapDecision;

        if (room.currentPrimaryActor !== player ||
            room.currentPrimaryActor.currentPrimaryAction?.type !== COUP_PRIMARY_ACTION_TYPE.SWAP ||
            room.currentPrimaryActor.hand.length <= 2) {
            throw new Error("Unexpected swap decision");
        }
        if (!isSubset(swapDecision.details.cards, room.currentPrimaryActor.hand) ||
            (room.currentPrimaryActor.hand.length === 3 && swapDecision.details.cards.length !== 1) ||
            (room.currentPrimaryActor.hand.length === 4 && swapDecision.details.cards.length !== 2)) {
            throw new Error("Invalid swap decision cards");
        }
        const leftOver:CARD_TYPES[] = removeSubset(swapDecision.details.cards, room.currentPrimaryActor.hand) as CARD_TYPES[];
        room.currentPrimaryActor.hand = swapDecision.details.cards;
        room.deck = [...room.deck, ...leftOver];
        room.deck = shuffle(room.deck) as Deck;
        incrementTurn(room);

        return {
            newState: room,
            messages: getBroadcastMessages(room),
        }
    }

    handleAccept = (message:RequestMessage, rm:Room, playerName:string): GameActionHandlerResponse => {
        const [room, player] = this.getCallerData(rm, playerName);

        handleSecondaryAction(player, room);

        const acceptAction:AcceptAction = message as AcceptAction;

        if (room.currentBlockingActor && !room.currentChallengingActor && room.currentBlockingActor !== player) { // Accepting a block
            player.currentSecondaryAction = acceptAction;
            if (haveOthersAccepted(room, room.currentBlockingActor)) { // Block goes through
                incrementTurn(room);
            }
        } else if (room.currentPrimaryActor !== player && !room.currentChallengingActor) {
            player.currentSecondaryAction = acceptAction;
            if (haveOthersAccepted(room, room.currentPrimaryActor)) { // Primary goes through
                const primaryAction = room.currentPrimaryActor.currentPrimaryAction as CoupPrimaryMoveAction;
                this.carryOutPrimaryAction(room.currentPrimaryActor, room, primaryAction);
            }
        } else {
            throw new Error("Unexpected accept");
        }

        return {
            newState: room,
            messages: getBroadcastMessages(room),
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
                // sendPlayerGameState(this.clientStore, player, room);
                // this.updateState(room);
                break;
        }
    }
}

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
            }
    });
    return allAccepted;
}

const haveOthersAcceptedExcept = (room:CoupRoom, except:CoupPlayer[]) => {
    let allAccepted = true;
    Object.values(room.players).forEach(player => {
        if (!except.includes(player) && 
            player.hand.length > 0 && 
            (!player.currentSecondaryAction || player.currentSecondaryAction?.type !== COUP_SECONDARY_ACTION_TYPE.ACCEPT)) {
                allAccepted = false;
            }
    });
    return allAccepted;
}

const isRevealValid = (room:CoupRoom, primaryAction:CoupPrimaryMoveAction, revealAction:RevealAction, blockAction?:BlockAction):boolean => {
    let validCards:CARD_TYPES[];
    logger.info(`Validating reveal: ${primaryAction.type}`);
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

// TODO: this function doesn't work either
const removeCard = (player:CoupPlayer, room:CoupRoom, card:CARD_TYPES) => {
    removeFirst(player.hand, card);
    room.deck.unshift(card);
}

// const removeRandomCard = (player:CoupPlayer, room:CoupRoom) => {
//     if (player.hand.length <= 0) return;
//     const card = player.hand[getRandomInt(0, player.hand.length)];
//     removeCard(player, room, card);
// }

const stealCoins = (theif:CoupPlayer, victim:CoupPlayer) => {
    const numCoins = victim.coins >= 2 ? 2 : 1;
    theif.coins += numCoins;
    victim.coins -= numCoins;
}

const incrementTurn = (room:CoupRoom, incrementCount:boolean = true) => {
    // Check win condition
    let numPlayersAlive = 0;
    const playersList = Object.values(room.players);
    playersList.forEach((player) => {
        player.currentPrimaryAction = null;
        // player.currentSecondaryAction = null;
        if (player.currentSecondaryAction && player.currentSecondaryAction.type != COUP_SECONDARY_ACTION_TYPE.REVEAL) {
            player.currentSecondaryAction = null;
        }
        if (player.hand.length > 0) numPlayersAlive++;
    });
    
    // Increment the primary player
    room.currentPlayerIndex = (room.currentPlayerIndex + (incrementCount ? 1 : 0)) % playersList.length;
    while (playersList[room.currentPlayerIndex].hand.length <= 0) {
        room.currentPlayerIndex = (room.currentPlayerIndex + 1) % playersList.length;
    }
    room.currentPrimaryActor = playersList[room.currentPlayerIndex];
    room.currentChallengingActor = null;
    room.currentBlockingActor = null;
    room.currentDiscardingActor = null;
    room.currentState = COUP_PLAY_STATE.WAITING_ON_PRIMARY;
    room.currentStateV2 = COUP_PLAY_STATE_V2.PRIMARY;
    if (numPlayersAlive <= 1) {
        logger.info("Game is over");
        room.currentStateV2 = COUP_PLAY_STATE_V2.FINISHED;
    }
}

const getBroadcastMessages = (room: CoupRoom): PlayerBoundMessage[] => {
    return Object.values(room.players).map(p => getBroadcastMessage(room, p));
}

const getBroadcastMessagesExcept = (room: CoupRoom, except: string[]): PlayerBoundMessage[] => {
    const messages = getBroadcastMessages(room);
    return messages.filter(m => !except.includes(m.player.name));
}

const getBroadcastMessage = (room: CoupRoom, player: CoupPlayer): PlayerBoundMessage => {
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
    const content = {
        currentState: room.currentState,
        currentStateV2: room.currentStateV2,
        currentPrimaryActor: room.currentPrimaryActor?.name,
        currentDiscardingActor: room.currentDiscardingActor?.name,
        currentBlockingActor: room.currentBlockingActor?.name,
        currentChallengingActor: room.currentChallengingActor?.name,
        players: playerStates,
    }
    return {
        player: player,
        message: {
            type: ResponseType.GAME_STATE,
            data: content,
        }
    };
}