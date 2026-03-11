"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TensionPoint {
  sceneNumber: number;
  tension: number;
}

export default function TensionChart({ data }: { data: TensionPoint[] }) {
  if (data.length === 0) return null;

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="tensionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
          <XAxis
            dataKey="sceneNumber"
            label={{
              value: "Scene",
              position: "insideBottomRight",
              offset: -5,
              className: "fill-muted-foreground text-xs",
            }}
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
          />
          <YAxis
            domain={[0, 100]}
            label={{
              value: "Tension",
              angle: -90,
              position: "insideLeft",
              className: "fill-muted-foreground text-xs",
            }}
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelFormatter={(val) => `Scene ${val}`}
          />
          <Area
            type="monotone"
            dataKey="tension"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#tensionGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
