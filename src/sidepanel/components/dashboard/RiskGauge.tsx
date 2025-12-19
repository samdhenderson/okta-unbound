import React from 'react';

interface RiskGaugeProps {
  riskScore: number; // 0-100
  riskFactors: string[];
}

const RiskGauge: React.FC<RiskGaugeProps> = ({ riskScore, riskFactors }) => {
  // Determine color and label based on risk score
  let colorClasses: { border: string; bg: string; text: string; ring: string };
  let label: string;
  let healthScore: number;

  if (riskScore <= 30) {
    colorClasses = {
      border: 'border-emerald-500',
      bg: 'from-emerald-500 to-emerald-600',
      text: 'text-emerald-600',
      ring: 'ring-emerald-500/20',
    };
    label = 'Healthy';
    healthScore = 100 - riskScore;
  } else if (riskScore <= 60) {
    colorClasses = {
      border: 'border-amber-500',
      bg: 'from-amber-500 to-amber-600',
      text: 'text-amber-600',
      ring: 'ring-amber-500/20',
    };
    label = 'Medium Risk';
    healthScore = 100 - riskScore;
  } else {
    colorClasses = {
      border: 'border-rose-500',
      bg: 'from-rose-500 to-rose-600',
      text: 'text-rose-600',
      ring: 'ring-rose-500/20',
    };
    label = 'High Risk';
    healthScore = 100 - riskScore;
  }

  return (
    <div className="space-y-6">
      {/* Gauge Display */}
      <div className="flex items-center justify-center">
        <div className="relative">
          {/* Outer ring with glow */}
          <div className={`absolute inset-0 rounded-full blur-xl opacity-30 ${colorClasses.ring} bg-gradient-to-br ${colorClasses.bg}`} />

          {/* Main gauge circle */}
          <div className={`relative w-40 h-40 rounded-full border-8 ${colorClasses.border} bg-white flex flex-col items-center justify-center shadow-lg ${colorClasses.ring} ring-8`}>
            <div className={`text-5xl font-bold ${colorClasses.text}`}>
              {healthScore}
            </div>
            <div className={`text-sm font-semibold ${colorClasses.text} mt-1`}>
              {label}
            </div>
          </div>
        </div>
      </div>

      {/* Risk Factors */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold uppercase tracking-wider text-gray-600">
          {riskFactors.length === 1 && riskFactors[0] === 'No issues detected'
            ? 'Status'
            : 'Risk Factors'}
        </h4>
        <ul className="space-y-2">
          {riskFactors.slice(0, 3).map((factor, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
              <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${colorClasses.bg} bg-gradient-to-br`} />
              <span>{factor}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default RiskGauge;
