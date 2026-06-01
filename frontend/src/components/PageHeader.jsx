import ConnectionBadge from './ConnectionBadge.jsx';

export default function PageHeader({ title, connected }) {
  return (
    <header className="universal-page-header">
      <h1 className="universal-page-title">{title}</h1>
      <ConnectionBadge connected={connected} />
    </header>
  );
}
