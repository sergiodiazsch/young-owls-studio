"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";

interface ChartDataPoint {
  sceneNumber: number;
  brightness: number;
  saturation: number;
  warmth: number;
}

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

export default function ColorScriptCharts({ data }: { data: ChartDataPoint[] }) {
  if (data.length < 2) return null;

  return (
    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3 mb-6">
      <Card>
        <CardContent className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
            Brightness Curve
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="sceneNumber" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={30} />
              <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `Scene ${v}`} />
              <Line type="monotone" dataKey="brightness" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
            Warmth Curve
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="sceneNumber" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={30} />
              <RechartsTooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(v) => `Scene ${v}`}
                formatter={(value) => {
                  const v = Number(value ?? 0);
                  const raw = (v / 50 - 1).toFixed(2);
                  return [`${raw} (${v > 50 ? "warm" : "cool"})`, "Warmth"];
                }}
              />
              <Line type="monotone" dataKey="warmth" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
            Saturation Curve
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="sceneNumber" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={30} />
              <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `Scene ${v}`} />
              <Line type="monotone" dataKey="saturation" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
