import http from 'http';
import socketIo, { Socket } from 'socket.io';
import ioClient from 'socket.io-client';

import RedisConnection from "./shared/RedisConnection";
import TxStore from "./shared/TxStore";
import { IPendingTransaction } from "./shared/IPendingTransaction";

export default class AggregatorNode {
  readonly verboseLogs = false;

  readonly aggregateListener: string = 'http://host.docker.internal:10902/';

  readonly dataStoreHost = 'aggregatordb';
  readonly dataStorePort = 6379;

  readonly broadcastPort = 9000;

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
  aggregate() {
    const io = ioClient(this.aggregateListener, {
      path: '/',
    });
    console.log(`aggregate -> init on ${this.aggregateListener}`);

    io.on('connect', () => {
      console.log(`aggregate -> connected to ${this.aggregateListener}`);

      io.on('message', (message: string) => {
        // Transaction received
        const tx = (<IPendingTransaction>JSON.parse(message));
        if (this.verboseLogs) {
          console.log(`aggregate -> message received: ${tx.hash}`);
        }

        // Save all of the incoming transactions on the redis key/value store
        // This will de-dup the transactions if they're received from multiple nodes.
        this.txStore.save(tx);
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
    const httpServer = http.createServer().listen(this.broadcastPort, '0.0.0.0');

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
  }

}
