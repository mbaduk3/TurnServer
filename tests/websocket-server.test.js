import { createServer } from "http";
import { waitForSocketState, createSocketClient } from "./utils/testUtils";
import waitForExpect from "wait-for-expect";
import DictClientStore from "../src/client-store/dict-client-store";
import TurnBasedWebSocketServer from "../src/websocket-server";
import TurnBasedServer from "../src/turn-based-server/server";
import { ResponseType } from "../src/turn-based-server/types";
import logger from "../src/logger";

jest.mock("../src/turn-based-server/server");

const PORT = process.env.PORT || 8080;

describe("test basic ws server function", () => {
    
    let httpServer;
    let turnBasedServer;
    let webSocketServer;
    let clientStore;
    let infoSpy;
    let errorSpy;

    beforeAll(async () => {
        infoSpy = jest.spyOn(logger, "info");
        errorSpy = jest.spyOn(logger, "error");
    });

    beforeEach(() => {
        httpServer = createServer();
        clientStore = new DictClientStore();
        turnBasedServer = new TurnBasedServer();
        webSocketServer = new TurnBasedWebSocketServer(turnBasedServer, httpServer, clientStore);
        TurnBasedServer.mockReset();
        infoSpy.mockClear();
        errorSpy.mockClear();
    });

    afterAll(() => {
        httpServer.close();
        infoSpy.mockRestore();
        errorSpy.mockRestore();
    });

    afterEach(() => {
        httpServer.close();
    });

    test("connect to server", async () => {
        let [client, messages] = await createSocketClient(PORT, 1);
        await waitForSocketState(client, client.OPEN);
        client.ping("Hello");
        await waitForSocketState(client, client.CLOSED);
        let [responseMessage] = messages;
        expect(infoSpy.mock.calls[1][0]).toContain("Identified undefined as");
        expect(responseMessage).toBe("Hello");
        client.close();
    });

    test("ws close client", async () => {
        let [client, messages] = await createSocketClient(PORT, 1);
        await waitForSocketState(client, client.OPEN);
        client.close();
        await waitForSocketState(client, client.CLOSED);
        expect(infoSpy.mock.calls[2][0]).toContain("closed with code 1005 and reason:");
    });

    test("send simple json message", async () => {
        let [client, messages] = await createSocketClient(PORT, 1);
        await waitForSocketState(client, client.OPEN);
        client.send(JSON.stringify({key: "value"}));
        await waitForExpect(() => {
            expect(infoSpy.mock.calls[1][0]).toContain("Identified undefined as");
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
            expect(errorSpy.mock.calls[0][0]).toContain("Could not send message to fake-client; client not found");
        });
    });

    test("send message to client", async () => {
        let [client, messages] = await createSocketClient(PORT, 1);
        await waitForSocketState(client, client.OPEN);
        expect(infoSpy.mock.calls[1][0]).toContain("Identified undefined as");

        const message = {
            type: ResponseType.CREATE_SUCCESS,
        }
        const logMessage = infoSpy.mock.calls[1][0];
        const clientId = logMessage.slice(-36);
        webSocketServer.sendMessageToClient(clientId, message);

        await waitForSocketState(client, client.CLOSED);
        expect(JSON.parse(messages[0])).toEqual(message);
    });

});
