import { createServer, Server as HttpServer } from "http";
import TurnBasedServer from "./turn-based-server/server.ts";
import TurnBasedWebSocketServer from "./websocket-server.ts";
import CoupServer from "./game-logic/coup/coup-server.ts";
import { RoomStore } from "./room-store/types.ts";
import DictRoomStore from "./room-store/dict-room-store.ts";
import { ClientStore } from "./client-store/types.ts";
import DictClientStore from "./client-store/dict-client-store.ts";
import { DBProxy } from "./db-proxy/types.ts";
import LocalDB from "./db-proxy/local-db.ts";

const httpServer:HttpServer = createServer(); 
const roomStore:RoomStore = new DictRoomStore();
const clientStore:ClientStore = new DictClientStore();
const dbProxy:DBProxy = new LocalDB();
const coupServer = new CoupServer();
const turnBasedServer:TurnBasedServer = new TurnBasedServer(clientStore, roomStore, dbProxy, coupServer);
new TurnBasedWebSocketServer(turnBasedServer, httpServer, clientStore);