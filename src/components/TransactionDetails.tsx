import { useCopy } from '../hooks/useCopy';
import { formatTimestamp } from './PreviewCard';
import type { PreviewCardData } from './PreviewCard';

/** On-chain details for one transaction: the same PreviewCardData the desktop hover preview shows. */
export function TransactionDetails({ data }: { data: PreviewCardData }) {
  const { copied, supported, handleCopy } = useCopy();
  return (
    <dl className="bh-details">
      {data.network && (
        <>
          <dt>Network</dt>
          <dd>{data.network}</dd>
        </>
      )}
      {data.confirmations !== undefined && (
        <>
          <dt>Confirmations</dt>
          <dd>{data.confirmations}</dd>
        </>
      )}
      {data.txHash && (
        <>
          <dt>Transaction hash</dt>
          <dd className="bh-details__hash">
            <code>{data.txHash}</code>
            {supported && (
              <button
                type="button"
                className="bh-details__copy"
                aria-label="Copy transaction hash"
                onClick={() => handleCopy(data.txHash as string)}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
          </dd>
        </>
      )}
      {data.timestamp && (
        <>
          <dt>Time</dt>
          <dd>
            <time dateTime={data.timestamp}>{formatTimestamp(data.timestamp)}</time>
          </dd>
        </>
      )}
    </dl>
  );
}

export default TransactionDetails;
