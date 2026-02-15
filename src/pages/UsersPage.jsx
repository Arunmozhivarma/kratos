import { useState } from 'react';
import { users } from '../data/mockData';

export default function UsersPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users (Admin Only)</h1>
        <button onClick={() => setOpen(true)} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white">Add User</button>
      </div>
      <div className="card-surface overflow-x-auto p-5">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-gray-500"><th className="pb-2">Username</th><th>Role</th><th>Last Login</th><th>Action</th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.username} className="border-t border-gray-100"><td className="py-3">{user.username}</td><td><select className="rounded-lg border border-emerald-100 px-2 py-1"><option>{user.role}</option><option>Admin</option><option>Operator</option></select></td><td>{user.lastLogin}</td><td><button className="text-primary">Edit</button></td></tr>)}</tbody>
        </table>
      </div>
      {open && <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4"><div className="card-surface w-full max-w-md p-6"><h3 className="text-lg font-semibold">Add User</h3><input className="mt-4 w-full rounded-xl border border-emerald-100 px-3 py-2" placeholder="Username" /><button onClick={() => setOpen(false)} className="mt-4 rounded-xl bg-primary px-4 py-2 text-white">Save (UI only)</button></div></div>}
    </div>
  );
}
