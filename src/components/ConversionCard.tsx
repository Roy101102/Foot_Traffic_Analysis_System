import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ArrowRight } from "lucide-react";

interface ConversionCardProps {
  visitors: number;
  customers: number;
  conversionRate: number;
  period?: string;
}

export function ConversionCard({ visitors, customers, conversionRate, period = "Today" }: ConversionCardProps) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">Conversion Overview - {period}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <p className="text-sm text-slate-400">Total Visitors</p>
            <p className="text-3xl font-bold text-blue-500">{visitors.toLocaleString()}</p>
          </div>
          <div className="flex items-center justify-center">
            <ArrowRight className="h-8 w-8 text-slate-600" />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-400">Customers (POS Sales)</p>
            <p className="text-3xl font-bold text-green-500">{customers.toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-slate-700">
          <div className="text-center space-y-2">
            <p className="text-sm text-slate-400">Conversion Rate</p>
            <div className="flex items-center justify-center gap-2">
              <p className="text-5xl font-bold text-white">{conversionRate}%</p>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3 mt-4">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${conversionRate}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
