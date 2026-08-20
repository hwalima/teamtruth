import React, { useState, useEffect } from 'react';
import { PageTemplate } from '@/components/page-template';
import TimesheetDashboardWidget from '@/components/timesheets/TimesheetDashboardWidget';
import {
  RefreshCw, BarChart3, Download, Users, Activity, UserPlus, DollarSign,
  FolderOpen, CheckSquare, Clock, Bug, Receipt, FileText, Building2,
  TrendingUp, AlertTriangle, Calendar, Target, Wallet, CreditCard, Ticket, X,
  Settings as SettingsIcon, Globe, Shield, ChevronRight, ArrowUpRight, AlertCircle, Banknote,
  Tag, Gift, Settings
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/utils/currency';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ResponsiveContainer, BarChart, AreaChart, Bar, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, LabelList, Cell,
  PieChart, Pie, Legend
} from 'recharts';

interface DashboardData {
  cards: Array<{
    value: number;
    title?: string;
    format?: string;
    icon?: string;
  }>;
  // Super admin stats object
  stats?: {
    totalCompanies: number;
    totalActivePlanCompanies: number;
    totalUsers: number;
    totalRevenue: number;
    activePlans: number;
    pendingRequests: number;
    monthlyGrowth: number;
    activeCoupons: number;
  };
  // Super admin chart data
  recentActivity?: Array<{
    id: number;
    name: string;
    email: string;
    registered_at: string;
    status: string;
    avatar?: string;
  }>;
  topPlans?: Array<{
    name: string;
    subscribers: number;
    revenue: number;
  }>;
  monthlyRevenue?: Array<{ month: string; short: string; revenue: number }>;
  monthlyCompanies?: Array<{ month: string; short: string; count: number }>;
  revenueYear?: number;
  companiesYear?: number;
  availableYears?: number[];
  // Company dashboard data
  projects?: {
    total: number;
    active: number;
    completed: number;
    overdue: number;
  };
  tasks?: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
  };
  timesheets?: {
    totalHours: number;
    thisWeek: number;
    pendingApprovals: number;
  };
  budgets?: {
    totalBudget: number;
    spent: number;
    remaining: number;
    utilization: number;
  };
  invoices?: {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
  };
  bugs?: {
    total: number;
    open: number;
    resolved: number;
    critical: number;
  };
  monthlyTimesheetHours?: Array<{ month: string; short: string; hours: number }>;
  monthlyTaskCompletion?: Array<{ month: string; short: string; created: number; completed: number }>;
  monthlyInvoiceRevenue?: Array<{ month: string; short: string; revenue: number }>;
  chartYear?: number;
  availableYears?: number[];
  pendingTimesheets?: Array<{ id: number; user: string; avatar: string | null; period: string; total_hours: number; submitted_at: string }>;
  recentBugs?: Array<{ id: number; title: string; priority: string; status: string; project: string; reported_at: string }>;
  pendingInvoices?: Array<{ id: number; invoice_number: string; title: string; total_amount: number; due_date: string; status: string; project: string }>;
  ongoingProjects?: Array<{ id: number; title: string; priority: string; progress: number; deadline: string; members: number }>;
  recentTasks?: Array<{ id: number; title: string; priority: string; stage: string; project: string; due_date: string; updated_at: string }>;
  pendingExpenses?: Array<{ id: number; title: string; amount: number; submitted_by: string; project: string; expense_date: string; submitted_at: string }>;
  recentActivities?: Array<{
    id: number;
    type: string;
    description: string;
    user: string;
    time: string;
    avatar?: string;
  }>;
  recentCompanies?: Array<{
    id: number;
    name: string;
    email: string;
    plan?: string;
    registered_at: string;
  }>;
  // Super admin existing fields
  companies?: { total: number; active: number; inactive: number };
  plans?: { total: number; active: number; inactive: number };
  planOrders?: { total: number; pending: number; approved: number; rejected: number };
  planRequests?: { total: number; pending: number; approved: number; rejected: number };
  coupons?: { total: number; active: number; expired: number };
  mostBoughtPlan?: { name: string; count: number } | null;
  mostUsedCoupon?: { name: string; code: string; count: number } | null;
  currencies?: { total: number; default: string };
  customPages?: { total: number };
  users?: { total: number };
  currentWorkspace?: { id: number; name: string };
}

interface PageAction {
  label: string;
  icon: React.ReactNode;
  variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  onClick: () => void;
}

import UserInitials from '@/components/user-initials';

