import http from 'http';
import socketIo, { Socket } from 'socket.io';
import ioClient from 'socket.io-client';

import RedisConnection from "./shared/RedisConnection";
import TxStore from "./shared/TxStore";
import { IPendingTransaction } from "./shared/IPendingTransaction";

export default class AggregatorNode {
  readonly verboseLogs = false;

  readonly listenServer: string = 'http://host.docker.internal:10902/';

  readonly dataStorePort = 6379;
  readonly dataStoreHost = 'aggregatordb';

  readonly wsBroadcastPort = 9000;

  txStore: TxStore;

  constructor() {
    const redisConnection = new RedisConnection({
      port: this.dataStorePort,
      host: this.dataStoreHost
    });

    this.txStore = new TxStore(redisConnection);
  }

  /**
   *  Listens on a known port for incoming publisher connections.
   *  This is a websocket client connection.
   */
  listenIncomingTxs() {
    const io = ioClient(this.listenServer, {
      path: '/',
    });

    console.log(`listen -> init on ${this.listenServer}`);

    io.on('connect', () => {
      console.log(`listen -> connection made to ${this.listenServer}`);

      // Connection made - time to receive messages
      io.on('message', (message: string) => {
        // Transaction received
        const tx = (<IPendingTransaction>JSON.parse(message));

        // Message received.
        if (this.verboseLogs) {
          console.log(`listen -> message received: ${tx.hash}`);
        }

        // Save all of the incoming transactions on the redis key/value store
        // This will de-dup the transactions if they're received from multiple nodes.
        this.txStore.save(tx);
      });

    }).on('close', () => {
      console.log('listen -> close');

    }).on('connect_error', (error: string) => {
      console.log('listen -> connect_error ' + error);

    }).on('connect_timeout', (error: string) => {
      console.log('listen -> connect_timeout ' + error);

    }).on('disconnect', (reason: string) => {
      console.log('listen -> disconnect ' + reason);

    }).on('close', () => {
      console.log('listen -> close');

    }).on('error', (error: string) => {
      console.log('listen -> error ' + error);
    });
  }

  /**
   *  Emits stored pending transactions
   */
  emit() {
    const httpServer = http.createServer().listen(this.dataStorePort, '0.0.0.0');

    const ioListen = socketIo(httpServer, {
      path: '/',
    });
    console.log('emit -> stored tx');

    ioListen.on('connection', (socket: Socket) => {
      console.log('emit -> WS connection success!');

      this.txStore.load()
        .subscribe({
          next(value: string) {
            socket.send(value);
            console.log(`emit -> Message sent: ${(<IPendingTransaction>JSON.parse(value)).hash}`);
          },
        });
    });
  }

  /**
   * Broadcasts emitted events.
   *
   * Waits for ws connections and then streams txs from the txStore.
   */
  broadcastTxStream() {
    const httpServer = http.createServer().listen(this.wsBroadcastPort, '0.0.0.0');

    const ioListen = socketIo(httpServer, {
      path: '/txspending',
    });
    console.log('broadcast -> initing broadcast of stored tx');

    ioListen.on('connection', (socket: Socket) => {
      console.log('broadcast -> ws connection success');

      this.txStore.load()
        .subscribe({
          next(value: string) {
            socket.send(value);
            if (false) {
              console.log(`message sent: ${(<IPendingTransaction>JSON.parse(value)).hash}`);
            }
          },
          complete() {
            console.log('broadcast -> closed broadcast subscription');
          },
        });
    });
    // .on("disconnect", ());
  }

}
