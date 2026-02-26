import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Plus, TrendingUp, TrendingDown, Activity, DollarSign, Calendar as CalendarIcon, PieChart as PieChartIcon, Pencil, Trash2, FileText, X, Filter, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { CalendarHeatmap } from '@/components/CalendarHeatmap';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

// Types
interface Trade {
  id: number;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry_date: string;
  entry_time: string;
  entry_price: number;
  exit_price: number;
  stop_loss: number;
  quantity: number;
  quantity_type: 'SHARES' | 'LOTS';
  commission: number;
  setup: string;
  tags: string[];
  notes: string;
}

interface Stats {
  totalPnL: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgWin: number;
  avgLoss: number;
  avgRMultiple: number;
  equityCurve: { date: string; balance: number }[];
  dailyPnL: { date: string; value: number }[];
  hourlyPnL: { time: string; value: number }[];
}

export default function App() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'journal' | 'analytics'>('dashboard');
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Filter State
  const [filters, setFilters] = useState({
    symbol: '',
    side: 'ALL',
    setup: 'ALL'
  });

  // Form State
  const [formData, setFormData] = useState({
    symbol: '',
    side: 'LONG',
    entry_date: new Date(),
    entry_time: format(new Date(), 'HH:mm'),
    entry_price: '',
    exit_price: '',
    stop_loss: '',
    quantity: '',
    quantity_type: 'SHARES',
    commission: '',
    setup: '',
    tags: '',
    notes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tradesRes, statsRes] = await Promise.all([
        fetch('/api/trades'),
        fetch('/api/stats')
      ]);
      const tradesData = await tradesRes.json();
      const statsData = await statsRes.json();
      setTrades(tradesData);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setFormData(prev => ({ ...prev, entry_date: date }));
    }
  };

  const openEntryModal = (trade?: Trade) => {
    if (trade) {
      setEditingId(trade.id);
      setFormData({
        symbol: trade.symbol,
        side: trade.side,
        entry_date: parseISO(trade.entry_date),
        entry_time: trade.entry_time || '09:30',
        entry_price: trade.entry_price.toString(),
        exit_price: trade.exit_price.toString(),
        stop_loss: trade.stop_loss ? trade.stop_loss.toString() : '',
        quantity: trade.quantity.toString(),
        quantity_type: trade.quantity_type || 'SHARES',
        commission: trade.commission ? trade.commission.toString() : '',
        setup: trade.setup || '',
        tags: trade.tags ? trade.tags.join(', ') : '',
        notes: trade.notes || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        symbol: '',
        side: 'LONG',
        entry_date: new Date(),
        entry_time: format(new Date(), 'HH:mm'),
        entry_price: '',
        exit_price: '',
        stop_loss: '',
        quantity: '',
        quantity_type: 'SHARES',
        commission: '',
        setup: '',
        tags: '',
        notes: ''
      });
    }
    setIsEntryModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        entry_date: format(formData.entry_date, 'yyyy-MM-dd'),
        entry_price: parseFloat(formData.entry_price),
        exit_price: parseFloat(formData.exit_price),
        stop_loss: parseFloat(formData.stop_loss) || 0,
        quantity: parseInt(formData.quantity),
        commission: parseFloat(formData.commission) || 0,
        tags: typeof formData.tags === 'string' ? formData.tags.split(',').map(t => t.trim()).filter(t => t) : formData.tags
      };

      const url = editingId ? `/api/trades/${editingId}` : '/api/trades';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsEntryModalOpen(false);
        setEditingId(null);
        fetchData();
      }
    } catch (error) {
      console.error('Error submitting trade:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this trade?')) return;
    try {
      await fetch(`/api/trades/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting trade:', error);
    }
  };

  // Helper to calculate PnL for a trade
  const calculatePnL = (trade: Trade) => {
    const multiplier = trade.side === 'LONG' ? 1 : -1;
    const quantityMultiplier = trade.quantity_type === 'LOTS' ? 100 : 1;
    const gross = (trade.exit_price - trade.entry_price) * trade.quantity * quantityMultiplier * multiplier;
    return gross - trade.commission;
  };

  // Helper to calculate R-Multiple
  const calculateR = (trade: Trade) => {
    if (!trade.stop_loss || trade.stop_loss === 0) return 0;
    const risk = Math.abs(trade.entry_price - trade.stop_loss);
    if (risk === 0) return 0;
    const multiplier = trade.side === 'LONG' ? 1 : -1;
    return ((trade.exit_price - trade.entry_price) * multiplier) / risk;
  };

  // Filtered Trades
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      const matchesSymbol = filters.symbol === '' || trade.symbol.toLowerCase().includes(filters.symbol.toLowerCase());
      const matchesSide = filters.side === 'ALL' || trade.side === filters.side;
      const matchesSetup = filters.setup === 'ALL' || (trade.setup && trade.setup === filters.setup);
      return matchesSymbol && matchesSide && matchesSetup;
    });
  }, [trades, filters]);

  // Unique Setups for Filter
  const uniqueSetups = useMemo(() => {
    const setups = new Set(trades.map(t => t.setup).filter(Boolean));
    return Array.from(setups);
  }, [trades]);

  // Analytics Data Preparation
  const setupPerformance = useMemo(() => {
    const performance: Record<string, { wins: number; losses: number; total: number; pnl: number }> = {};
    trades.forEach(trade => {
      const pnl = calculatePnL(trade);
      const setup = trade.setup || 'Unknown';
      if (!performance[setup]) performance[setup] = { wins: 0, losses: 0, total: 0, pnl: 0 };
      
      performance[setup].total++;
      performance[setup].pnl += pnl;
      if (pnl > 0) performance[setup].wins++;
      else performance[setup].losses++;
    });
    
    return Object.entries(performance).map(([name, data]) => ({
      name,
      ...data,
      winRate: (data.wins / data.total) * 100
    })).sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  // Advanced Analytics Summary
  const analyticsSummary = useMemo(() => {
    if (!trades.length) return null;
    
    let currentWinStreak = 0;
    let maxWinStreak = 0;
    let currentLossStreak = 0;
    let maxLossStreak = 0;
    let totalPnL = 0;

    // Sort trades by date/time for streak calculation
    const sortedTrades = [...trades].sort((a, b) => {
      const dateA = new Date(`${a.entry_date}T${a.entry_time || '00:00'}`).getTime();
      const dateB = new Date(`${b.entry_date}T${b.entry_time || '00:00'}`).getTime();
      return dateA - dateB;
    });

    sortedTrades.forEach(trade => {
      const pnl = calculatePnL(trade);
      totalPnL += pnl;

      if (pnl > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      } else if (pnl < 0) {
        currentLossStreak++;
        currentWinStreak = 0;
        if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
      }
    });

    const avgPnLPerTrade = totalPnL / trades.length;

    return {
      avgPnLPerTrade,
      maxWinStreak,
      maxLossStreak
    };
  }, [trades]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/50 p-6 flex flex-col gap-6 fixed h-full">
        <div className="flex items-center gap-2 text-primary font-bold text-xl">
          <Activity className="h-6 w-6" />
          <span>TradeLab</span>
        </div>
        
        <div className="text-xs text-muted-foreground font-mono">
          {format(new Date(), 'EEEE, MMM do yyyy')}
        </div>
        
        <nav className="flex flex-col gap-2">
          <Button 
            variant={activeTab === 'dashboard' ? 'secondary' : 'ghost'} 
            className="justify-start" 
            onClick={() => setActiveTab('dashboard')}
          >
            <TrendingUp className="mr-2 h-4 w-4" /> Dashboard
          </Button>
          <Button 
            variant={activeTab === 'journal' ? 'secondary' : 'ghost'} 
            className="justify-start" 
            onClick={() => setActiveTab('journal')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" /> Journal
          </Button>
          <Button 
            variant={activeTab === 'analytics' ? 'secondary' : 'ghost'} 
            className="justify-start" 
            onClick={() => setActiveTab('analytics')}
          >
            <PieChartIcon className="mr-2 h-4 w-4" /> Analytics
          </Button>
        </nav>

        <div className="mt-auto">
          <Button className="w-full" onClick={() => openEntryModal()}>
            <Plus className="mr-2 h-4 w-4" /> New Trade
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto h-screen ml-64">
        {loading ? (
          <div className="flex items-center justify-center h-full">Loading...</div>
        ) : (
          <>
            {activeTab === 'dashboard' && stats && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        ${stats.totalPnL.toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        All time realized P&L
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.winRate.toFixed(1)}%</div>
                      <p className="text-xs text-muted-foreground">
                        {stats.totalTrades} total trades
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Avg R-Multiple</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.avgRMultiple.toFixed(2)}R</div>
                      <p className="text-xs text-muted-foreground">
                        Average Risk:Reward
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Avg Win / Loss</CardTitle>
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ${stats.avgWin.toFixed(0)} / <span className="text-red-500">${stats.avgLoss.toFixed(0)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Expectancy ratio
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Equity Curve */}
                  <Card className="col-span-1 lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Equity Curve</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                      <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={stats.equityCurve}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                            <XAxis 
                              dataKey="date" 
                              stroke="hsl(var(--muted-foreground))" 
                              fontSize={12} 
                              tickLine={false} 
                              axisLine={false} 
                              tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                            />
                            <YAxis 
                              stroke="hsl(var(--muted-foreground))" 
                              fontSize={12} 
                              tickLine={false} 
                              axisLine={false} 
                              tickFormatter={(value) => `$${value}`} 
                            />
                            <RechartsTooltip 
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                              itemStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="balance" 
                              stroke="hsl(var(--primary))" 
                              strokeWidth={2} 
                              dot={false} 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Calendar Heatmap */}
                  <Card className="col-span-1 lg:col-span-2">
                    <CardHeader>
                      <CardTitle>P&L Heatmap</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[350px] flex items-center justify-center">
                        <CalendarHeatmap data={stats.dailyPnL} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'journal' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-bold tracking-tight">Trade Journal</h2>
                </div>
                
                {/* Filters */}
                <Card className="p-4">
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="space-y-2 w-full sm:w-auto flex-1 min-w-[200px]">
                      <Label htmlFor="filter-symbol" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Search className="h-3 w-3" /> Symbol
                      </Label>
                      <Input 
                        id="filter-symbol" 
                        placeholder="Search Symbol..." 
                        value={filters.symbol}
                        onChange={(e) => setFilters(prev => ({ ...prev, symbol: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2 w-full sm:w-auto min-w-[150px]">
                      <Label htmlFor="filter-side" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Filter className="h-3 w-3" /> Side
                      </Label>
                      <Select value={filters.side} onValueChange={(val) => setFilters(prev => ({ ...prev, side: val }))}>
                        <SelectTrigger id="filter-side" className="h-9">
                          <SelectValue placeholder="All Sides" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Sides</SelectItem>
                          <SelectItem value="LONG">Long</SelectItem>
                          <SelectItem value="SHORT">Short</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 w-full sm:w-auto min-w-[150px]">
                      <Label htmlFor="filter-setup" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Filter className="h-3 w-3" /> Setup
                      </Label>
                      <Select value={filters.setup} onValueChange={(val) => setFilters(prev => ({ ...prev, setup: val }))}>
                        <SelectTrigger id="filter-setup" className="h-9">
                          <SelectValue placeholder="All Setups" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Setups</SelectItem>
                          {uniqueSetups.map(setup => (
                            <SelectItem key={setup} value={setup}>{setup}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      variant="ghost" 
                      onClick={() => setFilters({ symbol: '', side: 'ALL', setup: 'ALL' })}
                      className="h-9 px-3 text-muted-foreground hover:text-foreground"
                    >
                      Reset
                    </Button>
                  </div>
                </Card>

                <Card>
                  <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm text-left">
                      <thead className="[&_tr]:border-b">
                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                          <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Date</th>
                          <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Time</th>
                          <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Symbol</th>
                          <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Side</th>
                          <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Setup</th>
                          <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Qty</th>
                          <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Entry</th>
                          <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Exit</th>
                          <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">R</th>
                          <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">P&L</th>
                          <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Tags</th>
                          <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Notes</th>
                          <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="[&_tr:last-child]:border-0">
                        {filteredTrades.length === 0 ? (
                          <tr>
                            <td colSpan={13} className="p-8 text-center text-muted-foreground">
                              No trades found matching your filters.
                            </td>
                          </tr>
                        ) : (
                          filteredTrades.map((trade) => {
                            const pnl = calculatePnL(trade);
                            const r = calculateR(trade);
                            return (
                              <tr key={trade.id} className="border-b transition-colors hover:bg-muted/50">
                                <td className="p-4 align-middle">{format(new Date(trade.entry_date), 'MMM dd, yyyy')}</td>
                                <td className="p-4 align-middle text-muted-foreground text-xs">{trade.entry_time}</td>
                                <td className="p-4 align-middle font-bold">{trade.symbol}</td>
                                <td className="p-4 align-middle">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${trade.side === 'LONG' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                                    {trade.side}
                                  </span>
                                </td>
                                <td className="p-4 align-middle">{trade.setup}</td>
                                <td className="p-4 align-middle text-right">
                                  {trade.quantity} <span className="text-[10px] text-muted-foreground">{trade.quantity_type === 'LOTS' ? 'L' : 'S'}</span>
                                </td>
                                <td className="p-4 align-middle text-right">${trade.entry_price.toFixed(2)}</td>
                                <td className="p-4 align-middle text-right">${trade.exit_price.toFixed(2)}</td>
                                <td className="p-4 align-middle text-right font-mono">{r.toFixed(2)}R</td>
                                <td className={`p-4 align-middle text-right font-bold ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  ${pnl.toFixed(2)}
                                </td>
                                <td className="p-4 align-middle">
                                  <div className="flex gap-1 flex-wrap">
                                    {trade.tags.map((tag, i) => (
                                      <span key={i} className="px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[10px]">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="p-4 align-middle">
                                  {trade.notes && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <FileText className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-80">
                                        <div className="space-y-2">
                                          <h4 className="font-medium leading-none">Trade Notes</h4>
                                          <p className="text-sm text-muted-foreground">
                                            {trade.notes}
                                          </p>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                </td>
                                <td className="p-4 align-middle text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => openEntryModal(trade)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(trade.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
                
                {/* Analytics Summary Cards */}
                {analyticsSummary && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg P&L / Trade</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${analyticsSummary.avgPnLPerTrade >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          ${analyticsSummary.avgPnLPerTrade.toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Max Win Streak</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-500">
                          {analyticsSummary.maxWinStreak}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Max Loss Streak</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-500">
                          {analyticsSummary.maxLossStreak}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Time of Day Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.hourlyPnL}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
                            <YAxis stroke="hsl(var(--muted-foreground))" />
                            <RechartsTooltip 
                              cursor={{fill: 'hsl(var(--muted)/0.2)'}}
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                              itemStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                              {stats.hourlyPnL.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#22c55e' : '#ef4444'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Setup Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={setupPerformance} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                            <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                            <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" width={100} />
                            <RechartsTooltip 
                              cursor={{fill: 'hsl(var(--muted)/0.2)'}}
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                              itemStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Bar dataKey="pnl" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                              {setupPerformance.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Win Rate by Setup</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={setupPerformance}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                            <YAxis stroke="hsl(var(--muted-foreground))" />
                            <RechartsTooltip 
                              cursor={{fill: 'hsl(var(--muted)/0.2)'}}
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                              itemStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Bar dataKey="winRate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Entry Modal */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{editingId ? 'Edit Trade' : 'Log New Trade'}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setIsEntryModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="symbol">Symbol</Label>
                    <Input id="symbol" name="symbol" value={formData.symbol} onChange={handleInputChange} required placeholder="e.g. SPY" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="side">Side</Label>
                    <Select name="side" value={formData.side} onValueChange={(val) => handleSelectChange('side', val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select side" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LONG">Long</SelectItem>
                        <SelectItem value="SHORT">Short</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 flex flex-col">
                    <Label htmlFor="entry_date" className="mb-2">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.entry_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.entry_date ? format(formData.entry_date, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.entry_date}
                          onSelect={handleDateSelect}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="entry_time">Time</Label>
                    <Input id="entry_time" name="entry_time" type="time" value={formData.entry_time} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <div className="flex gap-2">
                      <Input id="quantity" name="quantity" type="number" value={formData.quantity} onChange={handleInputChange} required placeholder="100" className="flex-1" />
                      <Select name="quantity_type" value={formData.quantity_type} onValueChange={(val) => handleSelectChange('quantity_type', val)}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SHARES">Shares</SelectItem>
                          <SelectItem value="LOTS">Lots</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="commission">Commission</Label>
                    <Input id="commission" name="commission" type="number" step="0.01" value={formData.commission} onChange={handleInputChange} placeholder="0.00" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="entry_price">Entry Price</Label>
                    <Input id="entry_price" name="entry_price" type="number" step="0.01" value={formData.entry_price} onChange={handleInputChange} required placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exit_price">Exit Price</Label>
                    <Input id="exit_price" name="exit_price" type="number" step="0.01" value={formData.exit_price} onChange={handleInputChange} required placeholder="0.00" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stop_loss">Stop Loss (Optional)</Label>
                  <Input id="stop_loss" name="stop_loss" type="number" step="0.01" value={formData.stop_loss} onChange={handleInputChange} placeholder="0.00" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup">Setup</Label>
                  <Input id="setup" name="setup" value={formData.setup} onChange={handleInputChange} placeholder="e.g. VWAP Reversal" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma separated)</Label>
                  <Input id="tags" name="tags" value={formData.tags} onChange={handleInputChange} placeholder="FOMO, Late Entry, A+ Setup" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Trade rationale..." />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setIsEntryModalOpen(false)}>Cancel</Button>
                  <Button type="submit">{editingId ? 'Update Trade' : 'Log Trade'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
