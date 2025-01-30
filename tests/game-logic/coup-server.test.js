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

    const players = {};
    const roomKey = "ABCDE";
    for (let i = 0; i < 3; i++) {
        players[`player_${i}`] = getCoupPlayer(i, roomKey);
    }
    const getDefaultState = () => ({
        started: true,
        key: "ABCDE",
        players: players,
        deck: getShuffledDeck(),
        currentPlayerIndex: 0,
        currentPrimaryActor: players["player_0"],
        currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
        currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
    });

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

    test("foreign aid action without coins", async () => {
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
            type: COUP_PRIMARY_ACTION_TYPE.BLOCK,
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
});