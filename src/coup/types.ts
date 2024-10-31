import {
    Player,
    ResponseMessage,
    ResponseType,
    Room,
    // Actiondata,
    Client,
    RequestMessage,
} from "../turn-based-server/types.ts";

/**
 * The types of the cards
 */
export enum CARD_TYPES {
    DUKE = "duke",
    ASSASIN = "assasin",
    CONTESSA = "contessa",
    CAPTAIN = "captain",
    AMBASSADOR = "ambassador",
}

/**
 * The types of primary actions a primary acting player can take.
 */
export enum COUP_PRIMARY_ACTION_TYPE {
    INCOME = "income",
    FOREIGN_AID = "foreign_aid",
    COUP = "coup",
    TAX = "tax",
    ASSASINATE = "assasinate",
    STEAL = "steal",
    SWAP = "swap",
}

/**
 * The types of secondary actions players can make 
 * in response to another action.
 */
export enum COUP_SECONDARY_ACTION_TYPE {
    CHALLENGE = "challenge",
    BLOCK = "block",
    REVEAL = "reveal",
    SWAP_REVEAL = "swap_reveal",
    ACCEPT = "accept",
}

export const challengableActions:COUP_ACTION_TYPE[] = [
    COUP_PRIMARY_ACTION_TYPE.TAX,
    COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
    COUP_PRIMARY_ACTION_TYPE.STEAL,
    COUP_PRIMARY_ACTION_TYPE.SWAP,
    COUP_SECONDARY_ACTION_TYPE.BLOCK,
];

export const blockableActions:COUP_ACTION_TYPE[] = [
    COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID,
    COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
    COUP_PRIMARY_ACTION_TYPE.STEAL,
];

/**
 * Non-action requests sent to the Coup server must be of this type.
 */
export enum COUP_OTHER_REQUEST_TYPE {
    GAME_STATE = "game_state",
}


/**
 * Any request sent to the Coup server must be of this type.
 */
// export type COUP_REQUEST_TYPE = COUP_ACTION_TYPE | COUP_OTHER_REQUEST_TYPE;

/**
 * An action in the game of Coup must be of this type.
 */
export type COUP_ACTION_TYPE = COUP_PRIMARY_ACTION_TYPE | COUP_SECONDARY_ACTION_TYPE;

/**
 * An action message sent to the Coup server must fit this
 * interface.
 */
export interface CoupMoveAction extends RequestMessage {
    type: COUP_ACTION_TYPE,
}

/**
 * A message sent to the Coup server must fit this
 * interface.
 */
// export interface CoupRequestMessage extends Actiondata {
//     actionType: COUP_REQUEST_TYPE,
// }

/**
 * A message sent to the Coup server representing a primary action
 * must fit this interface.
 */
export interface CoupPrimaryMoveAction extends CoupMoveAction {
    type: COUP_PRIMARY_ACTION_TYPE,
}

/**
 * A message sent to the Coup server representing a secondary action
 * must fit this interface.
 */
export interface CoupSecondaryMoveAction extends CoupMoveAction {
    type: COUP_SECONDARY_ACTION_TYPE,
}

/**
 * A message sent to the Coup server representing an action which
 * has a target player must fit this interface.
 */
export interface TargetedCoupMoveAction extends CoupMoveAction {
    type: COUP_ACTION_TYPE,
    details: {
        target: string,
    }
}

/**
 * A message sent to the Coup server representing an action which
 * has a chosen card must fit this interface.
 */
interface ChosenCoupMoveAction extends CoupMoveAction {
    type: COUP_ACTION_TYPE,
    details: {
        card: CARD_TYPES,
    }
}

/**
 * A message sent to the Coup server representing the income action
 * must fit this interface.
 */
export interface IncomeAction extends CoupMoveAction {
    type: COUP_PRIMARY_ACTION_TYPE.INCOME,
}

/**
 * A message sent to the Coup server representing the foreign aid  action
 * must fit this interface.
 */
export interface ForeignAidAction extends CoupMoveAction {
    type: COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID,
}

/**
 * A message sent to the Coup server representing the coup action
 * must fit this interface.
 */
export interface CoupAction extends TargetedCoupMoveAction {
    type: COUP_PRIMARY_ACTION_TYPE.COUP,
}

/**
 * A message sent to the Coup server representing the tax action
 * must fit this interface.
 */
export interface TaxAction extends TargetedCoupMoveAction {
    type: COUP_PRIMARY_ACTION_TYPE.TAX,
}

