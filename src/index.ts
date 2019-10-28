import AggregatorNode from './AggregatorNode';

const aggregatorNode = new AggregatorNode();
aggregatorNode.listenIncomingTxs();
aggregatorNode.emit();
aggregatorNode.broadcastTxStream();
