import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './SalesChart.css';

const data = [
  { name: '08/05', value: 180000 },
  { name: '10/05', value: 50000 },
  { name: '11/05', value: 40000 },
  { name: '12/05', value: 350000 },
  { name: '13/05', value: 90000 },
  { name: '14/05', value: 50000 },
  { name: '15/05', value: 80000 },
  { name: '16/05', value: 20000 },
  { name: '17/05', value: 10000 },
  { name: '18/05', value: 230000 },
  { name: '19/05', value: 50000 },
  { name: '20/05', value: 10000 },
  { name: '21/05', value: 15000 },
  { name: '22/05', value: 20000 },
];

const SalesChart = () => {
  return (
    <div className="sales-chart-container">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Sales Trend</h3>
          <p className="chart-subtitle">Daily revenue - last 14 days</p>
        </div>
        <div className="chart-filters">
          <button className="filter-btn active">14D</button>
          <button className="filter-btn">30D</button>
          <button className="filter-btn">MTD</button>
        </div>
      </div>
      
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4299e1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#4299e1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#a0aec0', fontSize: 12 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a0aec0', fontSize: 12 }} tickFormatter={(value) => `${value / 1000}k`} />
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#4299e1" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SalesChart;
