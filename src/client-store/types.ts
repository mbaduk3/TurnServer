import { Client, ResponseMessage } from "../turn-based-server/types";

export interface ClientStore {
    // get(clientId: string): Client;
    has(clientId: string): boolean;
    add(client: Client): void;
    delete(clientId: string): void;
    send(clientId: string, message: ResponseMessage): void;
}