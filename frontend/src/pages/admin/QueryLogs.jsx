import { useState } from "react";
import Badge from "../../components/ui/Badge.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import Modal from "../../components/ui/Modal.jsx";

const MOCK = [
  { id:"1", user:"Dr. Sarah Khan",  question:"What is the first-line treatment for Type 2 diabetes?", status:"answered", sources:3, ms:2340, time:"14:32 Jul 12", answer:"According to ADA 2024 guidelines, metformin remains the preferred initial pharmacologic agent for Type 2 diabetes..." },
  { id:"2", user:"Dr. Ahmed Ali",   question:"List symptoms of heart failure with reduced ejection fraction", status:"answered", sources:2, ms:1890, time:"13:10 Jul 12", answer:"Heart failure with reduced ejection fraction (HFrEF) presents with dyspnea on exertion..." },
  { id:"3", user:"Dr. Priya Patel", question:"What is the capital of France?", status:"refused",  sources:0, ms:410,  time:"12:05 Jul 12", answer:"I can only answer questions based on the uploaded documents..." },
  { id:"4", user:"Dr. Liu Chen",    question:"Explain antibiotic resistance mechanisms", status:"answered", sources:4, ms:3120, time:"11:44 Jul 12", answer:"Antibiotic resistance occurs through several key mechanisms..." },
  { id:"5", user:"Dr. Sarah Khan",  question:"COPD exacerbation management GOLD guidelines", status:"answered", sources:2, ms:2780, time:"10:20 Jul 12", answer:"According to GOLD 2024, COPD exacerbation management includes..." },
  { id:"6", user:"Dr. Ahmed Ali",   question:"Write me a Python script", status:"refused", sources:0, ms:380, time:"09:15 Jul 12", answer:"I can only answer questions based on the uploaded documents..." },
];

export default function QueryLogs() {
  const [selected, setSelected] = useState(null);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState("All");

  const filtered = MOCK.filter(l =>
    (filter === "All" || l.status === filter.toLowerCase()) &&
    l.question.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="page-header">
        <div>
          <h1 className="page-title">Query Audit Log</h1>
          <p className="page-subtitle">Full history of all questions asked by all users</p>
        </div>
        <button className="btn-secondary flex items-center gap-2 text-sm">
          ↓ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
               placeholder="Search questions..."
               className="input-base max-w-sm"/>
        {["All","Answered","Refused"].map(f => (
          <button key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all
                              ${filter===f
                                ? "bg-[#E21B70]/20 border border-[#E21B70]/40 text-[#E21B70]"
                                : "glass-card text-gray-400 hover:text-white"}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-wrapper overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {["Time","User","Question","Status","Sources","Response",""].map(h => (
                <th key={h} className="table-head">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((l, i) => (
              <tr key={l.id} className={`table-row ${i%2===0?"":"bg-white/2"}`}>
                <td className="table-cell text-xs text-gray-500 font-mono whitespace-nowrap">{l.time}</td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <Avatar name={l.user} size="sm"/>
                    <span className="text-xs text-gray-300 whitespace-nowrap">{l.user.split(" ").slice(0,2).join(" ")}</span>
                  </div>
                </td>
                <td className="table-cell max-w-[280px]">
                  <p className="text-sm text-gray-300 line-clamp-2 leading-snug">{l.question}</p>
                </td>
                <td className="table-cell">
                  <Badge variant={l.status==="answered" ? "success" : "warning"}>
                    {l.status}
                  </Badge>
                </td>
                <td className="table-cell text-center font-mono text-xs text-gray-400">{l.sources}</td>
                <td className="table-cell">
                  <span className={`text-xs font-mono ${l.ms > 3000 ? "text-amber-400" : "text-gray-400"}`}>
                    {l.ms}ms
                  </span>
                </td>
                <td className="table-cell">
                  <button onClick={() => setSelected(l)}
                          className="btn-ghost text-xs">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Log detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)}
             title="Query Detail" width="max-w-2xl">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card p-3 rounded-xl">
                <p className="text-[10px] text-gray-500 uppercase mb-1">User</p>
                <p className="text-sm text-white">{selected.user}</p>
              </div>
              <div className="glass-card p-3 rounded-xl">
                <p className="text-[10px] text-gray-500 uppercase mb-1">Status</p>
                <Badge variant={selected.status==="answered"?"success":"warning"}>{selected.status}</Badge>
              </div>
              <div className="glass-card p-3 rounded-xl">
                <p className="text-[10px] text-gray-500 uppercase mb-1">Response time</p>
                <p className="text-sm text-white font-mono">{selected.ms}ms</p>
              </div>
              <div className="glass-card p-3 rounded-xl">
                <p className="text-[10px] text-gray-500 uppercase mb-1">Sources used</p>
                <p className="text-sm text-white">{selected.sources}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase mb-2">Question</p>
              <div className="glass-card p-3 rounded-xl">
                <p className="text-sm text-gray-200">{selected.question}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase mb-2">AI Answer (truncated)</p>
              <div className="glass-card p-3 rounded-xl max-h-40 overflow-y-auto">
                <p className="text-sm text-gray-300 leading-relaxed">{selected.answer}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
