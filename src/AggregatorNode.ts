import chalk from 'chalk';
import http from 'http';
import socketIo, { Socket } from 'socket.io';
import ioClient from 'socket.io-client';

import RedisStore from "./shared/RedisStore";
import TxStore from "./shared/TxStore";
import { PendingTransaction } from "./shared/PendingTransaction";

export default class AggregatorNode {
  readonly verboseLogs = false;

  readonly listenServer: string;

  readonly aggregatorRedis = 6390;

  readonly storePort = 6350;

  readonly broadcastPort = 9000;

  readonly redisStore: RedisStore;

  constructor() {
    this.listenServer = 'http://127.0.0.1:10902/';
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

    AggregatorNode.log(`listening on: ${this.listenServer}`);
    const io = ioClient(this.listenServer, {
      path: '/socket.io',
    });

    io.on('connect', () => {
      AggregatorNode.log('connection made');

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
      AggregatorNode.log('close');
    }).on('error', () => {
      AggregatorNode.log('error');
    });
  }


  /**
   *  Emits stored pending transactions
   */
  emit() {
    const store = new TxStore(this.redisStore);
    const httpServer = http.createServer().listen(this.storePort, '127.0.0.1');

    const ioListen = socketIo(httpServer, {
      path: '/',
    });
    AggregatorNode.log('Emitting stored tx');

    ioListen.on('connection', (socket: Socket) => {
      AggregatorNode.log('WS connection success!');

      store.load()
        .subscribe({
          next(value) {
            socket.send(value);
            AggregatorNode.log(`Message sent: ${(<PendingTransaction>JSON.parse(value)).hash}`);
          },
        });
    });
  }

  broadcast() {
    const store = new TxStore(this.redisStore);
    const httpServer = http.createServer().listen(this.broadcastPort, '127.0.0.1');

    const ioListen = socketIo(httpServer, {
      path: '/txspending',
    });
    AggregatorNode.log('Broadcasting stored tx');

    ioListen.on('connection', (socket: Socket) => {
      AggregatorNode.log('WS broadcast connection success!');

      store.load()
        .subscribe({
          next(value) {
            socket.send(value);
            if (false) {
              AggregatorNode.log(`message sent: ${(<PendingTransaction>JSON.parse(value)).hash}`);
            }
          },
          complete() {
            AggregatorNode.log('Closed broadcast subscription');
          },
        });
    });
    // .on("disconnect", ());
  }

  // listen on an open socket
  // allow connections
  // accept stream of data

  // parse data
  // store in redis

  // allow for connections to system (via web socket)
  // stream out data from redis
}
