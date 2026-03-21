import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { ChatSocketProvider } from './contexts/ChatSocketContext';
import { PartySocketProvider } from './contexts/PartySocketContext';
import { GameSocketProvider } from './contexts/GameSocketContext';
import { DuelSocketProvider } from './contexts/DuelSocketContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { FeaturesProvider } from './contexts/FeaturesContext';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <TooltipProvider delayDuration={120}>
          <AuthProvider>
            {/* SocketProvider = base (socket instance, connected, presence, ban) */}
            <SocketProvider>
              {/* PartySocketProvider needs to be before GameSocketProvider */}
              <PartySocketProvider>
                <GameSocketProvider>
                  <DuelSocketProvider>
                    <ChatSocketProvider>
                      <NotificationProvider>
                        <FeaturesProvider>
                          <App />
                        </FeaturesProvider>
                        <Toaster />
                        <SonnerToaster />
                      </NotificationProvider>
                    </ChatSocketProvider>
                  </DuelSocketProvider>
                </GameSocketProvider>
              </PartySocketProvider>
            </SocketProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
