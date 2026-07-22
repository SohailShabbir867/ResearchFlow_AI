export default function StatCard({ icon, label, value, sub, color = "#E21B70", trend }) {
  return (
    <div className="stat-card group hover:border-white/20 transition-all duration-300">
      {/* Glow blob */}
      <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-10 blur-2xl pointer-events-none"
           style={{ background: color }}/>

      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
             style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
          {icon}
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        )}
      </div>

      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm font-medium text-gray-300 mb-1">{label}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}
