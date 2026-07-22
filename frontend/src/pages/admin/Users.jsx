import { useState } from "react";
import Badge from "../../components/ui/Badge.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import Modal from "../../components/ui/Modal.jsx";

const MOCK = [
  { _id:"1", name:"Dr. Sarah Khan",  email:"sarah@hospital.com", role:"Doctor",     specialty:"Cardiology",    status:"active",    lastActive:"2m ago",   queries:47 },
  { _id:"2", name:"Dr. Ahmed Ali",   email:"ahmed@hospital.com", role:"Doctor",     specialty:"Endocrinology", status:"active",    lastActive:"1h ago",   queries:23 },
  { _id:"3", name:"Dr. Priya Patel", email:"priya@hospital.com", role:"Researcher", specialty:"Oncology",      status:"active",    lastActive:"3h ago",   queries:89 },
  { _id:"4", name:"Dr. Liu Chen",    email:"liu@hospital.com",   role:"Viewer",     specialty:"Neurology",     status:"suspended", lastActive:"2d ago",   queries:5  },
  { _id:"5", name:"Admin",           email:"admin@hospital.com", role:"Admin",      specialty:"—",             status:"active",    lastActive:"just now", queries:0  },
];

const ROLE_COLORS = { Admin:"primary", Doctor:"info", Researcher:"success", Viewer:"ghost" };
const STATUS_COLORS = { active:"success", suspended:"error" };

export default function Users() {
  const [users, setUsers]     = useState(MOCK);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch]   = useState("");
  const [roleFilter, setRole] = useState("All");
  const [form, setForm]       = useState({ name:"", email:"", role:"Doctor", specialty:"", password:"" });
  const [delConfirm, setDel]  = useState(null);

  const filtered = users.filter(u =>
    (roleFilter === "All" || u.role === roleFilter) &&
    (u.name.toLowerCase().includes(search.toLowerCase()) ||
     u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleStatus = id => setUsers(p => p.map(u =>
    u._id === id ? {...u, status: u.status === "active" ? "suspended" : "active"} : u
  ));

  return (
    <div className="p-8">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{users.length} total users</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <span>+</span> Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
               placeholder="Search by name or email..."
               className="input-base max-w-xs"/>
        {["All","Admin","Doctor","Researcher","Viewer"].map(r => (
          <button key={r}
                  onClick={() => setRole(r)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all
                              ${roleFilter===r
                                ? "bg-[#E21B70]/20 border border-[#E21B70]/40 text-[#E21B70]"
                                : "glass-card text-gray-400 hover:text-white"}`}>
            {r}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-wrapper overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {["User","Role","Specialty","Status","Last Active","Queries","Actions"].map(h => (
                <th key={h} className="table-head">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u._id}
                  className={`table-row ${i % 2 === 0 ? "" : "bg-white/2"}`}>
                <td className="table-cell">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} size="sm"/>
                    <div>
                      <p className="text-sm font-medium text-white">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="table-cell">
                  <Badge variant={ROLE_COLORS[u.role]}>{u.role}</Badge>
                </td>
                <td className="table-cell text-gray-400">{u.specialty}</td>
                <td className="table-cell">
                  <Badge variant={STATUS_COLORS[u.status]}>{u.status}</Badge>
                </td>
                <td className="table-cell text-gray-500 text-xs">{u.lastActive}</td>
                <td className="table-cell font-mono text-xs text-gray-300">{u.queries}</td>
                <td className="table-cell">
                  <div className="flex items-center gap-1.5">
                    <button className="btn-ghost text-xs py-1 px-2">✏</button>
                    <button onClick={() => toggleStatus(u._id)}
                            className={`btn-ghost text-xs py-1 px-2 ${
                              u.status==="active" ? "hover:text-amber-400" : "hover:text-emerald-400"}`}>
                      {u.status==="active" ? "⏸" : "▶"}
                    </button>
                    <button onClick={() => setDel(u)}
                            className="btn-ghost text-xs py-1 px-2 hover:text-red-400">
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Create New User">
        <div className="space-y-4">
          {[["Full name","text","name","Dr. Jane Smith"],
            ["Email address","email","email","doctor@hospital.com"],
            ["Medical specialty","text","specialty","e.g. Cardiology"],
            ["Temporary password","password","password","min 8 characters"]
          ].map(([label, type, key, ph]) => (
            <div key={key}>
              <label className="input-label">{label}</label>
              <input type={type} placeholder={ph}
                     value={form[key]} onChange={e => setForm(p => ({...p,[key]:e.target.value}))}
                     className="input-base"/>
            </div>
          ))}
          <div>
            <label className="input-label">Role</label>
            <select value={form.role} onChange={e => setForm(p => ({...p,role:e.target.value}))}
                    className="input-base">
              {["Doctor","Researcher","Viewer","Admin"].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
            <button className="btn-primary flex-1">Create User</button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!delConfirm} onClose={() => setDel(null)} title="Delete User" width="max-w-sm">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30
                          flex items-center justify-center text-2xl mx-auto mb-4">
            🗑
          </div>
          <p className="text-white font-semibold mb-1">Delete {delConfirm?.name}?</p>
          <p className="text-sm text-gray-500 mb-6">
            This will remove their account and all chat history. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDel(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => { setUsers(p => p.filter(u => u._id !== delConfirm._id)); setDel(null); }}
                    className="btn-danger flex-1">Delete permanently</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
