import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CalendarHeatmapProps {
  data: { date: string; value: number; trades: number; wins: number }[];
}

export function CalendarHeatmap({ data }: CalendarHeatmapProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calculate padding days for the start of the month
  const startDay = getDay(monthStart); // 0 = Sunday, 1 = Monday, etc.
  const paddingDays = Array.from({ length: startDay });

  const getDayStats = (dateStr: string) => {
    return data.find(d => d.date === dateStr) || { value: 0, trades: 0, wins: 0 };
  };

  const getCellStyle = (value: number, trades: number) => {
    if (trades === 0) return 'bg-muted/10 border-transparent';
    
    if (value > 0) {
      return 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20';
    } else if (value < 0) {
      return 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20';
    } else {
      return 'bg-muted/20 border-muted hover:bg-muted/30';
    }
  };

  const getTextStyle = (value: number, trades: number) => {
    if (trades === 0) return 'text-muted-foreground';
    if (value > 0) return 'text-green-500';
    if (value < 0) return 'text-red-500';
    return 'text-foreground';
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // Calculate monthly stats
  const monthlyStats = data.filter(d => isSameMonth(new Date(d.date), currentMonth)).reduce((acc, curr) => {
    acc.pnl += curr.value;
    acc.trades += curr.trades;
    return acc;
  }, { pnl: 0, trades: 0 });

  return (
    <div className="w-full h-full flex flex-col select-none">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-lg min-w-[140px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
          </div>
          <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Monthly P&L</span>
            <span className={`font-bold font-mono ${monthlyStats.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {monthlyStats.pnl >= 0 ? '+' : ''}${monthlyStats.pnl.toFixed(2)}
            </span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Trades</span>
            <span className="font-bold font-mono">{monthlyStats.trades}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3 mb-3 text-center text-xs text-muted-foreground font-medium uppercase tracking-wider">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr gap-3 flex-1">
        {paddingDays.map((_, i) => (
          <div key={`padding-${i}`} className="w-full h-full min-h-[100px] rounded-xl bg-muted/5 border border-transparent" />
        ))}
        
        {daysInMonth.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const { value, trades, wins } = getDayStats(dateStr);
          const isToday = isSameDay(day, new Date());
          const winRate = trades > 0 ? (wins / trades) * 100 : 0;

          return (
            <TooltipProvider key={dateStr}>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div 
                    className={cn(
                      "w-full h-full min-h-[100px] rounded-xl border p-2 flex flex-col justify-between transition-all duration-200 relative group",
                      getCellStyle(value, trades),
                      isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <span className={cn(
                        "text-xs font-medium",
                        trades > 0 ? "text-muted-foreground" : "text-muted-foreground/50"
                      )}>
                        {format(day, 'd')}
                      </span>
                      {trades > 0 && (
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-background/50 backdrop-blur-sm",
                          getTextStyle(value, trades)
                        )}>
                          {trades} {trades === 1 ? 'trade' : 'trades'}
                        </span>
                      )}
                    </div>

                    {trades > 0 && (
                      <div className="flex flex-col items-end gap-0.5 w-full overflow-hidden">
                        <span className={cn(
                          "font-bold font-mono text-sm tracking-tight truncate w-full text-right",
                          getTextStyle(value, trades)
                        )}>
                          {value >= 0 ? '+' : ''}${Math.abs(value).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium truncate">
                          {winRate.toFixed(0)}% WR
                        </span>
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="p-3">
                  <div className="space-y-1">
                    <p className="font-bold text-sm border-b pb-1 mb-1">{format(day, 'EEEE, MMM do, yyyy')}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="text-muted-foreground">P&L:</span>
                      <span className={cn("font-mono font-medium", value >= 0 ? 'text-green-500' : 'text-red-500')}>
                        {value >= 0 ? '+' : ''}${value.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground">Trades:</span>
                      <span className="font-mono font-medium">{trades}</span>
                      <span className="text-muted-foreground">Wins:</span>
                      <span className="font-mono font-medium text-green-500">{wins}</span>
                      <span className="text-muted-foreground">Losses:</span>
                      <span className="font-mono font-medium text-red-500">{trades - wins}</span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}
