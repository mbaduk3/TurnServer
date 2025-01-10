import typia from 'typia'
import { genKey } from '../utils.ts';
import {
    RequestType,
    ResponseType,
    RequestMessage,
    ResponseMessage,
    Room,
    Player,
    CreateMessage,
    JoinMessage,
    HandlerMethod,
    HandlerResponse,
    GameActionHandlerResponse,
} from './types.ts';
import { ClientStore } from '../client-store/types.ts';
import { RoomStore } from '../room-store/types.ts';
import { DBProxy } from '../db-proxy/types.ts';
import { GameLogicServer } from '../game-logic/types.ts';
import { getRoomStateBroadcast, getRoomStateMessage, transformPlayerMessagesToClient } from './utils.ts';

export default class TurnBasedServer {
    protected clientStore:ClientStore;
    protected listeners: { [key:string]: HandlerMethod };
    private gameLogicServer: GameLogicServer;
    private roomStore:RoomStore;
    private dbProxy:DBProxy;

    constructor(clientStore:ClientStore, roomStore:RoomStore, dbProxy:DBProxy, gameLogicServer:GameLogicServer) {
        this.gameLogicServer = gameLogicServer;
        this.clientStore = clientStore;
        this.roomStore = roomStore;
        this.dbProxy = dbProxy;
        this.listeners = {
            [RequestType.PING]: this.handlePing.bind(this),
            [RequestType.STATUS]: this.handleStatus.bind(this),
            [RequestType.CREATE]: this.handleCreate.bind(this),
            [RequestType.JOIN]: this.handleJoin.bind(this),
            [RequestType.START]: this.handleStart.bind(this),
            [RequestType.LEAVE]: this.handleLeave.bind(this),
        }
    }

    public handleMessage(clientId: string, data: string) {
        if (!this.clientStore.has(clientId)) throw new Error("Unknown client");
        try {
            const obj:RequestMessage = typia.json.assertParse<RequestMessage>(data);
            this.handleParsedMessage(clientId, obj);
        } catch (error) {
            console.error("Invalid message sent: ", data, error);
            const response:ResponseMessage = {
                type: ResponseType.INVALID_MESSAGE,
            }
            this.clientStore.send(clientId, response);
        }
    }

    private handleParsedMessage(clientId: string, obj: RequestMessage) {
        const handlerMethod = this.listeners[obj.type];
        const clientRoom = this.roomStore.getClientRoom(clientId);
        const playerName = this.roomStore.getClientPlayerName(clientId);
        const handlerResponse = handlerMethod ? handlerMethod(clientId, obj, clientRoom) : this.delegateMessage(obj, clientRoom, playerName);

        if (handlerResponse && handlerResponse.newState) {
            const newState = handlerResponse.newState;
            this.roomStore.put(newState);
            this.dbProxy.recordAction(newState.key, playerName, obj);
            this.dbProxy.recordState(newState.key, newState);
        }

        if (handlerResponse && handlerResponse.messages) {
            handlerResponse.messages.forEach(clientMsg => {
                this.clientStore.send(clientMsg.clientId, clientMsg.message);
            });
        }
    }

    private delegateMessage(obj: RequestMessage, clientRoom: Room, playerName: string): HandlerResponse {
        const gameActionResponse: GameActionHandlerResponse | void = this.gameLogicServer.handleMessage(obj, clientRoom, playerName);
        let clientMessages = null;
        if (gameActionResponse && gameActionResponse.messages) clientMessages = transformPlayerMessagesToClient(gameActionResponse.messages);
        const response:HandlerResponse = gameActionResponse ? { newState: gameActionResponse.newState, messages: clientMessages } : null;
        return response;
    }

    public handleDisconnect(clientId:string) {
        this.roomStore.removeClient(clientId); 
    }

    private handleLeave(clientId:string, _:RequestMessage, room:Room): HandlerResponse {
        const playerName = this.roomStore.getClientPlayerName(clientId);
        const response:HandlerResponse = {
            messages: [],
        }
        if (room) {
            if (room.gameStarted) {
                const gameResponse = this.gameLogicServer.onPlayerLeft(room, playerName);
                if (gameResponse && gameResponse.newState) response.newState = gameResponse.newState;
                if (gameResponse && gameResponse.messages) response.messages = [
                    ...response.messages,
                    ...transformPlayerMessagesToClient(gameResponse.messages),
                ];
            }
            this.roomStore.deletePlayer(room.players[this.roomStore.getClientPlayerName(clientId)]);
        }

        const notInRoomResponse:ResponseMessage = {
            type: ResponseType.NOT_IN_ROOM,
        }
        const msg = {
            clientId: clientId,
            message: notInRoomResponse,
        }
        response.messages.push(msg);

        return response;
    }

