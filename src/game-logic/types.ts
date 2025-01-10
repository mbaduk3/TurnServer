import { GameActionHandlerMethod, GameActionHandlerResponse, Room } from "../turn-based-server/types";

export interface GameLogicServer {
    // listeners: { [key:string]: HandlerMethod };
    handleMessage: GameActionHandlerMethod;

    getStateRepresentation(room:Room): object;
    getInitialState(room:Room): Room;
    onPlayerLeft(room:Room, playerName: string): GameActionHandlerResponse;
}