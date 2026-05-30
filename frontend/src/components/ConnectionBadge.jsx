export default function ConnectionBadge({ connected }) {
  return (
    <span className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
      {connected ? 'Live sync connected' : 'Reconnecting...' }
    </span>
  );
}
