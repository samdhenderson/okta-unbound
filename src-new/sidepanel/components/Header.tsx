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

  return (
    <header className="header">
      <h1>Okta Unbound</h1>
      <div className={`status-indicator ${status}`}>
        <span className="status-dot"></span>
        <span className="status-text">{statusText}</span>
      </div>
    </header>
  );
};

export default Header;
