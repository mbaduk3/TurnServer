import CoupServer from "../../src/game-logic/coup/coup-server";
import { CARD_TYPES, COUP_PLAY_STATE, COUP_PLAY_STATE_V2, COUP_PRIMARY_ACTION_TYPE, COUP_SECONDARY_ACTION_TYPE } from "../../src/game-logic/coup/types";
import { shuffle } from "../../src/utils";
import { getCoupPlayer } from "../utils/coupTestUtils";

const getShuffledDeck = () => {
    const deck = [];
    Object.values(CARD_TYPES).forEach(cardType => {
        for (let i = 0; i < 3; i++) deck.push(cardType);
    });
    shuffle(deck);
    return deck;
}

describe("test coup server functions", () => {

    let logSpy;
    let errorSpy;
    let coupServer;

    const roomKey = "ABCDE";
    const getDefaultState = () => {
        const players = {};
        for (let i = 0; i < 3; i++) {
            players[`player_${i}`] = getCoupPlayer(i, roomKey);
        }
        return {
            started: true,
            key: "ABCDE",
            players: players,
            deck: getShuffledDeck(),
            currentPlayerIndex: 0,
            currentPrimaryActor: players["player_0"],
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
        };
    };

    beforeEach(() => {
        coupServer = new CoupServer();
        logSpy = jest.spyOn(global.console, "log");
        errorSpy = jest.spyOn(global.console, "error");
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test("income action success", async () => {
        const defaultState = getDefaultState();
        const incomeMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.INCOME,
        }
        const response = coupServer.handleMessage(incomeMessage, defaultState, "player_0");

        const expectedState = {
            ...defaultState,
            currentPlayerIndex: 1,
            currentPrimaryActor: defaultState.players["player_1"],
        }
        expectedState.players["player_0"].coins = 4;

        expect(response.newState).toEqual(expectedState);
    });

    test("coup action ", async () => {
        const defaultState = getDefaultState(); 
        defaultState.players["player_0"].coins = 10;
        const coupMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.COUP,
            details: {
                target: "player_1",
            }
        }
        const response = coupServer.handleMessage(coupMessage, defaultState, "player_0");

        const expectedState = {
            ...defaultState,
            currentPlayerIndex: 0,
            currentPrimaryActor: defaultState.players["player_0"],
            currentDiscardingActor: defaultState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.DISCARD,
        }

        expect(response.newState).toEqual(expectedState);
    });

    test("coup action without coins", async () => {
        const defaultState = getDefaultState(); 
        defaultState.players["player_0"].coins = 1;
        const coupMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.COUP,
            details: {
                target: "player_1",
            }
        }
        expect(() => coupServer.message(coupMessage, defaultState, "player_0")).toThrow(Error);
    });

    test("assasinate action", async () => {
        const defaultState = getDefaultState(); 
        defaultState.players["player_0"].coins = 4;
        const message = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: {
                target: "player_1",
            }
        }
        const response = coupServer.handleMessage(message, defaultState, "player_0");

        const expectedState = {
            ...defaultState,
            currentPlayerIndex: 0,
            currentPrimaryActor: defaultState.players["player_0"],
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
        }

        expect(response.newState).toEqual(expectedState);
    });

    test("assasinate action without coins", async () => {
        const defaultState = getDefaultState(); 
        defaultState.players["player_0"].coins = 2;
        const message = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: {
                target: "player_1",
            }
        }
        expect(() => coupServer.handleMessage(message, defaultState, "player_0")).toThrow(Error);
    });

    test("foreign aid action", async () => {
        const defaultState = getDefaultState(); 
        const message = {
            type: COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID,
        }
        const expectedPrimaryActor = {...defaultState.players["player_0"]};
        expectedPrimaryActor.currentPrimaryAction = message;
        const expectedState = {
            ...defaultState,
            currentPlayerIndex: 0,
            currentPrimaryActor: expectedPrimaryActor,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
        }
        const response = coupServer.handleMessage(message, defaultState, "player_0");
        expect(response.newState).toEqual(expectedState);
    });

    test("steal action", async () => {
        const defaultState = getDefaultState(); 
        const message = {
            type: COUP_PRIMARY_ACTION_TYPE.STEAL,
            details: {
                target: "player_1",
            }
        }
        const response = coupServer.handleMessage(message, defaultState, "player_0");

        const expectedState = {
            ...defaultState,
            currentPlayerIndex: 0,
            currentPrimaryActor: defaultState.players["player_0"],
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
        }

        expect(response.newState).toEqual(expectedState);
    });

    test("steal action without coins", async () => {
        const defaultState = getDefaultState(); 
        defaultState.players["player_1"].coins = 0;
        const message = {
            type: COUP_PRIMARY_ACTION_TYPE.STEAL,
            details: {
                target: "player_1",
            }
        }
        expect(() => coupServer.handleMessage(message, defaultState, "player_0")).toThrow(Error);
    });

    test("swap action", async () => {
        const defaultState = getDefaultState(); 
        const message = {
            type: COUP_PRIMARY_ACTION_TYPE.SWAP,
        }
        const response = coupServer.handleMessage(message, defaultState, "player_0");

        const expectedState = {
            ...defaultState,
            currentPlayerIndex: 0,
            currentPrimaryActor: defaultState.players["player_0"],
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
        }

        expect(response.newState).toEqual(expectedState);
    });

    test("tax action", async () => {
        const defaultState = getDefaultState(); 
        const message = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        const response = coupServer.handleMessage(message, defaultState, "player_0");

        const expectedState = {
            ...defaultState,
            currentPlayerIndex: 0,
            currentPrimaryActor: defaultState.players["player_0"],
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
        }

        expect(response.newState).toEqual(expectedState);
    });

    test("block action", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.WAITING_ON_SECONDARY,
        }
        defaultState.currentPrimaryActor.currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID,
        }
        defaultState.players["player_2"].currentSecondaryAction = {
            type: COUP_SECONDARY_ACTION_TYPE.ACCEPT,
        }
        const message = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        const response = coupServer.handleMessage(message, defaultState, "player_1");

        const expectedState = {
            ...defaultState,
            currentBlockingActor: defaultState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.REACTION_TO_BLOCK,
        }
        expectedState.players["player_2"].currentSecondaryAction = null;

        expect(response.newState).toEqual(expectedState);
    });

    test("block non-blockable action", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.WAITING_ON_SECONDARY,
        }
        defaultState.currentPrimaryActor.currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.SWAP,
        }
        defaultState.players["player_2"].currentSecondaryAction = {
            type: COUP_SECONDARY_ACTION_TYPE.ACCEPT,
        }
        const message = {
            type: COUP_PRIMARY_ACTION_TYPE.BLOCK,
        }
        expect(() => coupServer.handleMessage(message, defaultState, "player_1")).toThrow(Error);
    });

    test("block assasination as non-target", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.WAITING_ON_SECONDARY,
        }
        defaultState.currentPrimaryActor.currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: {
                target: "player_2"
            }
        }
        defaultState.players["player_2"].currentSecondaryAction = {
            type: COUP_SECONDARY_ACTION_TYPE.ACCEPT,
        }
        const message = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        expect(() => coupServer.handleMessage(message, defaultState, "player_1")).toThrow(Error);
    });

    test("block assasination as target", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.WAITING_ON_SECONDARY,
        }
        defaultState.currentPrimaryActor.currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: {
                target: "player_1"
            }
        }
        defaultState.players["player_2"].currentSecondaryAction = {
            type: COUP_SECONDARY_ACTION_TYPE.ACCEPT,
        }
        const message = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        const response = coupServer.handleMessage(message, defaultState, "player_1");

        const expectedState = {
            ...defaultState,
            currentBlockingActor: defaultState.players["player_1"],
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.REACTION_TO_BLOCK,
        }
        expectedState.players["player_2"].currentSecondaryAction = null;

        expect(response.newState).toEqual(expectedState);
    });

    test("block with existing block", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.WAITING_ON_SECONDARY,
        }
        defaultState.currentBlockingActor = defaultState.players["player_2"];
        defaultState.currentPrimaryActor.currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: {
                target: "player_2"
            }
        }
        defaultState.players["player_2"].currentSecondaryAction = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        const message = {
            type: COUP_PRIMARY_ACTION_TYPE.BLOCK,
        }
        expect(() => coupServer.handleMessage(message, defaultState, "player_1")).toThrow(Error);
    });

    test("block with existing challenge", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.WAITING_ON_SECONDARY,
        }
        defaultState.currentChallengingActor = defaultState.players["player_2"];
        defaultState.currentPrimaryActor.currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: {
                target: "player_2"
            }
        }
        defaultState.players["player_2"].currentSecondaryAction = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        const message = {
            type: COUP_PRIMARY_ACTION_TYPE.BLOCK,
        }
        expect(() => coupServer.handleMessage(message, defaultState, "player_1")).toThrow(Error);
    });

    test("block with existing discard", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.DISCARD,
        }
        defaultState.currentDiscardingActor = defaultState.players["player_2"];
        defaultState.currentPrimaryActor.currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: {
                target: "player_2"
            }
        }
        defaultState.players["player_2"].currentSecondaryAction = {
            type: COUP_SECONDARY_ACTION_TYPE.DISCARD,
        }
        const message = {
            type: COUP_PRIMARY_ACTION_TYPE.BLOCK,
        }
        expect(() => coupServer.handleMessage(message, defaultState, "player_1")).toThrow(Error);
    });

    test("challenge action", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentBlockingActor: null,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.WAITING_ON_SECONDARY,
        }
        defaultState.players["player_2"].currentSecondaryAction = {
            type: COUP_SECONDARY_ACTION_TYPE.ACCEPT,
        }
        defaultState.currentPrimaryActor.currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        const message = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        const response = coupServer.handleMessage(message, defaultState, "player_1");

        const expectedState = {
            ...defaultState,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.REACTION_TO_CHALLENGE,
            currentChallengingActor: defaultState.players["player_1"],
        }

        expect(response.newState).toEqual(expectedState);
    });

    test("challenge block action", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.WAITING_ON_SECONDARY,
        }
        defaultState.currentBlockingActor = defaultState.players["player_2"];
        defaultState.currentBlockingActor.currentSecondaryAction = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        defaultState.currentPrimaryActor.currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        const message = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        const response = coupServer.handleMessage(message, defaultState, "player_1");

        const expectedState = {
            ...defaultState,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.REACTION_TO_BLOCK_CHALLENGE,
            currentChallengingActor: defaultState.players["player_1"],
        }

        expect(response.newState).toEqual(expectedState);
    });

    test("challenge invalid action", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentBlockingActor: null,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.WAITING_ON_SECONDARY,
        }
        defaultState.currentPrimaryActor.currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID,
        }
        const message = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        expect(() => coupServer.handleMessage(message, defaultState, "player_1")).toThrow(Error);
    });

    test("challenge existing discard", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentBlockingActor: null,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.WAITING_ON_SECONDARY,
        }
        defaultState.currentDiscardingActor = defaultState.players["player_2"];
        defaultState.currentPrimaryActor.currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        const message = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        expect(() => coupServer.handleMessage(message, defaultState, "player_1")).toThrow(Error);
    });

    test("challenge existing challenge", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentBlockingActor: null,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.WAITING_ON_SECONDARY,
        }
        defaultState.currentChallengingActor = defaultState.players["player_2"];
        defaultState.currentPrimaryActor.currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        const message = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        expect(() => coupServer.handleMessage(message, defaultState, "player_1")).toThrow(Error);
    });

    test("reveal (discard) action", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.WAITING_ON_SECONDARY,
        }
        defaultState.currentDiscardingActor = defaultState.players["player_0"];
        defaultState.players["player_0"].hand = [CARD_TYPES.CAPTAIN, CARD_TYPES.CAPTAIN];
        const message = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.CAPTAIN,
            }
        }
        const response = coupServer.handleMessage(message, defaultState, "player_0");

        const expectedState = {
            ...defaultState,
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
            currentPrimaryActor: defaultState.players["player_1"],
        }

        expect(response.newState).toEqual(expectedState);
    });

    test("reveal (discard, non-primary) action", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.WAITING_ON_SECONDARY,
        }
        defaultState.currentDiscardingActor = defaultState.players["player_1"];
        defaultState.players["player_1"].hand = [CARD_TYPES.CAPTAIN, CARD_TYPES.CAPTAIN];
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID,
        }
        const message = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: {
                card: CARD_TYPES.CAPTAIN,
            }
        }
        const response = coupServer.handleMessage(message, defaultState, "player_1");

        const expectedState = {
            ...defaultState,
            currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
            currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
            currentPrimaryActor: defaultState.players["player_1"],
        }

        expect(response.newState).toEqual(expectedState);
    });

    // ========== 10-COIN MANDATORY COUP TESTS ==========
    test("player with exactly 10 coins must coup", async () => {
        const defaultState = getDefaultState();
        defaultState.players["player_0"].coins = 10;
        const incomeMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.INCOME,
        }
        expect(() => coupServer.handleMessage(incomeMessage, defaultState, "player_0")).toThrow("Must coup when at >=10 coins");
    });

    test("player with more than 10 coins must coup", async () => {
        const defaultState = getDefaultState();
        defaultState.players["player_0"].coins = 12;
        const taxMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        expect(() => coupServer.handleMessage(taxMessage, defaultState, "player_0")).toThrow("Must coup when at >=10 coins");
    });

    test("player with 10 coins can coup", async () => {
        const defaultState = getDefaultState();
        defaultState.players["player_0"].coins = 10;
        const coupMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.COUP,
            details: {
                target: "player_1",
            }
        }
        const response = coupServer.handleMessage(coupMessage, defaultState, "player_0");
        expect(response.newState.players["player_0"].coins).toBe(3);
    });

    // ========== ACCEPT ACTION TESTS ==========
    test("accept primary action - all players accept", async () => {
        const baseState = getDefaultState();
        const defaultState = {
            ...baseState,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
            currentPrimaryActor: baseState.players["player_0"],
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        defaultState.players["player_0"].coins = 3;
        
        const acceptMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.ACCEPT,
        }
        const response1 = coupServer.handleMessage(acceptMessage, defaultState, "player_1");
        expect(response1.newState.players["player_1"].currentSecondaryAction.type).toBe(COUP_SECONDARY_ACTION_TYPE.ACCEPT);
        expect(response1.newState.currentState).toBe(COUP_PLAY_STATE.WAITING_ON_SECONDARY);
        
        const response2 = coupServer.handleMessage(acceptMessage, response1.newState, "player_2");
        expect(response2.newState.players["player_0"].coins).toBe(6); // 3 starting + 3 from tax
        expect(response2.newState.currentState).toBe(COUP_PLAY_STATE.WAITING_ON_PRIMARY);
        expect(response2.newState.currentPrimaryActor.name).toBe("player_1");
    });

    test("accept block - all players accept block", async () => {
        const baseState = getDefaultState();
        const defaultState = {
            ...baseState,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.REACTION_TO_BLOCK,
            currentPrimaryActor: baseState.players["player_0"],
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID,
        }
        defaultState.players["player_0"].coins = 3;
        defaultState.currentBlockingActor = defaultState.players["player_1"];
        defaultState.players["player_1"].currentSecondaryAction = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        
        const acceptMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.ACCEPT,
        }
        
        const response1 = coupServer.handleMessage(acceptMessage, defaultState, "player_0");
        expect(response1.newState.players["player_0"].currentSecondaryAction.type).toBe(COUP_SECONDARY_ACTION_TYPE.ACCEPT);
        
        const response2 = coupServer.handleMessage(acceptMessage, response1.newState, "player_2");
        expect(response2.newState.players["player_0"].coins).toBe(3); // No coins gained
        expect(response2.newState.currentState).toBe(COUP_PLAY_STATE.WAITING_ON_PRIMARY);
        expect(response2.newState.currentPrimaryActor.name).toBe("player_1");
    });

    // ========== COMPLETE ACTION RESOLUTION TESTS ==========
    test("tax action completes and adds 3 coins", async () => {
        const baseState = getDefaultState();
        const defaultState = {
            ...baseState,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
            currentPrimaryActor: baseState.players["player_0"],
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        defaultState.players["player_0"].coins = 5;
        
        const acceptMessage = { type: COUP_SECONDARY_ACTION_TYPE.ACCEPT }
        const response1 = coupServer.handleMessage(acceptMessage, defaultState, "player_1");
        const response2 = coupServer.handleMessage(acceptMessage, response1.newState, "player_2");
        
        expect(response2.newState.players["player_0"].coins).toBe(8);
    });

    test("foreign aid action completes and adds 2 coins", async () => {
        const baseState = getDefaultState();
        const defaultState = {
            ...baseState,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
            currentPrimaryActor: baseState.players["player_0"],
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID,
        }
        defaultState.players["player_0"].coins = 4;
        
        const acceptMessage = { type: COUP_SECONDARY_ACTION_TYPE.ACCEPT }
        const response1 = coupServer.handleMessage(acceptMessage, defaultState, "player_1");
        const response2 = coupServer.handleMessage(acceptMessage, response1.newState, "player_2");
        
        expect(response2.newState.players["player_0"].coins).toBe(6);
    });

    test("steal action completes and transfers 2 coins", async () => {
        const baseState = getDefaultState();
        const defaultState = {
            ...baseState,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
            currentPrimaryActor: baseState.players["player_0"],
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.STEAL,
            details: { target: "player_1" }
        }
        defaultState.players["player_0"].coins = 2;
        defaultState.players["player_1"].coins = 5;
        
        const acceptMessage = { type: COUP_SECONDARY_ACTION_TYPE.ACCEPT }
        const response1 = coupServer.handleMessage(acceptMessage, defaultState, "player_1");
        const response2 = coupServer.handleMessage(acceptMessage, response1.newState, "player_2");
        
        expect(response2.newState.players["player_0"].coins).toBe(4);
        expect(response2.newState.players["player_1"].coins).toBe(3);
    });

    test("steal action only transfers 1 coin when target has 1 coin", async () => {
        const baseState = getDefaultState();
        const defaultState = {
            ...baseState,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
            currentPrimaryActor: baseState.players["player_0"],
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.STEAL,
            details: { target: "player_1" }
        }
        defaultState.players["player_0"].coins = 2;
        defaultState.players["player_1"].coins = 1;
        
        const acceptMessage = { type: COUP_SECONDARY_ACTION_TYPE.ACCEPT }
        const response1 = coupServer.handleMessage(acceptMessage, defaultState, "player_1");
        const response2 = coupServer.handleMessage(acceptMessage, response1.newState, "player_2");
        
        expect(response2.newState.players["player_0"].coins).toBe(3);
        expect(response2.newState.players["player_1"].coins).toBe(0);
    });

    // ========== BLOCK STEAL TESTS ==========
    test("block steal with Captain", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.STEAL,
            details: { target: "player_1" }
        }
        
        const blockMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        const response = coupServer.handleMessage(blockMessage, defaultState, "player_1");
        
        expect(response.newState.currentBlockingActor.name).toBe("player_1");
        expect(response.newState.currentStateV2).toBe(COUP_PLAY_STATE_V2.REACTION_TO_BLOCK);
    });

    // ========== CHALLENGE TESTS ==========
    test("challenge tax action", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        defaultState.currentBlockingActor = null;
        defaultState.currentChallengingActor = null;
        
        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        const response = coupServer.handleMessage(challengeMessage, defaultState, "player_1");
        
        expect(response.newState.currentChallengingActor.name).toBe("player_1");
        expect(response.newState.currentStateV2).toBe(COUP_PLAY_STATE_V2.REACTION_TO_CHALLENGE);
    });

    test("challenge assassinate action", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: { target: "player_1" }
        }
        defaultState.players["player_0"].coins = 5;
        defaultState.currentBlockingActor = null;
        defaultState.currentChallengingActor = null;
        
        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        const response = coupServer.handleMessage(challengeMessage, defaultState, "player_2");
        
        expect(response.newState.currentChallengingActor.name).toBe("player_2");
        expect(response.newState.currentStateV2).toBe(COUP_PLAY_STATE_V2.REACTION_TO_CHALLENGE);
    });

    test("challenge swap action", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.SWAP,
        }
        defaultState.currentBlockingActor = null;
        defaultState.currentChallengingActor = null;
        
        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        const response = coupServer.handleMessage(challengeMessage, defaultState, "player_1");
        
        expect(response.newState.currentChallengingActor.name).toBe("player_1");
        expect(response.newState.currentStateV2).toBe(COUP_PLAY_STATE_V2.REACTION_TO_CHALLENGE);
    });

    test("challenge steal block", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.REACTION_TO_BLOCK,
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.STEAL,
            details: { target: "player_1" }
        }
        defaultState.currentBlockingActor = defaultState.players["player_1"];
        defaultState.players["player_1"].currentSecondaryAction = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        
        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        const response = coupServer.handleMessage(challengeMessage, defaultState, "player_0");
        
        expect(response.newState.currentChallengingActor.name).toBe("player_0");
        expect(response.newState.currentStateV2).toBe(COUP_PLAY_STATE_V2.REACTION_TO_BLOCK_CHALLENGE);
    });

    // ========== SUCCESSFUL CHALLENGE (CHALLENGER WINS) TESTS ==========
    test("successful challenge - primary actor bluffed and loses influence", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.REACTION_TO_CHALLENGE,
        }
        defaultState.players["player_0"].hand = [CARD_TYPES.CAPTAIN, CARD_TYPES.CONTESSA];
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        defaultState.currentChallengingActor = defaultState.players["player_1"];
        defaultState.currentBlockingActor = null;
        
        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: { card: CARD_TYPES.CAPTAIN }
        }
        const response = coupServer.handleMessage(revealMessage, defaultState, "player_0");
        
        expect(response.newState.players["player_0"].hand).toEqual([CARD_TYPES.CONTESSA]);
        expect(response.newState.currentState).toBe(COUP_PLAY_STATE.WAITING_ON_PRIMARY);
        expect(response.newState.currentPrimaryActor.name).toBe("player_1");
    });

    // ========== FAILED CHALLENGE (CHALLENGER LOSES) TESTS ==========
    test("failed challenge - primary actor proves card and challenger loses influence", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.REACTION_TO_CHALLENGE,
        }
        defaultState.players["player_0"].hand = [CARD_TYPES.DUKE, CARD_TYPES.CONTESSA];
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        defaultState.players["player_1"].hand = [CARD_TYPES.CAPTAIN, CARD_TYPES.AMBASSADOR];
        defaultState.currentChallengingActor = defaultState.players["player_1"];
        defaultState.currentBlockingActor = null;
        defaultState.deck = [CARD_TYPES.ASSASIN, CARD_TYPES.DUKE, CARD_TYPES.CAPTAIN];
        
        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: { card: CARD_TYPES.DUKE }
        }
        const response = coupServer.handleMessage(revealMessage, defaultState, "player_0");
        
        expect(response.newState.players["player_0"].hand.length).toBe(2);
        expect(response.newState.currentDiscardingActor.name).toBe("player_1");
        expect(response.newState.currentStateV2).toBe(COUP_PLAY_STATE_V2.DISCARD);
    });

    test("failed challenge then action executes after challenger discards", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.DISCARD,
        }
        defaultState.players["player_0"].hand = [CARD_TYPES.DUKE, CARD_TYPES.CONTESSA];
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        defaultState.players["player_0"].coins = 3;
        defaultState.players["player_1"].hand = [CARD_TYPES.CAPTAIN];
        defaultState.currentDiscardingActor = defaultState.players["player_1"];
        
        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: { card: CARD_TYPES.CAPTAIN }
        }
        const response = coupServer.handleMessage(revealMessage, defaultState, "player_1");
        
        expect(response.newState.players["player_0"].coins).toBe(6);
        expect(response.newState.players["player_1"].hand.length).toBe(0);
        expect(response.newState.currentState).toBe(COUP_PLAY_STATE.WAITING_ON_PRIMARY);
    });

    // ========== FAILED BLOCK CHALLENGE TESTS ==========
    test("failed block challenge - blocker proves card and challenger loses influence", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.REACTION_TO_BLOCK_CHALLENGE,
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: { target: "player_1" }
        }
        defaultState.players["player_1"].hand = [CARD_TYPES.CONTESSA, CARD_TYPES.CAPTAIN];
        defaultState.currentBlockingActor = defaultState.players["player_1"];
        defaultState.players["player_1"].currentSecondaryAction = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        defaultState.currentChallengingActor = defaultState.players["player_0"];
        defaultState.deck = [CARD_TYPES.DUKE, CARD_TYPES.AMBASSADOR];
        
        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: { card: CARD_TYPES.CONTESSA }
        }
        const response = coupServer.handleMessage(revealMessage, defaultState, "player_1");
        
        expect(response.newState.currentDiscardingActor.name).toBe("player_0");
        expect(response.newState.currentStateV2).toBe(COUP_PLAY_STATE_V2.DISCARD);
    });

    // ========== DOUBLE-LOSS ASSASSINATION TESTS ==========
    test("double loss - challenge assassin, lose challenge, then lose to assassination", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.REACTION_TO_CHALLENGE,
        }
        defaultState.players["player_0"].hand = [CARD_TYPES.ASSASIN, CARD_TYPES.DUKE];
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: { target: "player_1" }
        }
        defaultState.players["player_1"].hand = [CARD_TYPES.CAPTAIN, CARD_TYPES.AMBASSADOR];
        defaultState.currentChallengingActor = defaultState.players["player_1"];
        defaultState.currentBlockingActor = null;
        defaultState.deck = [CARD_TYPES.CONTESSA, CARD_TYPES.DUKE];
        
        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: { card: CARD_TYPES.ASSASIN }
        }
        const response1 = coupServer.handleMessage(revealMessage, defaultState, "player_0");
        
        expect(response1.newState.currentDiscardingActor.name).toBe("player_1");
        expect(response1.newState.currentStateV2).toBe(COUP_PLAY_STATE_V2.DISCARD_ASSASINATE_CHALLENGE);
        
        const discardMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: { card: CARD_TYPES.CAPTAIN }
        }
        const response2 = coupServer.handleMessage(discardMessage, response1.newState, "player_1");
        
        expect(response2.newState.currentDiscardingActor.name).toBe("player_1");
        expect(response2.newState.currentStateV2).toBe(COUP_PLAY_STATE_V2.DISCARD);
        expect(response2.newState.players["player_1"].hand.length).toBe(1);
    });

    test("double loss - bluff contessa block, lose challenge, then lose to assassination", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.REACTION_TO_BLOCK_CHALLENGE,
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: { target: "player_1" }
        }
        defaultState.players["player_1"].hand = [CARD_TYPES.CAPTAIN, CARD_TYPES.AMBASSADOR];
        defaultState.currentBlockingActor = defaultState.players["player_1"];
        defaultState.players["player_1"].currentSecondaryAction = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        defaultState.currentChallengingActor = defaultState.players["player_0"];
        
        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: { card: CARD_TYPES.CAPTAIN }
        }
        const response = coupServer.handleMessage(revealMessage, defaultState, "player_1");
        
        expect(response.newState.players["player_1"].hand.length).toBe(1);
        expect(response.newState.currentDiscardingActor.name).toBe("player_1");
        expect(response.newState.currentStateV2).toBe(COUP_PLAY_STATE_V2.DISCARD);
    });

    test("double loss results in player elimination", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.DISCARD,
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: { target: "player_1" }
        }
        defaultState.players["player_1"].hand = [CARD_TYPES.AMBASSADOR];
        defaultState.currentDiscardingActor = defaultState.players["player_1"];
        
        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: { card: CARD_TYPES.AMBASSADOR }
        }
        const response = coupServer.handleMessage(revealMessage, defaultState, "player_1");
        
        expect(response.newState.players["player_1"].hand.length).toBe(0);
        expect(response.newState.currentState).toBe(COUP_PLAY_STATE.WAITING_ON_PRIMARY);
        expect(response.newState.currentPrimaryActor.name).toBe("player_2");
    });

    // ========== PLAYER ELIMINATION TESTS ==========
    test("player loses last influence and is eliminated", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.DISCARD,
        }
        defaultState.players["player_1"].hand = [CARD_TYPES.DUKE];
        defaultState.currentDiscardingActor = defaultState.players["player_1"];
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.COUP,
            details: { target: "player_1" }
        }
        
        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: { card: CARD_TYPES.DUKE }
        }
        const response = coupServer.handleMessage(revealMessage, defaultState, "player_1");
        
        expect(response.newState.players["player_1"].hand.length).toBe(0);
        expect(response.newState.currentPrimaryActor.name).toBe("player_2");
    });

    test("turn skips eliminated players", async () => {
        const defaultState = getDefaultState();
        defaultState.players["player_1"].hand = [];
        defaultState.currentPlayerIndex = 0;
        
        const incomeMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.INCOME,
        }
        const response = coupServer.handleMessage(incomeMessage, defaultState, "player_0");
        
        expect(response.newState.currentPrimaryActor.name).toBe("player_2");
    });

    test("cannot target eliminated player", async () => {
        const defaultState = getDefaultState();
        defaultState.players["player_1"].hand = [];
        defaultState.players["player_0"].coins = 7;
        
        const coupMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.COUP,
            details: { target: "player_1" }
        }
        
        expect(() => coupServer.handleMessage(coupMessage, defaultState, "player_0")).toThrow("Cannot target a player who is out of the game");
    });

    test("game ends when only one player remains", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.DISCARD,
        }
        defaultState.players["player_1"].hand = [];
        defaultState.players["player_2"].hand = [CARD_TYPES.CAPTAIN];
        defaultState.currentDiscardingActor = defaultState.players["player_2"];
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.COUP,
            details: { target: "player_2" }
        }
        
        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: { card: CARD_TYPES.CAPTAIN }
        }
        const response = coupServer.handleMessage(revealMessage, defaultState, "player_2");
        
        expect(response.newState.currentStateV2).toBe(COUP_PLAY_STATE_V2.FINISHED);
    });

    // ========== SWAP/AMBASSADOR TESTS ==========
    test("swap action draws 2 cards and waits for swap reveal", async () => {
        const baseState = getDefaultState();
        const defaultState = {
            ...baseState,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
            currentPrimaryActor: baseState.players["player_0"],
        }
        defaultState.players["player_0"].hand = [CARD_TYPES.DUKE, CARD_TYPES.CAPTAIN];
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.SWAP,
        }
        defaultState.deck = [CARD_TYPES.ASSASIN, CARD_TYPES.AMBASSADOR, CARD_TYPES.CONTESSA];
        
        const acceptMessage = { type: COUP_SECONDARY_ACTION_TYPE.ACCEPT }
        const response1 = coupServer.handleMessage(acceptMessage, defaultState, "player_1");
        const response2 = coupServer.handleMessage(acceptMessage, response1.newState, "player_2");
        
        expect(response2.newState.players["player_0"].hand.length).toBe(4);
        expect(response2.newState.currentStateV2).toBe(COUP_PLAY_STATE_V2.SWAP);
        expect(response2.newState.deck.length).toBe(1);
    });

    test("swap reveal with correct card selection", async () => {
        const baseState = getDefaultState();
        const defaultState = {
            ...baseState,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SWAP,
            currentPrimaryActor: baseState.players["player_0"],
        }
        defaultState.players["player_0"].hand = [CARD_TYPES.DUKE, CARD_TYPES.CAPTAIN, CARD_TYPES.CONTESSA, CARD_TYPES.AMBASSADOR];
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.SWAP,
        }
        defaultState.deck = [CARD_TYPES.ASSASIN];
        
        const swapRevealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.SWAP_REVEAL,
            details: {
                cards: [CARD_TYPES.DUKE, CARD_TYPES.CONTESSA]
            }
        }
        const response = coupServer.handleMessage(swapRevealMessage, defaultState, "player_0");
        
        expect(response.newState.players["player_0"].hand).toEqual([CARD_TYPES.DUKE, CARD_TYPES.CONTESSA]);
        expect(response.newState.deck.length).toBeGreaterThanOrEqual(2);
        expect(response.newState.currentState).toBe(COUP_PLAY_STATE.WAITING_ON_PRIMARY);
        expect(response.newState.currentPrimaryActor.name).toBe("player_1");
    });

    test("swap reveal with wrong number of cards fails", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SWAP,
        }
        defaultState.players["player_0"].hand = [CARD_TYPES.DUKE, CARD_TYPES.CAPTAIN, CARD_TYPES.CONTESSA, CARD_TYPES.AMBASSADOR];
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.SWAP,
        }
        
        const swapRevealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.SWAP_REVEAL,
            details: {
                cards: [CARD_TYPES.DUKE]
            }
        }
        
        expect(() => coupServer.handleMessage(swapRevealMessage, defaultState, "player_0")).toThrow("Invalid swap decision cards");
    });

    test("swap reveal with cards not in hand fails", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SWAP,
        }
        defaultState.players["player_0"].hand = [CARD_TYPES.DUKE, CARD_TYPES.CAPTAIN, CARD_TYPES.CONTESSA, CARD_TYPES.AMBASSADOR];
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.SWAP,
        }
        
        const swapRevealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.SWAP_REVEAL,
            details: {
                cards: [CARD_TYPES.ASSASIN, CARD_TYPES.ASSASIN]
            }
        }
        
        expect(() => coupServer.handleMessage(swapRevealMessage, defaultState, "player_0")).toThrow("Invalid swap decision cards");
    });

    test("swap with 3 cards (one influence lost) selects 1 card to return", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SWAP,
        }
        defaultState.players["player_0"].hand = [CARD_TYPES.DUKE, CARD_TYPES.CAPTAIN, CARD_TYPES.CONTESSA];
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.SWAP,
        }
        defaultState.deck = [CARD_TYPES.ASSASIN];
        
        const swapRevealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.SWAP_REVEAL,
            details: {
                cards: [CARD_TYPES.DUKE]
            }
        }
        const response = coupServer.handleMessage(swapRevealMessage, defaultState, "player_0");
        
        expect(response.newState.players["player_0"].hand).toEqual([CARD_TYPES.DUKE]);
        expect(response.newState.deck.length).toBeGreaterThanOrEqual(2);
    });

    // ========== EDGE CASE TESTS ==========
    test("cannot take action when not your turn", async () => {
        const defaultState = getDefaultState();
        defaultState.players["player_1"].hand = [CARD_TYPES.DUKE, CARD_TYPES.CAPTAIN];
        
        const incomeMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.INCOME,
        }
        
        expect(() => coupServer.handleMessage(incomeMessage, defaultState, "player_1")).toThrow("Not your turn!");
    });

    test("cannot play with 0 influences", async () => {
        const defaultState = getDefaultState();
        defaultState.players["player_0"].hand = [];
        
        const incomeMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.INCOME,
        }
        
        expect(() => coupServer.handleMessage(incomeMessage, defaultState, "player_0")).toThrow("Cannot play with 0 influences");
    });

    test("cannot reveal card not in your hand", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.REACTION_TO_CHALLENGE,
        }
        defaultState.players["player_0"].hand = [CARD_TYPES.CAPTAIN, CARD_TYPES.CONTESSA];
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        defaultState.currentChallengingActor = defaultState.players["player_1"];
        defaultState.currentBlockingActor = null;
        
        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: { card: CARD_TYPES.AMBASSADOR }
        }
        
        expect(() => coupServer.handleMessage(revealMessage, defaultState, "player_0")).toThrow("Cannot reveal a card that not in your hand");
    });

    test("tax action is challengeable", async () => {
        const defaultState = {
            ...getDefaultState(),
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.TAX,
        }
        defaultState.players["player_1"].hand = [CARD_TYPES.CAPTAIN, CARD_TYPES.AMBASSADOR];
        defaultState.currentBlockingActor = null;
        defaultState.currentChallengingActor = null;
        
        const challengeMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.CHALLENGE,
        }
        const response = coupServer.handleMessage(challengeMessage, defaultState, "player_1");
        
        expect(response.newState.currentChallengingActor.name).toBe("player_1");
        expect(response.newState.currentStateV2).toBe(COUP_PLAY_STATE_V2.REACTION_TO_CHALLENGE);
    });

    // ========== ADDITIONAL BLOCK TESTS ==========
    test("block foreign aid with Duke", async () => {
        const baseState = getDefaultState();
        const defaultState = {
            ...baseState,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
            currentPrimaryActor: baseState.players["player_0"],
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID,
        }
        
        const blockMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        const response = coupServer.handleMessage(blockMessage, defaultState, "player_1");
        
        expect(response.newState.currentBlockingActor.name).toBe("player_1");
        expect(response.newState.currentStateV2).toBe(COUP_PLAY_STATE_V2.REACTION_TO_BLOCK);
    });

    test("block assassination with Contessa", async () => {
        const baseState = getDefaultState();
        const defaultState = {
            ...baseState,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
            currentPrimaryActor: baseState.players["player_0"],
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: { target: "player_1" },
        }
        defaultState.players["player_0"].coins = 3;
        
        const blockMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        const response = coupServer.handleMessage(blockMessage, defaultState, "player_1");
        
        expect(response.newState.currentBlockingActor.name).toBe("player_1");
        expect(response.newState.currentStateV2).toBe(COUP_PLAY_STATE_V2.REACTION_TO_BLOCK);
        expect(response.newState.players["player_0"].coins).toBe(3); // Coins taken but not assassination yet
    });

    test("block steal with Ambassador", async () => {
        const baseState = getDefaultState();
        const defaultState = {
            ...baseState,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SECONDARY,
            currentPrimaryActor: baseState.players["player_0"],
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.STEAL,
            details: { target: "player_1" },
        }
        
        const blockMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        const response = coupServer.handleMessage(blockMessage, defaultState, "player_1");
        
        expect(response.newState.currentBlockingActor.name).toBe("player_1");
        expect(response.newState.currentStateV2).toBe(COUP_PLAY_STATE_V2.REACTION_TO_BLOCK);
    });

    test("successful block challenge - blocker bluffed and loses influence", async () => {
        const baseState = getDefaultState();
        const defaultState = {
            ...baseState,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.REACTION_TO_BLOCK_CHALLENGE,
            currentPrimaryActor: baseState.players["player_0"],
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.FOREIGN_AID,
        }
        defaultState.players["player_0"].coins = 5;
        defaultState.players["player_1"].hand = [CARD_TYPES.CAPTAIN, CARD_TYPES.CONTESSA]; // No Duke
        defaultState.currentBlockingActor = defaultState.players["player_1"];
        defaultState.currentChallengingActor = defaultState.players["player_2"];
        defaultState.players["player_1"].currentSecondaryAction = {
            type: COUP_SECONDARY_ACTION_TYPE.BLOCK,
        }
        
        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: { card: CARD_TYPES.CAPTAIN } // Wrong card - not Duke
        }
        const response = coupServer.handleMessage(revealMessage, defaultState, "player_1");
        
        expect(response.newState.players["player_1"].hand.length).toBe(1); // Lost one card
        expect(response.newState.players["player_0"].coins).toBe(7); // Got 2 coins from foreign aid
    });

    // ========== EDGE CASE TESTS ==========
    test("coup with exactly 7 coins", async () => {
        const defaultState = getDefaultState();
        defaultState.players["player_0"].coins = 7;
        
        const coupMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.COUP,
            details: { target: "player_1" },
        }
        const response = coupServer.handleMessage(coupMessage, defaultState, "player_0");
        
        expect(response.newState.players["player_0"].coins).toBe(0);
        expect(response.newState.currentDiscardingActor.name).toBe("player_1");
    });

    test("steal from player with 0 coins should throw error", async () => {
        const defaultState = getDefaultState();
        defaultState.players["player_1"].coins = 0; // Target has no coins
        defaultState.currentPrimaryActor = defaultState.players["player_0"];

        const stealMessage = { type: COUP_PRIMARY_ACTION_TYPE.STEAL, details: { target: "player_1" } }
        
        expect(() => {
            coupServer.handleMessage(stealMessage, defaultState, "player_0");
        }).toThrow("Cannot steal when target has <= 0 coins");
    });

    test("reveal wrong card type in challenge fails", async () => {
        const baseState = getDefaultState();
        const defaultState = {
            ...baseState,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.REACTION_TO_CHALLENGE,
            currentPrimaryActor: baseState.players["player_0"],
        }
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: { target: "player_1" },
        }
        defaultState.players["player_0"].hand = [CARD_TYPES.DUKE, CARD_TYPES.CAPTAIN]; // No Assassin
        defaultState.players["player_0"].coins = 0; // Already paid for assassination
        defaultState.currentChallengingActor = defaultState.players["player_1"];
        defaultState.currentBlockingActor = null;
        
        const revealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.REVEAL,
            details: { card: CARD_TYPES.DUKE } // Wrong card for assassinate
        }
        const response = coupServer.handleMessage(revealMessage, defaultState, "player_0");
        
        // Should fail the reveal - lose the card and turn passes
        expect(response.newState.players["player_0"].hand.length).toBe(1);
        expect(response.newState.currentState).toBe(COUP_PLAY_STATE.WAITING_ON_PRIMARY);
        expect(response.newState.currentPrimaryActor.name).toBe("player_1");
    });

    test("assassinate with exactly 3 coins", async () => {
        const defaultState = getDefaultState();
        defaultState.players["player_0"].coins = 3;
        
        const assassinateMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: { target: "player_1" },
        }
        const response = coupServer.handleMessage(assassinateMessage, defaultState, "player_0");
        
        expect(response.newState.players["player_0"].coins).toBe(0);
        expect(response.newState.currentState).toBe(COUP_PLAY_STATE.WAITING_ON_SECONDARY);
    });

    test("cannot steal from eliminated player", async () => {
        const defaultState = getDefaultState();
        defaultState.players["player_1"].hand = []; // Eliminated
        
        const stealMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.STEAL,
            details: { target: "player_1" },
        }
        
        expect(() => coupServer.handleMessage(stealMessage, defaultState, "player_0")).toThrow("Cannot target a player who is out of the game");
    });

    test("cannot assassinate eliminated player", async () => {
        const defaultState = getDefaultState();
        defaultState.players["player_0"].coins = 5;
        defaultState.players["player_1"].hand = []; // Eliminated
        
        const assassinateMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.ASSASINATE,
            details: { target: "player_1" },
        }
        
        expect(() => coupServer.handleMessage(assassinateMessage, defaultState, "player_0")).toThrow("Cannot target a player who is out of the game");
    });

    test("cannot coup eliminated player", async () => {
        const defaultState = getDefaultState();
        defaultState.players["player_0"].coins = 10;
        defaultState.players["player_1"].hand = []; // Eliminated
        
        const coupMessage = {
            type: COUP_PRIMARY_ACTION_TYPE.COUP,
            details: { target: "player_1" },
        }
        
        expect(() => coupServer.handleMessage(coupMessage, defaultState, "player_0")).toThrow("Cannot target a player who is out of the game");
    });

    test("deck shuffles returned cards from swap", async () => {
        const baseState = getDefaultState();
        const defaultState = {
            ...baseState,
            currentState: COUP_PLAY_STATE.WAITING_ON_SECONDARY,
            currentStateV2: COUP_PLAY_STATE_V2.SWAP,
            currentPrimaryActor: baseState.players["player_0"],
        }
        defaultState.players["player_0"].hand = [CARD_TYPES.DUKE, CARD_TYPES.CAPTAIN, CARD_TYPES.CONTESSA, CARD_TYPES.AMBASSADOR];
        defaultState.players["player_0"].currentPrimaryAction = {
            type: COUP_PRIMARY_ACTION_TYPE.SWAP,
        }
        const initialDeckLength = defaultState.deck.length;
        
        const swapRevealMessage = {
            type: COUP_SECONDARY_ACTION_TYPE.SWAP_REVEAL,
            details: {
                cards: [CARD_TYPES.DUKE, CARD_TYPES.CONTESSA]
            }
        }
        const response = coupServer.handleMessage(swapRevealMessage, defaultState, "player_0");
        
        expect(response.newState.players["player_0"].hand).toEqual([CARD_TYPES.DUKE, CARD_TYPES.CONTESSA]);
        // Deck should have 2 cards returned (Captain and Ambassador not kept)
        expect(response.newState.deck.length).toBeGreaterThan(initialDeckLength);
    });
});