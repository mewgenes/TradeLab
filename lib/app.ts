import express from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from './db.js';
import { signToken, verifyToken } from './auth.js';

const app = express();
app.use(express.json());

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const { data: users } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .limit(1);

    const user = users?.[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    res.json({ token: signToken(user.id), username: user.username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    const { data } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', (req as any).userId)
      .single();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get all trades
app.get('/api/trades', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', (req as any).userId)
      .order('entry_date', { ascending: false })
      .order('entry_time', { ascending: false });

    if (error) throw error;

    const parsedTrades = (data ?? []).map((t: any) => ({
      ...t,
      tags: t.tags ? JSON.parse(t.tags) : [],
    }));
    res.json(parsedTrades);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// Add a trade
app.post('/api/trades', verifyToken, async (req, res) => {
  try {
    const {
      symbol, side, entry_date, entry_time, entry_price, exit_price,
      stop_loss, take_profit, quantity, quantity_type, commission,
      setup, tags, notes,
    } = req.body;

    const { data, error } = await supabase
      .from('trades')
      .insert({
        symbol,
        side,
        entry_date,
        entry_time: entry_time || '09:30',
        entry_price,
        exit_price,
        stop_loss: stop_loss || 0,
        take_profit: take_profit || 0,
        quantity,
        quantity_type: quantity_type || 'SHARES',
        commission: commission || 0,
        setup,
        tags: JSON.stringify(tags || []),
        notes,
        user_id: (req as any).userId,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ ...data, tags: data.tags ? JSON.parse(data.tags) : [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

// Update a trade
app.put('/api/trades/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      symbol, side, entry_date, entry_time, entry_price, exit_price,
      stop_loss, take_profit, quantity, quantity_type, commission,
      setup, tags, notes,
    } = req.body;

    const { data, error } = await supabase
      .from('trades')
      .update({
        symbol,
        side,
        entry_date,
        entry_time: entry_time || '09:30',
        entry_price,
        exit_price,
        stop_loss: stop_loss || 0,
        take_profit: take_profit || 0,
        quantity,
        quantity_type: quantity_type || 'SHARES',
        commission: commission || 0,
        setup,
        tags: JSON.stringify(tags || []),
        notes,
      })
      .eq('id', id)
      .eq('user_id', (req as any).userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Trade not found' });
      }
      throw error;
    }

    res.json({ ...data, tags: data.tags ? JSON.parse(data.tags) : [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update trade' });
  }
});

// Delete a trade
app.delete('/api/trades/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', id)
      .eq('user_id', (req as any).userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete trade' });
  }
});

// Get Dashboard Stats
app.get('/api/stats', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', (req as any).userId);

    if (error) throw error;
    const trades = data ?? [];

    let totalPnL = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let totalRR = 0;
    let tradesWithRR = 0;

    const equityCurve: { date: string; balance: number }[] = [];
    let runningBalance = 0;

    const sortedTrades = trades.sort((a: any, b: any) => {
      const dateA = new Date(`${a.entry_date}T${a.entry_time || '00:00'}`).getTime();
      const dateB = new Date(`${b.entry_date}T${b.entry_time || '00:00'}`).getTime();
      return dateA - dateB;
    });

    const dailyPnLMap: Record<string, { pnl: number; trades: number; wins: number }> = {};
    const hourlyPnLMap: Record<string, number> = {};

    for (const trade of sortedTrades as any[]) {
      const multiplier = trade.side === 'LONG' ? 1 : -1;
      const quantityMultiplier = trade.quantity_type === 'LOTS' ? 100 : 1;
      const grossPnL = (trade.exit_price - trade.entry_price) * trade.quantity * quantityMultiplier * multiplier;
      const netPnL = grossPnL - (trade.commission || 0);

      totalPnL += netPnL;
      runningBalance += netPnL;

      if (netPnL > 0) {
        winningTrades++;
        totalWins += netPnL;
      } else {
        losingTrades++;
        totalLosses += Math.abs(netPnL);
      }

      if (trade.stop_loss && trade.stop_loss > 0 && trade.take_profit && trade.take_profit > 0) {
        const risk = Math.abs(trade.entry_price - trade.stop_loss);
        const reward = Math.abs(trade.take_profit - trade.entry_price);
        if (risk > 0) {
          const rr = reward / risk;
          totalRR += rr;
          tradesWithRR++;
        }
      }

      if (equityCurve.length > 0 && equityCurve[equityCurve.length - 1].date === trade.entry_date) {
        equityCurve[equityCurve.length - 1].balance = runningBalance;
      } else {
        equityCurve.push({ date: trade.entry_date, balance: runningBalance });
      }

      if (!dailyPnLMap[trade.entry_date]) {
        dailyPnLMap[trade.entry_date] = { pnl: 0, trades: 0, wins: 0 };
      }
      dailyPnLMap[trade.entry_date].pnl += netPnL;
      dailyPnLMap[trade.entry_date].trades += 1;
      if (netPnL > 0) {
        dailyPnLMap[trade.entry_date].wins += 1;
      }

      if (trade.entry_time) {
        const hour = trade.entry_time.split(':')[0];
        const timeLabel = `${hour}:00`;
        if (!hourlyPnLMap[timeLabel]) {
          hourlyPnLMap[timeLabel] = 0;
        }
        hourlyPnLMap[timeLabel] += netPnL;
      }
    }

    const totalTrades = winningTrades + losingTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const avgRR = tradesWithRR > 0 ? totalRR / tradesWithRR : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
    const avgWin = winningTrades > 0 ? totalWins / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? totalLosses / losingTrades : 0;

    const dailyPnL = Object.entries(dailyPnLMap).map(([date, data]) => ({
      date,
      value: data.pnl,
      trades: data.trades,
      wins: data.wins,
    }));

    const totalDays = dailyPnL.length;
    const winningDays = dailyPnL.filter(d => d.value > 0).length;
    const losingDays = dailyPnL.filter(d => d.value < 0).length;

    const hourlyPnL = Object.entries(hourlyPnLMap)
      .map(([time, value]) => ({ time, value }))
      .sort((a, b) => parseInt(a.time) - parseInt(b.time));

    res.json({
      totalPnL,
      winRate,
      profitFactor,
      totalTrades,
      winningTrades,
      losingTrades,
      winningDays,
      losingDays,
      totalDays,
      avgWin,
      avgLoss,
      avgRR,
      equityCurve,
      dailyPnL,
      hourlyPnL,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default app;
