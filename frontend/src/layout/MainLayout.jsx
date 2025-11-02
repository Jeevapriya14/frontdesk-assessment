import React from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
export default function MainLayout({ children }) {
  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
