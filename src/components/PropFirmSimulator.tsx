import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export function PropFirmSimulator() {
  const [winRate, setWinRate] = useState<number | ''>(50);
  const [riskReward, setRiskReward] = useState<number | ''>(2);
  const [riskPerTrade, setRiskPerTrade] = useState<number | ''>(1);
  const [profitTarget, setProfitTarget] = useState<number | ''>(10);
  const [maxDrawdown, setMaxDrawdown] = useState<number | ''>(10);
  const [numSimulations, setNumSimulations] = useState<number | ''>(10000);
  const [riskStyle, setRiskStyle] = useState<'compounding' | 'fixed'>('fixed');
  const [tradesPerDay, setTradesPerDay] = useState<number | ''>(2);

  // Financial Inputs
  const [challengeFee, setChallengeFee] = useState<number | ''>(500);
  const [accountSize, setAccountSize] = useState<number | ''>(100000);
  const [profitSplit, setProfitSplit] = useState<number | ''>(80);
  const [payoutTargetPct, setPayoutTargetPct] = useState<number | ''>(4);
  const [feeRefundPct, setFeeRefundPct] = useState<number | ''>(100);

  const [results, setResults] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});

  const clearInputError = (key: string) => {
    setInputErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const runSimulation = () => {
    const errors: Record<string, string> = {};
    const requiredNumber = (key: string, value: number | '') => {
      if (value === '') {
        errors[key] = 'Required';
        return null;
      }
      if (!Number.isFinite(value)) {
        errors[key] = 'Enter a valid number';
        return null;
      }
      return value;
    };

    const wrVal = requiredNumber('winRate', winRate);
    const rrVal = requiredNumber('riskReward', riskReward);
    const riskPerTradeVal = requiredNumber('riskPerTrade', riskPerTrade);
    const profitTargetVal = requiredNumber('profitTarget', profitTarget);
    const maxDrawdownVal = requiredNumber('maxDrawdown', maxDrawdown);
    const tradesPerDayVal = requiredNumber('tradesPerDay', tradesPerDay);
    const numSimulationsVal = requiredNumber('numSimulations', numSimulations);

    const challengeFeeVal = requiredNumber('challengeFee', challengeFee);
    const accountSizeVal = requiredNumber('accountSize', accountSize);
    const profitSplitVal = requiredNumber('profitSplit', profitSplit);
    const payoutTargetPctVal = requiredNumber('payoutTargetPct', payoutTargetPct);
    const feeRefundPctVal = requiredNumber('feeRefundPct', feeRefundPct);

    if (Object.keys(errors).length > 0) {
      setInputErrors(errors);
      return;
    }

    setInputErrors({});
    setIsSimulating(true);

    // Use setTimeout to allow UI to update before heavy computation
    setTimeout(() => {
      const wr = (wrVal as number) / 100;
      const rr = rrVal as number;
      const risk = (riskPerTradeVal as number) / 100;
      const target = 1 + ((profitTargetVal as number) / 100);
      const drawdownLimit = 1 - ((maxDrawdownVal as number) / 100);
      const maxTrades = 1000;
      const tradesPerDayLocal = tradesPerDayVal as number;
      const numSimulationsLocal = numSimulationsVal as number;
      const challengeFeeLocal = challengeFeeVal as number;
      const accountSizeLocal = accountSizeVal as number;
      const profitSplitLocal = profitSplitVal as number;
      const payoutTargetPctLocal = payoutTargetPctVal as number;
      const feeRefundPctLocal = feeRefundPctVal as number;

      let passedCount = 0;
      let failedCount = 0;
      let totalTradesToPass = 0;

      // Store paths for visualization (only keep up to 50 paths to avoid memory issues)
      const pathsToVisualize: any[] = [];
      const numPathsToKeep = 50;

      const netProfitOnPayout =
        (accountSizeLocal * (payoutTargetPctLocal / 100) * (profitSplitLocal / 100)) +
        (challengeFeeLocal * (feeRefundPctLocal / 100));
      const breakEvenPassRate = (challengeFeeLocal / (netProfitOnPayout + challengeFeeLocal)) * 100;

      // Handle edge cases
      if (wr <= 0) {
        setResults({
          passRate: 0,
          avgTradesToPass: 0,
          avgDaysToPass: 0,
          riskOfRuin: 100,
          paths: [],
          epv: -challengeFeeLocal,
          roi: -100,
          probOfProfit: 0,
          breakEvenPassRate,
          netProfitOnPayout,
          plotMaxDrawdown: maxDrawdownVal as number,
          plotProfitTarget: profitTargetVal as number,
          plotChallengeFee: challengeFeeLocal
        });
        setIsSimulating(false);
        return;
      }

      if (wr >= 1) {
        const tradesNeeded = Math.ceil((target - 1) / (risk * rr));
        setResults({
          passRate: 100,
          avgTradesToPass: tradesNeeded,
          avgDaysToPass: tradesNeeded / tradesPerDayLocal,
          riskOfRuin: 0,
          paths: [],
          epv: netProfitOnPayout,
          roi: (netProfitOnPayout / challengeFeeLocal) * 100,
          probOfProfit: 100,
          breakEvenPassRate,
          netProfitOnPayout,
          plotMaxDrawdown: maxDrawdownVal as number,
          plotProfitTarget: profitTargetVal as number,
          plotChallengeFee: challengeFeeLocal
        });
        setIsSimulating(false);
        return;
      }

      for (let i = 0; i < numSimulationsLocal; i++) {
        let balance = 1.0;
        let trades = 0;
        let passed = false;
        let failed = false;

        const currentPath = [{ trade: 0, balance: 1.0 }];

        while (trades < maxTrades && !passed && !failed) {
          trades++;
          const isWin = Math.random() < wr;

          const riskAmount = riskStyle === 'compounding' ? balance * risk : 1.0 * risk;

          if (isWin) {
            balance += riskAmount * rr;
          } else {
            balance -= riskAmount;
          }

          if (pathsToVisualize.length < numPathsToKeep || i < numPathsToKeep) {
            currentPath.push({ trade: trades, balance });
          }

          if (balance >= target) {
            passed = true;
            passedCount++;
            totalTradesToPass += trades;
          } else if (balance <= drawdownLimit) {
            failed = true;
            failedCount++;
          }
        }

        if (pathsToVisualize.length < numPathsToKeep) {
          pathsToVisualize.push(currentPath);
        }
      }

      // Format data for Recharts
      // We need to pivot the data so each trade number has values for multiple lines
      const chartData: any[] = [];
      const maxPathLength = Math.max(...pathsToVisualize.map((p) => p.length), 0);

      for (let t = 0; t < maxPathLength; t++) {
        const dataPoint: any = { trade: t };
        pathsToVisualize.forEach((path, index) => {
          if (t < path.length) {
            dataPoint[`path${index}`] = (path[t].balance - 1) * 100; // Convert to % return
          } else {
            // Carry forward the last value if the simulation ended early
            dataPoint[`path${index}`] = (path[path.length - 1].balance - 1) * 100;
          }
        });
        chartData.push(dataPoint);
      }

      // Secondary simulation for funded stage
      let fundedPassedCount = 0;
      const fundedTarget = 1 + (payoutTargetPctLocal / 100);

      for (let i = 0; i < numSimulationsLocal; i++) {
        let balance = 1.0;
        let trades = 0;
        let passed = false;
        let failed = false;

        while (trades < maxTrades && !passed && !failed) {
          trades++;
          const isWin = Math.random() < wr;
          const riskAmount = riskStyle === 'compounding' ? balance * risk : 1.0 * risk;

          if (isWin) {
            balance += riskAmount * rr;
          } else {
            balance -= riskAmount;
          }

          if (balance >= fundedTarget) {
            passed = true;
            fundedPassedCount++;
          } else if (balance <= drawdownLimit) {
            failed = true;
          }
        }
      }

      const fundedPassRate = fundedPassedCount / numSimulationsLocal;
      const challengePassRate = passedCount / numSimulationsLocal;

      const epv = (challengePassRate * netProfitOnPayout) - ((1 - challengePassRate) * challengeFeeLocal);
      const roi = (epv / challengeFeeLocal) * 100;
      const probOfProfit = challengePassRate * fundedPassRate * 100;

      setResults({
        passRate: challengePassRate * 100,
        avgTradesToPass: passedCount > 0 ? totalTradesToPass / passedCount : 0,
        avgDaysToPass: passedCount > 0 ? (totalTradesToPass / passedCount) / tradesPerDayLocal : 0,
        riskOfRuin: (failedCount / numSimulationsLocal) * 100,
        chartData,
        numPaths: pathsToVisualize.length,
        epv,
        roi,
        probOfProfit,
        breakEvenPassRate,
        netProfitOnPayout,
        plotMaxDrawdown: maxDrawdownVal as number,
        plotProfitTarget: profitTargetVal as number,
        plotChallengeFee: challengeFeeLocal
      });

      setIsSimulating(false);
    }, 50);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Prop Firm Simulator</h2>
          <p className="text-muted-foreground">
            Monte Carlo simulation to calculate the statistical likelihood of passing a challenge.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Simulation Parameters</CardTitle>
              <CardDescription>Configure your strategy metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="winRate">Win Rate (%)</Label>
              <Input
                id="winRate"
                type="number"
                value={winRate}
                onChange={(e) => {
                  const v = e.target.value;
                  setWinRate(v === '' ? '' : Number(v));
                  if (v.trim() !== '') clearInputError('winRate');
                }}
                max={100}
              />
              {inputErrors.winRate && <p className="text-sm text-red-500">{inputErrors.winRate}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="riskReward">Risk:Reward Ratio (e.g. 2 for 1:2)</Label>
              <Input
                id="riskReward"
                type="number"
                value={riskReward}
                onChange={(e) => {
                  const v = e.target.value;
                  setRiskReward(v === '' ? '' : Number(v));
                  if (v.trim() !== '') clearInputError('riskReward');
                }}
                step={0.1}
              />
              {inputErrors.riskReward && <p className="text-sm text-red-500">{inputErrors.riskReward}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="riskPerTrade">Risk Per Trade (%)</Label>
              <Input
                id="riskPerTrade"
                type="number"
                value={riskPerTrade}
                onChange={(e) => {
                  const v = e.target.value;
                  setRiskPerTrade(v === '' ? '' : Number(v));
                  if (v.trim() !== '') clearInputError('riskPerTrade');
                }}
                step={0.1}
              />
              {inputErrors.riskPerTrade && <p className="text-sm text-red-500">{inputErrors.riskPerTrade}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="profitTarget">Profit Target (%)</Label>
              <Input
                id="profitTarget"
                type="number"
                value={profitTarget}
                onChange={(e) => {
                  const v = e.target.value;
                  setProfitTarget(v === '' ? '' : Number(v));
                  if (v.trim() !== '') clearInputError('profitTarget');
                }}
              />
              {inputErrors.profitTarget && <p className="text-sm text-red-500">{inputErrors.profitTarget}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxDrawdown">Max Drawdown (%)</Label>
              <Input
                id="maxDrawdown"
                type="number"
                value={maxDrawdown}
                onChange={(e) => {
                  const v = e.target.value;
                  setMaxDrawdown(v === '' ? '' : Number(v));
                  if (v.trim() !== '') clearInputError('maxDrawdown');
                }}
              />
              {inputErrors.maxDrawdown && <p className="text-sm text-red-500">{inputErrors.maxDrawdown}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="riskStyle">Risk Style</Label>
              <Select value={riskStyle} onValueChange={(value: any) => setRiskStyle(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select risk style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Lot (Initial Balance)</SelectItem>
                  <SelectItem value="compounding">Compounding (Current Balance)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tradesPerDay">Avg Trades Per Day</Label>
              <Input
                id="tradesPerDay"
                type="number"
                value={tradesPerDay}
                onChange={(e) => {
                  const v = e.target.value;
                  setTradesPerDay(v === '' ? '' : Number(v));
                  if (v.trim() !== '') clearInputError('tradesPerDay');
                }}
                step={0.1}
              />
              {inputErrors.tradesPerDay && <p className="text-sm text-red-500">{inputErrors.tradesPerDay}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="numSimulations">Number of Simulations</Label>
              <Input
                id="numSimulations"
                type="number"
                value={numSimulations}
                onChange={(e) => {
                  const v = e.target.value;
                  setNumSimulations(v === '' ? '' : Number(v));
                  if (v.trim() !== '') clearInputError('numSimulations');
                }}
                min={100}
                max={100000}
                step={100}
              />
              {inputErrors.numSimulations && <p className="text-sm text-red-500">{inputErrors.numSimulations}</p>}
            </div>

            <Button className="w-full" onClick={runSimulation} disabled={isSimulating}>
              {isSimulating ? 'Simulating...' : 'Run Simulation'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Parameters</CardTitle>
            <CardDescription>Configure challenge costs and payouts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="challengeFee">Challenge Fee ($)</Label>
              <Input
                id="challengeFee"
                type="number"
                value={challengeFee}
                onChange={(e) => {
                  const v = e.target.value;
                  setChallengeFee(v === '' ? '' : Number(v));
                  if (v.trim() !== '') clearInputError('challengeFee');
                }}
              />
              {inputErrors.challengeFee && <p className="text-sm text-red-500">{inputErrors.challengeFee}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="accountSize">Account Size ($)</Label>
              <Input
                id="accountSize"
                type="number"
                value={accountSize}
                onChange={(e) => {
                  const v = e.target.value;
                  setAccountSize(v === '' ? '' : Number(v));
                  if (v.trim() !== '') clearInputError('accountSize');
                }}
              />
              {inputErrors.accountSize && <p className="text-sm text-red-500">{inputErrors.accountSize}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="profitSplit">Profit Split (%)</Label>
              <Input
                id="profitSplit"
                type="number"
                value={profitSplit}
                onChange={(e) => {
                  const v = e.target.value;
                  setProfitSplit(v === '' ? '' : Number(v));
                  if (v.trim() !== '') clearInputError('profitSplit');
                }}
                max={100}
              />
              {inputErrors.profitSplit && <p className="text-sm text-red-500">{inputErrors.profitSplit}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="payoutTargetPct">Payout Target (%)</Label>
              <Input
                id="payoutTargetPct"
                type="number"
                value={payoutTargetPct}
                onChange={(e) => {
                  const v = e.target.value;
                  setPayoutTargetPct(v === '' ? '' : Number(v));
                  if (v.trim() !== '') clearInputError('payoutTargetPct');
                }}
              />
              {inputErrors.payoutTargetPct && <p className="text-sm text-red-500">{inputErrors.payoutTargetPct}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="feeRefundPct">Fee Refund (%)</Label>
              <Input
                id="feeRefundPct"
                type="number"
                value={feeRefundPct}
                onChange={(e) => {
                  const v = e.target.value;
                  setFeeRefundPct(v === '' ? '' : Number(v));
                  if (v.trim() !== '') clearInputError('feeRefundPct');
                }}
                max={100}
              />
              {inputErrors.feeRefundPct && <p className="text-sm text-red-500">{inputErrors.feeRefundPct}</p>}
            </div>
          </CardContent>
        </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pass Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {results ? `${results.passRate.toFixed(2)}%` : '-'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Risk of Ruin</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {results ? `${results.riskOfRuin.toFixed(2)}%` : '-'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Trades to Pass</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {results ? Math.round(results.avgTradesToPass) : '-'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Days to Pass</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {results ? Math.round(results.avgDaysToPass) : '-'}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="h-[500px] flex flex-col">
            <CardHeader>
              <CardTitle>Equity Paths (Top {results?.numPaths || 50} Simulations)</CardTitle>
              <CardDescription>Visualizing the journey of simulated accounts</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              {results?.chartData && results.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results.chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis 
                      dataKey="trade" 
                      label={{ value: 'Number of Trades', position: 'insideBottom', offset: -5 }} 
                    />
                    <YAxis 
                      tickFormatter={(val) => `${val > 0 ? '+' : ''}${val.toFixed(0)}%`}
                      domain={[-results.plotMaxDrawdown, results.plotProfitTarget]}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(2)}%`, 'Return']}
                      labelFormatter={(label) => `Trade ${label}`}
                    />
                    {/* Render a line for each path */}
                    {Array.from({ length: results.numPaths }).map((_, i) => (
                      <Line 
                        key={i}
                        type="monotone" 
                        dataKey={`path${i}`} 
                        stroke={`hsl(${(i * 137.5) % 360}, 70%, 50%)`} 
                        strokeWidth={1}
                        dot={false}
                        opacity={0.4}
                        isAnimationActive={false}
                      />
                    ))}
                    {/* Target and Drawdown lines */}
                    <Line
                      type="step"
                      dataKey={() => results.plotProfitTarget}
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="step"
                      dataKey={() => -results.plotMaxDrawdown}
                      stroke="#ef4444"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Run a simulation to see equity paths
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Expected Payout Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${results && results.epv > 0 ? 'text-green-500' : results && results.epv < 0 ? 'text-red-500' : ''}`}>
                  {results ? `$${results.epv.toFixed(2)}` : '-'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Return on Investment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${results && results.roi > 0 ? 'text-green-500' : results && results.roi < 0 ? 'text-red-500' : ''}`}>
                  {results ? `${results.roi.toFixed(2)}%` : '-'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Probability of Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {results ? `${results.probOfProfit.toFixed(2)}%` : '-'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Break-Even Pass Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {results ? `${results.breakEvenPassRate.toFixed(2)}%` : '-'}
                </div>
              </CardContent>
            </Card>
          </div>

          {results && (
            <Card>
              <CardHeader>
                <CardTitle>Cost vs. Expected Reward</CardTitle>
                <CardDescription className={results.epv > 0 ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                  {results.epv > 0 
                    ? "Positive Expected Value: This strategy is statistically viable for this challenge fee." 
                    : "Negative Expected Value: This strategy is statistically likely to lose money over time."}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Challenge Fee', value: results.plotChallengeFee ?? 0, fill: '#ef4444' },
                    { name: 'Expected Payout Value', value: results.epv, fill: results.epv > 0 ? '#10b981' : '#ef4444' }
                  ]} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(val) => `$${val}`} />
                    <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Amount']} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {
                        [
                          { name: 'Challenge Fee', value: results.plotChallengeFee ?? 0, fill: '#ef4444' },
                          { name: 'Expected Payout Value', value: results.epv, fill: results.epv > 0 ? '#10b981' : '#ef4444' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