/**
 * A message sent to the Coup server representing the assasinate action
 * must fit this interface.
 */
export interface AssasinateAction extends TargetedCoupMoveAction {
    type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
}

/**
 * A message sent to the Coup server representing the steal action
 * must fit this interface.
 */
export interface StealAction extends TargetedCoupMoveAction {
    type: COUP_PRIMARY_ACTION_TYPE.STEAL,
}

/**
 * A message sent to the Coup server representing the swap action
 * must fit this interface.
 */
export interface SwapAction extends CoupMoveAction {
    type: COUP_PRIMARY_ACTION_TYPE.SWAP,
}

/**
 * A message sent to the Coup server representing the challenge action
 * must fit this interface.
 */
export interface ChallengeAction extends CoupMoveAction {
    type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
}

/**
 * A message sent to the Coup server representing the block action
 * must fit this interface.
 */
export interface BlockAction extends CoupMoveAction {
    type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
}

export interface AcceptAction extends CoupMoveAction {
    type: COUP_SECONDARY_ACTION_TYPE.ACCEPT,
}

/**
 * A message sent to the Coup server representing the reveal action
 * must fit this interface.
 */
export interface RevealAction extends ChosenCoupMoveAction, CoupSecondaryMoveAction {
    type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
}

export interface SwapDecision extends CoupSecondaryMoveAction {
    type: COUP_SECONDARY_ACTION_TYPE.SWAP_REVEAL,
    details: {
        cards: CARD_TYPES[]
    }
}

/**
 * Represents a game's card deck.
 */
export type Deck = CARD_TYPES[];

/**
 * Represents a player's card hand.
 */
export type Hand = CARD_TYPES[];

export interface CoupPlayerStateData {
    name: string,
    coins: number,
    cards: number,
    currentPrimaryAction?: CoupPrimaryMoveAction;
    currentSecondaryAction?: CoupSecondaryMoveAction;
    hand?: Hand,
}

export type CoupStateData = {
    currentState: COUP_PLAY_STATE;
    currentStateV2: COUP_PLAY_STATE_V2;
    currentPrimaryActor: string;
    currentDiscardingActor: string;
    currentBlockingActor: string;
    currentChallengingActor: string;
    players: { [key: string]: CoupPlayerStateData }
}

/**
 * Responses sent to players from the coup-server must be of this type.
 */
export enum COUP_RESPONSE_TYPE {
    GAME_STATE = "game_state",
}

/**
 * Responses sent to players from the coup-server must fit this
 * interface.
 */
export interface CoupResponseMessage extends ResponseMessage {
    type: ResponseType.GAME_ACTION,
    data: {
        respType: COUP_RESPONSE_TYPE;
    }
}

/**
 * Responses sent to players about the current game state must fit
 * this interface.
 */
export interface GameStateResponse extends CoupResponseMessage {
    data: {
        respType: COUP_RESPONSE_TYPE.GAME_STATE,
        state: CoupStateData,
    }
}

/**
 * Indicates which party the server is currently waiting on a response from.
 */
export enum COUP_PLAY_STATE {
    WAITING_ON_PRIMARY = "waiting_on_primary",
    WAITING_ON_SECONDARY = "waiting_on_secondary",
}

export enum COUP_PLAY_STATE_V2 {
    PRIMARY = "primary",
    SECONDARY = "secondary",
    SWAP = "swap",
    DISCARD = "discard",
    DISCARD_ASSASINATE_CHALLENGE = "discard_assasinate_challenge",
    REACTION_TO_BLOCK = "reaction_to_block",
    REACTION_TO_CHALLENGE = "reaction_to_challenge",
    REACTION_TO_BLOCK_CHALLENGE = "reaction_to_block_challenge",
    FINISHED = "finished",
}

export interface CoupRoom extends Room {
    deck: Deck;
    players: {[key: string]: CoupPlayer};
    currentPlayerIndex: number;
    currentPrimaryActor: CoupPlayer;
    currentChallengingActor: CoupPlayer | null;
    currentBlockingActor: CoupPlayer | null;
    currentDiscardingActor: CoupPlayer | null;
    currentState: COUP_PLAY_STATE;
    currentStateV2: COUP_PLAY_STATE_V2;
}

export interface CoupPlayer extends Player {
    // room: CoupRoom;
    hand: Hand;
    coins: number;
    currentPrimaryAction: CoupPrimaryMoveAction | null;
    currentSecondaryAction: CoupSecondaryMoveAction | null;
}

export interface CoupClient extends Client {
    player: CoupPlayer;
}
