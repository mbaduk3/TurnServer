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
} from './types.ts';
import { ClientStore } from '../client-store/types.ts';
import { RoomStore } from '../room-store/types.ts';

export default abstract class TurnBasedServer {
    protected clientStore:ClientStore;
    protected roomStore:RoomStore;
    protected listeners: { [key:string]: HandlerMethod };

    constructor(clientStore:ClientStore, roomStore:RoomStore) {
        this.clientStore = clientStore;
        this.roomStore = roomStore;
        this.listeners = {
            [RequestType.PING]: this.handlePing.bind(this),
            [RequestType.CREATE]: this.handleCreate.bind(this),
            [RequestType.JOIN]: this.handleJoin.bind(this),
            [RequestType.LEAVE]: this.handleLeave.bind(this),
            [RequestType.START]: this.handleStart.bind(this),
            [RequestType.STATUS]: this.handleStatus.bind(this),
        }
    }

    public handleMessage(clientId: string, data: string) {
        if (!this.clientStore.has(clientId)) throw new Error("Unknown client");
        try {
            const obj:RequestMessage = typia.json.assertParse<RequestMessage>(data);
            const handlerMethod = this.listeners[obj.type];
            if (!handlerMethod) throw new Error("No handler for message type: " + obj.type);
            handlerMethod(clientId, obj);
        } catch (error) {
            console.error("Invalid message sent: ", data, error);
            const response:ResponseMessage = {
                type: ResponseType.INVALID_MESSAGE,
            }
            this.clientStore.send(clientId, response);
        }
    }

    protected handleCreate(clientId:string, message:RequestMessage) {
        typia.assert<CreateMessage>(message);
        const createMessage = message as CreateMessage;

        const clientRoom = this.roomStore.getClientRoom(clientId);
        if (clientRoom) {
            // const response:ResponseMessage = {
            //     type: ResponseType.CREATE_FAILURE,
            //     data: {
            //         message: "Already in a room"
            //     }
            // }
            // this.clientStore.send(clientId, response);
            // return;
            this.handleLeave(clientId);
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
        this.roomStore.put(room);

        addNewPlayerToRoom(this.roomStore, room.key, name, clientId);

        const response:ResponseMessage = {
            type: ResponseType.CREATE_SUCCESS,
            data: {
                key: key
            }
        }
        this.clientStore.send(clientId, response);
    }

    protected handleJoin(clientId:string, message:RequestMessage) {
        typia.assert<JoinMessage>(message);
        console.log(message);
        const joinMessage = message as JoinMessage;

        const clientRoom = this.roomStore.getClientRoom(clientId);
        if (clientRoom) {
            // const response:ResponseMessage = {
            //     type: ResponseType.JOIN_FAILURE,
            //     data: {
            //         message: "Already in a room"
            //     }
            // }
            // this.clientStore.send(clientId, response);
            // return;
            this.handleLeave(clientId);
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
            this.clientStore.send(clientId, response);
            return;
        }

        const room:Room = this.roomStore.get(key);
        if (!room) {
            const response:ResponseMessage = {
                type: ResponseType.JOIN_FAILURE,
                data: {
                    message: "Room does not exist"
                }
            }
            this.clientStore.send(clientId, response);
            return;
        }

        const player = room.players[name];
        if (!player) {
            addNewPlayerToRoom(this.roomStore, room.key, name, clientId); 
        } else {
            this.roomStore.addClientToPlayer(clientId, player);
        }

        const joinResponse:ResponseMessage = {
            type: ResponseType.JOIN_SUCCESS,
        }
        this.clientStore.send(clientId, joinResponse);

        const roomResponse:ResponseMessage = {
            type: ResponseType.JOIN_NEW,
            data: {
                players: Object.keys(room.players)
            }
        }
        broadcastToRoom(this.clientStore, this.roomStore, room.key, roomResponse);
    }

    protected handleStart(clientId:string) {
        const clientRoom = this.roomStore.getClientRoom(clientId);
        if (!clientRoom) {
            const response:ResponseMessage = {
                type: ResponseType.START_FAILURE,
                data: {
                    message: "Not currently in a room"
                }
            }
            this.clientStore.send(clientId, response);
            return;
        }
        
        if (clientRoom.gameStarted) {
            const response:ResponseMessage = {
                type: ResponseType.START_FAILURE,
                data: {
                    message: "Game already started"
                }
            }
            this.clientStore.send(clientId, response);
            return;
        }

        clientRoom.gameStarted = true;
        const startResponse:ResponseMessage = {
            type: ResponseType.START_SUCCESS,
        }
        this.roomStore.put(clientRoom);
        this.clientStore.send(clientId, startResponse);
    }

    protected handlePing(clientId:string) {
        const response:ResponseMessage = {
            type: ResponseType.PONG,
        }
        this.clientStore.send(clientId, response);
    }

    protected handleLeave(clientId:string) {
        const clientRoom = this.roomStore.getClientRoom(clientId);
        if (clientRoom) {
            this.roomStore.deletePlayer(clientRoom.players[this.roomStore.getClientPlayerName(clientId)]);
        }
        const roomResponse:ResponseMessage = {
            type: ResponseType.ROOM_STATUS,
            data: {
                players: Object.keys(clientRoom.players),
                started: clientRoom.gameStarted,
            }
        }
        this.roomStore.put(clientRoom);
        broadcastToRoom(this.clientStore, this.roomStore, clientRoom.key, roomResponse);

        const notInRoomResponse:ResponseMessage = {
            type: ResponseType.NOT_IN_ROOM,
        }
        this.clientStore.send(clientId, notInRoomResponse);
    }

    protected handleStatus(clientId:string) {
        const clientRoom = this.roomStore.getClientRoom(clientId);
        let response:ResponseMessage;
        if (clientRoom) {
            response = {
                type: ResponseType.ROOM_STATUS,
                data: {
                    players: Object.keys(clientRoom.players),
                    started: clientRoom.gameStarted,
                }
            } 
        } else {
            response = {
                type: ResponseType.NOT_IN_ROOM,
            }
        }
        this.clientStore.send(clientId, response);
    }

    public handleDisconnect(clientId:string) {
        this.roomStore.removeClient(clientId); 
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

const addNewPlayerToRoom = (roomStore:RoomStore, roomId:string, playerName:string, clientId:string) => {
    const player = createNewPlayer(playerName, roomId, clientId);
    const room = roomStore.get(roomId);
    room.players[playerName] = player;
    roomStore.put(room);
}

const broadcastToRoom = (clientStore: ClientStore, roomStore: RoomStore, roomKey:string, message:ResponseMessage) => {
    const room = roomStore.get(roomKey);
    const players = Object.values(room.players);
    players.forEach(player => {
        player.clients.forEach(clientId => clientStore.send(clientId, message));
    });
}
