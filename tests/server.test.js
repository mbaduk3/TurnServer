import TurnBasedServer from "../src/turn-based-server/server";
import { RequestType, ResponseType } from "../src/turn-based-server/types";
import DictClientStore from "../src/client-store/dict-client-store";
import DictRoomStore from "../src/room-store/dict-room-store";
import NoOpDB from "../src/db-proxy/noop-db";
import TurnBasedWebSocketServer from "../src/websocket-server";
import CoupServer from "../src/game-logic/coup/coup-server";
import { createAndAddNServerClients, createAndJoinNPlayers } from "./utils/testUtils";

jest.mock("../src/websocket-server");
jest.mock("../src/game-logic/coup/coup-server");

describe("test basic turn-based server functions", () => {

    let server;
    let clientStore;
    let dbProxy;
    let roomStore;
    let wsServerMock;
    let coupServerMock;
    let logSpy;
    let errorSpy;

    beforeAll(async () => {
        logSpy = jest.spyOn(global.console, "log");
        errorSpy = jest.spyOn(global.console, "error");
    });

    beforeEach(() => {
        clientStore = new DictClientStore();
        roomStore = new DictRoomStore();
        dbProxy = new NoOpDB();
        coupServerMock = new CoupServer();
        coupServerMock.listeners = {};
        server = new TurnBasedServer(clientStore, roomStore, dbProxy, coupServerMock);
        logSpy = jest.spyOn(global.console, "log");
        errorSpy = jest.spyOn(global.console, "error");

        TurnBasedWebSocketServer.mockClear();
        wsServerMock = new TurnBasedWebSocketServer();
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test("send invalid json message", async () => {
        clientStore.add({id: "someId", protocolServer: wsServerMock});
        server.handleMessage("someId", "invalidJson");

        const expectedResponse = {
            type: ResponseType.INVALID_MESSAGE,
        }
        expect(wsServerMock.sendMessageToClient).toHaveBeenCalledWith("someId", expectedResponse);
    });

    test("send invalid message type", async () => {
        clientStore.add({id: "someId", protocolServer: wsServerMock});
        const invalidMessage = {
            type: "invalidType",
        }
        server.handleMessage("someId", JSON.stringify(invalidMessage));

        const expectedResponse = {
            type: ResponseType.INVALID_MESSAGE,
        }
        expect(wsServerMock.sendMessageToClient).toHaveBeenCalledWith("someId", expectedResponse);
    });

    test("test ping", async () => {
        const clientId = "someId";
        clientStore.add({id: clientId, protocolServer: wsServerMock});
        const pingMessage = {
            type: RequestType.PING,
        }
        server.handleMessage(clientId, JSON.stringify(pingMessage));

        const expectedResponse = {
            type: ResponseType.PONG,
        }
        expect(wsServerMock.sendMessageToClient).toHaveBeenCalledWith(clientId, expectedResponse);
    });

    test("test invalid message", async () => {
        const clientId = "someId";
        clientStore.add({id: clientId, protocolServer: wsServerMock});
        const invalidMessage = {
            type: "invalid_message"
        }
        server.handleMessage(clientId, JSON.stringify(invalidMessage));

        const expectedResponse = {
            type: ResponseType.INVALID_MESSAGE,
        }
        expect(wsServerMock.sendMessageToClient).toHaveBeenCalledWith(clientId, expectedResponse);
    });

    test("test create room", async () => {
        const clientId = "someId";
        clientStore.add({id: clientId, protocolServer: wsServerMock});
        const createMessage = {
            type: RequestType.CREATE,
            data: {
                name: "max"
            }
        }
        server.handleMessage(clientId, JSON.stringify(createMessage));

        const expectedResponse = {
            type: ResponseType.ROOM_STATE,
            data: {
                key: expect.any(String),
                players: ["max"],
                started: false,
            }
        }
        expect(wsServerMock.sendMessageToClient).toHaveBeenCalledWith(clientId, expectedResponse);
    });

    test("test create no name", async () => {
        const clientId = "someId";
        clientStore.add({id: clientId, protocolServer: wsServerMock});
        const createMessage = {
            type: RequestType.CREATE,
            data: {}
        }
        server.handleMessage(clientId, JSON.stringify(createMessage));

        const expectedResponse = {
            type: ResponseType.INVALID_MESSAGE,
        }
        expect(wsServerMock.sendMessageToClient).toHaveBeenCalledWith(clientId, expectedResponse);
    });

    test("test create two rooms in a row", async () => {
        const clientId = "someId";
        clientStore.add({id: clientId, protocolServer: wsServerMock});
        const createMessage = {
            type: RequestType.CREATE,
            data: {
                name: "max"
            }
        }
        server.handleMessage(clientId, JSON.stringify(createMessage));

        const expectedResponse1 = {
            type: ResponseType.ROOM_STATE,
            data: {
                key: expect.any(String),
                players: ["max"],
                started: false,
            }
        }
        expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(1, clientId, expectedResponse1);

        const expectedResponse2 = {
            type: ResponseType.NOT_IN_ROOM,
        }

        server.handleMessage(clientId, JSON.stringify(createMessage));
        expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(2, clientId, expectedResponse2);
        expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(3, clientId, expectedResponse1);
    });

    test("test join existing room", async () => {
        const [clientIds, calledCounter] = createAndJoinNPlayers(3, server, wsServerMock, clientStore);
    });

    test("test remove client in a room", async () => {
        const [clientId1] = createAndAddNServerClients(1, wsServerMock, clientStore); 
        const createMessage = {
            type: RequestType.CREATE,
            data: {
                name: "max"
            }
        }
        server.handleMessage(clientId1, JSON.stringify(createMessage));
        const expectedResponse1 = {
            type: ResponseType.ROOM_STATE,
            data: {
                started: false,
                key: expect.any(String),
                players: ["max"],
            }
        }
        expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(1, clientId1, expectedResponse1);
        
        server.handleDisconnect(clientId1);
        expect(clientStore.has("client1")).toBe(false);
        expect(roomStore.getClientRoom("client1")).toBe(undefined);
    });

    test("test join room while in room", async () => {
        const [clientId1] = createAndAddNServerClients(1, wsServerMock, clientStore);
        const createMessage = {
            type: RequestType.CREATE,
            data: {
                name: "max"
            }
        }
        server.handleMessage(clientId1, JSON.stringify(createMessage));
        const expectedResponse1 = {
            type: ResponseType.ROOM_STATE,
            data: {
                started: false,
                key: expect.any(String),
                players: ["max"],
            }
        }
        expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(1, clientId1, expectedResponse1);
        
        const roomKey = wsServerMock.sendMessageToClient.mock.calls[0][1].data.key;
        const joinMessage = {
            type: RequestType.JOIN,
            data: {
                name: "max",
                key: roomKey,
            }
        }
        const expectedResponse2 = {
            type: ResponseType.NOT_IN_ROOM,
        }
        server.handleMessage(clientId1, JSON.stringify(joinMessage));
        expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(2, clientId1, expectedResponse2);
        expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(3, clientId1, expectedResponse1);
    });

    test("test join no name", async () => {
        const [clientId1, clientId2] = createAndAddNServerClients(2, wsServerMock, clientStore);
        const createMessage = {
            type: RequestType.CREATE,
            data: {
                name: "max",
            }
        }
        server.handleMessage(clientId1, JSON.stringify(createMessage));
        const expectedResponse1 = {
            type: ResponseType.ROOM_STATE,
            data: {
                started: false,
                key: expect.any(String),
                players: ["max"],
            }
        }
        expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(1, clientId1, expectedResponse1);

        const roomKey = wsServerMock.sendMessageToClient.mock.calls[0][1].data.key;
        const joinMessage = {
            type: RequestType.JOIN,
            data: {
                key: roomKey,
            }
        }
        server.handleMessage(clientId2, JSON.stringify(joinMessage));
        const expectedResponse2 = {
            type: ResponseType.INVALID_MESSAGE,
        }
        expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(2, clientId2, expectedResponse2);
    });

    test("test join no key", async () => {
        const [clientId1, clientId2] = createAndAddNServerClients(2, wsServerMock, clientStore);
        const createMessage = {
            type: RequestType.CREATE,
            data: {
                name: "max",
            }
        }
        server.handleMessage(clientId1, JSON.stringify(createMessage));
        const expectedResponse1 = {
            type: ResponseType.ROOM_STATE,
            data: {
                started: false,
                key: expect.any(String),
                players: ["max"],
            }
        }
        expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(1, clientId1, expectedResponse1);

        const joinMessage = {
            type: RequestType.JOIN,
            data: {
                name: "alex",
            }
        }
        server.handleMessage(clientId2, JSON.stringify(joinMessage));
        const expectedResponse2 = {
            type: ResponseType.INVALID_MESSAGE,
        }
        expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(2, clientId2, expectedResponse2);
    });

    test("test join non-existent room", async () => {
        const [clientId1] = createAndAddNServerClients(1, wsServerMock, clientStore);
        const joinMessage = {
            type: RequestType.JOIN,
            data: {
                name: "alex",
                key: "fake-key"
            }
        }
        server.handleMessage(clientId1, JSON.stringify(joinMessage));
        const expectedResponse2 = {
            type: ResponseType.JOIN_FAILURE,
            data: {
                message: "Room does not exist",
            }
        }
        expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(1, clientId1, expectedResponse2);
    });

    test("test start room", async () => {
        const numPlayers = 2;
        const [clientIds, calledCounter] = createAndJoinNPlayers(numPlayers, server, wsServerMock, clientStore);
        const startMessage = {
            type: RequestType.START,
        }
        server.handleMessage(clientIds[0], JSON.stringify(startMessage));
        const expectedResponse4 = {
            type: ResponseType.ROOM_STATE,
            data: {
                started: true,
                key: expect.any(String),
                players: ["player_0", "player_1"],
                state: undefined,
            }
        }
        for (let i = 0; i < numPlayers; i++) {
            expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(calledCounter + i, clientIds[i], expectedResponse4);
        }
    });

    test("start not in room", async () => {
        const [clientId] = createAndAddNServerClients(1, wsServerMock, clientStore);
        const startMessage = {
            type: RequestType.START,
        }
        server.handleMessage(clientId, JSON.stringify(startMessage));

        const expectedResponse = {
            type: ResponseType.START_FAILURE,
            data: {
                message: "Not currently in a room",
            }
        }
        expect(wsServerMock.sendMessageToClient).toHaveBeenCalledWith(clientId, expectedResponse);
    });

    test("test start room twice", async () => {
        let calledCounter;
        let clientIds;
        [clientIds, calledCounter] = createAndJoinNPlayers(2, server, wsServerMock, clientStore);

        const startMessage = {
            type: RequestType.START,
        }
        server.handleMessage(clientIds[0], JSON.stringify(startMessage));
        const expectedResponse4 = {
            type: ResponseType.ROOM_STATE,
            data: {
                started: true,
                key: expect.any(String),
                players: ["player_0", "player_1"],
            }
        }
        for (let i = 0; i < 2; i++) {
            expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(calledCounter++, clientIds[i], expectedResponse4);
        }
        const expectedResponse5 = {
            type: ResponseType.GAME_STATE,
            data: undefined,
        } 
        for (let i = 0; i < 2; i++) {
            expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(calledCounter++, clientIds[i], expectedResponse5); 
        }

        server.handleMessage(clientIds[0], JSON.stringify(startMessage));
        const expectedResponse6 = {
            type: ResponseType.START_FAILURE,
            data: {
                message: "Game already started",
            }
        }
        expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(calledCounter++, clientIds[0], expectedResponse6);
    });

    test("test action", async () => {
        let calledCounter;
        let clientIds;
        [clientIds, calledCounter] = createAndJoinNPlayers(2, server, wsServerMock, clientStore);

        const startMessage = {
            type: RequestType.START,
        }
        server.handleMessage(clientIds[0], JSON.stringify(startMessage));
        const expectedResponse4 = {
            type: ResponseType.ROOM_STATE,
            data: {
                started: true,
                key: expect.any(String),
                players: ["player_0", "player_1"],
            }
        }
        for (let i = 0; i < 2; i++) {
            expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(calledCounter++, clientIds[i], expectedResponse4);
        }

        const actionMessage = {
            type: RequestType.ACTION,
        }
        server.handleMessage(clientIds[0], JSON.stringify(actionMessage));
    });

    // test("test action not in room", async () => {
    //     const clientId = "someId";
    //     clientStore.add({id: clientId, protocolServer: wsServerMock});

    //     const actionMessage = {
    //         type: RequestType.ACTION,
    //         data: {
    //             actionType: "someAction"
    //         }
    //     }
    //     server.handleMessage(clientId, JSON.stringify(actionMessage));
    //     const expectedResponse = {
    //         type: ResponseType.ACTION_FAILURE,
    //         data: {
    //             message: "Not currently in a room",
    //         }
    //     }
    //     expect(wsServerMock.sendMessageToClient).toHaveBeenCalledWith(clientId, expectedResponse);
    // });

    // test("test action game not started", async () => {
    //     const clientId = "someId";
    //     clientStore.add({id: clientId, protocolServer: wsServerMock});
    //     const createMessage = {
    //         type: RequestType.CREATE,
    //         data: {
    //             name: "max"
    //         }
    //     }
    //     server.handleMessage(clientId, JSON.stringify(createMessage));

    //     const expectedResponse1 = {
    //         type: ResponseType.CREATE_SUCCESS,
    //         data: {
    //             key: expect.any(String)
    //         }
    //     }
    //     expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(1, clientId, expectedResponse1);

    //     const actionMessage = {
    //         type: RequestType.ACTION,
    //         data: {
    //             actionType: "someAction"
    //         }
    //     }
    //     server.handleMessage(clientId, JSON.stringify(actionMessage));
    //     const expectedResponse2 = {
    //         type: ResponseType.ACTION_FAILURE,
    //         data: {
    //             message: "Game has not started",
    //         }
    //     }
    //     expect(wsServerMock.sendMessageToClient).toHaveBeenNthCalledWith(2, clientId, expectedResponse2);

    // });

});