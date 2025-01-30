import TurnBasedServer from "./server";
import { ClientStore } from "../client-store/types";

/**
 * The type of request sent to the server.
 */
export enum RequestType {
    PING = 'ping',
    CREATE = 'create',
    JOIN = 'join',
    LEAVE = 'leave',
    START = 'start',
    STATUS = 'status',
}

/**
 * The type of response sent by the server.
 */
export enum ResponseType {
    PONG = 'pong',
    INVALID_MESSAGE = 'message_invalid',
    JOIN_FAILURE = 'failed_to_join_room',
    NOT_IN_ROOM = 'not_in_room',
    START_FAILURE = 'failed_to_start_game',
    GAME_STATE = 'game_state',
    ROOM_STATE = 'room_state',
}

/**
 * A schema for messages sent to/from the server.
 */
interface TurnBasedMessage {
    type: RequestType | ResponseType,
    data?: object,
}

// /**
//  * A schema for messages sent to the server.
//  */
// export interface RequestMessage extends TurnBasedMessage {
//     type: RequestType;
// }

export interface RequestMessage {
    type: string;
}

/**
 * A schema for messages sent from the server.
 */
export interface ResponseMessage extends TurnBasedMessage {
    type: ResponseType;
}

export interface GameStateResponse extends ResponseMessage {
    data: {
        started: boolean,
        key: string,
        players: string[],
        state?: object,
    }
}

export interface CreateMessage extends RequestMessage {
    type: RequestType.CREATE,
    data: {
        name: string,
    }
}

export interface JoinMessage extends RequestMessage {
    type: RequestType.JOIN,
    data: {
        name: string,
        key: string,
    }
}

export interface LeaveMessage extends RequestMessage {
    type: RequestType.LEAVE,
}

// export interface ActionMessage extends RequestMessage {
//     type: RequestType.ACTION,
//     data: Actiondata
// }

// export interface Actiondata {
//     actionType: string;
// }

export type PlayerBoundMessage = {
    player: Player;
    message: ResponseMessage;
}

export type ClientBoundMessage = {
    clientId: string;
    message: ResponseMessage;
}

export type GameActionHandlerResponse = {
    newState?: Room;
    messages?: PlayerBoundMessage[];
}

export type HandlerResponse = {
    newState?: Room;
    messages?: ClientBoundMessage[];
}

export type GameActionHandlerMethod = (message: RequestMessage, room: Room, playerName: string) => GameActionHandlerResponse | void;

export type HandlerMethod = (clientId: string, message: RequestMessage, room: Room) => HandlerResponse | void;


/**
 * A Room represents a game.
 * It has a unique key.
 * Multiple players can be in one room, each must have a unique name.
 */
export interface Room {
    started: boolean;
    key: string;
    players: { [key:string]: Player };
}

/**
 * A player can only be in one room at a time, and they must be in a room.
 * Multiple clients can be connected to a single player.
 */
export interface Player {
    name: string;
    roomId: string;
    clients: string[];
}

/**
 * A client is a WS, HTTP, etc. connection.
 * Each client must have a uuid.
 * A client may be associated with maximum 1 player at a time.
 */
export interface Client {
    id: string;
    protocolServer: TurnBasedProtocolServer;
    // player?: Player;
}

/**
 * Servers which interface with clients over a protocol (WS, HTTP, etc.)
 * must implement this interface.
 */
export abstract class TurnBasedProtocolServer {
    server:TurnBasedServer;
    clientStore:ClientStore;

    constructor(server:TurnBasedServer, clientStore: ClientStore) {
        this.server = server;
        this.clientStore = clientStore;
    }

    abstract sendMessageToClient(clientId: string, message: ResponseMessage): void;
}