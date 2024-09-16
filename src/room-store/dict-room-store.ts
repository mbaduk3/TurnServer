import { Room } from "../turn-based-server/types";
import { RoomStore } from "./types";

interface ClientLookupMap {
    [clientId: string]: {
        roomKey: string,
        playerName: string,
    }
}

export default class DictRoomStore implements RoomStore {

    roomStore: { [key:string]: Room };
    clientLookupMap: ClientLookupMap;

    constructor() {
        this.roomStore = {};
        this.clientLookupMap = {};
    }

    put(room: Room): void {
        const prevRoom = this.roomStore[room.key];
        if (prevRoom) {
            const playersNoLongerInRoom = Object.keys(prevRoom.players).filter(playerName => {
                return !Object.keys(room.players).includes(playerName)
            });
            playersNoLongerInRoom.forEach(playerName => {
                const player = room.players[playerName];
                player.clients.forEach(clientId => {
                    delete this.clientLookupMap[clientId];
                });
            });
        }
        this.roomStore[room.key] = room;
        Object.values(room.players).forEach(player => {
            player.clients.forEach(clientId => {
                this.clientLookupMap[clientId] = {
                    roomKey: room.key,
                    playerName: player.name,
                }
            });
        });
    }

    has(key: string): boolean {
        return key in this.roomStore;
    }

    get(key: string): Room {
        const room = this.roomStore[key];
        return room ? {...room} : undefined;
    }

    delete(key: string): void {
        const room:Room = this.roomStore[key];
        if (room) {
            Object.values(room.players).forEach(player => {
                player.clients.forEach(clientId => {
                    delete this.clientLookupMap[clientId];
                });
            });
        }
        delete this.roomStore[key]; 
    }

    getClientRoom(clientId: string): Room {
        return this.roomStore[this.clientLookupMap[clientId]?.roomKey];
    }

    getClientPlayerName(clientId: string): string {
        return this.clientLookupMap[clientId].playerName;
    }
}