// import { RequestType, ResponseType } from "../../src/turn-based-server/types";
import { createAndJoinNPlayers } from "../utils/testUtils";
// import { startCoupGame } from "../utils/coupTestUtils";
import DictClientStore from "../../src/client-store/dict-client-store";
import DictRoomStore from "../../src/room-store/dict-room-store";
import CoupServer from "../../src/coup/coup-server";
import TurnBasedWebSocketServer from "../../src/websocket-server";
import { initCoupGame, startCoupGame } from "../utils/coupTestUtils";
import { CARD_TYPES, COUP_PLAY_STATE, COUP_PLAY_STATE_V2, COUP_PRIMARY_ACTION_TYPE, COUP_SECONDARY_ACTION_TYPE } from "../../src/coup/types";

jest.mock("../../src/websocket-server");

describe("test coup server functions", () => {

    let server;
    let wsServerMock;
    let clientStore;
    let roomStore;
    let logSpy;
    let errorSpy;

    beforeAll(async () => {
        logSpy = jest.spyOn(global.console, "log");
        errorSpy = jest.spyOn(global.console, "error");
    });

    beforeEach(() => {
        clientStore = new DictClientStore();
        roomStore = new DictRoomStore();
        server = new CoupServer(clientStore, roomStore);
        logSpy = jest.spyOn(global.console, "log");
        errorSpy = jest.spyOn(global.console, "error");

        TurnBasedWebSocketServer.mockClear();
        wsServerMock = new TurnBasedWebSocketServer();
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test("start game", async () => {
        let [clientIds, currentCount] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);
    });

    test("income action success", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const incomeMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.INCOME,
        }
        server.handleMessage(clientIds[0], JSON.stringify(incomeMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
        }
        expectedState.players["player_0"].coins = 1;

        expect(server.roomStore.get(roomKey)).toEqual(expectedState);
    });

    test("coup action", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].coins = 10;
        server.roomStore.put(preloadedState);

        const coupMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.COUP,
            details: {
                target: "player_1",
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(coupMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 0,
            currentPrimaryActor: expectedState.players["player_0"],
            currentDiscardingActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.DISCARD,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(3);
    });

    test("coup action succeeds", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        let preloadedState = server.roomStore.get(roomKey);
        preloadedState = {
            ...preloadedState,
            currentDiscardingActor: preloadedState.players["player_1"],
            currentPrimaryActor: preloadedState.players["player_0"],
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.DISCARD,
        }
        const coupMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.COUP,
            details: {
                target: "player_1",
            }
        }
        preloadedState.players["player_0"].coins = 3;
        preloadedState.players["player_0"].currentPrimaryAction = coupMessage;
        server.roomStore.put(preloadedState);

        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: preloadedState.players["player_1"].hand[0],
            }
        }
        server.handleMessage(clientIds[1], JSON.stringify(revealMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_1"].hand.length).toBe(1);
        expect(actualState.players["player_0"].coins).toBe(3);
    });

    test("assasinate action", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].coins = 5;
        server.roomStore.put(preloadedState);

        const assasinateMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: {
                target: "player_1",
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(assasinateMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 0,
            currentPrimaryActor: expectedState.players["player_0"],
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].currentPrimaryAction.type).toBe(COUP_PRIMARY_ACTION_TYPE.ASSASINATE);
    });

    test("assasinate action challenge (from target) fails double elimination", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].coins = 5;
        preloadedState.players["player_0"].hand = [CARD_TYPES.ASSASIN, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].hand = [CARD_TYPES.DUKE, CARD_TYPES.DUKE];
        server.roomStore.put(preloadedState);

        const assasinateMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: {
                target: "player_1",
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(assasinateMessage));

        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        server.handleMessage(clientIds[1], JSON.stringify(challengeMessage));
        
        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.ASSASIN,
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(revealMessage));

        const discardMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.DUKE, 
            }
        }
        server.handleMessage(clientIds[1], JSON.stringify(discardMessage));
        server.handleMessage(clientIds[1], JSON.stringify(discardMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 2,
            currentPrimaryActor: expectedState.players["player_2"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(2);
        expect(actualState.players["player_0"].hand.length).toBe(2);
        expect(actualState.players["player_1"].hand.length).toBe(0);
    });

    test("assasinate action challenge (from target with only 1 card) fails double elimination", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].coins = 5;
        preloadedState.players["player_0"].hand = [CARD_TYPES.ASSASIN, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].hand = [CARD_TYPES.DUKE];
        server.roomStore.put(preloadedState);

        const assasinateMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: {
                target: "player_1",
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(assasinateMessage));

        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        server.handleMessage(clientIds[1], JSON.stringify(challengeMessage));
        
        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.ASSASIN,
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(revealMessage));

        const discardMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.DUKE, 
            }
        }
        server.handleMessage(clientIds[1], JSON.stringify(discardMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 2,
            currentPrimaryActor: expectedState.players["player_2"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(2);
        expect(actualState.players["player_0"].hand.length).toBe(2);
        expect(actualState.players["player_1"].hand.length).toBe(0);
    });

    test("assasinate action challenge (not from target) fails", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].coins = 5;
        preloadedState.players["player_0"].hand = [CARD_TYPES.ASSASIN, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].hand = [CARD_TYPES.DUKE, CARD_TYPES.DUKE];
        preloadedState.players["player_2"].hand = [CARD_TYPES.CONTESSA, CARD_TYPES.CONTESSA];
        server.roomStore.put(preloadedState);

        const assasinateMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: {
                target: "player_1",
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(assasinateMessage));

        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        server.handleMessage(clientIds[2], JSON.stringify(challengeMessage));
        
        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.ASSASIN,
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(revealMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 0,
            currentPrimaryActor: expectedState.players["player_0"],
            currentDiscardingActor: expectedState.players["player_2"],
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.DISCARD_ASSASINATE_CHALLENGE,
        }
        let actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);

        const discardMessageA = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.CONTESSA, 
            }
        }
        server.handleMessage(clientIds[2], JSON.stringify(discardMessageA));

        expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 0,
            currentPrimaryActor: expectedState.players["player_0"],
            currentDiscardingActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.DISCARD,
        }
        actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);

        const discardMessageB = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.DUKE, 
            }
        }
        server.handleMessage(clientIds[1], JSON.stringify(discardMessageB));

        expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(2);
        expect(actualState.players["player_0"].hand.length).toBe(2);
        expect(actualState.players["player_1"].hand.length).toBe(1);
        expect(actualState.players["player_2"].hand.length).toBe(1);
    });

    test("assasinate action block goes accepted", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].coins = 5;
        preloadedState.players["player_0"].hand = [CARD_TYPES.ASSASIN, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].hand = [CARD_TYPES.DUKE, CARD_TYPES.DUKE];
        server.roomStore.put(preloadedState);

        const assasinateMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: {
                target: "player_1",
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(assasinateMessage));

        const blockMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        server.handleMessage(clientIds[1], JSON.stringify(blockMessage));
        
        const acceptMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.ACCEPT,
        }
        server.handleMessage(clientIds[0], JSON.stringify(acceptMessage));
        server.handleMessage(clientIds[2], JSON.stringify(acceptMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(2);
        expect(actualState.players["player_0"].hand.length).toBe(2);
        expect(actualState.players["player_1"].hand.length).toBe(2);
        expect(actualState.players["player_2"].hand.length).toBe(2);
    });

    test("assasinate action block challenge (by primary) fails", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].coins = 5;
        preloadedState.players["player_0"].hand = [CARD_TYPES.ASSASIN, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].hand = [CARD_TYPES.CONTESSA, CARD_TYPES.CAPTAIN];
        server.roomStore.put(preloadedState);

        const assasinateMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: {
                target: "player_1",
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(assasinateMessage));

        const blockMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        server.handleMessage(clientIds[1], JSON.stringify(blockMessage));
        
        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        server.handleMessage(clientIds[0], JSON.stringify(challengeMessage));

        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.CONTESSA,
            }
        }
        server.handleMessage(clientIds[1], JSON.stringify(revealMessage));

        const discardMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.ASSASIN,
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(discardMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(2);
        expect(actualState.players["player_0"].hand.length).toBe(1);
        expect(actualState.players["player_1"].hand.length).toBe(2);
        expect(actualState.players["player_2"].hand.length).toBe(2);
    });

    test("assasinate action block challenge (by primary) succeeds", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].coins = 5;
        preloadedState.players["player_0"].hand = [CARD_TYPES.ASSASIN, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].hand = [CARD_TYPES.CAPTAIN, CARD_TYPES.CAPTAIN];
        server.roomStore.put(preloadedState);

        const assasinateMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: {
                target: "player_1",
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(assasinateMessage));

        const blockMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        server.handleMessage(clientIds[1], JSON.stringify(blockMessage));
        
        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        server.handleMessage(clientIds[0], JSON.stringify(challengeMessage));

        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.CAPTAIN,
            }
        }
        server.handleMessage(clientIds[1], JSON.stringify(revealMessage));
        server.handleMessage(clientIds[1], JSON.stringify(revealMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 2,
            currentPrimaryActor: expectedState.players["player_2"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(2);
        expect(actualState.players["player_0"].hand.length).toBe(2);
        expect(actualState.players["player_1"].hand.length).toBe(0);
        expect(actualState.players["player_2"].hand.length).toBe(2);
    });

    test("foreign aid action", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        server.roomStore.put(preloadedState);

        const foreignAidAction = {
            type: COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID,
        }
        server.handleMessage(clientIds[0], JSON.stringify(foreignAidAction));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 0,
            currentPrimaryActor: expectedState.players["player_0"],
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
    });

    test("foreign aid action succeeds (all accept)", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const foreignAidAction = {
            type: COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID,
        }
        server.handleMessage(clientIds[0], JSON.stringify(foreignAidAction));

        const acceptMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.ACCEPT,
        }
        server.handleMessage(clientIds[1], JSON.stringify(acceptMessage));
        server.handleMessage(clientIds[2], JSON.stringify(acceptMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(2);
        expect(actualState.players["player_0"].hand.length).toBe(2);
        expect(actualState.players["player_1"].hand.length).toBe(2);
        expect(actualState.players["player_2"].hand.length).toBe(2);
    });

    test("foreign aid action block succeeds (all accept)", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const foreignAidAction = {
            type: COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID,
        }
        server.handleMessage(clientIds[0], JSON.stringify(foreignAidAction));

        const blockMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        server.handleMessage(clientIds[1], JSON.stringify(blockMessage));

        const acceptMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.ACCEPT,
        }
        server.handleMessage(clientIds[0], JSON.stringify(acceptMessage));
        server.handleMessage(clientIds[2], JSON.stringify(acceptMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(0);
        expect(actualState.players["player_0"].hand.length).toBe(2);
        expect(actualState.players["player_1"].hand.length).toBe(2);
        expect(actualState.players["player_2"].hand.length).toBe(2);
    });

    test("foreign aid action block challenge succeeds", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].hand = [CARD_TYPES.ASSASIN, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].hand = [CARD_TYPES.CAPTAIN, CARD_TYPES.CAPTAIN];
        server.roomStore.put(preloadedState);

        const foreignAidAction = {
            type: COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID,
        }
        server.handleMessage(clientIds[0], JSON.stringify(foreignAidAction));

        const blockMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        server.handleMessage(clientIds[1], JSON.stringify(blockMessage));

        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        server.handleMessage(clientIds[0], JSON.stringify(challengeMessage));

        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.CAPTAIN,
            }
        }
        server.handleMessage(clientIds[1], JSON.stringify(revealMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(2);
        expect(actualState.players["player_0"].hand.length).toBe(2);
        expect(actualState.players["player_1"].hand.length).toBe(1);
        expect(actualState.players["player_2"].hand.length).toBe(2);
    });

    test("foreign aid action block challenge fails", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].hand = [CARD_TYPES.ASSASIN, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].hand = [CARD_TYPES.DUKE, CARD_TYPES.CAPTAIN];
        server.roomStore.put(preloadedState);

        const foreignAidAction = {
            type: COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID,
        }
        server.handleMessage(clientIds[0], JSON.stringify(foreignAidAction));

        const blockMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        server.handleMessage(clientIds[1], JSON.stringify(blockMessage));

        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        server.handleMessage(clientIds[0], JSON.stringify(challengeMessage));

        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.DUKE,
            }
        }
        server.handleMessage(clientIds[1], JSON.stringify(revealMessage));

        const discardMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.ASSASIN,
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(discardMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(0);
        expect(actualState.players["player_0"].hand.length).toBe(1);
        expect(actualState.players["player_1"].hand.length).toBe(2);
        expect(actualState.players["player_2"].hand.length).toBe(2);
    });

    test("steal action", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_1"].coins = 5;
        server.roomStore.put(preloadedState);

        const stealMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.STEAL,
            details: {
                target: "player_1"
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(stealMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 0,
            currentPrimaryActor: expectedState.players["player_0"],
        }

        expect(server.roomStore.get(roomKey)).toEqual(expectedState);
        expect(server.roomStore.get(roomKey).players["player_0"].currentPrimaryAction.type).toBe(COUP_PRIMARY_ACTION_TYPE.STEAL);
    });

    test("steal action challenge succeeds", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].hand = [CARD_TYPES.ASSASIN, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].coins = 5;
        server.roomStore.put(preloadedState);

        const stealMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.STEAL,
            details: {
                target: "player_1"
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(stealMessage));

        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        server.handleMessage(clientIds[1], JSON.stringify(challengeMessage));

        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.ASSASIN,
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(revealMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(0);
        expect(actualState.players["player_1"].coins).toBe(5);
        expect(actualState.players["player_0"].hand.length).toBe(1);
        expect(actualState.players["player_1"].hand.length).toBe(2);
        expect(actualState.players["player_2"].hand.length).toBe(2);
    });

    test("steal action challenge fails", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].hand = [CARD_TYPES.CAPTAIN, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].hand = [CARD_TYPES.AMBASSADOR, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].coins = 5;
        server.roomStore.put(preloadedState);

        const stealMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.STEAL,
            details: {
                target: "player_1"
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(stealMessage));

        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        server.handleMessage(clientIds[1], JSON.stringify(challengeMessage));

        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.CAPTAIN,
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(revealMessage));

        const discardMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.AMBASSADOR,
            }
        }
        server.handleMessage(clientIds[1], JSON.stringify(discardMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(2);
        expect(actualState.players["player_1"].coins).toBe(3);
        expect(actualState.players["player_0"].hand.length).toBe(2);
        expect(actualState.players["player_1"].hand.length).toBe(1);
        expect(actualState.players["player_2"].hand.length).toBe(2);
    });

    test("steal action block succeeds (all accept)", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].hand = [CARD_TYPES.CAPTAIN, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].hand = [CARD_TYPES.AMBASSADOR, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].coins = 5;
        server.roomStore.put(preloadedState);

        const stealMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.STEAL,
            details: {
                target: "player_1"
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(stealMessage));

        const blockMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        server.handleMessage(clientIds[1], JSON.stringify(blockMessage));

        const acceptMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.ACCEPT,
        }
        server.handleMessage(clientIds[0], JSON.stringify(acceptMessage));
        server.handleMessage(clientIds[2], JSON.stringify(acceptMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(0);
        expect(actualState.players["player_1"].coins).toBe(5);
        expect(actualState.players["player_0"].hand.length).toBe(2);
        expect(actualState.players["player_1"].hand.length).toBe(2);
        expect(actualState.players["player_2"].hand.length).toBe(2);
    });

    test("steal action block challenge succeeds", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].hand = [CARD_TYPES.CAPTAIN, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].hand = [CARD_TYPES.ASSASIN, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].coins = 5;
        server.roomStore.put(preloadedState);

        const stealMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.STEAL,
            details: {
                target: "player_1"
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(stealMessage));

        const blockMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        server.handleMessage(clientIds[1], JSON.stringify(blockMessage));

        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        server.handleMessage(clientIds[2], JSON.stringify(challengeMessage));

        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.ASSASIN,
            }
        }
        server.handleMessage(clientIds[1], JSON.stringify(revealMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(2);
        expect(actualState.players["player_1"].coins).toBe(3);
        expect(actualState.players["player_0"].hand.length).toBe(2);
        expect(actualState.players["player_1"].hand.length).toBe(1);
        expect(actualState.players["player_2"].hand.length).toBe(2);
    });

    test("steal action block challenge fails", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].hand = [CARD_TYPES.CAPTAIN, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].hand = [CARD_TYPES.AMBASSADOR, CARD_TYPES.ASSASIN];
        preloadedState.players["player_2"].hand = [CARD_TYPES.CONTESSA, CARD_TYPES.CONTESSA];
        preloadedState.players["player_1"].coins = 5;
        server.roomStore.put(preloadedState);

        const stealMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.STEAL,
            details: {
                target: "player_1"
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(stealMessage));

        const blockMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        server.handleMessage(clientIds[1], JSON.stringify(blockMessage));

        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        server.handleMessage(clientIds[2], JSON.stringify(challengeMessage));

        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.AMBASSADOR,
            }
        }
        server.handleMessage(clientIds[1], JSON.stringify(revealMessage));

        const discardMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.CONTESSA
            }
        }
        server.handleMessage(clientIds[2], JSON.stringify(discardMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(0);
        expect(actualState.players["player_1"].coins).toBe(5);
        expect(actualState.players["player_0"].hand.length).toBe(2);
        expect(actualState.players["player_1"].hand.length).toBe(2);
        expect(actualState.players["player_2"].hand.length).toBe(1);
    });

    test("swap action succeeds (all accept)", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].hand = [CARD_TYPES.AMBASSADOR, CARD_TYPES.ASSASIN];
        preloadedState.deck.push(CARD_TYPES.DUKE);
        preloadedState.deck.push(CARD_TYPES.CONTESSA);
        server.roomStore.put(preloadedState);

        const swapMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.SWAP,
        }
        server.handleMessage(clientIds[0], JSON.stringify(swapMessage));

        const acceptMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.ACCEPT,
        }
        server.handleMessage(clientIds[1], JSON.stringify(acceptMessage));
        server.handleMessage(clientIds[2], JSON.stringify(acceptMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 0,
            currentPrimaryActor: expectedState.players["player_0"],
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SWAP,
        }

        const actualStateA = server.roomStore.get(roomKey);
        expect(actualStateA).toEqual(expectedState);
        expect(actualStateA.players["player_0"].hand.length).toBe(4);

        const swapDecisionMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.SWAP_REVEAL,
            details: {
                cards: [CARD_TYPES.ASSASIN, CARD_TYPES.DUKE],
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(swapDecisionMessage));

        expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }
        const actualStateB = server.roomStore.get(roomKey);
        expect(actualStateB).toEqual(expectedState);
        expect(actualStateB.players["player_0"].hand.length).toBe(2);
        expect(actualStateB.players["player_1"].hand.length).toBe(2);
        expect(actualStateB.players["player_2"].hand.length).toBe(2);
        expect(actualStateB.players["player_0"].hand.includes(CARD_TYPES.ASSASIN)).toBe(true);
        expect(actualStateB.players["player_0"].hand.includes(CARD_TYPES.DUKE)).toBe(true);
    });

    test("swap action challenge fails", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].hand = [CARD_TYPES.AMBASSADOR, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].hand = [CARD_TYPES.CONTESSA, CARD_TYPES.CONTESSA];
        preloadedState.deck.push(CARD_TYPES.DUKE);
        preloadedState.deck.push(CARD_TYPES.CONTESSA);
        server.roomStore.put(preloadedState);

        const swapMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.SWAP,
        }
        server.handleMessage(clientIds[0], JSON.stringify(swapMessage));

        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        server.handleMessage(clientIds[1], JSON.stringify(challengeMessage));

        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.AMBASSADOR,
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(revealMessage));

        const discardMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.CONTESSA,
            }
        }
        server.handleMessage(clientIds[1], JSON.stringify(discardMessage));

        const swapDecisionMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.SWAP_REVEAL,
            details: {
                cards: [CARD_TYPES.ASSASIN, CARD_TYPES.DUKE],
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(swapDecisionMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }
        const actualStateB = server.roomStore.get(roomKey);
        expect(actualStateB).toEqual(expectedState);
        expect(actualStateB.players["player_0"].hand.length).toBe(2);
        expect(actualStateB.players["player_1"].hand.length).toBe(1);
        expect(actualStateB.players["player_2"].hand.length).toBe(2);
        expect(actualStateB.players["player_0"].hand.includes(CARD_TYPES.ASSASIN)).toBe(true);
        expect(actualStateB.players["player_0"].hand.includes(CARD_TYPES.DUKE)).toBe(true);
    });

    test("swap action challenge succeeds", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].hand = [CARD_TYPES.DUKE, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].hand = [CARD_TYPES.CONTESSA, CARD_TYPES.CONTESSA];
        preloadedState.deck.push(CARD_TYPES.DUKE);
        preloadedState.deck.push(CARD_TYPES.CONTESSA);
        server.roomStore.put(preloadedState);

        const swapMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.SWAP,
        }
        server.handleMessage(clientIds[0], JSON.stringify(swapMessage));

        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        server.handleMessage(clientIds[1], JSON.stringify(challengeMessage));

        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.DUKE,
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(revealMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }
        const actualStateB = server.roomStore.get(roomKey);
        expect(actualStateB).toEqual(expectedState);
        expect(actualStateB.players["player_0"].hand.length).toBe(1);
        expect(actualStateB.players["player_1"].hand.length).toBe(2);
        expect(actualStateB.players["player_2"].hand.length).toBe(2);
    });

    test("tax action succeeds (all accept)", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const taxAction = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        server.handleMessage(clientIds[0], JSON.stringify(taxAction));

        const acceptMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.ACCEPT,
        }
        server.handleMessage(clientIds[1], JSON.stringify(acceptMessage));
        server.handleMessage(clientIds[2], JSON.stringify(acceptMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(3);
        expect(actualState.players["player_0"].hand.length).toBe(2);
        expect(actualState.players["player_1"].hand.length).toBe(2);
        expect(actualState.players["player_2"].hand.length).toBe(2);
    });

    test("tax action challenge succeeds", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].hand = [CARD_TYPES.CONTESSA, CARD_TYPES.ASSASIN];
        server.roomStore.put(preloadedState);

        const taxMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        server.handleMessage(clientIds[0], JSON.stringify(taxMessage));

        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        server.handleMessage(clientIds[1], JSON.stringify(challengeMessage));

        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.ASSASIN,
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(revealMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(0);
        expect(actualState.players["player_0"].hand.length).toBe(1);
        expect(actualState.players["player_1"].hand.length).toBe(2);
        expect(actualState.players["player_2"].hand.length).toBe(2);
    });

    test("tax action challenge fails", async () => {
        let [clientIds, currentCount, roomKey] = createAndJoinNPlayers(3, server, wsServerMock, clientStore); 
        startCoupGame(clientIds, server, wsServerMock, currentCount);

        const preloadedState = server.roomStore.get(roomKey);
        preloadedState.players["player_0"].hand = [CARD_TYPES.DUKE, CARD_TYPES.ASSASIN];
        preloadedState.players["player_1"].hand = [CARD_TYPES.DUKE, CARD_TYPES.CONTESSA];
        server.roomStore.put(preloadedState);

        const taxMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        server.handleMessage(clientIds[0], JSON.stringify(taxMessage));

        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        server.handleMessage(clientIds[1], JSON.stringify(challengeMessage));

        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.DUKE,
            }
        }
        server.handleMessage(clientIds[0], JSON.stringify(revealMessage));

        const discardMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.DUKE,
            }
        }
        server.handleMessage(clientIds[1], JSON.stringify(discardMessage));

        let expectedState = server.roomStore.get(roomKey);
        expectedState = {
            ...expectedState,
            currentPlayerIndex: 1,
            currentPrimaryActor: expectedState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        }

        const actualState = server.roomStore.get(roomKey);
        expect(actualState).toEqual(expectedState);
        expect(actualState.players["player_0"].coins).toBe(3);
        expect(actualState.players["player_0"].hand.length).toBe(2);
        expect(actualState.players["player_1"].hand.length).toBe(1);
        expect(actualState.players["player_2"].hand.length).toBe(2);
    });

});