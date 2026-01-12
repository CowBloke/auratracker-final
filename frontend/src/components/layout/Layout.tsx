import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import Chat from '../chat/Chat';
import { useState } from 'react';

export default function Layout() {
  const [chatOpen, setChatOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 ml-64 mt-16 p-6 min-h-[calc(100vh-4rem)]">
          <div className={`transition-all duration-300 ${chatOpen ? 'mb-80' : 'mb-16'}`}>
            <Outlet />
          </div>
        </main>
      </div>
      <Chat isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
    </div>
  );
}
