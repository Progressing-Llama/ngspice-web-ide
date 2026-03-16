import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LineChart as ChartIcon } from 'lucide-react';

interface PlotViewerProps {
  data?: any[];
}

export const PlotViewer: React.FC<PlotViewerProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-white/30 bg-[#151619] border border-white/10 rounded-lg">
        <ChartIcon size={48} className="mb-4 opacity-20" />
        <p className="text-sm font-medium">No simulation data to display</p>
        <p className="text-xs opacity-50 mt-1">Run a simulation to see results</p>
      </div>
    );
  }

  // Dynamically get keys for lines (excluding 'time')
  const keys = Object.keys(data[0]).filter(k => k !== 'time');
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="h-full w-full bg-[#151619] p-4 border border-white/10 rounded-lg flex flex-col">
      <div className="flex items-center gap-2 mb-4 text-white/50">
        <ChartIcon size={14} />
        <span className="text-xs uppercase tracking-wider font-semibold">Simulation Plots</span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="#ffffff50" 
              fontSize={10} 
              tickFormatter={(val) => val.toFixed(2)}
              label={{ value: 'Time (s)', position: 'insideBottom', offset: -5, fill: '#ffffff50', fontSize: 10 }}
            />
            <YAxis 
              stroke="#ffffff50" 
              fontSize={10}
              label={{ value: 'Voltage (V)', angle: -90, position: 'insideLeft', fill: '#ffffff50', fontSize: 10 }}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #ffffff20', borderRadius: '8px', fontSize: '12px' }}
              itemStyle={{ color: '#fff' }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
            {keys.map((key, index) => (
              <Line 
                key={key} 
                type="monotone" 
                dataKey={key} 
                stroke={colors[index % colors.length]} 
                dot={false} 
                strokeWidth={2}
                animationDuration={500}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
