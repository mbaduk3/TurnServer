import { Room } from "../turn-based-server/types";

export interface RoomStore {
    get(key: string): Room;
    has(key: string): boolean;
    put(room: Room): void;
    delete(key: string): void;
    getClientRoom(clientId: string): Room;
    getClientPlayerName(clientId: string): string;
}