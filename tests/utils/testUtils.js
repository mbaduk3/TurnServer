import { WebSocket } from "ws";
import { RequestType, ResponseType } from "../../src/turn-based-server/types";

const waitForSocketState = (socket, state) => {
    return new Promise(function (resolve) {
      setTimeout(function () {
        if (socket.readyState === state) {
          resolve();
        } else {
          waitForSocketState(socket, state).then(resolve);
        }
      }, 5);
    });
}

async function createSocketClient(port, closeAfter) {
  const client = new WebSocket(`ws://localhost:${port}`);
  await waitForSocketState(client, client.OPEN);
  const messages = [];
  client.on("message", (data) => {
    messages.push(data);
    if (messages.length === closeAfter) {
      client.close();
    }
  });
  client.on("pong", (data) => {
    messages.push(data.toString());
    if (messages.length === closeAfter) {
      client.close();
    }
  })
  return [client, messages];
}

async function createNClients(n, port) {
  const clients = [];
  for (let i = 0; i < n; i++) {
    let client = await createSocketClient(port);
    clients.push(client);
  }
  return clients;
}

function createAndAddNServerClients(n, protocolServerMock, clientStore) {
  const clientIds = [];
  for (let i = 0; i < n; i++) {
    const clientId = `someId_${i}`;
    const client = {id: clientId, protocolServer: protocolServerMock}
    clientStore.add(client);
    expect(clientStore.has(clientId)).toBe(true);
    clientIds.push(clientId);
  }
  return clientIds;
}

function createAndJoinNPlayers(n, server, protocolServerMock, clientStore) {
  if (n <= 1) throw new Error("Number of players must be greater than 1");
  const clientIds = createAndAddNServerClients(n, protocolServerMock, clientStore);
  const createMessage = {
    type: RequestType.CREATE,
    data: {
        name: "player_0"
    }
  }
  server.handleMessage(clientIds[0], JSON.stringify(createMessage));

  const expectedResponse = {
    type: ResponseType.GAME_STATE,
    data: {
        started: false,
        key: expect.any(String),
        players: ["player_0"],
    }
  }
  expect(protocolServerMock.sendMessageToClient).toHaveBeenCalledWith(clientIds[0], expectedResponse);

  const roomKey = protocolServerMock.sendMessageToClient.mock.calls[0][1].data.key;
  const playersSoFar = ["player_0"];
  const clientsSoFar = ["someId_0"];
  let calledCounter = 2;
  for (let i = 1; i < n; i++) {
    const joinMessage = {
      type: RequestType.JOIN,
      data: {
          name: `player_${i}`,
          key: roomKey,
      }
    }
    server.handleMessage(clientIds[i], JSON.stringify(joinMessage));
    clientsSoFar.push(`someId_${i}`);
    playersSoFar.push(`player_${i}`);
    for (let j = 0; j <= i; j++) {
      const expectedResponseA = {
        type: ResponseType.GAME_STATE,
        data: {
          started: false,
          key: expect.any(String),
          players: playersSoFar, 
        }
      }
      expect(protocolServerMock.sendMessageToClient).toHaveBeenNthCalledWith(calledCounter++, clientIds[j], expectedResponseA);
    }

    // const expectedResponseB = {
    //   type: ResponseType.JOIN_NEW,
    //   data: {
    //       players: playersSoFar,
    //   }
    // }
    // clientsSoFar.forEach(clientId => {
    //   expect(protocolServerMock.sendMessageToClient).toHaveBeenNthCalledWith(calledCounter++, clientId, expectedResponseB);
    // });

  }
  return [clientIds, calledCounter, roomKey];
}

export {
  waitForSocketState,
  createSocketClient,
  createNClients,
  createAndAddNServerClients,
  createAndJoinNPlayers,
};