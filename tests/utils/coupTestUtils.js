// import { getShuffledDeck } from "../../src/coup/coup-server";
// import { COUP_PLAY_STATE, COUP_PLAY_STATE_V2, COUP_RESPONSE_TYPE } from "../../src/coup/types";
import { CARD_TYPES } from "../../src/game-logic/coup/types";
// import { RequestType, ResponseType } from "../../src/turn-based-server/types";

// export const startCoupGame = (clientIds, server, protocolServerMock, currentCount) => {
//     const startMessage = {
//         type: RequestType.START,
//     }
//     server.handleMessage(clientIds[0], JSON.stringify(startMessage));
//     const expectedResponse = {
//         type: ResponseType.START_SUCCESS,
//     }
//     expect(protocolServerMock.sendMessageToClient).toHaveBeenNthCalledWith(currentCount++, clientIds[0], expectedResponse);

    
    
//     clientIds.forEach((clientId, i) => {
//         const playerStates = clientIds.reduce((prev, cur, j) => {
//             const playerState = {
//                 coins: 0,
//                 name: `player_${j}`,
//                 cards: 2,
//             }
//             if (i === j) {
//                 playerState.hand = expect.any(Array);
//             }
//             return {...prev, [`player_${j}`]: playerState} 
//         }, {});
//         const expectedState = {
//             type: ResponseType.GAME_ACTION,
//             data: {
//                 respType: COUP_RESPONSE_TYPE.GAME_STATE,
//                 state: {
//                     currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
//                     currentStateV2: COUP_PLAY_STATE_V2.PRIMARY,
//                     currentPrimaryActor: "player_0",
//                     currentDiscardingActor: undefined,
//                     currentBlockingActor: undefined,
//                     currentChallengingActor: undefined,
//                     players: playerStates
//                 },
//             }
//         }
//         // const expectedPlayerState = {
//         //     type: ResponseType.GAME_ACTION,
//         //     data: {
//         //         respType: COUP_RESPONSE_TYPE.GAME_STATE,
//         //         data: {
//         //             currentTurn: expect.any(String),
//         //             hand: expect.any(Array),
//         //             coins: 0,
//         //         }
//         //     }
//         // }
//         // expect(protocolServerMock.sendMessageToClient).toHaveBeenNthCalledWith(currentCount++, clientId, expectedPlayerState);
//         expect(protocolServerMock.sendMessageToClient).toHaveBeenNthCalledWith(currentCount++, clientId, expectedState);
//     });

//     return [currentCount];
// }

// export const initCoupGame = (clientIds, server) => {
//     const players = {}
//     clientIds.forEach((_, i) => {
//         players[`player_${i}`] = {
//             name: `player_${i}`,
//             roomId: null,
//             clients: [`someId_${i}`],
//             room: null,
//             hand: null,
//             coins: 0,
//             currentPrimaryAction: null,
//             currentSecondaryAction: null,
//         }
//     });
//     const room = {
//         gameStarted: true,
//         key: "AAAAA",
//         players: players,
//         deck: getShuffledDeck(),
//         currentPlayerIndex: 0,
//         currentPrimaryActor: players["player_0"],
//         currentChallengingActor: null,
//         currentBlockingActor: null,
//         currentDiscardingActor: null,
//         currentState: COUP_PLAY_STATE.WAITING_ON_PRIMARY,
//     }
//     Object.values(room.players).forEach(player => {
//         player.room = room;
//         player.roomId = room.key;
//         player.hand = [room.deck.pop(), room.deck.pop()];
//     });
//     server.roomStore.put(room);
//     return room;
// }

export const getCoupDeck = () => {
    return [
        CARD_TYPES.AMBASSADOR,
        CARD_TYPES.ASSASIN,
        CARD_TYPES.CAPTAIN,
        CARD_TYPES.CONTESSA,
        CARD_TYPES.DUKE,
    ];
}
export const getCoupPlayer = (idx, roomKey) => {
    return {
        name: `player_${idx}`,
        roomId: roomKey,
        clients: [],
        hand: [CARD_TYPES.AMBASSADOR, CARD_TYPES.CONTESSA],
        coins: 3,
        currentPrimaryAction: null,
        currentSecondaryAction: null,
    }
}