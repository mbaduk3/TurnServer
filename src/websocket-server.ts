import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import {
    TurnBasedProtocolServer,
    ResponseMessage,
    Client,
} from './turn-based-server/types.ts';
import TurnBasedServer from './turn-based-server/server.ts';
import { ClientStore } from './client-store/types.ts';

interface IdentifiedWebSocket extends WebSocket {
    id: string;
}

interface PartialIdentitfiedWebSocket extends WebSocket {
    id?: string;
}

export default class TurnBasedWebSocketServer extends TurnBasedProtocolServer {

    httpServer:HttpServer;
    webSocketServer:WebSocketServer;
    webSockets: { [key: string]: IdentifiedWebSocket };
    port:number;

    constructor(server:TurnBasedServer, httpServer:HttpServer, clientStore:ClientStore) {
        super(server, clientStore);
        this.port = process.env.PORT ? parseInt(process.env.PORT) : 8080;
        this.httpServer = httpServer;
        this.webSocketServer = new WebSocketServer({ server: this.httpServer });
        this.webSockets = {};

        this.httpServer.listen(this.port);

        this.webSocketServer.on('connection', (ws: WebSocket) => {
            try {
                console.log(`New connection: ${ws.url}`);
                this.identifyWebSocket(ws);
                ws.on('message', (data:string) => this.onWsMessage(ws, data));
                ws.on('close', (code:number, reason:string, wasClean:boolean) => this.onWsClose(ws, code, reason, wasClean));
                ws.on('error', this.onWsError);
            } catch (error) {
                console.error("WS-Server error: ", error);
            }
        });
    }

    onWsMessage(ws:WebSocket, data:string) {
        this.identifyWebSocket(ws);
        this.server.handleMessage((ws as IdentifiedWebSocket).id, data);
    }

    onWsClose(ws: WebSocket, code:number, reason:string, wasClean:boolean) {
        let id = "unknown-id";
        if ((ws as IdentifiedWebSocket).id) {
            const idWs = ws as IdentifiedWebSocket;
            id = idWs.id;
            this.clientStore.delete(id);
            this.server.handleDisconnect(id);
            delete this.webSockets[id];
            delete (ws as PartialIdentitfiedWebSocket).id
        }
        const codeStr = code ? code : 'none';
        const reasonStr = reason ? reason : 'none';
        const cleanStr = wasClean ? 'cleanly' : 'uncleanly';
        console.warn(`Connection to ${id} was ${cleanStr} closed with code ${codeStr} and reason: ${reasonStr}`);
    }

    onWsError(error:Event) {
        console.error("An error occured: ");
        console.error(error);
    }

    public sendMessageToClient(clientId: string, message:ResponseMessage): void {
        const clientWebSocket = this.webSockets[clientId];
        if (!clientWebSocket) {
            console.error(`Could not send message to ${clientId}; client not found`);
            return;
        }
        try {
            clientWebSocket.send(JSON.stringify(message));
        } catch (error) {
            console.error(`Could not send message to ${clientId} at ${clientWebSocket.url}`, error);
        }
    }

    identifyWebSocket(ws:WebSocket) {
        if ((ws as PartialIdentitfiedWebSocket).id) return;
        let newId = "";
        while (newId === "" || this.clientStore.has(newId)) {
            newId = uuidv4();
        }
        const newClient:Client = {
            id: newId,
            protocolServer: this,
        }
        this.clientStore.add(newClient);
        (ws as IdentifiedWebSocket).id = newId;
        this.webSockets[newId] = (ws as IdentifiedWebSocket);
        console.log(`Identified ${ws.url} as ${newId}`);
    }
}