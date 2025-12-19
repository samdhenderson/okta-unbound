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

  const statusConfig = {
    connecting: {
      dotColor: 'bg-amber-400',
      ringColor: 'ring-amber-400/30',
      textColor: 'text-amber-50',
      bgGradient: 'from-amber-500/15 to-transparent',
      glowColor: 'shadow-amber-500/20',
    },
    connected: {
      dotColor: 'bg-emerald-400',
      ringColor: 'ring-emerald-400/30',
      textColor: 'text-emerald-50',
      bgGradient: 'from-emerald-500/15 to-transparent',
      glowColor: 'shadow-emerald-500/20',
    },
    error: {
      dotColor: 'bg-rose-400',
      ringColor: 'ring-rose-400/30',
      textColor: 'text-rose-50',
      bgGradient: 'from-rose-500/15 to-transparent',
      glowColor: 'shadow-rose-500/20',
    },
  }[status];

  return (
    <header className="relative overflow-hidden gradient-okta-mesh text-white shadow-xl z-50">
      {/* Animated mesh gradient overlay */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-white/5 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-96 h-full bg-gradient-to-r from-cyan-400/5 via-transparent to-transparent" />
      </div>

      {/* Animated status glow */}
      <div className={`absolute top-0 right-0 w-80 h-full bg-gradient-to-l ${statusConfig.bgGradient} transition-all duration-700 ease-out`} />

      <div className="relative px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Logo area - could add icon here */}
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight leading-tight" style={{ fontFamily: 'var(--font-primary)' }}>
              Okta <span className="font-light opacity-90">Unbound</span>
            </h1>
            <p className="text-xs text-blue-100/80 mt-1 font-medium tracking-wide">
              Advanced Identity Management
            </p>
          </div>
        </div>

        {/* Status indicator with elevated design */}
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 ${statusConfig.glowColor} shadow-lg transition-all duration-300`}>
          <div className="relative flex items-center justify-center">
            {/* Pulsing ring */}
            {status === 'connecting' && (
              <span className={`absolute w-4 h-4 rounded-full ${statusConfig.dotColor} animate-ping opacity-75`} />
            )}
            {/* Status dot with ring */}
            <span className={`relative w-2.5 h-2.5 rounded-full ${statusConfig.dotColor} ring-4 ${statusConfig.ringColor} shadow-lg`} />
          </div>
          <span className={`text-xs font-semibold ${statusConfig.textColor} tracking-wide`} style={{ fontFamily: 'var(--font-primary)' }}>
            {statusText}
          </span>
        </div>
      </div>

      {/* Bottom edge highlight */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </header>
  );
};

export default Header;
