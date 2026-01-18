import { Client, ResponseMessage } from "../turn-based-server/types";
import { ClientStore } from "./types";
import logger from "../logger.ts";

export default class DictClientStore implements ClientStore {

    clientStore: { [key:string]: Client };

    constructor() {
        this.clientStore = {};
    }

    add(client: Client): void {
       const existingClient = this.clientStore[client.id]; 
       if (existingClient) throw new Error(`Client with id: ${client.id} already exists`);
       this.clientStore[client.id] = client;
    }

    has(clientId: string): boolean {
        return clientId in this.clientStore;
    }

    // get(clientId: string): Client {
    //     return this.clientStore[clientId]; 
    // }

    delete(clientId: string): void {
        delete this.clientStore[clientId]; 
    }

    send(clientId: string, message: ResponseMessage): void {
        const client:Client = this.clientStore[clientId];
        if (!client) {
            logger.error(`client with id ${clientId} was not found in the clientStore`);
            return;
        }
        this.clientStore[clientId].protocolServer.sendMessageToClient(clientId, message);
    }
}