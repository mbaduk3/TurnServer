import TurnBasedServer from "./server";
import { ClientStore } from "../client-store/types";

/**
 * The type of request sent to the server.
 */
export enum RequestType {
    PING = 'ping',
    CREATE = 'create',
    JOIN = 'join',
    START = 'start',
    ACTION = 'action',
}

/**
 * The type of response sent by the server.
 */
export enum ResponseType {
    PONG = 'pong',
    INVALID_MESSAGE = 'message_invalid',
    CREATE_SUCCESS = 'created_room_successfully',
    CREATE_FAILURE = 'failed_to_create_room',
    JOIN_SUCCESS = 'joined_room_successfully',
    JOIN_FAILURE = 'failed_to_join_room',
    JOIN_NEW = 'new_player_joined',
    START_SUCCESS = 'started_game_successfully',
    START_FAILURE = 'failed_to_start_game',
    // ACTION_FAILURE = 'failed_to_perform_action',
    GAME_ACTION = 'game_action',
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

// export interface ActionMessage extends RequestMessage {
//     type: RequestType.ACTION,
//     data: Actiondata
// }

// export interface Actiondata {
//     actionType: string;
// }

export type HandlerMethod = (clientId: string, message: RequestMessage) => void;


/**
 * A Room represents a game.
 * It has a unique key.
 * Multiple players can be in one room, each must have a unique name.
 */
export interface Room {
    gameStarted: boolean;
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