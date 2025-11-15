import React, { useState } from 'react';

const RulesTab: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadRules = async () => {
    setIsLoading(true);
    // TODO: Implement rule fetching
    setTimeout(() => {
      setIsLoading(false);
      alert('Rule loading - Coming soon!');
    }, 500);
  };

  return (
    <div className="tab-content active">
      <div className="section">
        <h2>Group Rules</h2>
        <p className="section-description">Analyze group rules in your Okta organization</p>

        <div className="rules-toolbar">
          <button className="btn btn-primary" onClick={handleLoadRules} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Load Rules'}
            <span className="info-icon" data-tooltip="~1-2 fetch (read-only)">
              i
            </span>
          </button>
          <input type="text" className="input" placeholder="Search..." disabled={!rules.length} />
        </div>

        <div className="rules-container">
          <p className="muted">Click "Load Rules" to begin</p>
        </div>
      </div>
    </div>
  );
};

export default RulesTab;
