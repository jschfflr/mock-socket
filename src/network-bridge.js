import URL from 'url-parse';
import { reject } from './helpers/array-helpers';

function trimQueryPartFromURL(url) {
  const queryIndex = url.indexOf('?');
  return queryIndex >= 0 ? url.slice(0, queryIndex) : url;
}

/*
 * The network bridge is a way for the mock websocket object to 'communicate' with
 * all available servers. This is a singleton object so it is important that you
 * clean up urlMap whenever you are finished.
 */
class NetworkBridge {
  constructor() {
    this.availableServers = new Map();
  }

  /**
   * Normalize a url to either return the origin or it's pathname
   * in case of socket.io names
   * @param {string} url 
   */
  normalizeUrl(url) {
    const urlRecord = new URL(url);
    return urlRecord.origin || urlRecord.pathname;
  }

  /**
   * Return urlMap by normalized url
   * @param {string} url 
   */
  get(url) {
    return this.availableServers.get(this.normalizeUrl(url));
  }
  /*
   * Attaches a websocket object to the urlMap hash so that it can find the server
   * it is connected to and the server in turn can find it.
   *
   * @param {object} websocket - websocket object to add to the urlMap hash
   * @param {string} url
   */
  attachWebSocket(websocket, url) {
    const connectionLookup = this.get(url);

    if (connectionLookup && connectionLookup.server && connectionLookup.websockets.indexOf(websocket) === -1) {
      connectionLookup.websockets.push(websocket);
      return connectionLookup.server;
    }
  }

  /*
   * Attaches a websocket to a room
   */
  addMembershipToRoom(websocket, room) {
    const connectionLookup = this.get(websocket.url);

    if (connectionLookup && connectionLookup.server && connectionLookup.websockets.indexOf(websocket) !== -1) {
      if (!connectionLookup.roomMemberships[room]) {
        connectionLookup.roomMemberships[room] = [];
      }

      connectionLookup.roomMemberships[room].push(websocket);
    }
  }

  /*
   * Attaches a server object to the urlMap hash so that it can find a websockets
   * which are connected to it and so that websockets can in turn can find it.
   *
   * @param {object} server - server object to add to the urlMap hash
   * @param {string} url
   */
  attachServer(server, url) {
    const normalizedUrl = this.normalizeUrl(url);
    const connectionLookup = this.availableServers.get(normalizedUrl);

    if (!connectionLookup) {
      this.availableServers.set(normalizedUrl, {
        server,
        websockets: [],
        roomMemberships: {}
      });

      return server;
    }
  }

  /*
   * Finds the server which is 'running' on the given url.
   *
   * @param {string} url - the url to use to find which server is running on it
   */
  serverLookup(url) {
    const connectionLookup = this.get(url);

    if (connectionLookup) {
      return connectionLookup.server;
    }
  }

  /*
   * Finds all websockets which is 'listening' on the given url.
   *
   * @param {string} url - the url to use to find all websockets which are associated with it
   * @param {string} room - if a room is provided, will only return sockets in this room
   * @param {class} broadcaster - socket that is broadcasting and is to be excluded from the lookup
   */
  websocketsLookup(url, room, broadcaster) {
    const connectionLookup = this.get(url);
    let websockets;

    websockets = connectionLookup ? connectionLookup.websockets : [];

    if (room) {
      const members = connectionLookup.roomMemberships[room];
      websockets = members || [];
    }

    return broadcaster ? websockets.filter(websocket => websocket !== broadcaster) : websockets;
  }

  /*
   * Removes the entry associated with the url.
   *
   * @param {string} url
   */
  removeServer(url) {
    this.availableServers.delete(this.normalizeUrl(url));
  }

  /*
   * Removes the individual websocket from the map of associated websockets.
   *
   * @param {object} websocket - websocket object to remove from the url map
   * @param {string} url
   */
  removeWebSocket(websocket, url) {
    const connectionLookup = this.get(url);

    if (connectionLookup) {
      connectionLookup.websockets = reject(connectionLookup.websockets, socket => socket === websocket);
    }
  }

  /*
   * Removes a websocket from a room
   */
  removeMembershipFromRoom(websocket, room) {
    const connectionLookup = this.get(websocket.url);
    const memberships = connectionLookup.roomMemberships[room];

    if (connectionLookup && memberships !== null) {
      connectionLookup.roomMemberships[room] = reject(memberships, socket => socket === websocket);
    }
  }
}

export default new NetworkBridge(); // Note: this is a singleton
