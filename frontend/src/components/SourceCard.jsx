export default function SourceCard({ source }) {
  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1">
      <span className="text-primary text-xs">📄</span>
      <span className="text-xs text-gray-500 truncate">{source}</span>
    </div>
  );
}
