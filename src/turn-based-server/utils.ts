import { ClientBoundMessage, Player, PlayerBoundMessage, ResponseMessage, ResponseType, Room } from "./types.ts";

export const transformPlayerMessagesToClient = (playerMessages: PlayerBoundMessage[]): ClientBoundMessage[] => {
    const clientMessages:ClientBoundMessage[] = playerMessages.reduce((acc, message:PlayerBoundMessage) => {
        const perClientMessages:ClientBoundMessage[] = message.player.clients.map(client => {
            return {clientId: client, message: message.message}
        });
        return [...acc, ...perClientMessages];
    }, []);
    return clientMessages;
}

export const getRoomStateBroadcast = (room: Room): ClientBoundMessage[] => {
    const playerMessages = Object.values(room.players).map(p => getRoomStateMessageForPlayer(room, p));
    return transformPlayerMessagesToClient(playerMessages);
}

export const getRoomStateMessageForPlayer = (room: Room, player: Player): PlayerBoundMessage => {
    const response = getRoomStateMessage(room);
    return {
        player: player,
        message: response,
    }
}

export const getRoomStateMessageForClient = (room: Room, clientId: string): ClientBoundMessage => {
    const response = getRoomStateMessage(room);
    return {
        clientId: clientId,
        message: response,
    }
}

export const getRoomStateMessage = (room: Room): ResponseMessage => {
    return {
        type: ResponseType.ROOM_STATE,
        data: {
            started: room.started,
            key: room.key,
            players: Object.keys(room.players),
        }
    }
}