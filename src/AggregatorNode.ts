import chalk from 'chalk';
import http from 'http';
import socketIo, { Socket } from 'socket.io';
import ioClient from 'socket.io-client';

import RedisStore from "./shared/RedisStore";
import TxStore from "./shared/TxStore";
import { PendingTransaction } from "./shared/PendingTransaction";

export default class AggregatorNode {
  readonly verboseLogs = true;

  readonly listenServer: string;

  readonly storePort = 6350;

  readonly broadcastPort = 9000;

  readonly redisStore: RedisStore;

  constructor() {
    this.listenServer = 'http://0.0.0.0:10902';
    this.redisStore = new RedisStore({ port: 6379, host: 'aggregatordb' });
  }

  static log(statement: string) {
    console.log(chalk.bgRed.green.bold(' AGG ') + statement);
  }

  /**
   *  Listens on a known port for connections
   */
  listen() {
    const store = new TxStore(this.redisStore);

    AggregatorNode.log(`listen -> on: ${this.listenServer}`);
    const io = ioClient(this.listenServer, {
      path: '/socket.io',
    });

    io.on('connect', () => {
      AggregatorNode.log('listen -> connection made');

      // Connection made - time to receive messages
      io.on('message', (message: string) => {
        const tx = (<PendingTransaction>JSON.parse(message));
        // Message received.
        if (this.verboseLogs) {
          AggregatorNode.log(`message received: ${tx.hash}`);
        }
        store.save(tx);
      });
    }).on('close', () => {
      AggregatorNode.log('listen -> close');
    }).on('error', () => {
      AggregatorNode.log('listen -> error');
    });
  }


  /**
   *  Emits stored pending transactions
   */
  emit() {
    const store = new TxStore(this.redisStore);
    const httpServer = http.createServer().listen(this.storePort, '0.0.0.0');

    const ioListen = socketIo(httpServer, {
      path: '/',
    });
    AggregatorNode.log('emit -> stored tx');

    ioListen.on('connection', (socket: Socket) => {
      AggregatorNode.log('WS connection success!');

      store.load()
        .subscribe({
          next(value: string) {
            socket.send(value);
            AggregatorNode.log(`emit -> Message sent: ${(<PendingTransaction>JSON.parse(value)).hash}`);
          },
        });
    });
  }

  /**
   * Broadcasts emitted events
   */
  broadcast() {
    const store = new TxStore(this.redisStore);
    const httpServer = http.createServer().listen(this.broadcastPort, '0.0.0.0');

    const ioListen = socketIo(httpServer, {
      path: '/txspending',

    });
    AggregatorNode.log('broadcast -> initing broadcast of stored tx');

    ioListen.on('connection', (socket: Socket) => {
      AggregatorNode.log('broadcast -> socket connection success');

      store.load()
        .subscribe({
          next(value: string) {
            socket.send(value);
            if (false) {
              AggregatorNode.log(`message sent: ${(<PendingTransaction>JSON.parse(value)).hash}`);
            }
          },
          complete() {
            AggregatorNode.log('broadcast -> closed broadcast subscription');
          },
        });
    });
    // .on("disconnect", ());
  }

}
