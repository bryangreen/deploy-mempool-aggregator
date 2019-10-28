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
    this.listenServer = 'http://:10902/';
    // this.redisStore = new RedisStore({ port: 6390, host: 'aggregatordb' });
    this.redisStore = new RedisStore({ port: 6379, host: '0.0.0.0' });
  }

  /**
   *  Listens on a known port for connections
   */
  listen() {
    const store = new TxStore(this.redisStore);

    const io = ioClient(this.listenServer, {
      path: '/',
    });

    // const httpServer = http.createServer().listen(10902, '0.0.0.0');
    //
    // const io = socketIo(httpServer, {
    //   path: '/',
    // });
    console.log(`listen -> init`);


    io.on('connect', () => {
      console.log('listen -> connection made');

      // Connection made - time to receive messages
      io.on('message', (message: string) => {
        const tx = (<PendingTransaction>JSON.parse(message));
        // Message received.
        if (this.verboseLogs) {
          console.log(`listen -> message received: ${tx.hash}`);
        }
        store.save(tx);
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
    }).on('error', (error:string) => {
      console.log('listen -> error ' + error);
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
    console.log('emit -> stored tx');

    ioListen.on('connection', (socket: Socket) => {
      console.log('WS connection success!');

      store.load()
        .subscribe({
          next(value: string) {
            socket.send(value);
            console.log(`emit -> Message sent: ${(<PendingTransaction>JSON.parse(value)).hash}`);
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
    console.log('broadcast -> initing broadcast of stored tx');

    ioListen.on('connection', (socket: Socket) => {
      console.log('broadcast -> socket connection success');

      store.load()
        .subscribe({
          next(value: string) {
            socket.send(value);
            if (false) {
              console.log(`message sent: ${(<PendingTransaction>JSON.parse(value)).hash}`);
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
