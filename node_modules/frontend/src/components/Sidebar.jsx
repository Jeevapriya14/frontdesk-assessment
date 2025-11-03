import React from 'react';
import { NavLink } from 'react-router-dom';
export default function Sidebar() {
  const items = [
    { to: '/', label: 'Dashboard' },
    { to: '/requests', label: 'Requests' },
    { to: '/learned', label: 'Learned Answers' },
  ];
  return (
    <aside className="w-64 bg-white border-r min-h-screen p-4">
      <div className="mb-6 font-semibold">Menu</div>
      <nav className="flex flex-col gap-2">
        {items.map(i => (
          <NavLink
            key={i.to}
            to={i.to}
            className={({isActive}) => "p-2 rounded " + (isActive ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-100")}
          >
            {i.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
