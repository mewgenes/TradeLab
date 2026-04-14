import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell, AreaChart, Area } from 'recharts';
import { Plus, TrendingUp, Activity, Calendar as CalendarIcon, Pencil, Trash2, FileText, X, Filter, Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Target, LogOut } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { CalendarHeatmap } from '@/components/CalendarHeatmap';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

import { DashboardStats } from '@/components/DashboardStats';
import { PropFirmSimulator } from '@/components/PropFirmSimulator';
import { LoginPage } from '@/components/LoginPage';

const FUTURES_POINT_VALUES: Record<string, number> = {
  ES_MINI: 50, ES_MICRO: 5, NQ_MINI: 20, NQ_MICRO: 2,
};

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
  take_profit: number;
  quantity: number;
  quantity_type: 'SHARES' | 'LOTS';
  commission: number;
  setup: string;
  tags: string[];
  notes: string;
  futures_contract: string | null;
}

interface Stats {
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
  equityCurve: { date: string; balance: number }[];
  dailyPnL: { date: string; value: number; trades: number; wins: number }[];
  hourlyPnL: { time: string; value: number }[];
}

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(
    () => localStorage.getItem('tradelab_token')
  );
  const [currentUser, setCurrentUser] = useState<string | null>(
    () => localStorage.getItem('tradelab_user')
  );

  const handleLogin = (token: string, username: string) => {
    localStorage.setItem('tradelab_token', token);
    localStorage.setItem('tradelab_user', username);
    setAuthToken(token);
    setCurrentUser(username);
  };

  const handleLogout = () => {
    localStorage.removeItem('tradelab_token');
    localStorage.removeItem('tradelab_user');
    setAuthToken(null);
    setCurrentUser(null);
  };

  const authFetch = (url: string, options: RequestInit = {}) =>
    fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        ...(options.headers || {}),
      },
    });

  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'journal' | 'analytics' | 'simulator'>('dashboard');
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<number | null>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Filter State
  const [filters, setFilters] = useState({
    symbol: '',
    side: 'ALL',
    setup: 'ALL'
  });

  // Sort State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Form State
  const [formData, setFormData] = useState({
    symbol: '',
    side: 'LONG',
    entry_date: new Date(),
    entry_time: format(new Date(), 'HH:mm'),
    entry_price: '',
    exit_price: '',
    stop_loss: '',
    take_profit: '',
    quantity: '',
    quantity_type: 'LOTS',
    commission: '',
    setup: '',
    tags: '',
    notes: '',
    instrument_type: 'FOREX_CFD',
    futures_contract: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tradesRes, statsRes] = await Promise.all([
        authFetch('/api/trades'),
        authFetch('/api/stats')
      ]);
      if (tradesRes.status === 401 || statsRes.status === 401) {
        handleLogout();
        return;
      }
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
    if (authToken) fetchData();
  }, [authToken]);

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
        take_profit: trade.take_profit ? trade.take_profit.toString() : '',
        quantity: trade.quantity.toString(),
        quantity_type: trade.quantity_type || 'LOTS',
        commission: trade.commission ? trade.commission.toString() : '',
        setup: trade.setup || '',
        tags: trade.tags ? trade.tags.join(', ') : '',
        notes: trade.notes || '',
        instrument_type: trade.futures_contract ? 'FUTURES' : 'FOREX_CFD',
        futures_contract: trade.futures_contract || ''
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
        take_profit: '',
        quantity: '',
        quantity_type: 'LOTS',
        commission: '',
        setup: '',
        tags: '',
        notes: '',
        instrument_type: 'FOREX_CFD',
        futures_contract: ''
      });
    }
    setIsEntryModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { instrument_type, ...restFormData } = formData;
      const payload = {
        ...restFormData,
        entry_date: format(formData.entry_date, 'yyyy-MM-dd'),
        entry_price: parseFloat(formData.entry_price),
        exit_price: parseFloat(formData.exit_price),
        stop_loss: parseFloat(formData.stop_loss) || 0,
        take_profit: parseFloat(formData.take_profit) || 0,
        quantity: parseInt(formData.quantity),
        commission: parseFloat(formData.commission) || 0,
        tags: typeof formData.tags === 'string' ? formData.tags.split(',').map(t => t.trim()).filter(t => t) : formData.tags,
        futures_contract: instrument_type === 'FUTURES' ? (formData.futures_contract || null) : null,
      };

      const url = editingId ? `/api/trades/${editingId}` : '/api/trades';
      const method = editingId ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method: method,
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
    setDeleteConfirmationId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmationId === null) return;
    try {
      await authFetch(`/api/trades/${deleteConfirmationId}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting trade:', error);
    } finally {
      setDeleteConfirmationId(null);
    }
  };

  // Helper to calculate PnL for a trade
  const calculatePnL = (trade: Trade) => {
    const direction = trade.side === 'LONG' ? 1 : -1;
    const priceDiff = trade.exit_price - trade.entry_price;
    if (trade.futures_contract) {
      const pointValue = FUTURES_POINT_VALUES[trade.futures_contract] ?? 0;
      return priceDiff * trade.quantity * pointValue * direction - (trade.commission || 0);
    }
    const quantityMultiplier = trade.quantity_type === 'LOTS' ? 100 : 1;
    return priceDiff * trade.quantity * quantityMultiplier * direction - (trade.commission || 0);
  };

  // Helper to calculate Planned RR Ratio
  const calculatePlannedRR = (trade: Trade) => {
    if (!trade.stop_loss || trade.stop_loss === 0 || !trade.take_profit || trade.take_profit === 0) return 0;
    const risk = Math.abs(trade.entry_price - trade.stop_loss);
    const reward = Math.abs(trade.take_profit - trade.entry_price);
    if (risk === 0) return 0;
    return reward / risk;
  };

  // Filtered Trades
  const filteredTrades = useMemo(() => {
    let result = trades.filter(trade => {
      const matchesSymbol = filters.symbol === '' || trade.symbol.toLowerCase().includes(filters.symbol.toLowerCase());
      const matchesSide = filters.side === 'ALL' || trade.side === filters.side;
      const matchesSetup = filters.setup === 'ALL' || (trade.setup && trade.setup === filters.setup);
      return matchesSymbol && matchesSide && matchesSetup;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'Date':
            aValue = new Date(a.entry_date).getTime();
            bValue = new Date(b.entry_date).getTime();
            break;
          case 'Time':
            aValue = a.entry_time;
            bValue = b.entry_time;
            break;
          case 'Symbol':
            aValue = a.symbol;
            bValue = b.symbol;
            break;
          case 'Side':
            aValue = a.side;
            bValue = b.side;
            break;
          case 'Setup':
            aValue = a.setup || '';
            bValue = b.setup || '';
            break;
          case 'Qty':
            aValue = a.quantity;
            bValue = b.quantity;
            break;
          case 'Entry':
            aValue = a.entry_price;
            bValue = b.entry_price;
            break;
          case 'Exit':
            aValue = a.exit_price;
            bValue = b.exit_price;
            break;
          case 'RR':
            aValue = calculatePlannedRR(a);
            bValue = calculatePlannedRR(b);
            break;
          case 'P&L':
            aValue = calculatePnL(a);
            bValue = calculatePnL(b);
            break;
          case 'Tags':
            aValue = a.tags.join(', ');
            bValue = b.tags.join(', ');
            break;
          case 'Notes':
            aValue = a.notes || '';
            bValue = b.notes || '';
            break;
          default:
            return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [trades, filters, sortConfig]);

  // Unique Setups for Filter
  const uniqueSetups = useMemo(() => {
    const setups = new Set(trades.map(t => t.setup).filter(Boolean));
    return Array.from(setups);
  }, [trades]);

  if (!authToken) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex">
      {/* Sidebar */}
      <aside 
        className={cn(
          "border-r border-border bg-card/50 flex flex-col gap-6 fixed h-full transition-all duration-300 z-50",
          isSidebarCollapsed ? "w-16 px-4 py-6" : "w-64 p-6"
        )}
      >
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute -right-3 top-6 h-6 w-6 rounded-full border bg-background shadow-md hover:bg-accent z-50"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        >
          {isSidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>

        <div className={cn("flex items-center gap-2 text-primary font-bold text-xl overflow-hidden transition-all duration-300", isSidebarCollapsed && "justify-center")}>
          <Activity className="h-6 w-6 shrink-0" />
          {!isSidebarCollapsed && <span>TradeLab</span>}
        </div>
        
        {!isSidebarCollapsed && (
          <div className="text-xs text-muted-foreground font-mono">
            {format(new Date(), 'EEEE, MMM do yyyy')}
          </div>
        )}
        
        <nav className="flex flex-col gap-2">
          <Button 
            variant={activeTab === 'dashboard' ? 'secondary' : 'ghost'} 
            className={cn("justify-start", isSidebarCollapsed && "justify-center px-2")}
            onClick={() => setActiveTab('dashboard')}
            title={isSidebarCollapsed ? "Dashboard" : undefined}
          >
            <TrendingUp className={cn("h-4 w-4", !isSidebarCollapsed && "mr-2")} /> 
            {!isSidebarCollapsed && "Dashboard"}
          </Button>
          <Button 
            variant={activeTab === 'journal' ? 'secondary' : 'ghost'} 
            className={cn("justify-start", isSidebarCollapsed && "justify-center px-2")}
            onClick={() => setActiveTab('journal')}
            title={isSidebarCollapsed ? "Journal" : undefined}
          >
            <CalendarIcon className={cn("h-4 w-4", !isSidebarCollapsed && "mr-2")} /> 
            {!isSidebarCollapsed && "Journal"}
          </Button>
          <Button 
            variant={activeTab === 'simulator' ? 'secondary' : 'ghost'} 
            className={cn("justify-start", isSidebarCollapsed && "justify-center px-2")}
            onClick={() => setActiveTab('simulator')}
            title={isSidebarCollapsed ? "Prop Firm Simulator" : undefined}
          >
            <Target className={cn("h-4 w-4", !isSidebarCollapsed && "mr-2")} /> 
            {!isSidebarCollapsed && "Simulator"}
          </Button>
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <Button
            className={cn("w-full", isSidebarCollapsed && "px-2")}
            onClick={() => openEntryModal()}
            title={isSidebarCollapsed ? "New Trade" : undefined}
          >
            <Plus className={cn("h-4 w-4", !isSidebarCollapsed && "mr-2")} />
            {!isSidebarCollapsed && "New Trade"}
          </Button>
          {!isSidebarCollapsed && currentUser && (
            <p className="text-xs text-muted-foreground text-center truncate px-1">{currentUser}</p>
          )}
          <Button
            variant="ghost"
            className={cn("w-full text-muted-foreground hover:text-foreground", isSidebarCollapsed && "px-2")}
            onClick={handleLogout}
            title={isSidebarCollapsed ? "Sign Out" : undefined}
          >
            <LogOut className={cn("h-4 w-4", !isSidebarCollapsed && "mr-2")} />
            {!isSidebarCollapsed && "Sign Out"}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 p-8 overflow-y-auto h-screen transition-all duration-300",
          isSidebarCollapsed ? "ml-16" : "ml-64"
        )}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">Loading...</div>
        ) : (
          <>
            {activeTab === 'dashboard' && stats && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                
                {/* KPI Cards */}
                <DashboardStats stats={stats} />

                {/* Charts Row 1: Daily Net Cumulative P&L and Net Daily P&L */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Daily Net Cumulative P&L */}
                  <Card className="flex flex-col">
                    <CardHeader>
                      <CardTitle>Daily Net Cumulative P&L</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2 flex-1 flex flex-col">
                      <div className="flex-1 w-full min-h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={stats.equityCurve}>
                            <defs>
                              <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
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
                              tickFormatter={(value) => `$${value.toFixed(0)}`} 
                            />
                            <RechartsTooltip 
                              formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                              itemStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="balance" 
                              stroke="#10b981" 
                              fillOpacity={1} 
                              fill="url(#colorPnL)" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Net Daily P&L */}
                  <Card className="flex flex-col">
                    <CardHeader>
                      <CardTitle>Net Daily P&L</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2 flex-1 flex flex-col">
                      <div className="flex-1 w-full min-h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.dailyPnL}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
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
                              tickFormatter={(value) => `$${value.toFixed(0)}`} 
                            />
                            <RechartsTooltip 
                              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Daily P&L']}
                              cursor={{fill: 'hsl(var(--muted)/0.2)'}}
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                              itemStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                              {stats.dailyPnL.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#ef4444'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Row 2: Calendar Heatmap */}
                <div className="grid grid-cols-1 gap-6">
                  <Card className="flex flex-col">
                    <CardHeader>
                      <CardTitle>Calendar</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <div className="flex-1 w-full">
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
                          {[
                            { key: 'Date', label: 'Date', align: 'left' },
                            { key: 'Time', label: 'Time', align: 'left' },
                            { key: 'Symbol', label: 'Symbol', align: 'left' },
                            { key: 'Side', label: 'Side', align: 'left' },
                            { key: 'Setup', label: 'Setup', align: 'left' },
                            { key: 'Qty', label: 'Qty', align: 'right' },
                            { key: 'Entry', label: 'Entry', align: 'right' },
                            { key: 'Exit', label: 'Exit', align: 'right' },
                            { key: 'RR', label: 'RR', align: 'right' },
                            { key: 'P&L', label: 'P&L', align: 'right' },
                            { key: 'Tags', label: 'Tags', align: 'left' },
                            { key: 'Notes', label: 'Notes', align: 'left' },
                          ].map((col) => (
                            <th key={col.key} className={`h-12 px-4 align-middle font-medium text-muted-foreground ${col.align === 'right' ? 'text-right' : ''}`}>
                              <Button variant="ghost" onClick={() => handleSort(col.key)} className={`h-8 px-2 flex items-center gap-1 ${col.align === 'right' ? 'ml-auto' : ''} -ml-2 hover:bg-muted/50`}>
                                {col.label}
                                {sortConfig?.key === col.key ? (
                                  sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                ) : (
                                  <ArrowUpDown className="h-3 w-3 opacity-50" />
                                )}
                              </Button>
                            </th>
                          ))}
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
                            const plannedRR = calculatePlannedRR(trade);
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
                                  <div>{trade.quantity}</div>
                                  {trade.futures_contract ? (
                                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                      {trade.futures_contract.replace('_', ' ')}
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                      {trade.quantity_type === 'LOTS' ? 'LOTS' : 'SHS'}
                                    </div>
                                  )}
                                </td>
                                <td className="p-4 align-middle text-right">${trade.entry_price.toFixed(2)}</td>
                                <td className="p-4 align-middle text-right">${trade.exit_price.toFixed(2)}</td>
                                <td className="p-4 align-middle text-right font-mono">{plannedRR > 0 ? plannedRR.toFixed(2) : '-'}</td>
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
          </>
        )}

        {/* Simulator Tab */}
        {activeTab === 'simulator' && (
          <PropFirmSimulator />
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
                {(() => {
                  const isFutures = formData.instrument_type === 'FUTURES';
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Instrument Type</Label>
                          <Select name="instrument_type" value={formData.instrument_type} onValueChange={(val) => {
                            if (val === 'FUTURES') {
                              setFormData(prev => ({ ...prev, instrument_type: 'FUTURES', futures_contract: 'ES_MINI' }));
                            } else {
                              setFormData(prev => ({ ...prev, instrument_type: 'FOREX_CFD', futures_contract: '' }));
                            }
                          }}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FOREX_CFD">Forex CFD</SelectItem>
                              <SelectItem value="FUTURES">Futures</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {isFutures ? (
                          <div className="space-y-2">
                            <Label>Contract</Label>
                            <Select name="futures_contract" value={formData.futures_contract} onValueChange={(val) => handleSelectChange('futures_contract', val)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ES_MINI">ES Mini ($50/pt)</SelectItem>
                                <SelectItem value="ES_MICRO">ES Micro ($5/pt)</SelectItem>
                                <SelectItem value="NQ_MINI">NQ Mini ($20/pt)</SelectItem>
                                <SelectItem value="NQ_MICRO">NQ Micro ($2/pt)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label>Quantity Type</Label>
                            <Select name="quantity_type" value={formData.quantity_type} onValueChange={(val) => handleSelectChange('quantity_type', val)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="LOTS">Lots (100x)</SelectItem>
                                <SelectItem value="SHARES">Shares (1x)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="symbol">Symbol</Label>
                          <Input id="symbol" name="symbol" value={formData.symbol} onChange={handleInputChange} required placeholder={isFutures ? 'e.g. ES' : 'e.g. EUR/USD'} />
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
                          <Label htmlFor="quantity">{isFutures ? 'Contracts' : 'Quantity'}</Label>
                          <Input id="quantity" name="quantity" type="number" value={formData.quantity} onChange={handleInputChange} required placeholder={isFutures ? '1' : '100'} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="commission">Commission</Label>
                          <Input id="commission" name="commission" type="number" step="0.01" value={formData.commission} onChange={handleInputChange} placeholder="0.00" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="entry_price">Entry Price</Label>
                          <Input id="entry_price" name="entry_price" type="number" step="0.0001" value={formData.entry_price} onChange={handleInputChange} required placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="exit_price">Exit Price</Label>
                          <Input id="exit_price" name="exit_price" type="number" step="0.0001" value={formData.exit_price} onChange={handleInputChange} required placeholder="0.00" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="stop_loss">Stop Loss (Optional)</Label>
                          <Input id="stop_loss" name="stop_loss" type="number" step="0.0001" value={formData.stop_loss} onChange={handleInputChange} placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="take_profit">Take Profit (Optional)</Label>
                          <Input id="take_profit" name="take_profit" type="number" step="0.0001" value={formData.take_profit} onChange={handleInputChange} placeholder="0.00" />
                        </div>
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
                    </>
                  );
                })()}
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmationId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Delete Trade</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to delete this trade? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDeleteConfirmationId(null)}>Cancel</Button>
                <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
