import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Separator } from "../components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">Configure system preferences and settings</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="general" className="data-[state=active]:bg-blue-600">
            General
          </TabsTrigger>
          <TabsTrigger value="cameras" className="data-[state=active]:bg-blue-600">
            Cameras
          </TabsTrigger>
          <TabsTrigger value="detection" className="data-[state=active]:bg-blue-600">
            Detection
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-blue-600">
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400">System Version</Label>
                  <p className="text-white mt-1">v2.4.1</p>
                </div>
                <div>
                  <Label className="text-slate-400">YOLOv8 Model</Label>
                  <p className="text-white mt-1">yolov8n.pt</p>
                </div>
                <div>
                  <Label className="text-slate-400">Installation Date</Label>
                  <p className="text-white mt-1">January 15, 2026</p>
                </div>
                <div>
                  <Label className="text-slate-400">License Status</Label>
                  <p className="text-green-500 mt-1">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Business Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="business-name" className="text-slate-300">
                  Business Name
                </Label>
                <Input
                  id="business-name"
                  defaultValue="Mr. DIY"
                  className="bg-slate-900/50 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone" className="text-slate-300">
                  Timezone
                </Label>
                <Select defaultValue="utc+8-ph">
                  <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="utc+8-ph">Philippine Time (UTC+8)</SelectItem>
                    <SelectItem value="utc+8-sg">Singapore Time (UTC+8)</SelectItem>
                    <SelectItem value="utc+9">Japan / Korea Time (UTC+9)</SelectItem>
                    <SelectItem value="utc+7">Indochina Time (UTC+7)</SelectItem>
                    <SelectItem value="utc+5:30">India Standard Time (UTC+5:30)</SelectItem>
                    <SelectItem value="utc+0">Greenwich Mean Time (UTC+0)</SelectItem>
                    <SelectItem value="utc-5">Eastern Time (UTC-5)</SelectItem>
                    <SelectItem value="utc-6">Central Time (UTC-6)</SelectItem>
                    <SelectItem value="utc-7">Mountain Time (UTC-7)</SelectItem>
                    <SelectItem value="utc-8">Pacific Time (UTC-8)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency" className="text-slate-300">
                  Currency
                </Label>
                <Select defaultValue="php">
                  <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="php">PHP (₱)</SelectItem>
                    <SelectItem value="usd">USD ($)</SelectItem>
                    <SelectItem value="eur">EUR (€)</SelectItem>
                    <SelectItem value="gbp">GBP (£)</SelectItem>
                    <SelectItem value="jpy">JPY (¥)</SelectItem>
                    <SelectItem value="sgd">SGD ($)</SelectItem>
                    <SelectItem value="cad">CAD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700">Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cameras" className="space-y-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Camera Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Auto-reconnect Cameras</Label>
                  <p className="text-sm text-slate-400">Automatically reconnect cameras if connection is lost</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator className="bg-slate-700" />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Enable Motion Detection</Label>
                  <p className="text-sm text-slate-400">Use motion detection to save bandwidth</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator className="bg-slate-700" />
              <div className="space-y-2">
                <Label htmlFor="frame-rate" className="text-slate-300">
                  Frame Rate (FPS)
                </Label>
                <Select defaultValue="15">
                  <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="10">10 FPS</SelectItem>
                    <SelectItem value="15">15 FPS</SelectItem>
                    <SelectItem value="30">30 FPS</SelectItem>
                    <SelectItem value="60">60 FPS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resolution" className="text-slate-300">
                  Video Resolution
                </Label>
                <Select defaultValue="1080p">
                  <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="720p">720p</SelectItem>
                    <SelectItem value="1080p">1080p</SelectItem>
                    <SelectItem value="4k">4K</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700">Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detection" className="space-y-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">YOLOv8 Detection Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="confidence" className="text-slate-300">
                  Confidence Threshold: <span className="text-white">0.5</span>
                </Label>
                <Input
                  id="confidence"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  defaultValue="0.5"
                  className="bg-slate-900/50"
                />
                <p className="text-xs text-slate-400">
                  Minimum confidence level for person detection
                </p>
              </div>
              <Separator className="bg-slate-700" />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Track Movement Paths</Label>
                  <p className="text-sm text-slate-400">Track visitor movement across cameras</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator className="bg-slate-700" />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Ignore Stationary Objects</Label>
                  <p className="text-sm text-slate-400">Don't count people standing still for more than 2 minutes</p>
                </div>
                <Switch />
              </div>
              <Separator className="bg-slate-700" />
              <div className="space-y-2">
                <Label htmlFor="dwell-time" className="text-slate-300">
                  Dwell Time Threshold (seconds)
                </Label>
                <Input
                  id="dwell-time"
                  type="number"
                  defaultValue="10"
                  className="bg-slate-900/50 border-slate-700 text-white"
                />
                <p className="text-xs text-slate-400">
                  Minimum time spent in frame to count as a visitor
                </p>
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700">Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Email Notifications</Label>
                  <p className="text-sm text-slate-400">Receive alerts via email</p>
                </div>
                <Switch />
              </div>
              <Separator className="bg-slate-700" />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Push Notifications</Label>
                  <p className="text-sm text-slate-400">Receive browser push notifications</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator className="bg-slate-700" />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Daily Summary Report</Label>
                  <p className="text-sm text-slate-400">Receive daily summary at end of business day</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator className="bg-slate-700" />
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">
                  Notification Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue="admin@company.com"
                  className="bg-slate-900/50 border-slate-700 text-white"
                />
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700">Save Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}