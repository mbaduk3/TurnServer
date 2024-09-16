import { createServer } from "http";
import { waitForSocketState, createSocketClient } from "./utils/testUtils";
import waitForExpect from "wait-for-expect";
import DictClientStore from "../src/client-store/dict-client-store";
import TurnBasedWebSocketServer from "../src/websocket-server";
import TurnBasedServer from "../src/turn-based-server/server";
import { ResponseType } from "../src/turn-based-server/types";

jest.mock("../src/turn-based-server/server");

const PORT = process.env.PORT || 8080;

describe("test basic ws server function", () => {
    
    let httpServer;
    let turnBasedServer;
    let webSocketServer;
    let clientStore;
    let logSpy;
    let errorSpy;

    beforeAll(async () => {
        logSpy = jest.spyOn(global.console, "log");
        errorSpy = jest.spyOn(global.console, "error");
    });

    beforeEach(() => {
        httpServer = createServer();
        clientStore = new DictClientStore();
        turnBasedServer = new TurnBasedServer();
        webSocketServer = new TurnBasedWebSocketServer(turnBasedServer, httpServer, clientStore);
        TurnBasedServer.mockReset();
        logSpy = jest.spyOn(global.console, "log");
        errorSpy = jest.spyOn(global.console, "error");
    });

    afterAll(() => {
        httpServer.close();
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
        httpServer.close();
    });

    test("connect to server", async () => {
        let [client, messages] = await createSocketClient(PORT, 1);
        await waitForSocketState(client, client.OPEN);
        client.ping("Hello");
        await waitForSocketState(client, client.CLOSED);
        let [responseMessage] = messages;
        expect(logSpy.mock.calls[1][0].startsWith("Identified undefined as")).toBeTruthy();
        expect(responseMessage).toBe("Hello");
        client.close();
    });

    test("ws close client", async () => {
        let [client, messages] = await createSocketClient(PORT, 1);
        await waitForSocketState(client, client.OPEN);
        client.close();
        await waitForSocketState(client, client.CLOSED);
        expect(logSpy.mock.calls[2][0]).toBe("Connection uncleanly closed with code 1005 and reason: ");
    });

    test("send simple json message", async () => {
        let [client, messages] = await createSocketClient(PORT, 1);
        await waitForSocketState(client, client.OPEN);
        client.send(JSON.stringify({key: "value"}));
        await waitForExpect(() => {
            expect(logSpy.mock.calls[1][0].startsWith("Identified undefined as")).toBeTruthy();
        });
        client.close();
        await waitForSocketState(client, client.CLOSED);
    });

    test("send message to non-existent client", async () => {
        const message = {
            type: ResponseType.CREATE_SUCCESS
        }
        webSocketServer.sendMessageToClient("fake-client", message);
        await waitForExpect(() => {
            expect(errorSpy.mock.calls[0][0]).toBe("Could not send message to fake-client; client not found");
        });
    });

    test("send message to client", async () => {
        let [client, messages] = await createSocketClient(PORT, 1);
        await waitForSocketState(client, client.OPEN);
        expect(logSpy.mock.calls[1][0].startsWith("Identified undefined as")).toBeTruthy();

        const message = {
            type: ResponseType.CREATE_SUCCESS,
        }
        const clientId = logSpy.mock.calls[1][0].slice(-36);
        webSocketServer.sendMessageToClient(clientId, message);

        await waitForSocketState(client, client.CLOSED);
        expect(JSON.parse(messages[0])).toEqual(message);
    });

});
