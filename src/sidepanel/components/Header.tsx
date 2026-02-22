import React from 'react';

interface HeaderProps {
  status: 'connecting' | 'connected' | 'error';
}

const Header: React.FC<HeaderProps> = ({ status }) => {
  const statusText = {
    connecting: 'Connecting...',
    connected: 'Connected',
    error: 'Disconnected',
  }[status];

  const statusDot = {
    connecting: 'bg-warning',
    connected: 'bg-success',
    error: 'bg-danger',
  }[status];

  return (
    <header className="bg-white border-b border-neutral-200 z-50">
      <div className="px-5 py-3 flex items-center justify-between">
        <h1 className="text-base font-semibold text-neutral-900 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
          Okta <span className="font-normal text-neutral-600">Unbound</span>
        </h1>

        <div className="flex items-center gap-2 text-xs font-medium text-neutral-700">
          <span className={`w-2 h-2 rounded-full ${statusDot} ${status === 'connecting' ? 'animate-pulse' : ''}`} />
          <span>{statusText}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
