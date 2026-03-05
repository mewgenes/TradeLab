import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CalendarHeatmapProps {
  data: { date: string; value: number }[];
}

export function CalendarHeatmap({ data }: CalendarHeatmapProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calculate padding days for the start of the month
  const startDay = getDay(monthStart); // 0 = Sunday, 1 = Monday, etc.
  const paddingDays = Array.from({ length: startDay });

  const getColor = (value: number) => {
    if (value === 0) return 'bg-muted/30';
    if (value > 0) {
      if (value > 500) return 'bg-green-500';
      if (value > 200) return 'bg-green-600';
      return 'bg-green-700';
    } else {
      if (value < -500) return 'bg-red-500';
      if (value < -200) return 'bg-red-600';
      return 'bg-red-700';
    }
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold text-lg">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <Button variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs text-muted-foreground font-medium">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr gap-2 flex-1">
        {paddingDays.map((_, i) => (
          <div key={`padding-${i}`} className="w-full h-full min-h-[80px] rounded-md" />
        ))}
        
        {daysInMonth.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayData = data.find(d => d.date === dateStr);
          const value = dayData ? dayData.value : 0;
          const isToday = isSameDay(day, new Date());

          return (
            <TooltipProvider key={dateStr}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className={`
                      w-full h-full min-h-[80px] rounded-md flex flex-col items-center justify-center text-xs cursor-pointer transition-all hover:opacity-80 relative
                      ${getColor(value)}
                      ${isToday ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
                    `}
                  >
                    <span className={`font-medium ${value !== 0 ? 'text-white' : 'text-muted-foreground'}`}>
                      {format(day, 'd')}
                    </span>
                    {value !== 0 && (
                      <span className="text-[10px] text-white/90 font-mono hidden sm:block truncate w-full text-center px-1">
                        ${Math.abs(value).toFixed(2)}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-bold">{format(day, 'EEEE, MMM do, yyyy')}</p>
                  <p className={value >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {value >= 0 ? '+' : ''}${value.toFixed(2)}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
      
      <div className="mt-4 flex justify-center items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-sm"></div> Win
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-sm"></div> Loss
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-muted/30 rounded-sm"></div> No Trade
        </div>
      </div>
    </div>
  );
}
