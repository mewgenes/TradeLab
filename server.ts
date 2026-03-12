import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Database
const db = new Database('trades.db');

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK(side IN ('LONG', 'SHORT')),
    entry_date TEXT NOT NULL,
    entry_time TEXT,
    entry_price REAL NOT NULL,
    exit_price REAL NOT NULL,
    stop_loss REAL,
    quantity INTEGER NOT NULL,
    quantity_type TEXT DEFAULT 'SHARES' CHECK(quantity_type IN ('SHARES', 'LOTS')),
    commission REAL DEFAULT 0,
    setup TEXT,
    tags TEXT, -- JSON array of strings
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration to add entry_time if it doesn't exist
try {
  db.prepare('SELECT entry_time FROM trades LIMIT 1').run();
} catch (error) {
  db.prepare('ALTER TABLE trades ADD COLUMN entry_time TEXT').run();
}

// Migration to add stop_loss if it doesn't exist
try {
  db.prepare('SELECT stop_loss FROM trades LIMIT 1').run();
} catch (error) {
  db.prepare('ALTER TABLE trades ADD COLUMN stop_loss REAL').run();
}

// Migration to add quantity_type if it doesn't exist
try {
  db.prepare('SELECT quantity_type FROM trades LIMIT 1').run();
} catch (error) {
  db.prepare("ALTER TABLE trades ADD COLUMN quantity_type TEXT DEFAULT 'SHARES'").run();
}

// Migration to add take_profit if it doesn't exist
try {
  db.prepare('SELECT take_profit FROM trades LIMIT 1').run();
} catch (error) {
  db.prepare('ALTER TABLE trades ADD COLUMN take_profit REAL').run();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  
  // Get all trades
  app.get('/api/trades', (req, res) => {
    try {
      const trades = db.prepare('SELECT * FROM trades ORDER BY entry_date DESC, entry_time DESC').all();
      // Parse tags from JSON string
      const parsedTrades = trades.map((t: any) => ({
        ...t,
        tags: t.tags ? JSON.parse(t.tags) : []
      }));
      res.json(parsedTrades);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch trades' });
    }
  });

  // Add a trade
  app.post('/api/trades', (req, res) => {
    try {
      const { symbol, side, entry_date, entry_time, entry_price, exit_price, stop_loss, take_profit, quantity, quantity_type, commission, setup, tags, notes } = req.body;
      
      const stmt = db.prepare(`
        INSERT INTO trades (symbol, side, entry_date, entry_time, entry_price, exit_price, stop_loss, take_profit, quantity, quantity_type, commission, setup, tags, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const info = stmt.run(
        symbol, 
        side, 
        entry_date, 
        entry_time || '09:30', // Default to market open if missing
        entry_price, 
        exit_price, 
        stop_loss || 0,
        take_profit || 0,
        quantity, 
        quantity_type || 'SHARES',
        commission || 0, 
        setup, 
        JSON.stringify(tags || []), 
        notes
      );
      
      res.json({ id: info.lastInsertRowid, ...req.body });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create trade' });
    }
  });

  // Update a trade
  app.put('/api/trades/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { symbol, side, entry_date, entry_time, entry_price, exit_price, stop_loss, take_profit, quantity, quantity_type, commission, setup, tags, notes } = req.body;
      
      const stmt = db.prepare(`
        UPDATE trades 
        SET symbol = ?, side = ?, entry_date = ?, entry_time = ?, entry_price = ?, exit_price = ?, stop_loss = ?, take_profit = ?, quantity = ?, quantity_type = ?, commission = ?, setup = ?, tags = ?, notes = ?
        WHERE id = ?
      `);
      
      const info = stmt.run(
        symbol, 
        side, 
        entry_date, 
        entry_time || '09:30',
        entry_price, 
        exit_price, 
        stop_loss || 0,
        take_profit || 0,
        quantity, 
        quantity_type || 'SHARES',
        commission || 0, 
        setup, 
        JSON.stringify(tags || []), 
        notes,
        id
      );
      
      if (info.changes === 0) {
        return res.status(404).json({ error: 'Trade not found' });
      }
      
      res.json({ id, ...req.body });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update trade' });
    }
  });

  // Delete a trade
  app.delete('/api/trades/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM trades WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete trade' });
    }
  });

  // Get Dashboard Stats
  app.get('/api/stats', (req, res) => {
    try {
      const trades = db.prepare('SELECT * FROM trades').all();
      
      let totalPnL = 0;
      let winningTrades = 0;
      let losingTrades = 0;
      let totalWins = 0;
      let totalLosses = 0;
      let totalRR = 0;
      let tradesWithRR = 0;
      
      const equityCurve = [];
      let runningBalance = 0; // Assuming starting at 0 for P&L curve

      // Sort by date for equity curve
      const sortedTrades = trades.sort((a: any, b: any) => {
        const dateA = new Date(`${a.entry_date}T${a.entry_time || '00:00'}`).getTime();
        const dateB = new Date(`${b.entry_date}T${b.entry_time || '00:00'}`).getTime();
        return dateA - dateB;
      });

      const dailyPnLMap: Record<string, { pnl: number, trades: number, wins: number }> = {};
      const hourlyPnLMap: Record<string, number> = {};

      for (const trade of sortedTrades as any[]) {
        const multiplier = trade.side === 'LONG' ? 1 : -1;
        // Assume 1 Lot = 100 shares/units for PnL calculation if type is LOTS
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

        // Calculate Planned RR
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
          equityCurve.push({
            date: trade.entry_date,
            balance: runningBalance
          });
        }

        // Daily P&L
        if (!dailyPnLMap[trade.entry_date]) {
          dailyPnLMap[trade.entry_date] = { pnl: 0, trades: 0, wins: 0 };
        }
        dailyPnLMap[trade.entry_date].pnl += netPnL;
        dailyPnLMap[trade.entry_date].trades += 1;
        if (netPnL > 0) {
          dailyPnLMap[trade.entry_date].wins += 1;
        }

        // Hourly P&L
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
        wins: data.wins
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
        hourlyPnL
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
