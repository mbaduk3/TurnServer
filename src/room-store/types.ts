import { Player, Room } from "../turn-based-server/types";

export interface RoomStore {
    get(key: string): Room;
    has(key: string): boolean;
    put(room: Room): void;
    delete(key: string): void;
    deletePlayer(player: Player): void;
    getClientRoom(clientId: string): Room;
    getClientPlayerName(clientId: string): string;
    addClientToPlayer(clientId:string, player:Player): void;
    removeClient(clientId: string): void;
}