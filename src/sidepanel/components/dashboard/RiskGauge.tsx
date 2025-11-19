import React from 'react';

interface RiskGaugeProps {
  riskScore: number; // 0-100
  riskFactors: string[];
}

const RiskGauge: React.FC<RiskGaugeProps> = ({ riskScore, riskFactors }) => {
  // Determine color and label based on risk score
  let color: string;
  let label: string;
  let healthScore: number;

  if (riskScore <= 30) {
    color = '#4a934e'; // Green
    label = 'Healthy';
    healthScore = 100 - riskScore;
  } else if (riskScore <= 60) {
    color = '#d4880f'; // Yellow
    label = 'Medium Risk';
    healthScore = 100 - riskScore;
  } else {
    color = '#c94a3f'; // Red
    label = 'High Risk';
    healthScore = 100 - riskScore;
  }

  return (
    <div className="risk-gauge-container">
      <div className="risk-gauge-header">
        <h3 className="risk-gauge-title">Group Health Score</h3>
      </div>
      <div className="risk-gauge-display">
        <div className="risk-gauge-circle" style={{ borderColor: color }}>
          <div className="risk-gauge-score" style={{ color }}>
            {healthScore}
          </div>
          <div className="risk-gauge-label" style={{ color }}>
            {label}
          </div>
        </div>
      </div>
      <div className="risk-factors">
        <h4 className="risk-factors-title">
          {riskFactors.length === 1 && riskFactors[0] === 'No issues detected'
            ? 'Status'
            : 'Risk Factors'}
        </h4>
        <ul className="risk-factors-list">
          {riskFactors.slice(0, 3).map((factor, index) => (
            <li key={index} className="risk-factor-item">
              {factor}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default RiskGauge;
