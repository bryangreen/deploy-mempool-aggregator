import config from 'config';
import http from 'http';
import socketIo, { Socket } from 'socket.io';
import ioClient from 'socket.io-client';

import RedisConnection from "./shared/RedisConnection";
import TxStore from "./shared/TxStore";
import { IPendingTransaction } from "./shared/IPendingTransaction";

export default class AggregatorNode {
  readonly verboseLogs = false;
  readonly showStats = false;

  txStore: TxStore;

  constructor() {
    const redisConnection = new RedisConnection({
      port: config.get('store.port'),
      host: config.get('store.host')
    });

    this.txStore = new TxStore(redisConnection);
  }

  /**
   *  Listens on a known port for incoming publisher connections.
   *  This is a websocket client connection.
   */
  aggregate() {
    const url:string = config.get('listener.url');

    const io = ioClient(url, {
      path: config.get('listener.path'),
    });
    console.log(`aggregate -> init on ${url}`);

    io.on('connect', () => {
      console.log(`aggregate -> connected to ${url}`);

      io.on('message', (message: string) => {
        // Transaction received
        const tx = (<IPendingTransaction>JSON.parse(message));
        if (this.verboseLogs) {
          console.log(`aggregate -> message received: ${tx.hash}`);
        }

        // Save all of the incoming transactions on the redis key/value store
        // This will de-dup the transactions if they're received from multiple nodes.
        this.txStore.save(tx);

        if(this.showStats) {
          console.log(`aggregate -> tx received ${this.txStore.txReceived}, tx saved ~${this.txStore.txSaved}`)
        }
      });

    }).on('close', () => {
      // TODO could probably remove some of these events, useful for testing.
      console.log('aggregate -> close');

    }).on('connect_error', (error: string) => {
      console.log(`aggregate -> connect_error ${error}`);

    }).on('connect_timeout', (error: string) => {
      console.log(`aggregate -> connect_timeout ${error}`);

    }).on('disconnect', (reason: string) => {
      console.log(`aggregate -> disconnect ${reason}`);

    }).on('close', () => {
      console.log('aggregate -> close');

    }).on('error', (error: string) => {
      console.log(`aggregate -> error ${error}`);
    });
  }

  /**
   * Broadcasts emitted events.
   *
   * Waits for ws connections and then streams txs from the txStore.
   */
  broadcastTxStream() {
    const broadcastHost:string = config.get('broadcast.host');
    const broadcastPort:number = config.get('broadcast.port');

    const httpServer = http.createServer().listen(broadcastPort, broadcastHost);

    const ioListen = socketIo(httpServer, {
      path: '/txspending',
    });
    console.log(`broadcast -> serving tx via ws at ${broadcastHost}:${broadcastPort}`);

    const that = this;
    ioListen.on('connection', (socket: Socket) => {
      console.log(`broadcast -> ws connect from ${socket.conn.remoteAddress}`);

      this.txStore.load(true)
        .subscribe({
          next(value: string) {
            socket.send(value);
            if (that.verboseLogs) {
              console.log(`broadcast -> message sent: ${(<IPendingTransaction>JSON.parse(value)).hash}`);
            }
          },
          complete() {
            console.log('broadcast -> closed broadcast subscription');
          },
        });
    }).on('disconnecting', (socket: Socket) => {
      console.log(`broadcast -> ws disconnect from ${socket.conn.remoteAddress}`);
    });
  }

}
