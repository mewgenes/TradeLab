import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export function PropFirmSimulator() {
  const [winRate, setWinRate] = useState(50);
  const [riskReward, setRiskReward] = useState(2);
  const [riskPerTrade, setRiskPerTrade] = useState(1);
  const [profitTarget, setProfitTarget] = useState(10);
  const [maxDrawdown, setMaxDrawdown] = useState(10);
  const [numSimulations, setNumSimulations] = useState(10000);
  const [riskStyle, setRiskStyle] = useState<'compounding' | 'fixed'>('fixed');
  const [tradesPerDay, setTradesPerDay] = useState(2);

  // Financial Inputs
  const [challengeFee, setChallengeFee] = useState(500);
  const [accountSize, setAccountSize] = useState(100000);
  const [profitSplit, setProfitSplit] = useState(80);
  const [payoutTargetPct, setPayoutTargetPct] = useState(4);
  const [feeRefundPct, setFeeRefundPct] = useState(100);

  const [results, setResults] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const runSimulation = () => {
    setIsSimulating(true);
    
    // Use setTimeout to allow UI to update before heavy computation
    setTimeout(() => {
      const wr = winRate / 100;
      const rr = riskReward;
      const risk = riskPerTrade / 100;
      const target = 1 + (profitTarget / 100);
      const drawdownLimit = 1 - (maxDrawdown / 100);
      const maxTrades = 1000;
      
      let passedCount = 0;
      let failedCount = 0;
      let totalTradesToPass = 0;
      
      // Store paths for visualization (only keep up to 50 paths to avoid memory issues)
      const pathsToVisualize: any[] = [];
      const numPathsToKeep = 50;

      const netProfitOnPayout = (accountSize * (payoutTargetPct / 100) * (profitSplit / 100)) + (challengeFee * (feeRefundPct / 100));
      const breakEvenPassRate = (challengeFee / (netProfitOnPayout + challengeFee)) * 100;

      // Handle edge cases
      if (wr <= 0) {
        setResults({
          passRate: 0,
          avgTradesToPass: 0,
          avgDaysToPass: 0,
          riskOfRuin: 100,
          paths: [],
          epv: -challengeFee,
          roi: -100,
          probOfProfit: 0,
          breakEvenPassRate,
          netProfitOnPayout
        });
        setIsSimulating(false);
        return;
      }
      
      if (wr >= 1) {
        const tradesNeeded = Math.ceil((target - 1) / (risk * rr));
        setResults({
          passRate: 100,
          avgTradesToPass: tradesNeeded,
          avgDaysToPass: tradesNeeded / tradesPerDay,
          riskOfRuin: 0,
          paths: [],
          epv: netProfitOnPayout,
          roi: (netProfitOnPayout / challengeFee) * 100,
          probOfProfit: 100,
          breakEvenPassRate,
          netProfitOnPayout
        });
        setIsSimulating(false);
        return;
      }

      for (let i = 0; i < numSimulations; i++) {
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
      const maxPathLength = Math.max(...pathsToVisualize.map(p => p.length), 0);
      
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
      const fundedTarget = 1 + (payoutTargetPct / 100);
      
      for (let i = 0; i < numSimulations; i++) {
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
      
      const fundedPassRate = fundedPassedCount / numSimulations;
      const challengePassRate = passedCount / numSimulations;
      
      const epv = (challengePassRate * netProfitOnPayout) - ((1 - challengePassRate) * challengeFee);
      const roi = (epv / challengeFee) * 100;
      const probOfProfit = challengePassRate * fundedPassRate * 100;

      setResults({
        passRate: challengePassRate * 100,
        avgTradesToPass: passedCount > 0 ? totalTradesToPass / passedCount : 0,
        avgDaysToPass: passedCount > 0 ? (totalTradesToPass / passedCount) / tradesPerDay : 0,
        riskOfRuin: (failedCount / numSimulations) * 100,
        chartData,
        numPaths: pathsToVisualize.length,
        epv,
        roi,
        probOfProfit,
        breakEvenPassRate,
        netProfitOnPayout
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
              <Input id="winRate" type="number" value={winRate} onChange={e => setWinRate(Number(e.target.value))} max={100} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="riskReward">Risk:Reward Ratio (e.g. 2 for 1:2)</Label>
              <Input id="riskReward" type="number" value={riskReward} onChange={e => setRiskReward(Number(e.target.value))} step={0.1} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="riskPerTrade">Risk Per Trade (%)</Label>
              <Input id="riskPerTrade" type="number" value={riskPerTrade} onChange={e => setRiskPerTrade(Number(e.target.value))} step={0.1} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="profitTarget">Profit Target (%)</Label>
              <Input id="profitTarget" type="number" value={profitTarget} onChange={e => setProfitTarget(Number(e.target.value))} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxDrawdown">Max Drawdown (%)</Label>
              <Input id="maxDrawdown" type="number" value={maxDrawdown} onChange={e => setMaxDrawdown(Number(e.target.value))} />
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
              <Input id="tradesPerDay" type="number" value={tradesPerDay} onChange={e => setTradesPerDay(Number(e.target.value))} step={0.1} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="numSimulations">Number of Simulations</Label>
              <Input id="numSimulations" type="number" value={numSimulations} onChange={e => setNumSimulations(Number(e.target.value))} min={100} max={100000} step={100} />
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
              <Input id="challengeFee" type="number" value={challengeFee} onChange={e => setChallengeFee(Number(e.target.value))} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="accountSize">Account Size ($)</Label>
              <Input id="accountSize" type="number" value={accountSize} onChange={e => setAccountSize(Number(e.target.value))} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="profitSplit">Profit Split (%)</Label>
              <Input id="profitSplit" type="number" value={profitSplit} onChange={e => setProfitSplit(Number(e.target.value))} max={100} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="payoutTargetPct">Payout Target (%)</Label>
              <Input id="payoutTargetPct" type="number" value={payoutTargetPct} onChange={e => setPayoutTargetPct(Number(e.target.value))} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="feeRefundPct">Fee Refund (%)</Label>
              <Input id="feeRefundPct" type="number" value={feeRefundPct} onChange={e => setFeeRefundPct(Number(e.target.value))} max={100} />
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
                      domain={[-maxDrawdown, profitTarget]}
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
                    <Line type="step" dataKey={() => profitTarget} stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                    <Line type="step" dataKey={() => -maxDrawdown} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
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
                    { name: 'Challenge Fee', value: challengeFee, fill: '#ef4444' },
                    { name: 'Expected Payout Value', value: results.epv, fill: results.epv > 0 ? '#10b981' : '#ef4444' }
                  ]} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(val) => `$${val}`} />
                    <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Amount']} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {
                        [
                          { name: 'Challenge Fee', value: challengeFee, fill: '#ef4444' },
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
