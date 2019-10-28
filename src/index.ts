import AggregatorNode from './AggregatorNode';

const aggregatorNode = new AggregatorNode();
aggregatorNode.listenIncomingTxs('http://host.docker.internal:10902/');
aggregatorNode.emit();
aggregatorNode.broadcastTxStream();