    private handleStatus(clientId:string, _:RequestMessage, clientRoom: Room): HandlerResponse {
        let response:ResponseMessage;
        if (clientRoom) {
            response = getRoomStateMessage(clientRoom);
        } else {
            response = {
                type: ResponseType.NOT_IN_ROOM,
            }
        }
        const msg = {
            clientId: clientId,
            message: response,
        }
        return {
            messages: [msg],
        }
    }

    private handleCreate(clientId:string, message:RequestMessage, clientRoom:Room) {
        typia.assert<CreateMessage>(message);
        const createMessage = message as CreateMessage;
        const handlerResponse:HandlerResponse = {
            messages: [],
        };

        if (clientRoom) {
            const response = this.handleLeave(clientId, message, clientRoom);
            if (response && response.messages) handlerResponse.messages = [...handlerResponse.messages, ...response.messages];
            if (response && response.newState) handlerResponse.newState = response.newState;
        }

        const name = createMessage.data.name;
        let key:string = "";
        while (key === "" || this.roomStore.has(key)) {
            key = genKey(5);
        }
        const room:Room = {
            gameStarted: false,
            key: key,
            players: {},
        }
        this.addNewPlayerToRoom(room, name, clientId);
        const messages = getRoomStateBroadcast(room);

        handlerResponse.newState = room;
        handlerResponse.messages = [...handlerResponse.messages, ...messages];
        return handlerResponse;
    }

    private handleJoin(clientId:string, message:RequestMessage, clientRoom: Room): HandlerResponse {
        typia.assert<JoinMessage>(message);
        const joinMessage = message as JoinMessage;

        if (clientRoom) {
            const leaveMessage = {
                type: RequestType.LEAVE,
            }
            this.handleParsedMessage(clientId, leaveMessage);
        }

        const handlerResponse:HandlerResponse = {
            messages: [],
        }

        const name = joinMessage.data.name;
        const key = joinMessage.data.key;
        if (!key || typeof key !== "string") {
            const response:ResponseMessage = {
                type: ResponseType.JOIN_FAILURE,
                data: {
                    message: "No key supplied in data"
                }
            }
            handlerResponse.messages.push({
                clientId: clientId,
                message: response,
            });
            return handlerResponse;
        }

        const room:Room = this.roomStore.get(key);
        if (!room) {
            const response:ResponseMessage = {
                type: ResponseType.JOIN_FAILURE,
                data: {
                    message: "Room does not exist"
                }
            }
            handlerResponse.messages.push({
                clientId: clientId,
                message: response,
            });
            return handlerResponse;
        }

        const player = room.players[name];
        if (!player) {
            this.addNewPlayerToRoom(room, name, clientId); 
            handlerResponse.newState = room;
            handlerResponse.messages = [...handlerResponse.messages, ...getRoomStateBroadcast(room)];
        } else {
            this.roomStore.addClientToPlayer(clientId, player);
        }
        return handlerResponse;
    }

    private handleStart(clientId:string, _:RequestMessage, clientRoom: Room): HandlerResponse {
        const handlerResponse: HandlerResponse = {
            messages: [],
        }
        if (!clientRoom) {
            const response:ResponseMessage = {
                type: ResponseType.START_FAILURE,
                data: {
                    message: "Not currently in a room"
                }
            }
            handlerResponse.messages.push({
                clientId: clientId,
                message: response,
            });
            return handlerResponse;
        }
        
        if (clientRoom.gameStarted) {
            const response:ResponseMessage = {
                type: ResponseType.START_FAILURE,
                data: {
                    message: "Game already started"
                }
            }
            handlerResponse.messages.push({
                clientId: clientId,
                message: response,
            });
            return handlerResponse;
        }

        clientRoom = {...clientRoom, ...this.gameLogicServer.getInitialState(clientRoom)};
        clientRoom.gameStarted = true;
        handlerResponse.newState = clientRoom;
        handlerResponse.messages = [...handlerResponse.messages, ...getRoomStateBroadcast(clientRoom)];
        return handlerResponse;
    }

    private handlePing(clientId:string): HandlerResponse {
        const response:ResponseMessage = {
            type: ResponseType.PONG,
        }
        return {
            messages: [{ clientId: clientId, message: response }],
        }
    }

    private addNewPlayerToRoom(room:Room, playerName:string, clientId:string) {
        const player = createNewPlayer(playerName, room.key, clientId);
        room.players[playerName] = player;
        return player;
    }
}

const createNewPlayer = (name:string, roomId:string, clientId:string):Player => {
    const player:Player = {
        name: name,
        roomId: roomId,
        clients: [clientId],
    }
    return player;
}
