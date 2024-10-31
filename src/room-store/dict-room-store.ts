import { Player, Room } from "../turn-based-server/types";
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
               this.deletePlayer(player); 
            });
        }
        delete this.roomStore[key]; 
    }

    deletePlayer(player:Player): void {
        player.clients.forEach(clientId => {
            delete this.clientLookupMap[clientId];
        });
        const room:Room = this.roomStore[player.roomId];
        if (room) {
            delete room.players[player.name];
            this.put(room);
        }
    }

    getClientRoom(clientId: string): Room {
        return this.roomStore[this.clientLookupMap[clientId]?.roomKey];
    }

    getClientPlayerName(clientId: string): string {
        return this.clientLookupMap[clientId]?.playerName;
    }

    addClientToPlayer(clientId: string, player: Player): void {
        player.clients = player.clients.filter(x => x !== clientId);
        player.clients.push(clientId);
        const room:Room = this.roomStore[player.roomId];
        this.clientLookupMap[clientId] = {
            roomKey: room.key,
            playerName: player.name,
        }
        this.put(room);
    }

    removeClient(clientId: string):void {
        const room = this.getClientRoom(clientId);
        const playerName = this.getClientPlayerName(clientId);
        if (!room || !playerName) {
            console.warn(`No room/player found for clientId: ${clientId}`);
            return;
        }
        const player = room.players[playerName];
        if (!player) {
            console.warn(`No player found for clientId: ${clientId}`);
            return;
        }
        player.clients = player.clients.filter(id => id != clientId);
        delete this.clientLookupMap[clientId];
        this.put(room);
    }
}