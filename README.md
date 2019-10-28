# Mempool Aggregator

### Starting point
To launch Publisher:

```
docker-compose up --build
```

Two containers will be launched...
* aggregatorapp - aggregator application (listening for ws on port 10902, saving to redis and server tx on ws on port 9000)
* aggregatordb - redis container (standard port)

To listen to a stream of transactions:

Connect your websocket client to port 9000.
    

## TODO
- Some of the same TODOs as Publisher (unit tests, config files, shared code, etc.)


### Some ideas
#### Broadcasting transactions
- Consider broadcasting transactions in chunks so that they are not being transmitted one at a time


- What about when a transaction is no longer a pending transaction?
- Check recent blocks to see if a transaction has been mined

