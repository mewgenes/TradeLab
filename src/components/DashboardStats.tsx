import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardStatsProps {
  stats: {
    totalPnL: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winningDays: number;
    losingDays: number;
    totalDays: number;
    avgWin: number;
    avgLoss: number;
    avgRR: number;
  };
}

const SemiCircleGauge = ({ value, wins, losses }: { value: number, wins: number, losses: number }) => {
  const radius = 40;
  const circumference = Math.PI * radius;
  // Ensure value is between 0 and 100
  const safeValue = Math.min(Math.max(value, 0), 100);
  const strokeDashoffset = circumference - (safeValue / 100) * circumference;
  
  return (
    <div className="flex flex-col items-center justify-end w-full relative">
        <svg viewBox="0 0 100 50" className="w-full overflow-visible">
            {/* Background (Loss/Red) */}
            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" opacity="0.8" />
            {/* Foreground (Win/Green) */}
            <path 
                d="M 10 50 A 40 40 0 0 1 90 50" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="8" 
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-out"
            />
        </svg>
        <div className="w-full flex justify-between px-0 text-[9px] font-medium mt-1">
            <span className="bg-green-500/10 text-green-500 px-1 rounded-sm">{wins}</span>
            <span className="text-muted-foreground/40">0</span>
            <span className="bg-red-500/10 text-red-500 px-1 rounded-sm">{losses}</span>
        </div>
    </div>
  );
};

const CircleGauge = ({ value }: { value: number }) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    // Cap at 3 for visual scaling
    const maxVal = 3;
    const percentage = Math.min(value / maxVal, 1);
    const strokeDashoffset = circumference - percentage * circumference;

    return (
        <div className="relative h-full w-full flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                <circle 
                    cx="50" cy="50" r="40" 
                    fill="none" 
                    stroke={value >= 1 ? "#10b981" : "#ef4444"} 
                    strokeWidth="8" 
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
        </div>
    );
}

const HorizontalBar = ({ win, loss }: { win: number, loss: number }) => {
    const total = win + loss;
    // Avoid division by zero
    const winPercent = total > 0 ? (win / total) * 100 : 50;
    
    const formatCurrencyK = (val: number) => {
        if (Math.abs(val) >= 1000) {
            return `$${(val / 1000).toFixed(2)}K`;
        }
        return `$${val.toFixed(0)}`;
    }

    return (
        <div className="w-full flex flex-col gap-1.5">
            <div className="h-1.5 w-full flex rounded-full overflow-hidden bg-muted/30">
                <div style={{ width: `${winPercent}%` }} className="bg-green-500 h-full transition-all duration-500" />
                <div style={{ width: `${100 - winPercent}%` }} className="bg-red-500 h-full transition-all duration-500" />
            </div>
            <div className="flex justify-between text-[9px] font-medium">
                <span className="text-green-500">{formatCurrencyK(win)}</span>
                <span className="text-red-500">-{formatCurrencyK(loss)}</span>
            </div>
        </div>
    );
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const avgWinLossRatio = stats.avgLoss > 0 ? stats.avgWin / stats.avgLoss : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {/* Net P&L */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
        <CardContent className="p-5 flex flex-col justify-between h-full min-h-[110px]">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Net P&L</span>
            </div>
          </div>
          <div>
            <span className={cn(
              "text-2xl font-bold tracking-tight",
              stats.totalPnL >= 0 ? "text-green-500" : "text-red-500"
            )}>
              ${stats.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Win Rate */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
        <CardContent className="p-5 flex items-center justify-between h-full gap-2 min-h-[110px]">
          <div className="flex flex-col justify-between h-full py-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground">Win Rate</span>
            </div>
            <span className="text-2xl font-bold tracking-tight">
              {stats.winRate.toFixed(2)}%
            </span>
          </div>
          <div className="w-24 h-16 relative">
             <SemiCircleGauge 
                value={stats.winRate} 
                wins={stats.winningTrades} 
                losses={stats.losingTrades} 
             />
          </div>
        </CardContent>
      </Card>

      {/* Profit Factor */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
        <CardContent className="p-5 flex items-center justify-between h-full gap-2 min-h-[110px]">
          <div className="flex flex-col justify-between h-full py-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground">Profit Factor</span>
            </div>
            <span className="text-2xl font-bold tracking-tight">
              {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
            </span>
          </div>
          <div className="w-12 h-12">
            <CircleGauge value={stats.profitFactor === Infinity ? 3 : stats.profitFactor} />
          </div>
        </CardContent>
      </Card>

      {/* Average RR */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
        <CardContent className="p-5 flex items-center justify-between h-full gap-2 min-h-[110px]">
          <div className="flex flex-col justify-between h-full py-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground">Average RR</span>
            </div>
            <span className="text-2xl font-bold tracking-tight">
              {stats.avgRR.toFixed(2)}
            </span>
          </div>
          <div className="w-12 h-12">
            <CircleGauge value={stats.avgRR} />
          </div>
        </CardContent>
      </Card>

      {/* Avg win/loss trade */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
        <CardContent className="p-5 flex flex-col justify-between h-full min-h-[110px]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-muted-foreground">Avg win/loss trade</span>
          </div>
          <div className="flex items-end justify-between gap-3">
             <span className="text-2xl font-bold tracking-tight">
              {avgWinLossRatio.toFixed(2)}
            </span>
            <div className="flex-1 pb-1 min-w-[80px]">
                <HorizontalBar win={stats.avgWin} loss={stats.avgLoss} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