export default function Dashboard({ dashboardData, isSuperAdmin, isSaasMode = true, hasRoleDashboardAccess = false, userWorkspaceRole }: { dashboardData: DashboardData; isSuperAdmin?: boolean; isSaasMode?: boolean; hasRoleDashboardAccess?: boolean; userWorkspaceRole?: string }) {
  const { t } = useTranslation();
  const { auth } = usePage().props as any;

  // Super admin state
  const [mounted, setMounted] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(dashboardData?.revenueYear ?? currentYear);
  const [selectedCompaniesYear, setSelectedCompaniesYear] = useState<number>(dashboardData?.companiesYear ?? currentYear);
  const [selectedChartYear, setSelectedChartYear] = useState<number>(dashboardData?.chartYear ?? currentYear);
  const [monthlyTimesheetHours, setMonthlyTimesheetHours] = useState(dashboardData?.monthlyTimesheetHours ?? []);
  const [monthlyTaskCompletion, setMonthlyTaskCompletion] = useState(dashboardData?.monthlyTaskCompletion ?? []);
  const [monthlyInvoiceRevenue, setMonthlyInvoiceRevenue] = useState(dashboardData?.monthlyInvoiceRevenue ?? []);
  const [monthlyRevenue, setMonthlyRevenue] = useState<Array<{ month: string; short: string; revenue: number }>>(dashboardData?.monthlyRevenue ?? []);
  const [monthlyCompanies, setMonthlyCompanies] = useState<Array<{ month: string; short: string; count: number }>>(dashboardData?.monthlyCompanies ?? []);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setMonthlyRevenue(dashboardData?.monthlyRevenue ?? []); }, [dashboardData?.monthlyRevenue]);
  useEffect(() => { setMonthlyCompanies(dashboardData?.monthlyCompanies ?? []); }, [dashboardData?.monthlyCompanies]);
  useEffect(() => { setMonthlyTimesheetHours(dashboardData?.monthlyTimesheetHours ?? []); }, [dashboardData?.monthlyTimesheetHours]);
  useEffect(() => { setMonthlyTaskCompletion(dashboardData?.monthlyTaskCompletion ?? []); }, [dashboardData?.monthlyTaskCompletion]);
  useEffect(() => { setMonthlyInvoiceRevenue(dashboardData?.monthlyInvoiceRevenue ?? []); }, [dashboardData?.monthlyInvoiceRevenue]);

  const handleChartYearChange = (year: number) => {
    setSelectedChartYear(year);
    router.get(window.location.pathname, { chartYear: year }, { preserveState: true, preserveScroll: true });
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    router.get(window.location.pathname, { revenueYear: year, companiesYear: selectedCompaniesYear }, { preserveState: true, preserveScroll: true });
  };
  const handleCompaniesYearChange = (year: number) => {
    setSelectedCompaniesYear(year);
    router.get(window.location.pathname, { revenueYear: selectedYear, companiesYear: year }, { preserveState: true, preserveScroll: true });
  };

  const availableYears: number[] = dashboardData?.availableYears ?? Array.from({ length: 6 }, (_, i) => currentYear + 1 - i);
  const stats = dashboardData?.stats ?? {
    totalCompanies: 0, totalActivePlanCompanies: 0, totalUsers: 0,
    totalRevenue: 0, activePlans: 0, pendingRequests: 0, monthlyGrowth: 0, activeCoupons: 0,
  };
  const recentActivity = dashboardData?.recentActivity ?? [];
  const topPlans = dashboardData?.topPlans ?? [];
  const maxRevenue = topPlans.length > 0 ? Math.max(...topPlans.map(p => p.revenue)) : 1;

  // Get CSS primary color for charts
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  useEffect(() => {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    if (color) setPrimaryColor(color.startsWith('hsl') || color.startsWith('#') || color.startsWith('rgb') ? color : `hsl(${color})`);
  }, []);

  const fadeUp = (_delay: number) => '';
  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? t('Good morning') : h < 17 ? t('Good afternoon') : t('Good evening');
  };

  const safeRoute = (name: string, params?: any): string => {
    try { return route(name, params); } catch { return '#'; }
  };

  // If super admin, render super admin dashboard
  if (isSuperAdmin) {
    return (
      <PageTemplate
        title={t('Dashboard')}
        description={t("Manage subscription plans for your customers.")}
        url="/dashboard"
        actions={[
          {
            label: t('Refresh'),
            icon: <RefreshCw className="h-4 w-4" />,
            variant: 'outline',
            onClick: () => window.location.reload()
          }
        ]}
      >
         <div className="space-y-6">
        <style>{`
          @keyframes waterWave {
            0%   { transform: translateX(0); }
            50%  { transform: translateX(-25%); }
            100% { transform: translateX(0); }
          }
          .animate-water-wave-1 { animation: waterWave 4s ease-in-out infinite; will-change: transform; }
          .animate-water-wave-2 { animation: waterWave 6s ease-in-out infinite reverse; will-change: transform; }
          .animate-water-wave-3 { animation: waterWave 8s ease-in-out infinite; will-change: transform; }
          @keyframes handWave {
            0%   { transform: rotate(0deg); }
            10%  { transform: rotate(18deg); }
            20%  { transform: rotate(-8deg); }
            30%  { transform: rotate(18deg); }
            40%  { transform: rotate(-4deg); }
            50%  { transform: rotate(12deg); }
            60%  { transform: rotate(0deg); }
            100% { transform: rotate(0deg); }
          }
          .animate-hand-wave { animation: handWave 2.2s ease-in-out infinite; transform-origin: 70% 70%; display: inline-block; }
        `}</style>
        {/* ── Greeting Banner ── */}
        <div className={`group relative overflow-hidden rounded-2xl bg-slate-800 dark:bg-slate-900 px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${fadeUp(0)}`}>
          {/* flowing gradient orbs */}
          <span className="pointer-events-none absolute -top-10 -left-10 w-48 h-48 rounded-full bg-emerald-500/10 blur-2xl animate-pulse" style={{ animationDuration: '4s' }} />
          <span className="pointer-events-none absolute -bottom-10 right-0 w-56 h-56 rounded-full bg-blue-500/10 blur-2xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1.5s' }} />
          <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-violet-500/5 blur-2xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '0.8s' }} />
          {/* crisp glowing dots */}
          <span className="pointer-events-none absolute top-4 left-1/3 w-1.5 h-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_6px_2px_rgba(52,211,153,0.6)] animate-ping" style={{ animationDuration: '3s' }} />
          <span className="pointer-events-none absolute bottom-4 left-1/4 w-1 h-1 rounded-full bg-blue-400/70 shadow-[0_0_4px_2px_rgba(96,165,250,0.5)] animate-ping" style={{ animationDuration: '4s', animationDelay: '1s' }} />
          <span className="pointer-events-none absolute top-3 right-1/4 w-1.5 h-1.5 rounded-full bg-violet-400/70 shadow-[0_0_6px_2px_rgba(167,139,250,0.5)] animate-ping" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }} />
          <span className="pointer-events-none absolute bottom-3 right-1/3 w-1 h-1 rounded-full bg-emerald-300/80 shadow-[0_0_4px_2px_rgba(110,231,183,0.5)] animate-ping" style={{ animationDuration: '2.8s', animationDelay: '1.8s' }} />
          {/* water wave layers at bottom */}
          <div className="pointer-events-none absolute bottom-0 left-0 w-full overflow-hidden" style={{ height: '40px' }}>
            <div className="absolute bottom-0 left-0 w-[200%] animate-water-wave-1">
              <svg viewBox="0 0 2400 40" preserveAspectRatio="none" className="w-full h-[40px]"><path fill="rgba(52,211,153,0.12)" d="M0,20 C150,38 350,0 600,20 C850,38 1050,0 1200,20 C1350,38 1550,0 1800,20 C2050,38 2250,0 2400,20 L2400,40 L0,40 Z" /></svg>
            </div>
            <div className="absolute bottom-0 left-0 w-[200%] animate-water-wave-2">
              <svg viewBox="0 0 2400 40" preserveAspectRatio="none" className="w-full h-[40px]"><path fill="rgba(96,165,250,0.09)" d="M0,26 C200,10 400,38 600,22 C800,8 1000,36 1200,24 C1400,10 1600,38 1800,22 C2000,8 2200,36 2400,24 L2400,40 L0,40 Z" /></svg>
            </div>
            <div className="absolute bottom-0 left-0 w-[200%] animate-water-wave-3">
              <svg viewBox="0 0 2400 40" preserveAspectRatio="none" className="w-full h-[40px]"><path fill="rgba(167,139,250,0.07)" d="M0,30 C300,14 500,38 700,28 C900,16 1100,38 1200,28 C1400,14 1600,38 1900,28 C2100,16 2300,38 2400,28 L2400,40 L0,40 Z" /></svg>
            </div>
          </div>
          <div className="group-hover:translate-x-2 transition-transform duration-300 min-w-0">
            <p className="text-slate-400 text-sm mb-0.5 transition-colors duration-300">{greeting()},</p>
            <div className="flex items-center gap-2">
              <h2 className="text-white text-xl sm:text-2xl font-bold truncate group-hover:text-primary transition-colors duration-300">
                {auth?.user?.name ?? 'Super Admin'}
              </h2>
              <span className="animate-hand-wave text-2xl sm:text-3xl select-none">👋</span>
            </div>
            <p className="text-slate-400 text-xs mt-1 hidden sm:block group-hover:text-slate-300 transition-colors duration-300">
              {t("Here's what's happening across your platform today.")}
            </p>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.2s' }} />
                <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms', animationDuration: '1.2s' }} />
                <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms', animationDuration: '1.2s' }} />
              </div>
              <span className="text-primary font-semibold text-sm group-hover:scale-105 transition-transform duration-200">
                {stats.totalActivePlanCompanies.toLocaleString()} {t('active plan companies')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <div className="rounded-xl bg-white/10 px-4 py-2.5 text-center min-w-[80px] hover:bg-white/15 hover:scale-105 transition-all duration-300">
              <p className="text-white text-lg font-bold leading-tight">{stats.totalCompanies}</p>
              <p className="text-slate-400 text-[11px]">{t('Companies')}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2.5 text-center min-w-[80px] hover:bg-white/15 hover:scale-105 transition-all duration-300">
              <p className={`text-lg font-bold leading-tight ${stats.monthlyGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.monthlyGrowth >= 0 ? '+' : ''}{stats.monthlyGrowth}%
              </p>
              <p className="text-slate-400 text-[11px]">{t('Growth')}</p>
            </div>
            <div className="w-px h-10 bg-white/10 hidden sm:block" />
            {[
              { icon: Tag, label: t('Coupons'), href: safeRoute('coupons.index'), color: 'text-rose-300 hover:text-rose-200', bg: 'hover:bg-rose-400/10' },
              { icon: Gift, label: t('Referral'), href: safeRoute('referral.index'), color: 'text-violet-300 hover:text-violet-200', bg: 'hover:bg-violet-400/10' },
              { icon: Settings, label: t('Settings'), href: safeRoute('settings'), color: 'text-slate-300 hover:text-slate-200', bg: 'hover:bg-white/10' },
            ].map(({ icon: Icon, label, href, color, bg }) => (
              <Link key={label} href={href} className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all duration-200 ${bg} group/qa`}>
                <Icon className={`h-5 w-5 transition-all duration-200 ${color} group-hover/qa:-translate-y-0.5`} />
                <span className="text-slate-400 text-[10px] group-hover/qa:text-slate-300 transition-colors duration-200">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">

          {/* Revenue */}
          <Link href={safeRoute('plan-orders.index')} className={`group ${fadeUp(100)}`}>
            <Card className="h-full border border-emerald-300 dark:border-emerald-800 shadow-sm bg-emerald-50 dark:bg-emerald-950/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
              <CardContent className="relative overflow-hidden p-5">
                <span className="pointer-events-none absolute -top-3 right-4 w-10 h-10 rounded-full bg-emerald-300/40 dark:bg-emerald-500/10 animate-ping" style={{ animationDuration: '6s' }} />
                <span className="pointer-events-none absolute top-1 right-1 w-14 h-14 rounded-full bg-emerald-200/30 dark:bg-emerald-600/10 animate-pulse" style={{ animationDuration: '7s' }} />
                <span className="pointer-events-none absolute bottom-1 right-8 w-7 h-7 rounded-full bg-emerald-400/30 dark:bg-emerald-400/10 animate-ping" style={{ animationDuration: '5s', animationDelay: '2s' }} />
                <div className="flex items-start justify-between mb-4">
                  <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/60 p-2.5">
                    <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-emerald-300 group-hover:text-emerald-600 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
                <p className="text-emerald-700 dark:text-emerald-400 text-xs mb-1">{t('Total Revenue')}</p>
                <p className="text-emerald-900 dark:text-emerald-100 text-2xl font-bold tracking-tight font-mono">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-emerald-600 dark:text-emerald-500 text-[11px] mt-1.5">{t('from approved orders')}</p>
              </CardContent>
            </Card>
          </Link>

          {/* Total Companies */}
          <Link href={safeRoute('companies.index')} className={`group ${fadeUp(150)}`}>
            <Card className="h-full border border-blue-200 dark:border-blue-900/50 shadow-sm bg-blue-50 dark:bg-blue-950/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer dark:bg-slate-900">
              <CardContent className="relative overflow-hidden p-5">
                <span className="pointer-events-none absolute -top-3 right-4 w-10 h-10 rounded-full bg-blue-300/40 dark:bg-blue-500/10 animate-ping" style={{ animationDuration: '7s' }} />
                <span className="pointer-events-none absolute top-1 right-1 w-14 h-14 rounded-full bg-blue-200/30 dark:bg-blue-600/10 animate-pulse" style={{ animationDuration: '8s' }} />
                <span className="pointer-events-none absolute bottom-1 right-8 w-7 h-7 rounded-full bg-blue-400/30 dark:bg-blue-400/10 animate-ping" style={{ animationDuration: '6s', animationDelay: '1.5s' }} />
                <div className="flex items-start justify-between mb-4">
                  <div className="rounded-xl bg-blue-100 dark:bg-blue-900/50 p-2.5">
                    <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-blue-200 group-hover:text-blue-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
                <p className="text-blue-700 dark:text-blue-400 text-xs mb-1">{t('Total Companies')}</p>
                <p className="text-blue-900 dark:text-blue-100 text-2xl font-bold tracking-tight">{stats.totalCompanies.toLocaleString()}</p>
                <p className={`text-[11px] mt-1.5 flex items-center gap-0.5 ${stats.monthlyGrowth >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {stats.monthlyGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
                  {stats.monthlyGrowth >= 0 ? '+' : ''}{stats.monthlyGrowth}% {t('this month')}
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Active Plans */}
          <Link href={safeRoute('plans.index')} className={`group ${fadeUp(200)}`}>
            <Card className="h-full border border-violet-200 dark:border-violet-900/50 shadow-sm bg-violet-50 dark:bg-violet-950/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
              <CardContent className="relative overflow-hidden p-5">
                <span className="pointer-events-none absolute -top-3 right-4 w-10 h-10 rounded-full bg-violet-300/40 dark:bg-violet-500/10 animate-ping" style={{ animationDuration: '8s' }} />
                <span className="pointer-events-none absolute top-1 right-1 w-14 h-14 rounded-full bg-violet-200/30 dark:bg-violet-600/10 animate-pulse" style={{ animationDuration: '6s' }} />
                <span className="pointer-events-none absolute bottom-1 right-8 w-7 h-7 rounded-full bg-violet-400/30 dark:bg-violet-400/10 animate-ping" style={{ animationDuration: '5s', animationDelay: '2.5s' }} />
                <div className="flex items-start justify-between mb-4">
                  <div className="rounded-xl bg-violet-100 dark:bg-violet-900/50 p-2.5">
                    <CreditCard className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-violet-200 group-hover:text-violet-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
                <p className="text-violet-700 dark:text-violet-400 text-xs mb-1">{t('Active Plans')}</p>
                <p className="text-violet-900 dark:text-violet-100 text-2xl font-bold tracking-tight">{stats.activePlans.toLocaleString()}</p>
                <p className="text-violet-500 dark:text-violet-400 text-[11px] mt-1.5">{t('subscription plans')}</p>
              </CardContent>
            </Card>
          </Link>

          {/* Total Users */}
          <div className={`group ${fadeUp(300)}`}>
            <Card className="h-full border border-indigo-200 dark:border-indigo-900/50 shadow-sm bg-indigo-50 dark:bg-indigo-950/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <CardContent className="relative overflow-hidden p-5">
                <span className="pointer-events-none absolute -top-3 right-4 w-10 h-10 rounded-full bg-indigo-300/40 dark:bg-indigo-500/10 animate-ping" style={{ animationDuration: '7s' }} />
                <span className="pointer-events-none absolute top-1 right-1 w-14 h-14 rounded-full bg-indigo-200/30 dark:bg-indigo-600/10 animate-pulse" style={{ animationDuration: '8s' }} />
                <span className="pointer-events-none absolute bottom-1 right-8 w-7 h-7 rounded-full bg-indigo-400/30 dark:bg-indigo-400/10 animate-ping" style={{ animationDuration: '6s', animationDelay: '1s' }} />
                <div className="flex items-start justify-between mb-4">
                  <div className="rounded-xl bg-indigo-100 dark:bg-indigo-900/50 p-2.5">
                    <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
                <p className="text-indigo-700 dark:text-indigo-400 text-xs mb-1">{t('Total Users')}</p>
                <p className="text-indigo-900 dark:text-indigo-100 text-2xl font-bold tracking-tight">{stats.totalUsers.toLocaleString()}</p>
                <p className="text-indigo-500 dark:text-indigo-400 text-[11px] mt-1.5">{t('registered users')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Pending Requests */}
          <Link href={safeRoute('plan-requests.index')} className={`group ${fadeUp(250)}`}>
            <Card className={`h-full border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer ${
              stats.pendingRequests > 0
                ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
            }`}>
              <CardContent className="relative overflow-hidden p-5">
                <span className="pointer-events-none absolute -top-3 right-4 w-10 h-10 rounded-full bg-amber-300/40 dark:bg-amber-500/10 animate-ping" style={{ animationDuration: '7s' }} />
                <span className="pointer-events-none absolute top-1 right-1 w-14 h-14 rounded-full bg-amber-200/30 dark:bg-amber-600/10 animate-pulse" style={{ animationDuration: '9s' }} />
                <span className="pointer-events-none absolute bottom-1 right-8 w-7 h-7 rounded-full bg-amber-400/30 dark:bg-amber-400/10 animate-ping" style={{ animationDuration: '6s', animationDelay: '3s' }} />
                <div className="flex items-start justify-between mb-4">
                  <div className={`rounded-xl p-2.5 ${stats.pendingRequests > 0 ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-muted'}`}>
                    <AlertCircle className={`h-5 w-5 ${stats.pendingRequests > 0 ? 'text-amber-600 dark:text-amber-400 animate-pulse' : 'text-muted-foreground'}`} />
                  </div>
                  {stats.pendingRequests > 0 && (
                    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 animate-bounce">
                      {t('Action needed')}
                    </span>
                  )}
                </div>
                <p className="text-amber-700 dark:text-amber-400 text-xs mb-1">{t('Pending Requests')}</p>
                <p className={`text-2xl font-bold tracking-tight ${stats.pendingRequests > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {stats.pendingRequests.toLocaleString()}
                </p>
                <p className="text-amber-500 dark:text-amber-500 text-[11px] mt-1.5">{t('awaiting approval')}</p>
              </CardContent>
            </Card>
          </Link>

        </div>

        {/* ── Main Content ── */}
        <div className={`grid gap-4 lg:grid-cols-5 ${fadeUp(300)}`}>

          {/* Recently Registered Companies */}
          <Card className="lg:col-span-3 border border-blue-100 dark:border-blue-900/40 shadow-sm dark:bg-slate-900 overflow-hidden">
            <CardHeader className="pb-3 pt-5 px-5 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">{t('Recently Registered Companies')}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('Latest companies that joined the platform')}</p>
                </div>
                <Link href={safeRoute('companies.index')} className="flex items-center gap-1 text-xs text-primary font-medium shrink-0 hover:gap-1.5 transition-all duration-150">
                  {t('View all')} <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentActivity.length > 0 ? (
                <div>
                  {recentActivity.map((company, i) => (
                    <div
                      key={company.id}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 dark:hover:bg-slate-800/60 transition-colors duration-150 group/row"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className="relative w-9 h-9 shrink-0">
                        {company.avatar ? (
                          <img
                            src={company.avatar}
                            alt={company.name}
                            className="w-9 h-9 rounded-full object-cover shadow-sm group-hover/row:scale-105 transition-transform duration-150"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                          />
                        ) : <UserInitials name={company?.name} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate leading-tight">{company.name}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{company.email}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
                          {t('Active')}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{company.registered_at}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <div className="rounded-full bg-muted p-4 animate-pulse">
                    <Building2 className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('No companies registered yet')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Plans */}
          <Card className="lg:col-span-2 border border-violet-100 dark:border-violet-900/40 shadow-sm dark:bg-slate-900 overflow-hidden">
            <CardHeader className="pb-3 pt-5 px-5 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">{t('Top Plans')}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('By revenue generated')}</p>
                </div>
                <Link href={safeRoute('plans.index')} className="flex items-center gap-1 text-xs text-primary font-medium shrink-0 hover:gap-1.5 transition-all duration-150">
                  {t('View all')} <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {topPlans.length > 0 ? (
                <div>
                  {topPlans.map((plan, index) => {
                    const barPct = maxRevenue > 0 ? Math.round((plan.revenue / maxRevenue) * 100) : 0;
                    return (
                      <div key={plan.name} className="flex items-center gap-3 px-5 py-4 hover:bg-muted/50 dark:hover:bg-slate-800/60 transition-colors duration-150 group/plan">
                        <UserInitials name={`${index+1}`}/>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <p className="text-sm font-semibold truncate">{plan.name}</p>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted dark:bg-slate-700 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full bg-primary transition-all duration-1000 ease-out`}
                              style={{ width: mounted ? `${barPct}%` : '0%' }}
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {plan.subscribers} {t('subscribers')}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold font-mono">{formatCurrency(plan.revenue)}</p>
                          <p className="text-[11px] text-muted-foreground">{t('revenue')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <div className="rounded-full bg-muted p-4 animate-pulse">
                    <CreditCard className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('No plan data available')}</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* ── Monthly Companies Chart ── */}
        <div className={fadeUp(375)}>
          <Card className="border border-border shadow-sm dark:bg-slate-900 overflow-hidden">
            <CardHeader className="pb-3 pt-5 px-5 border-b">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base font-semibold">{t('New Companies Registered')}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('Companies joined per month')} — {selectedCompaniesYear}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-500/30">
                    {monthlyCompanies.reduce((s, m) => s + m.count, 0)} {t('total')}
                  </span>
                  <Select value={String(selectedCompaniesYear)} onValueChange={(v) => handleCompaniesYearChange(Number(v))}>
                    <SelectTrigger className="h-7 w-24 text-xs focus:ring-0 focus:ring-offset-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map((yr) => (
                        <SelectItem key={yr} value={String(yr)} className="text-xs">{yr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-5">
              {monthlyCompanies.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyCompanies} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} accessibilityLayer={false}>
                    <CartesianGrid strokeDasharray="3 3" stroke={primaryColor} strokeOpacity={0.3} vertical={false} />
                    <XAxis
                      dataKey="short"
                      tick={{ fontSize: 11, fill: 'currentColor' }}
                      className="text-muted-foreground"
                      axisLine={{ stroke: primaryColor }}
                      tickLine={{ stroke: primaryColor }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'currentColor' }}
                      className="text-muted-foreground"
                      axisLine={{ stroke: primaryColor }}
                      tickLine={{ stroke: primaryColor }}
                      allowDecimals={false}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: `1px solid ${primaryColor}30`,
                        backgroundColor: "rgba(255, 255, 255, 0.7)",
                        color: primaryColor,
                      }}
                      formatter={(value: number) => [value, t('Companies')]}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.month ?? label}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false}>
                      <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: primaryColor, fontWeight: 600 }} formatter={(v: number) => v > 0 ? v : ''} />
                      {monthlyCompanies.map((_, i) => (
                        <Cell key={i} fill={primaryColor} fillOpacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <div className="rounded-full bg-muted p-4 animate-pulse">
                    <Building2 className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('No company data available')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Monthly Revenue Chart ── */}
        <div className={fadeUp(350)}>
          <Card className="border border-border shadow-sm dark:bg-slate-900 overflow-hidden">
            <CardHeader className="pb-3 pt-5 px-5 border-b">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base font-semibold">{t('Monthly Revenue')}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('Approved plan orders')} — {selectedYear}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium font-mono bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-500/30">
                    {formatCurrency(monthlyRevenue.reduce((s, m) => s + m.revenue, 0))}
                  </span>
                  <Select value={String(selectedYear)} onValueChange={(v) => handleYearChange(Number(v))}>
                    <SelectTrigger className="h-7 w-24 text-xs focus:ring-0 focus:ring-offset-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map((yr) => (
                        <SelectItem key={yr} value={String(yr)} className="text-xs">{yr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-5">
              {monthlyRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={monthlyRevenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} accessibilityLayer={false}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={primaryColor} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={primaryColor} strokeOpacity={0.3} vertical={false} />
                    <XAxis
                      dataKey="short"
                      tick={{ fontSize: 11, fill: 'currentColor' }}
                      className="text-muted-foreground"
                      axisLine={{ stroke: primaryColor }}
                      tickLine={{ stroke: primaryColor }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'currentColor' }}
                      className="text-muted-foreground"
                      axisLine={{ stroke: primaryColor }}
                      tickLine={{ stroke: primaryColor }}
                      tickFormatter={(v) => formatCurrency(v)}
                      width={72}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: `1px solid ${primaryColor}30`,
                        background: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                      formatter={(value: number) => [formatCurrency(value), t('Revenue')]}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.month ?? label}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke={primaryColor}
                      strokeWidth={2}
                      fill="url(#revenueGrad)"
                      dot={{ r: 3, fill: primaryColor, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: primaryColor, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <div className="rounded-full bg-muted p-4 animate-pulse">
                    <DollarSign className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('No revenue data available')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
      </PageTemplate>
    );
  }

  const pageActions: PageAction[] = [
    {
      label: t('Refresh'),
      icon: <RefreshCw className="h-4 w-4" />,
      variant: 'outline',
      onClick: () => window.location.reload()
    }
  ];

  // Use actual data from backend
  const projects = dashboardData?.projects || { total: 0, active: 0, completed: 0, overdue: 0 };
  const tasks = dashboardData?.tasks || { total: 0, pending: 0, inProgress: 0, completed: 0 };
  const timesheets = dashboardData?.timesheets || { totalHours: 0, thisWeek: 0, pendingApprovals: 0 };
  const budgets = dashboardData?.budgets || { totalBudget: 0, spent: 0, remaining: 0, utilization: 0 };
  const invoices = dashboardData?.invoices || { total: 0, paid: 0, pending: 0, overdue: 0 };
  const recentActivities = dashboardData?.recentActivities || [];

  return (
    <PageTemplate
      title={t('Dashboard')}
      description={auth?.user?.workspace_role === 'owner' ? t("Welcome to your company dashboard.") : undefined}
      url="/dashboard"
      actions={pageActions}
    >
      <div className="space-y-6">

        {/* ── COMPANY CHUNK 1: Greeting Banner ── */}
        {(() => {
          const hour = new Date().getHours();
          const greetingText = hour < 12 ? t('Good morning') : hour < 17 ? t('Good afternoon') : t('Good evening');
          const userName = auth?.user?.name ?? t('there');
          const roleLabel = userWorkspaceRole === 'company' ? t('Owner') : userWorkspaceRole === 'client' ? t('Client') : userWorkspaceRole === 'member' ? t('Member') : userWorkspaceRole ?? t('Member');
          return (
            <div className="group relative overflow-hidden rounded-2xl bg-slate-800 dark:bg-slate-900 px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* gradient orbs */}
              <span className="pointer-events-none absolute -top-10 -left-10 w-48 h-48 rounded-full bg-emerald-500/10 blur-2xl animate-pulse" style={{ animationDuration: '4s' }} />
              <span className="pointer-events-none absolute -bottom-10 right-0 w-56 h-56 rounded-full bg-blue-500/10 blur-2xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1.5s' }} />
              <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-violet-500/5 blur-2xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '0.8s' }} />
              {/* glowing dots */}
              <span className="pointer-events-none absolute top-4 left-1/3 w-1.5 h-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_6px_2px_rgba(52,211,153,0.6)] animate-ping" style={{ animationDuration: '3s' }} />
              <span className="pointer-events-none absolute bottom-4 left-1/4 w-1 h-1 rounded-full bg-blue-400/70 shadow-[0_0_4px_2px_rgba(96,165,250,0.5)] animate-ping" style={{ animationDuration: '4s', animationDelay: '1s' }} />
              <span className="pointer-events-none absolute top-3 right-1/4 w-1.5 h-1.5 rounded-full bg-violet-400/70 shadow-[0_0_6px_2px_rgba(167,139,250,0.5)] animate-ping" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }} />
              <span className="pointer-events-none absolute bottom-3 right-1/3 w-1 h-1 rounded-full bg-emerald-300/80 shadow-[0_0_4px_2px_rgba(110,231,183,0.5)] animate-ping" style={{ animationDuration: '2.8s', animationDelay: '1.8s' }} />
              {/* water waves */}
              <div className="pointer-events-none absolute bottom-0 left-0 w-full overflow-hidden" style={{ height: '40px' }}>
                <div className="absolute bottom-0 left-0 w-[200%] animate-water-wave-1">
                  <svg viewBox="0 0 2400 40" preserveAspectRatio="none" className="w-full h-[40px]"><path fill="rgba(52,211,153,0.12)" d="M0,20 C150,38 350,0 600,20 C850,38 1050,0 1200,20 C1350,38 1550,0 1800,20 C2050,38 2250,0 2400,20 L2400,40 L0,40 Z" /></svg>
                </div>
                <div className="absolute bottom-0 left-0 w-[200%] animate-water-wave-2">
                  <svg viewBox="0 0 2400 40" preserveAspectRatio="none" className="w-full h-[40px]"><path fill="rgba(96,165,250,0.09)" d="M0,26 C200,10 400,38 600,22 C800,8 1000,36 1200,24 C1400,10 1600,38 1800,22 C2000,8 2200,36 2400,24 L2400,40 L0,40 Z" /></svg>
                </div>
                <div className="absolute bottom-0 left-0 w-[200%] animate-water-wave-3">
                  <svg viewBox="0 0 2400 40" preserveAspectRatio="none" className="w-full h-[40px]"><path fill="rgba(167,139,250,0.07)" d="M0,30 C300,14 500,38 700,28 C900,16 1100,38 1200,28 C1400,14 1600,38 1900,28 C2100,16 2300,38 2400,28 L2400,40 L0,40 Z" /></svg>
                </div>
              </div>

              {/* Left: greeting */}
              <div className="group-hover:translate-x-2 transition-transform duration-300 min-w-0">
                <p className="text-slate-400 text-sm mb-0.5">{greetingText},</p>
                <div className="flex items-center gap-2">
                  <h2 className="text-white text-xl sm:text-2xl font-bold truncate group-hover:text-primary transition-colors duration-300">{userName}</h2>
                  <span className="animate-hand-wave text-2xl sm:text-3xl select-none">👋</span>
                </div>
                <p className="text-slate-400 text-xs mt-1 hidden sm:block group-hover:text-slate-300 transition-colors duration-300">
                  {t("Here's what's happening in your workspace today.")}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.2s' }} />
                    <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms', animationDuration: '1.2s' }} />
                    <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms', animationDuration: '1.2s' }} />
                  </div>
                  <span className="text-primary font-semibold text-sm group-hover:scale-105 transition-transform duration-200">
                    {(() => {
                      if (userWorkspaceRole === 'company') {
                        const count = dashboardData?.cards?.find((c: any) => c.title?.includes('User'))?.value ?? 0;
                        return <>{count.toLocaleString()} {t('workspace members')}</>;
                      }
                      if (userWorkspaceRole === 'client') {
                        const count = dashboardData?.projects?.total ?? 0;
                        return <>{count.toLocaleString()} {t('projects assigned')}</>;
                      }
                      const count = dashboardData?.projects?.total ?? 0;
                      return <>{count.toLocaleString()} {t('projects assigned')}</>;
                    })()}
                  </span>
                </div>
              </div>

              {/* Right: stats chips + quick links */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {dashboardData?.projects && (
                  <div className="rounded-xl bg-white/10 px-4 py-2.5 text-center min-w-[80px] hover:bg-white/15 hover:scale-105 transition-all duration-300">
                    <p className="text-white text-lg font-bold leading-tight">{dashboardData.projects.active ?? 0}</p>
                    <p className="text-slate-400 text-[11px]">{t('Active Projects')}</p>
                  </div>
                )}
                {dashboardData?.tasks && (
                  <div className="rounded-xl bg-white/10 px-4 py-2.5 text-center min-w-[80px] hover:bg-white/15 hover:scale-105 transition-all duration-300">
                    <p className="text-emerald-400 text-lg font-bold leading-tight">{dashboardData.tasks.inProgress ?? 0}</p>
                    <p className="text-slate-400 text-[11px]">{t('In Progress')}</p>
                  </div>
                )}
                <div className="w-px h-10 bg-white/10 hidden sm:block" />
                {[
                  ...(dashboardData?.projects ? [{ icon: FolderOpen, label: t('Projects'), href: safeRoute('projects.index'), color: 'text-blue-300 hover:text-blue-200', bg: 'hover:bg-blue-400/10' }] : []),
                  ...(dashboardData?.tasks ? [{ icon: CheckSquare, label: t('Tasks'), href: safeRoute('tasks.index'), color: 'text-violet-300 hover:text-violet-200', bg: 'hover:bg-violet-400/10' }] : []),
                  ...(dashboardData?.timesheets ? [{ icon: Clock, label: t('Timesheets'), href: safeRoute('timesheets.index'), color: 'text-emerald-300 hover:text-emerald-200', bg: 'hover:bg-emerald-400/10' }] : []),
                  { icon: SettingsIcon, label: t('Settings'), href: safeRoute('settings'), color: 'text-slate-300 hover:text-slate-200', bg: 'hover:bg-white/10' },
                ].map(({ icon: Icon, label, href, color, bg }) => (
                  <Link key={label} href={href} className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all duration-200 ${bg} group/qa`}>
                    <Icon className={`h-5 w-5 transition-all duration-200 ${color} group-hover/qa:-translate-y-0.5`} />
                    <span className="text-slate-400 text-[10px] group-hover/qa:text-slate-300 transition-colors duration-200">{label}</span>
                  </Link>
                ))}
              </div>

              {/* Bottom stat strip */}
              <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-white/10 px-6 py-2.5 flex flex-wrap gap-5 mt-2 sm:hidden">
              </div>
            </div>
          );
        })()}

        {/* ── COMPANY CHUNK 2: Main Stats Cards ── */}
        {dashboardData?.cards && dashboardData.cards.length > 0 && (
          <div className={`grid gap-4 md:grid-cols-2 ${dashboardData.cards.length >= 3 ? 'lg:grid-cols-' + Math.min(dashboardData.cards.length, 4) : ''}`}>
            {dashboardData.cards.map((card: any, index: number) => {

              const getCardConfig = (title: string) => {
                if (title.includes('User')) return {
                  icon: <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
                  iconBg: 'bg-emerald-100 dark:bg-emerald-900/60',
                  border: 'border-emerald-300 dark:border-emerald-800',
                  bg: 'bg-emerald-50 dark:bg-emerald-950/40',
                  label: 'text-emerald-700 dark:text-emerald-400',
                  value: 'text-emerald-900 dark:text-emerald-100',
                  footer: 'text-emerald-600 dark:text-emerald-500',
                  orb1: 'bg-emerald-300/40 dark:bg-emerald-500/10',
                  orb2: 'bg-emerald-200/30 dark:bg-emerald-600/10',
                  orb3: 'bg-emerald-400/30 dark:bg-emerald-400/10',
                  arrow: 'text-emerald-300 group-hover:text-emerald-600',
                  route: null,
                  footerText: t('workspace members'),
                };
                if (title.includes('Project')) return {
                  icon: <FolderOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
                  iconBg: 'bg-blue-100 dark:bg-blue-900/60',
                  border: 'border-blue-300 dark:border-blue-800',
                  bg: 'bg-blue-50 dark:bg-blue-950/40',
                  label: 'text-blue-700 dark:text-blue-400',
                  value: 'text-blue-900 dark:text-blue-100',
                  footer: 'text-blue-600 dark:text-blue-500',
                  orb1: 'bg-blue-300/40 dark:bg-blue-500/10',
                  orb2: 'bg-blue-200/30 dark:bg-blue-600/10',
                  orb3: 'bg-blue-400/30 dark:bg-blue-400/10',
                  arrow: 'text-blue-200 group-hover:text-blue-500',
                  route: 'projects.index',
                  footerText: `${dashboardData?.projects?.completed ?? 0} ${t('completed')}${ (dashboardData?.projects?.overdue ?? 0) > 0 ? ` · ${dashboardData?.projects?.overdue} ${t('overdue')}` : '' }`,
                };
                if (title.includes('Task')) return {
                  icon: <CheckSquare className="h-5 w-5 text-violet-600 dark:text-violet-400" />,
                  iconBg: 'bg-violet-100 dark:bg-violet-900/60',
                  border: 'border-violet-300 dark:border-violet-800',
                  bg: 'bg-violet-50 dark:bg-violet-950/40',
                  label: 'text-violet-700 dark:text-violet-400',
                  value: 'text-violet-900 dark:text-violet-100',
                  footer: 'text-violet-600 dark:text-violet-500',
                  orb1: 'bg-violet-300/40 dark:bg-violet-500/10',
                  orb2: 'bg-violet-200/30 dark:bg-violet-600/10',
                  orb3: 'bg-violet-400/30 dark:bg-violet-400/10',
                  arrow: 'text-violet-200 group-hover:text-violet-500',
                  route: 'tasks.index',
                  footerText: `${ (dashboardData?.tasks?.pending ?? 0) > 0 ? `${dashboardData?.tasks?.pending} ${t('pending')} · ` : '' }${dashboardData?.tasks?.inProgress ?? 0} ${t('in progress')}`,
                };
                if (title.includes('Received') || title.includes('Revenue')) return {
                  icon: <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
                  iconBg: 'bg-amber-100 dark:bg-amber-900/60',
                  border: 'border-amber-300 dark:border-amber-800',
                  bg: 'bg-amber-50 dark:bg-amber-950/40',
                  label: 'text-amber-700 dark:text-amber-400',
                  value: 'text-amber-900 dark:text-amber-100',
                  footer: 'text-amber-600 dark:text-amber-500',
                  orb1: 'bg-amber-300/40 dark:bg-amber-500/10',
                  orb2: 'bg-amber-200/30 dark:bg-amber-600/10',
                  orb3: 'bg-amber-400/30 dark:bg-amber-400/10',
                  arrow: 'text-amber-200 group-hover:text-amber-500',
                  route: 'invoices.index',
                  footerText: (dashboardData?.invoices?.pending ?? 0) > 0 ? `${dashboardData?.invoices?.pending} ${t('invoices pending')}` : t('All invoices paid'),
                };
                return {
                  icon: <Activity className="h-5 w-5 text-slate-500" />,
                  iconBg: 'bg-slate-100 dark:bg-slate-800',
                  border: 'border-slate-200 dark:border-slate-700',
                  bg: 'bg-slate-50 dark:bg-slate-900',
                  label: 'text-slate-600 dark:text-slate-400',
                  value: 'text-slate-900 dark:text-slate-100',
                  footer: 'text-slate-500 dark:text-slate-400',
                  orb1: 'bg-slate-300/40 dark:bg-slate-500/10',
                  orb2: 'bg-slate-200/30 dark:bg-slate-600/10',
                  orb3: 'bg-slate-400/30 dark:bg-slate-400/10',
                  arrow: 'text-slate-300 group-hover:text-slate-500',
                  route: null,
                  footerText: '',
                };
              };

              const cfg = getCardConfig(card.title);
              const cardHref = cfg.route ? safeRoute(cfg.route) : null;
              const displayValue = card.format === 'currency' ? formatCurrency(card.value) : card.value.toLocaleString();

              const cardInner = (
                <CardContent className="relative overflow-hidden p-5">
                  {/* animated orbs */}
                  <span className={`pointer-events-none absolute -top-3 right-4 w-10 h-10 rounded-full ${cfg.orb1} animate-ping`} style={{ animationDuration: '6s' }} />
                  <span className={`pointer-events-none absolute top-1 right-1 w-14 h-14 rounded-full ${cfg.orb2} animate-pulse`} style={{ animationDuration: '7s' }} />
                  <span className={`pointer-events-none absolute bottom-1 right-8 w-7 h-7 rounded-full ${cfg.orb3} animate-ping`} style={{ animationDuration: '5s', animationDelay: '2s' }} />
                  {/* header row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`rounded-xl p-2.5 ${cfg.iconBg}`}>
                      {cfg.icon}
                    </div>
                    {cardHref && (
                      <ArrowUpRight className={`h-4 w-4 ${cfg.arrow} group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-200`} />
                    )}
                  </div>
                  {/* label */}
                  <p className={`${cfg.label} text-xs mb-1`}>{t(card.title)}</p>
                  {/* main value */}
                  <p className={`${cfg.value} text-2xl font-bold tracking-tight font-mono`}>{displayValue}</p>
                  {/* footer */}
                  {cfg.footerText && (
                    <p className={`${cfg.footer} text-[11px] mt-1.5`}>{cfg.footerText}</p>
                  )}
                </CardContent>
              );

              return cardHref ? (
                <Link key={index} href={cardHref} className="group">
                  <Card className={`h-full border ${cfg.border} shadow-sm ${cfg.bg} hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer`}>
                    {cardInner}
                  </Card>
                </Link>
              ) : (
                <div key={index} className="group">
                  <Card className={`h-full border ${cfg.border} shadow-sm ${cfg.bg} hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}>
                    {cardInner}
                  </Card>
                </div>
              );
            })}
          </div>
        )}

        {/* ── COMPANY CHUNK 4: Secondary Stats ── */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {/* Time Tracking */}
          {dashboardData?.timesheets && (
            <Card className={`group border border-border bg-card hover:shadow-md transition-all duration-300${!(dashboardData?.bugs && dashboardData.bugs.length > 0 && auth?.permissions?.includes('bug_view_any')) ? ' lg:col-span-2' : ''}`}>
              <CardHeader className="pb-4 pt-5 px-5 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle className="text-base font-semibold">{t('Time Tracking')}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('Pending approval timesheets')}</p>
                    </div>
                  </div>
                  {auth?.permissions?.includes('timesheet_view_any') && (
                    <Link href={route('timesheets.index')} className="flex items-center gap-1 text-xs font-semibold text-primary hover:gap-1.5 transition-all duration-150">
                      {t('View all')} <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {dashboardData?.pendingTimesheets && dashboardData.pendingTimesheets.length > 0 ? (
                  <div className="overflow-y-auto max-h-[358px]">
                    {dashboardData.pendingTimesheets.map((ts: any) => (
                      <div key={ts.id} className="flex items-center justify-between px-5 py-4.5 hover:bg-muted/50 transition-colors duration-150">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative w-9 h-9 shrink-0">
                            {ts.avatar ? (
                              <img
                                src={ts.avatar}
                                alt={ts.user}
                                className="w-9 h-9 rounded-full object-cover shadow-sm"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                              />
                            ) : null}
                            <div className={ts.avatar ? 'hidden' : ''}>
                              <UserInitials name={ts.user} />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate leading-tight">{ts.user}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{ts.period}</p>
                          </div>
                        </div>
                        <div className="flex items-center shrink-0">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">{t('Pending')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 opacity-30 mb-2" />
                    <p className="text-xs">{t('No pending timesheets')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Bug Tracking */}
          {dashboardData?.bugs && dashboardData.bugs.length > 0 && auth?.permissions?.includes('bug_view_any') && (
            <Card className="group border border-border bg-card hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-4 pt-5 px-5 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle className="text-base font-semibold">{t('Bug Tracking')}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('Recently reported bugs')}</p>
                    </div>
                  </div>
                  {auth?.permissions?.includes('bug_view_any') && (
                    <Link href={route('bugs.index')} className="flex items-center gap-1 text-xs font-semibold text-primary hover:gap-1.5 transition-all duration-150">
                      {t('View all')} <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {dashboardData?.recentBugs && dashboardData.recentBugs.length > 0 ? (
                  <div className="overflow-y-auto max-h-[360px]">
                    {dashboardData.recentBugs.map((bug: any) => {
                      const priorityColors: Record<string, string> = {
                        critical: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
                        high:     'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
                        medium:   'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
                        low:      'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                      };
                      return (
                        <div key={bug.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors duration-150">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200/50 dark:border-rose-800/50 shrink-0">
                              <Bug className="h-3.5 w-3.5 text-rose-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate leading-tight">{bug.title}</p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{bug.project}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${priorityColors[bug.priority] ?? priorityColors.medium}`}>{bug.priority}</span>
                            <span className="text-[11px] text-muted-foreground">{bug.reported_at}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Bug className="h-8 w-8 opacity-30 mb-2" />
                    <p className="text-xs">{t('No recent bugs')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── COMPANY CHUNK 3: Project Status Overview + Budget Pie ── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Project Status Overview */}
          {dashboardData?.ongoingProjects !== undefined && (
          <Card className={`border border-border bg-card overflow-hidden${!(dashboardData?.budgets && auth?.permissions?.includes('budget_view_any')) ? ' lg:col-span-2' : ''}`}>
            <CardHeader className="pb-4 pt-5 px-5 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">{t('Project Status Overview')}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('Ongoing active projects')}</p>
                </div>
                {auth?.permissions?.includes('project_view_any') && (
                  <Link href={route('projects.index')} className="flex items-center gap-1 text-xs text-primary font-semibold hover:gap-1.5 transition-all duration-150">
                    {t('View all')} <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {dashboardData.ongoingProjects && dashboardData.ongoingProjects.length > 0 ? (
                <div className="overflow-y-auto max-h-[298px]">
                  {dashboardData.ongoingProjects.map((proj: any) => {
                    const priorityColors: Record<string, string> = {
                      urgent: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
                      high:   'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
                      medium: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
                      low:    'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                    };
                    return (
                      <div key={proj.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors duration-150">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50 shrink-0">
                            <FolderOpen className="h-3.5 w-3.5 text-blue-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate leading-tight">{proj.title}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{proj.deadline}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${priorityColors[proj.priority] ?? priorityColors.medium}`}>{proj.priority}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <FolderOpen className="h-8 w-8 opacity-30 mb-2" />
                  <p className="text-xs">{t('No ongoing projects')}</p>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Budget Overview Pie Chart */}
          {dashboardData?.budgets && auth?.permissions?.includes('budget_view_any') && (
            <Card className="border border-border bg-card overflow-hidden flex flex-col flex-1">
              <CardHeader className="pb-4 pt-5 px-5 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">{t('Budget Overview')}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('Spend vs remaining budget')}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex flex-col flex-1">
                {budgets.totalBudget > 0 ? (
                  <div className="flex items-center justify-center gap-6 flex-1">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: t('Spent'),     value: budgets.spent,     color: '#ef4444' },
                            { name: t('Remaining'), value: budgets.remaining > 0 ? budgets.remaining : 0, color: '#10b981' },
                          ]}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          isAnimationActive={false}
                        >
                          {[
                            { color: '#ef4444' },
                            { color: '#10b981' },
                          ].map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
                          formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-3">
                      {[
                        { label: t('Spent'),     value: budgets.spent,     color: '#ef4444' },
                        { label: t('Remaining'), value: budgets.remaining > 0 ? budgets.remaining : 0, color: '#10b981' },
                      ].map((item) => {
                        const pct = budgets.totalBudget > 0 ? Math.round((item.value / budgets.totalBudget) * 100) : 0;
                        return (
                          <div key={item.label} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="text-sm text-foreground">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-foreground font-mono">{formatCurrency(item.value)}</span>
                              <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Wallet className="h-8 w-8 opacity-30 mb-2" />
                    <p className="text-xs">{t('No budget data available')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── COMPANY CHARTS: Timesheet Hours, Task Completion & Invoice Revenue ── */}
        {(dashboardData?.monthlyTimesheetHours || dashboardData?.monthlyTaskCompletion || dashboardData?.monthlyInvoiceRevenue) && (
          <div className="grid gap-6 grid-cols-1">

            {/* Timesheet Hours by Month */}
            {dashboardData?.monthlyTimesheetHours && (
              <Card className="border border-border shadow-sm bg-card overflow-hidden">
                <CardHeader className="pb-3 pt-5 px-5 border-b">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-base font-semibold">{t('Timesheet Hours')}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('Logged hours per month')} — {selectedChartYear}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-600/20 dark:ring-blue-500/30">
                        {monthlyTimesheetHours.reduce((s: number, m: any) => s + m.hours, 0)} {t('h total')}
                      </span>
                      <Select value={String(selectedChartYear)} onValueChange={(v) => handleChartYearChange(Number(v))}>
                        <SelectTrigger className="h-7 w-24 text-xs focus:ring-0 focus:ring-offset-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(dashboardData?.availableYears ?? availableYears).map((yr) => (
                            <SelectItem key={yr} value={String(yr)} className="text-xs">{yr}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-5">
                  {monthlyTimesheetHours.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={monthlyTimesheetHours} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} accessibilityLayer={false}>
                        <CartesianGrid strokeDasharray="3 3" stroke={primaryColor} strokeOpacity={0.3} vertical={false} />
                        <XAxis dataKey="short" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" axisLine={{ stroke: primaryColor }} tickLine={{ stroke: primaryColor }} />
                        <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" axisLine={{ stroke: primaryColor }} tickLine={{ stroke: primaryColor }} allowDecimals={false} width={36} />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${primaryColor}30`, backgroundColor: 'rgba(255,255,255,0.7)', color: primaryColor }}
                          formatter={(value: number) => [value, t('Hours')]}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.month ?? label}
                        />
                        <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false}>
                          <LabelList dataKey="hours" position="top" style={{ fontSize: 11, fill: primaryColor, fontWeight: 600 }} formatter={(v: number) => v > 0 ? `${v}h` : ''} />
                          {monthlyTimesheetHours.map((_: any, i: number) => (
                            <Cell key={i} fill={primaryColor} fillOpacity={0.7} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 gap-3">
                      <div className="rounded-full bg-muted p-4 animate-pulse">
                        <Clock className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground">{t('No timesheet data available')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Task Completion Trend */}
            {dashboardData?.monthlyTaskCompletion && (
              <Card className="border border-border shadow-sm bg-card overflow-hidden">
                <CardHeader className="pb-3 pt-5 px-5 border-b">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-base font-semibold">{t('Task Completion Trend')}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('Created vs completed tasks')} — {selectedChartYear}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={String(selectedChartYear)} onValueChange={(v) => handleChartYearChange(Number(v))}>
                        <SelectTrigger className="h-7 w-24 text-xs focus:ring-0 focus:ring-offset-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(dashboardData?.availableYears ?? availableYears).map((yr) => (
                            <SelectItem key={yr} value={String(yr)} className="text-xs">{yr}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-5">
                  {monthlyTaskCompletion.length > 0 ? (
                    <>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={monthlyTaskCompletion} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} accessibilityLayer={false} barCategoryGap="20%" barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke={primaryColor} strokeOpacity={0.3} vertical={false} />
                        <XAxis dataKey="short" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" axisLine={{ stroke: primaryColor }} tickLine={{ stroke: primaryColor }} />
                        <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" axisLine={{ stroke: primaryColor }} tickLine={{ stroke: primaryColor }} allowDecimals={false} width={36} />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${primaryColor}30`, background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
                          formatter={(value: number, name: string) => [value, name === 'created' ? t('Created') : t('Completed')]}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.month ?? label}
                        />
                        <Bar dataKey="created" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} fill="#60a5fa" fillOpacity={0.8}>
                          <LabelList dataKey="created" position="top" style={{ fontSize: 10, fill: '#60a5fa', fontWeight: 600 }} formatter={(v: number) => v > 0 ? v : ''} />
                        </Bar>
                        <Bar dataKey="completed" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} fill="#10b981" fillOpacity={0.9}>
                          <LabelList dataKey="completed" position="top" style={{ fontSize: 10, fill: '#10b981', fontWeight: 600 }} formatter={(v: number) => v > 0 ? v : ''} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex items-center justify-center gap-4 mt-5">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-2.5 h-2.5 inline-block bg-blue-400" />
                        {t('Created')}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-2.5 h-2.5 inline-block bg-emerald-500" />
                        {t('Completed')}
                      </span>
                    </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 gap-3">
                      <div className="rounded-full bg-muted p-4 animate-pulse">
                        <CheckSquare className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground">{t('No task data available')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Invoice Revenue Chart */}
            {dashboardData?.monthlyInvoiceRevenue && auth?.permissions?.includes('invoice_view_any') && (
              <Card className="border border-border shadow-sm bg-card overflow-hidden">
                <CardHeader className="pb-3 pt-5 px-5 border-b">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-base font-semibold">{t('Invoice Revenue')}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('Monthly paid invoice revenue')} — {selectedChartYear}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium font-mono bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/20 dark:ring-emerald-500/30">
                        {formatCurrency(monthlyInvoiceRevenue.reduce((s: number, m: any) => s + m.revenue, 0))}
                      </span>
                      <Select value={String(selectedChartYear)} onValueChange={(v) => handleChartYearChange(Number(v))}>
                        <SelectTrigger className="h-7 w-24 text-xs focus:ring-0 focus:ring-offset-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(dashboardData?.availableYears ?? availableYears).map((yr) => (
                            <SelectItem key={yr} value={String(yr)} className="text-xs">{yr}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-5">
                  {monthlyInvoiceRevenue.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={monthlyInvoiceRevenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} accessibilityLayer={false}>
                        <defs>
                          <linearGradient id="invoiceRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={primaryColor} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={primaryColor} strokeOpacity={0.3} vertical={false} />
                        <XAxis dataKey="short" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" axisLine={{ stroke: primaryColor }} tickLine={{ stroke: primaryColor }} />
                        <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" axisLine={{ stroke: primaryColor }} tickLine={{ stroke: primaryColor }} tickFormatter={(v) => formatCurrency(v)} width={72} />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${primaryColor}30`, background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
                          formatter={(value: number) => [formatCurrency(value), t('Revenue')]}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.month ?? label}
                        />
                        <Area type="monotone" dataKey="revenue" stroke={primaryColor} strokeWidth={2} fill="url(#invoiceRevenueGrad)" dot={{ r: 3, fill: primaryColor, strokeWidth: 0 }} activeDot={{ r: 5, fill: primaryColor, strokeWidth: 0 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 gap-3">
                      <div className="rounded-full bg-muted p-4 animate-pulse">
                        <FileText className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground">{t('No invoice revenue data available')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

          </div>
        )}

        {/* ── Recent Tasks & Pending Expenses ── */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {/* Recent Tasks */}
          {dashboardData?.recentTasks !== undefined && (
            <Card className={`border border-border bg-card hover:shadow-md transition-all duration-300${!(dashboardData?.pendingExpenses !== undefined && auth?.permissions?.includes('expense_view_any')) ? ' lg:col-span-2' : ''}`}>
              <CardHeader className="pb-4 pt-5 px-5 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle className="text-base font-semibold">{t('Recent Tasks')}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('Recently created tasks')}</p>
                    </div>
                  </div>
                  {auth?.permissions?.includes('task_view_any') && (
                    <Link href={route('tasks.index')} className="flex items-center gap-1 text-xs font-semibold text-primary hover:gap-1.5 transition-all duration-150">
                      {t('View all')} <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {dashboardData.recentTasks && dashboardData.recentTasks.length > 0 ? (
                  <div className="overflow-y-auto max-h-[353px]">
                    {dashboardData.recentTasks.map((task: any) => {
                      const priorityColors: Record<string, string> = {
                        critical: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
                        high:     'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
                        medium:   'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
                        low:      'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                      };
                      return (
                        <div key={task.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors duration-150">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200/50 dark:border-violet-800/50 shrink-0">
                              <CheckSquare className="h-3.5 w-3.5 text-violet-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate leading-tight">{task.title}</p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{task.project}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${priorityColors[task.priority] ?? priorityColors.medium}`}>{task.priority}</span>
                            <span className="text-[11px] text-muted-foreground">{task.updated_at}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <CheckSquare className="h-8 w-8 opacity-30 mb-2" />
                    <p className="text-xs">{t('No recent tasks')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pending Expenses */}
          {dashboardData?.pendingExpenses !== undefined && auth?.permissions?.includes('expense_view_any') && (
            <Card className="border border-border bg-card hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-4 pt-5 px-5 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle className="text-base font-semibold">{t('Pending Expenses')}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('Expenses awaiting approval')}</p>
                    </div>
                  </div>
                  {auth?.permissions?.includes('expense_view_any') && (
                    <Link href={route('expenses.index')} className="flex items-center gap-1 text-xs font-semibold text-primary hover:gap-1.5 transition-all duration-150">
                      {t('View all')} <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {dashboardData.pendingExpenses && dashboardData.pendingExpenses.length > 0 ? (
                  <div className="overflow-y-auto max-h-[353px]">
                    {dashboardData.pendingExpenses.map((exp: any) => (
                      <div key={exp.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors duration-150">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/50 shrink-0">
                            <Receipt className="h-3.5 w-3.5 text-amber-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate leading-tight">{exp.title}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5 font-mono">{formatCurrency(exp.amount)}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">{t('Pending')}</span>
                          <span className="text-[11px] text-muted-foreground">{exp.submitted_at}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Receipt className="h-8 w-8 opacity-30 mb-2" />
                    <p className="text-xs">{t('No pending expenses')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageTemplate>
  );
}