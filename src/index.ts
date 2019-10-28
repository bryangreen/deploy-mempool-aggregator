import AggregatorNode from './AggregatorNode';

const aggregatorNode = new AggregatorNode();
aggregatorNode.aggregate();
//aggregatorNode.emit();
aggregatorNode.broadcastTxStream();
