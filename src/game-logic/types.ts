import {
    GameActionHandlerMethod,
    GameActionHandlerResponse,
    Room
} from "../turn-based-server/types";

export interface GameLogicServer {
    // listeners: { [key:string]: HandlerMethod };
    handleMessage: GameActionHandlerMethod;

    getStateRepresentation(room:Room): object;
    getStateRepresentationForPlayer(room:Room, playerName:string): object;
    onPlayerLeft(room:Room, playerName: string): GameActionHandlerResponse;
    initGame(room:Room): Room;
}