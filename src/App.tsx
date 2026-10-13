import { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  ChevronDown,
  CircleDollarSign,
  Download,
  Droplets,
  Gauge,
  Gift,
  ImagePlus,
  Pencil,
  Trash2,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Receipt,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Tag,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { stationLogo } from '@/lib/logo';
import { supabase } from '@/lib/supabase';
import { AuthLoading, AuthPage } from '@/components/AuthPage';

type View = 'Overview' | 'POS' | 'Inventory' | 'Sales & Analytics' | 'Loyalty Points' | 'Customer List' | 'Expenses' | 'Settings';
type SettingsSection = 'general' | 'account' | 'notifications';
type IconType = typeof LayoutDashboard;
type Product = { id: string; name: string; category: string; unit: string; price: number; stock: number; reorder_level: number; active: boolean; image_url: string | null; earns_points?: boolean | null };
type Customer = { id: string; name: string; phone: string | null; email: string | null; loyalty_points: number; refill_count: number; free_refills_claimed: number; total_spent: number; last_visit_at: string | null; created_at?: string };
type SaleLine = { sale_id: string; product_name: string; quantity: number; product_id: string | null };
type CartItem = Product & { quantity: number };
type Sale = { id: string; total: number; payment_method: string; status: string; created_at: string; customer_id: string | null; cash_received: number | null; change_amount: number | null };
type BorrowedContainer = { id: string; customer_id: string; sale_id: string | null; container_code: string; borrowed_at: string; returned_at: string | null };
type Expense = { id: string; title: string; category: string; amount: number; expense_date: string; notes: string | null };

const navItems: { label: View; icon: IconType }[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'POS', icon: ShoppingCart },
  { label: 'Inventory', icon: Package },
  { label: 'Sales & Analytics', icon: BarChart3 },
  { label: 'Loyalty Points', icon: Sparkles },
  { label: 'Customer List', icon: Users },
  { label: 'Expenses', icon: Wallet },
  { label: 'Settings', icon: Settings },
];

const viewSlugs: Record<View, string> = {
  Overview: 'overview',
  POS: 'pos',
  Inventory: 'inventory',
  'Sales & Analytics': 'sales',
  'Loyalty Points': 'loyalty',
  'Customer List': 'customers',
  Expenses: 'expenses',
  Settings: 'settings',
};

const viewFromLocation = (): View => {
  const slug = window.location.hash.replace(/^#/, '');
  const match = (Object.entries(viewSlugs) as [View, string][]).find(([, value]) => value === slug);
  return match?.[0] ?? 'Overview';
};

const money = (value: number) => `${value < 0 ? '-' : ''}₱${Math.abs(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (value: string | null) => value ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No visit yet';
const dayKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const shiftDay = (offset: number) => { const day = new Date(); day.setDate(day.getDate() + offset); return day; };
const salesOn = (sales: Sale[], offset: number) => sales.filter((sale) => dayKey(new Date(sale.created_at)) === dayKey(shiftDay(offset)));
const sumSales = (sales: Sale[]) => sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
const percentChange = (current: number, previous: number) => { if (!previous) return current ? 'New' : '0%'; const rounded = Math.round(((current - previous) / previous) * 1000) / 10; return `${rounded > 0 ? '+' : ''}${rounded}%`; };
const niceMax = (value: number) => { if (value <= 0) return 100; const step = Math.pow(10, Math.floor(Math.log10(value))); return Math.ceil(value / step) * step; };
const moneyAxis = (value: number) => value >= 1000 ? `₱${Math.round(value / 100) / 10}k` : `₱${Math.round(value)}`;
const todayLabel = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
type AnalyticsRange = 'Day' | 'Week' | 'Month' | 'Year';
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, amount: number) => { const next = new Date(date); next.setDate(next.getDate() + amount); return next; };
const parseDayKey = (value: string) => { const [year, month, day] = value.split('-').map(Number); return new Date(year, (month || 1) - 1, day || 1); };
const startOfWeek = (date: Date) => { const day = startOfDay(date); return addDays(day, day.getDay() === 0 ? -6 : 1 - day.getDay()); };
const salesBetween = (sales: Sale[], start: Date, end: Date) => sales.filter((sale) => { const created = new Date(sale.created_at); return created >= start && created < end; });
const periodFor = (range: AnalyticsRange, anchor: Date) => {
  const day = startOfDay(anchor);
  if (range === 'Day') return { start: day, end: addDays(day, 1), previousStart: addDays(day, -1), previousEnd: day, compare: 'vs previous day' };
  if (range === 'Week') { const start = startOfWeek(day); const end = addDays(start, 7); return { start, end, previousStart: addDays(start, -7), previousEnd: start, compare: 'vs previous week' }; }
  if (range === 'Month') { const start = new Date(day.getFullYear(), day.getMonth(), 1); const end = new Date(day.getFullYear(), day.getMonth() + 1, 1); return { start, end, previousStart: new Date(day.getFullYear(), day.getMonth() - 1, 1), previousEnd: start, compare: 'vs previous month' }; }
  const start = new Date(day.getFullYear(), 0, 1);
  return { start, end: new Date(day.getFullYear() + 1, 0, 1), previousStart: new Date(day.getFullYear() - 1, 0, 1), previousEnd: start, compare: 'vs previous year' };
};
const periodLabel = (range: AnalyticsRange, start: Date, end: Date) => {
  if (range === 'Day') return start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  if (range === 'Year') return String(start.getFullYear());
  if (range === 'Month') return start.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const last = addDays(end, -1);
  return `${start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`;
};
const hourLabel = (hour: number) => hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`;
const FREE_REFILL_POINTS = 11;
const LOW_STOCK_LEVEL = 10;
const LOW_STOCK_ALERT_KEY = 'crma-low-stock-alert';
const THEME_KEY = 'crma-theme';
const NOTIFY_KEY = 'crma-notifications';
const UNPAID_ALERT_KEY = 'crma-unpaid-alert';
type NotifyPrefs = { lowStock: boolean; unpaid: boolean };
const readDarkMode = () => window.localStorage.getItem(THEME_KEY) === 'dark';
const applyTheme = (dark: boolean) => {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  window.localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
};
const readNotify = (): NotifyPrefs => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(NOTIFY_KEY) || '') as Partial<NotifyPrefs>;
    return { lowStock: parsed.lowStock !== false, unpaid: parsed.unpaid === true };
  } catch {
    return { lowStock: true, unpaid: false };
  }
};
const settingsCopy: Record<SettingsSection, { title: string; blurb: string }> = {
  general: { title: 'General Settings', blurb: 'Station name, address, contact number, and operating hours.' },
  account: { title: 'Account Settings', blurb: 'The name, email, and password for this owner account.' },
  notifications: { title: 'Notification', blurb: 'Choose which alerts this station shows.' },
};
const isLowStock = (product: { category: string; stock: number }) => product.category !== 'Water Refill' && Number(product.stock) <= LOW_STOCK_LEVEL;
const isUnpaid = (sale: Sale) => sale.status === 'unpaid';
const unpaidTotal = (sales: Sale[], customerId: string) => sales.filter((sale) => sale.customer_id === customerId && isUnpaid(sale)).reduce((sum, sale) => sum + Number(sale.total || 0), 0);
const earnsLoyalty = (item: { category?: string; earns_points?: boolean | null }) => item.earns_points == null ? item.category === 'Water Refill' : Boolean(item.earns_points);
const refillPoints = (items: { category?: string; earns_points?: boolean | null; quantity: number }[]) => Math.round(items.filter(earnsLoyalty).reduce((sum, item) => sum + Number(item.quantity), 0));
const normalizeProduct = (row: Product): Product => ({ ...row, earns_points: row.earns_points == null ? row.category === 'Water Refill' : Boolean(row.earns_points) });
const cashColumnMissing = (message?: string) => /cash_received|change_amount|schema cache/i.test(message ?? '');
const normalizeSale = (row: Partial<Sale> & Pick<Sale, 'id' | 'total' | 'payment_method' | 'status' | 'created_at'>): Sale => ({
  id: row.id,
  total: Number(row.total) || 0,
  payment_method: row.payment_method,
  status: row.status,
  created_at: row.created_at,
  customer_id: row.customer_id ?? null,
  cash_received: row.cash_received == null ? null : Number(row.cash_received),
  change_amount: row.change_amount == null ? null : Number(row.change_amount),
});
const normalizeCustomer = (row: Customer): Customer => ({
  ...row,
  email: row.email ?? null,
  loyalty_points: Number(row.loyalty_points) || 0,
  refill_count: Number(row.refill_count) || 0,
  free_refills_claimed: Number(row.free_refills_claimed) || 0,
  total_spent: Number(row.total_spent) || 0,
});
const loyaltyColumnMissing = (message?: string) => /refill_count|free_refills_claimed|schema cache/i.test(message ?? '');
const exactCustomerName = (value: string) => value.trim();
const isExactNameConflict = (message?: string) => /duplicate key|unique constraint|station_customers_exact_name/i.test(message ?? '');
const insertStationCustomer = async (fields: { name: string; phone?: string | null; email?: string | null; loyalty_points: number; refill_count: number; total_spent: number; last_visit_at: string | null }) => {
  const phone = fields.phone ?? null;
  const email = fields.email?.trim() || null;
  const full = { name: fields.name, phone, email, loyalty_points: fields.loyalty_points, refill_count: fields.refill_count, free_refills_claimed: 0, total_spent: fields.total_spent, last_visit_at: fields.last_visit_at };
  let result = await supabase.from('station_customers').insert(full).select('*').maybeSingle();
  if (result.error && /email/i.test(result.error.message)) {
    result = await supabase.from('station_customers').insert({ name: full.name, phone: full.phone, loyalty_points: full.loyalty_points, refill_count: full.refill_count, free_refills_claimed: full.free_refills_claimed, total_spent: full.total_spent, last_visit_at: full.last_visit_at }).select('*').maybeSingle();
  }
  if (result.error && loyaltyColumnMissing(result.error.message)) {
    result = await supabase.from('station_customers').insert({ name: fields.name, phone, loyalty_points: fields.loyalty_points, total_spent: fields.total_spent, last_visit_at: fields.last_visit_at }).select('*').maybeSingle();
  }
  return result;
};
const updateStationCustomer = async (id: string, fields: { loyalty_points: number; refill_count: number; total_spent: number; last_visit_at: string }) => {
  let result = await supabase.from('station_customers').update(fields).eq('id', id);
  if (result.error && loyaltyColumnMissing(result.error.message)) {
    result = await supabase.from('station_customers').update({ loyalty_points: fields.loyalty_points, total_spent: fields.total_spent, last_visit_at: fields.last_visit_at }).eq('id', id);
  }
  return result;
};

function StationWorkspace({ session }: { session: Session }) {
  const [activeView, setActiveViewState] = useState<View>(viewFromLocation);
  const setActiveView = (view: View) => {
    const slug = viewSlugs[view];
    if (window.location.hash !== `#${slug}`) window.history.pushState(null, '', `#${slug}`);
    setActiveViewState(view);
  };
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [borrowed, setBorrowed] = useState<BorrowedContainer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(viewFromLocation() === 'Settings');
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('general');
  const [darkMode, setDarkMode] = useState(readDarkMode);
  const [notify, setNotify] = useState<NotifyPrefs>(readNotify);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [stockAlertOpen, setStockAlertOpen] = useState(false);
  const rawName = session.user.user_metadata.full_name;
  const ownerName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : (session.user.email?.split('@')[0] || 'Owner');
  const ownerFirst = ownerName.split(' ')[0]?.toUpperCase() || 'OWNER';
  const ownerInitials = ownerName.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'OW';

  useEffect(() => {
    const loadData = async () => {
      const [productResult, customerResult, saleResult, expenseResult, borrowedResult] = await Promise.all([
        supabase.from('station_products').select('*').eq('active', true).order('name'),
        supabase.from('station_customers').select('*').order('total_spent', { ascending: false }),
        supabase.from('station_sales').select('id,total,payment_method,status,created_at,customer_id,cash_received,change_amount').order('created_at', { ascending: false }),
        supabase.from('station_expenses').select('id,title,category,amount,expense_date,notes').order('expense_date', { ascending: false }),
        supabase.from('station_borrowed_containers').select('id,customer_id,sale_id,container_code,borrowed_at,returned_at').order('borrowed_at', { ascending: false }),
      ]);
      setProducts((productResult.data ?? []).map(normalizeProduct));
      setCustomers((customerResult.data ?? []).map(normalizeCustomer));
      if (saleResult.error && cashColumnMissing(saleResult.error.message)) {
        const basicSales = await supabase.from('station_sales').select('id,total,payment_method,status,created_at,customer_id').order('created_at', { ascending: false });
        setSales((basicSales.data ?? []).map(normalizeSale));
      } else {
        setSales((saleResult.data ?? []).map(normalizeSale));
      }
      setExpenses(expenseResult.data ?? []);
      setBorrowed(borrowedResult.data ?? []);
    };
    void loadData();
  }, []);

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', '#overview');
    const syncView = () => setActiveViewState(viewFromLocation());
    window.addEventListener('hashchange', syncView);
    window.addEventListener('popstate', syncView);
    return () => {
      window.removeEventListener('hashchange', syncView);
      window.removeEventListener('popstate', syncView);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => { applyTheme(darkMode); }, [darkMode]);

  useEffect(() => {
    if (!notify.lowStock) return;
    const low = products.filter(isLowStock);
    if (!low.length) return;
    if (window.localStorage.getItem(LOW_STOCK_ALERT_KEY) === dayKey(new Date())) return;
    setStockAlertOpen(true);
  }, [products, notify.lowStock]);

  useEffect(() => {
    if (!notify.unpaid || !sales.some(isUnpaid)) return;
    if (window.localStorage.getItem(UNPAID_ALERT_KEY) === dayKey(new Date())) return;
    window.localStorage.setItem(UNPAID_ALERT_KEY, dayKey(new Date()));
    const count = sales.filter(isUnpaid).length;
    setToast(`${count} unpaid order${count === 1 ? '' : 's'} still open.`);
  }, [sales, notify.unpaid]);

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) return current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { ...product, quantity: 1 }];
    });
  };
  const updateCartQuantity = (id: string, delta: number) => setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter((item) => item.quantity > 0));
  const checkout = async (paid: boolean, customerName: string, borrowedCodes: string[] = [], tendered: number | null = null) => {
    if (!cart.length) return false;
    const name = customerName.trim();
    const codes = [...new Set(borrowedCodes.map((code) => code.trim()).filter(Boolean))];
    if (codes.length && !name) {
      setToast('Add a customer name so the borrowed container can be tracked.');
      return false;
    }
    if (!paid && !name) {
      setToast('Add a customer name so the unpaid balance can be tracked.');
      return false;
    }
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const points = refillPoints(cart);
    const stamp = new Date().toISOString();
    let nextCustomer: Customer | null = null;
    if (name) {
      const existing = customers.find((item) => exactCustomerName(item.name) === name);
      if (existing) nextCustomer = existing;
      else {
        const { data: created, error: createError } = await insertStationCustomer({ name, loyalty_points: 0, refill_count: 0, total_spent: 0, last_visit_at: stamp });
        if (createError && isExactNameConflict(createError.message)) {
          const { data: found } = await supabase.from('station_customers').select('*').eq('name', name).maybeSingle();
          if (!found) {
            setToast('This exact name is already on the customer list.');
            return false;
          }
          nextCustomer = normalizeCustomer(found);
        } else if (createError || !created) {
          setToast(createError?.message ? `Customer could not be saved. ${createError.message}` : 'Customer could not be saved.');
          return false;
        } else {
          nextCustomer = normalizeCustomer(created);
        }
        setCustomers((current) => [nextCustomer!, ...current.filter((item) => item.id !== nextCustomer!.id)]);
      }
    }
    const cashReceived = paid && tendered != null && Number.isFinite(tendered) ? Math.round(tendered * 100) / 100 : null;
    const changeAmount = cashReceived == null ? null : Math.round((cashReceived - subtotal) * 100) / 100;
    let inserted = await supabase.from('station_sales').insert({ customer_id: nextCustomer?.id ?? null, subtotal, total: subtotal, payment_method: paid ? 'Paid' : 'Unpaid', status: paid ? 'paid' : 'unpaid', cash_received: cashReceived, change_amount: changeAmount }).select('id,total,payment_method,status,created_at,customer_id,cash_received,change_amount').maybeSingle();
    let cashNote = '';
    if (inserted.error && cashColumnMissing(inserted.error.message)) {
      inserted = await supabase.from('station_sales').insert({ customer_id: nextCustomer?.id ?? null, subtotal, total: subtotal, payment_method: paid ? 'Paid' : 'Unpaid', status: paid ? 'paid' : 'unpaid' }).select('id,total,payment_method,status,created_at,customer_id').maybeSingle();
      if (cashReceived != null) cashNote = ' Cash received was not stored. Run the cash SQL in Supabase.';
    }
    const { data, error } = inserted;
    if (error || !data) {
      setToast(nextCustomer ? `${nextCustomer.name} was saved to the customer list, but the sale could not be recorded.` : 'Sale could not be saved.');
      return false;
    }
    const savedSale = normalizeSale({ ...data, cash_received: data.cash_received ?? cashReceived, change_amount: data.change_amount ?? changeAmount });
    const { error: itemError } = await supabase.from('station_sale_items').insert(cart.map((item) => ({ sale_id: data.id, product_id: item.id, product_name: item.name, quantity: item.quantity, unit_price: item.price, line_total: item.price * item.quantity })));
    let borrowNote = '';
    if (codes.length && nextCustomer) {
      const { data: borrowedRows, error: borrowError } = await supabase.from('station_borrowed_containers').insert(codes.map((code) => ({ customer_id: nextCustomer.id, sale_id: data.id, container_code: code }))).select('id,customer_id,sale_id,container_code,borrowed_at,returned_at');
      if (borrowError || !borrowedRows) borrowNote = /station_borrowed_containers|schema cache/i.test(borrowError?.message ?? '') ? ' Run the borrowed-container SQL in Supabase so the codes are saved.' : /duplicate|unique/i.test(borrowError?.message ?? '') ? ' One of those container codes is already borrowed.' : ' Borrowed containers could not be recorded.';
      else {
        setBorrowed((current) => [...borrowedRows, ...current]);
        borrowNote = ` ${borrowedRows.length} borrowed container${borrowedRows.length === 1 ? '' : 's'} recorded.`;
      }
    }
    if (nextCustomer && !itemError) {
      const earned = paid ? points : 0;
      const patch = { loyalty_points: nextCustomer.loyalty_points + earned, refill_count: nextCustomer.refill_count + earned, total_spent: Number(nextCustomer.total_spent) + (paid ? subtotal : 0), last_visit_at: stamp };
      const { error: updateError } = await updateStationCustomer(nextCustomer.id, patch);
      const saved = { ...nextCustomer, ...patch };
      setCustomers((current) => {
        const exists = current.some((item) => item.id === saved.id);
        const next = exists ? current.map((item) => item.id === saved.id ? (updateError ? nextCustomer! : saved) : item) : [updateError ? nextCustomer! : saved, ...current];
        return next.sort((a, b) => Number(b.total_spent) - Number(a.total_spent));
      });
      if (updateError) {
        setSales((current) => [savedSale, ...current]);
        setCart([]);
        setToast(`Sale saved, but points could not be updated. Run the latest SQL migration in Supabase.${borrowNote}${cashNote}`);
        return true;
      }
    }
    setSales((current) => [savedSale, ...current]);
    setCart([]);
    if (itemError) setToast(`Sale saved, but the items could not be recorded.${borrowNote}${cashNote}`);
    else if (!paid) setToast(`Unpaid order saved for ${name}. No points added.${borrowNote}`);
    else if (name && points) setToast(`Paid order saved. ${name} earned ${points} point${points === 1 ? '' : 's'}.${borrowNote}${cashNote}`);
    else setToast(`Paid order saved.${borrowNote}${cashNote}`);
    return true;
  };

  const filteredProducts = products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()));
  const lowStockItems = products.filter(isLowStock);
  const lowStock = lowStockItems.length;
  const dismissStockAlert = () => {
    window.localStorage.setItem(LOW_STOCK_ALERT_KEY, dayKey(new Date()));
    setStockAlertOpen(false);
  };
  const openSettings = (section: SettingsSection) => {
    setSettingsSection(section);
    setSettingsOpen(true);
    setActiveView('Settings');
    setIsSidebarOpen(false);
  };
  const updateNotify = (patch: Partial<NotifyPrefs>) => {
    setNotify((current) => {
      const next = { ...current, ...patch };
      window.localStorage.setItem(NOTIFY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const renderView = () => {
    switch (activeView) {
      case 'POS': return <POSView products={filteredProducts} customers={customers} sales={sales} cart={cart} addToCart={addToCart} updateCartQuantity={updateCartQuantity} checkout={checkout} />;
      case 'Inventory': return <InventoryView products={products} search={search} setSearch={setSearch} setProducts={setProducts} setCart={setCart} setToast={setToast} />;
      case 'Sales & Analytics': return <AnalyticsView sales={sales} customers={customers} borrowed={borrowed} setToast={setToast} />;
      case 'Loyalty Points': return <LoyaltyView customers={customers} sales={sales} setCustomers={setCustomers} setToast={setToast} setActiveView={setActiveView} />;
      case 'Customer List': return <CustomersView customers={customers} products={products} sales={sales} borrowed={borrowed} setBorrowed={setBorrowed} setCustomers={setCustomers} setSales={setSales} setToast={setToast} />;
      case 'Expenses': return <ExpensesView expenses={expenses} setExpenses={setExpenses} setToast={setToast} />;
      case 'Settings': return <SettingsView session={session} section={settingsSection} setSection={openSettings} darkMode={darkMode} setDarkMode={setDarkMode} notify={notify} setNotify={updateNotify} setToast={setToast} />;
      default: return <OverviewView sales={sales} products={products} customers={customers} expenses={expenses} lowStock={lowStock} setActiveView={setActiveView} />;
    }
  };

  return (
    <div className="app-shell">
      {isSidebarOpen && <button className="sidebar-backdrop" aria-label="Close menu" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-logo-frame"><img src={stationLogo} alt="" /></div>
          <div><strong>CRMA</strong><span>WATER STATION</span></div>
          <button className="mobile-close" onClick={() => setIsSidebarOpen(false)} aria-label="Close menu"><X size={19} /></button>
        </div>
        <div className="station-badge"><span className="online-dot" /> Store is open <span className="badge-chevron">●</span></div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="nav-list">
          {navItems.map(({ label, icon: Icon }) => label === 'Settings' ? (
            <div className={`nav-group ${settingsOpen ? 'open' : ''}`} key={label}>
              <button type="button" className={`nav-item ${activeView === 'Settings' ? 'active' : ''}`} onClick={() => { setSettingsOpen((open) => !open); if (activeView !== 'Settings') setActiveView('Settings'); }}>
                <Icon size={18} /><span>Settings</span><ChevronDown size={15} className="nav-chevron" />
              </button>
              {settingsOpen && <div className="nav-dropdown">
                <button type="button" className={activeView === 'Settings' && settingsSection === 'general' ? 'selected' : ''} onClick={() => openSettings('general')}>General Settings</button>
                <button type="button" className={activeView === 'Settings' && settingsSection === 'account' ? 'selected' : ''} onClick={() => openSettings('account')}>Account Settings</button>
                <button type="button" className={activeView === 'Settings' && settingsSection === 'notifications' ? 'selected' : ''} onClick={() => openSettings('notifications')}>Notification</button>
                <div className="nav-toggle"><span>Dark mode <em>{darkMode ? 'On' : 'Off'}</em></span><label className="theme-switch"><input type="checkbox" checked={darkMode} onChange={(event) => setDarkMode(event.target.checked)} aria-label="Dark mode" /><i /></label></div>
              </div>}
            </div>
          ) : <button key={label} className={`nav-item ${activeView === label ? 'active' : ''}`} onClick={() => { setActiveView(label); setIsSidebarOpen(false); }}><Icon size={18} /><span>{label}</span>{label === 'POS' && <small>⌘ P</small>}</button>)}
        </nav>
        <div className="sidebar-bottom"><div className="profile"><div className="avatar">{ownerInitials}</div><div><strong>{ownerName}</strong><span>Station owner</span></div><button aria-label="Log out" onClick={() => { void supabase.auth.signOut(); }}><LogOut size={17} /></button></div></div>
      </aside>
      <main className="main-area">
        <header className="topbar"><button className="mobile-menu" onClick={() => setIsSidebarOpen(true)} aria-label="Open menu"><Menu size={21} /></button><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{activeView}</strong></div><div className="topbar-actions"><div className="date-chip"><Gauge size={15} /> {todayLabel}</div><button className="icon-button" aria-label="Low stock alerts" onClick={() => { if (notify.lowStock && lowStockItems.length) setStockAlertOpen(true); }}><Bell size={18} />{notify.lowStock && lowStockItems.length > 0 && <i />}</button><div className="top-avatar">{ownerInitials}</div></div></header>
        <div className="content"><div className="page-heading"><div><p className="eyebrow">GOOD MORNING, {ownerFirst} <span>✦</span></p><h1>{activeView === 'Overview' ? 'Here’s your station at a glance.' : activeView === 'Settings' ? settingsCopy[settingsSection].title : activeView}</h1><p className="muted">{activeView === 'Settings' ? settingsCopy[settingsSection].blurb : 'Keep your operations flowing and your customers refreshed.'}</p></div>{activeView === 'Overview' && <button className="primary-button" onClick={() => setActiveView('POS')}><Plus size={18} /> New sale</button>}</div>{renderView()}</div>
      </main>
      {stockAlertOpen && lowStockItems.length > 0 && <div className="modal-backdrop" onClick={dismissStockAlert}><div className="product-modal confirm-modal stock-alert" onClick={(event) => event.stopPropagation()}><div className="confirm-icon stock"><Package size={22} /></div><p className="eyebrow">LOW STOCK</p><h2>{lowStockItems.length} item{lowStockItems.length === 1 ? '' : 's'} at {LOW_STOCK_LEVEL} or below.</h2><p className="muted">Restock these before they run out. This reminder shows once a day.</p><ul className="stock-alert-list">{lowStockItems.map((product) => <li key={product.id}><strong>{product.name}</strong><span>{product.stock} left</span></li>)}</ul><div className="modal-actions"><button type="button" className="outline-button" onClick={dismissStockAlert}>Got it</button><button type="button" className="primary-button" onClick={() => { dismissStockAlert(); setActiveView('Inventory'); }}>Check inventory</button></div></div></div>}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </div>
  );
}

function OverviewView({ sales, products, customers, expenses, lowStock, setActiveView }: { sales: Sale[]; products: Product[]; customers: Customer[]; expenses: Expense[]; lowStock: number; setActiveView: (view: View) => void }) {
  const revenue = sales.filter((sale) => !isUnpaid(sale));
  const todaySales = salesOn(revenue, 0);
  const yesterdaySales = salesOn(revenue, -1);
  const totalToday = sumSales(todaySales);
  const expensesOn = (offset: number) => expenses.filter((expense) => expense.expense_date.slice(0, 10) === dayKey(shiftDay(offset)));
  const sumExpenses = (items: Expense[]) => items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const todayExpenses = sumExpenses(expensesOn(0));
  const yesterdayExpenses = sumExpenses(expensesOn(-1));
  const netToday = totalToday - todayExpenses;
  const netYesterday = sumSales(yesterdaySales) - yesterdayExpenses;
  const monthStart = dayKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const newMembers = customers.filter((customer) => customer.created_at && customer.created_at.slice(0, 10) >= monthStart).length;
  const week = Array.from({ length: 7 }, (_, index) => {
    const offset = index - 6;
    return { label: shiftDay(offset).toLocaleDateString('en-PH', { weekday: 'short' }), total: sumSales(salesOn(revenue, offset)), isToday: offset === 0 };
  });
  const weekTotal = week.reduce((sum, day) => sum + day.total, 0);
  const previousWeekTotal = Array.from({ length: 7 }, (_, index) => sumSales(salesOn(revenue, index - 13))).reduce((sum, total) => sum + total, 0);
  const axisMax = niceMax(Math.max(...week.map((day) => day.total), 0));
  const customerName = (id: string | null) => customers.find((customer) => customer.id === id)?.name || 'Walk-in';
  const cards = [
    { label: "Today's sales", value: money(totalToday), change: percentChange(totalToday, sumSales(yesterdaySales)), icon: CircleDollarSign, tone: 'blue', warn: false },
    { label: "Today's expenses", value: money(todayExpenses), change: percentChange(todayExpenses, yesterdayExpenses), icon: Wallet, tone: 'orange', warn: todayExpenses > yesterdayExpenses },
    { label: 'Net income', value: money(netToday), change: percentChange(netToday, netYesterday), icon: TrendingUp, tone: 'teal', warn: netToday < 0 },
    { label: 'Orders today', value: `${todaySales.length}`, change: percentChange(todaySales.length, yesterdaySales.length), icon: Receipt, tone: 'green', warn: false },
    { label: 'Low stock items', value: `${lowStock}`, change: lowStock ? 'Needs attention' : 'All stocked', icon: Package, tone: 'orange', warn: lowStock > 0 },
    { label: 'Loyalty members', value: `${customers.length}`, change: `+${newMembers} this month`, icon: Sparkles, tone: 'teal', warn: false },
  ];
  return <><section className="stats-grid overview-stats">{cards.map(({ label, value, change, icon: Icon, tone, warn }) => <div className="stat-card" key={label}><div className={`stat-icon ${tone}`}><Icon size={19} /></div><p>{label}</p><strong>{value}</strong><span className={warn ? 'warning-text' : 'positive-text'}>{change}</span></div>)}</section><section className="dashboard-grid"><div className="panel sales-panel"><PanelHeader title="Sales overview" action="Last 7 days" /><div className="chart-wrap"><div className="chart-y">{[1, 0.75, 0.5, 0.25, 0].map((step) => <span key={step}>{moneyAxis(axisMax * step)}</span>)}</div><div className="chart"><div className="chart-grid-lines"><i /><i /><i /><i /><i /></div><div className="bars">{week.map((day) => <div className="bar-column" key={day.label}><div className={`bar ${day.isToday ? 'today' : ''}`} style={{ height: `${axisMax ? (day.total / axisMax) * 100 : 0}%` }} /><span>{day.label}</span></div>)}</div></div></div><div className="chart-footer"><span><i className="legend-dot blue-dot" /> Sales</span><strong>{money(weekTotal)} <em>{percentChange(weekTotal, previousWeekTotal)}</em></strong></div></div><div className="panel quick-panel"><PanelHeader title="Quick actions" /><button onClick={() => setActiveView('POS')} className="quick-action"><span className="quick-action-icon aqua"><ShoppingCart size={18} /></span><span><strong>Start a new sale</strong><small>Open point of sale</small></span><span>→</span></button><button onClick={() => setActiveView('Inventory')} className="quick-action"><span className="quick-action-icon blue"><Package size={18} /></span><span><strong>Check inventory</strong><small>{lowStock} items need restocking</small></span><span>→</span></button><button onClick={() => setActiveView('Customer List')} className="quick-action"><span className="quick-action-icon yellow"><UserRound size={18} /></span><span><strong>Add a customer</strong><small>Grow your loyalty list</small></span><span>→</span></button></div></section><section className="dashboard-grid lower-grid"><div className="panel"><PanelHeader title="Recent transactions" action="View all" onAction={() => setActiveView('Sales & Analytics')} /><div className="transaction-list">{sales.length ? sales.slice(0, 4).map((sale) => <div className="transaction-row" key={sale.id}><div className="transaction-icon"><Receipt size={16} /></div><div><strong>{customerName(sale.customer_id)}</strong><span>{sale.payment_method} · {shortDate(sale.created_at)}</span></div><strong className="transaction-amount">{money(Number(sale.total))}</strong><span className={`status-pill ${isUnpaid(sale) ? 'attention' : ''}`}>{isUnpaid(sale) ? 'Unpaid' : 'Paid'}</span></div>) : <div className="empty-state">No sales recorded yet.</div>}</div></div><div className="panel"><PanelHeader title="Inventory snapshot" action="Manage" onAction={() => setActiveView('Inventory')} /><div className="stock-list">{products.length ? products.slice(0, 4).map((product) => <div className="stock-row" key={product.id}><div><strong>{product.name}</strong><span>{product.category} · {product.unit}</span></div><div className="stock-progress"><div><i style={{ width: `${Math.min(Number(product.stock), 100)}%` }} /></div><span className={isLowStock(product) ? 'warning-text' : ''}>{product.stock} left</span></div></div>) : <div className="empty-state">No products yet.</div>}</div></div></section></>;
}

function PanelHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) { return <div className="panel-header"><h2>{title}</h2>{action && <button onClick={onAction}>{action} <span>→</span></button>}</div>; }

function POSView({ products, customers, sales, cart, addToCart, updateCartQuantity, checkout }: { products: Product[]; customers: Customer[]; sales: Sale[]; cart: CartItem[]; addToCart: (product: Product) => void; updateCartQuantity: (id: string, delta: number) => void; checkout: (paid: boolean, customerName: string, borrowedCodes: string[]) => Promise<boolean> }) {
  const [category, setCategory] = useState('All items');
  const [customerName, setCustomerName] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [cashInput, setCashInput] = useState('');
  const [borrowDraft, setBorrowDraft] = useState('');
  const [borrowedCodes, setBorrowedCodes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const categories = ['All items', ...Array.from(new Set(products.map((product) => product.category)))];
  const visible = category === 'All items' ? products : products.filter((product) => product.category === category);
  const refillProducts = visible.filter((product) => product.category === 'Water Refill');
  const otherProducts = visible.filter((product) => product.category !== 'Water Refill');
  const splitRows = category === 'All items' && refillProducts.length > 0 && otherProducts.length > 0;
  const productCard = (product: Product) => <button className="product-card" key={product.id} onClick={() => addToCart(product)}><div className={`product-art ${product.image_url ? 'has-photo' : ''} ${product.category === 'Container' ? 'container-art' : ''}`}>{product.image_url ? <img src={product.image_url} alt="" /> : <Droplets size={31} />}</div><div className="product-info"><strong>{product.name}</strong><span>{product.category === 'Water Refill' ? 'Water refill' : `${product.stock} available`}</span><b>{money(product.price)}</b></div><div className="add-product"><Plus size={16} /></div></button>;
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const points = refillPoints(cart);
  const typed = customerName.trim();
  const query = typed.toLowerCase();
  const match = typed ? customers.find((item) => exactCustomerName(item.name) === typed) : undefined;
  const suggestions = query ? [...customers].filter((item) => item.name.trim().toLowerCase().includes(query)).sort((a, b) => Number(!a.name.trim().toLowerCase().startsWith(query)) - Number(!b.name.trim().toLowerCase().startsWith(query)) || a.name.localeCompare(b.name)).slice(0, 6) : [];
  const showSuggestions = nameFocused && suggestions.length > 0;
  const owed = match ? unpaidTotal(sales, match.id) : 0;
  const cash = Number(cashInput);
  const cashReady = cashInput.trim() !== '' && Number.isFinite(cash);
  const change = cashReady ? Math.round((cash - subtotal) * 100) / 100 : 0;
  const cashCovers = cashReady && change >= 0;
  const needsBorrower = borrowedCodes.length > 0 || borrowDraft.trim().length > 0;
  const submit = async (paid: boolean) => {
    if (paid && !cashCovers) return;
    const draft = borrowDraft.trim();
    const codes = draft && !borrowedCodes.some((code) => code.toLowerCase() === draft.toLowerCase()) ? [...borrowedCodes, draft] : borrowedCodes;
    setSaving(true);
    const ok = await checkout(paid, typed, codes, paid ? cash : null);
    setSaving(false);
    if (ok) { setCustomerName(''); setCashInput(''); setBorrowDraft(''); setBorrowedCodes([]); }
  };
  const addBorrowed = () => {
    const code = borrowDraft.trim();
    if (!code) return;
    if (borrowedCodes.some((item) => item.toLowerCase() === code.toLowerCase())) { setBorrowDraft(''); return; }
    setBorrowedCodes((current) => [...current, code]);
    setBorrowDraft('');
  };
  return <div className="pos-layout"><section className="panel product-panel"><div className="pos-toolbar"><div className="segmented">{categories.map((item) => <button key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div><span>{visible.length} products</span></div>{splitRows ? <div className="product-groups"><div className="product-grid">{refillProducts.map(productCard)}</div><div className="product-grid product-grid-others">{otherProducts.map(productCard)}</div></div> : <div className="product-grid">{visible.map(productCard)}</div>}</section><aside className="panel cart-panel"><div className="cart-heading"><div><p className="eyebrow">CURRENT ORDER</p><h2>New sale</h2></div><span className="cart-count">{cart.reduce((sum, item) => sum + item.quantity, 0)} items</span></div>{cart.length ? <div className="cart-items">{cart.map((item) => <div className="cart-row" key={item.id}><div className="cart-thumb">{item.image_url ? <img src={item.image_url} alt="" /> : <Droplets size={15} />}</div><div className="cart-product"><strong>{item.name}</strong><span>{money(item.price)} / {item.unit}</span></div><div className="quantity"><button onClick={() => updateCartQuantity(item.id, -1)}>−</button><span>{item.quantity}</span><button onClick={() => updateCartQuantity(item.id, 1)}>+</button></div><strong>{money(item.price * item.quantity)}</strong></div>)}</div> : <div className="empty-cart"><ShoppingCart size={28} /><strong>Your order is empty</strong><span>Select a product to begin</span></div>}<div className="customer-field"><span className="customer-label">Customer name <em className={needsBorrower ? 'required' : ''}>{needsBorrower ? 'Required' : 'Optional'}</em></span><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} onFocus={() => setNameFocused(true)} onBlur={() => setNameFocused(false)} placeholder="Enter Customer's name (Optional)" autoComplete="off" />{showSuggestions && <div className="customer-suggest">{suggestions.map((item) => { const name = item.name.trim(); const index = name.toLowerCase().indexOf(query); return <button type="button" key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setCustomerName(name); setNameFocused(false); }}><span>{index >= 0 ? <>{name.slice(0, index)}<mark>{name.slice(index, index + query.length)}</mark>{name.slice(index + query.length)}</> : name}</span><small>{item.loyalty_points}/11 pts</small></button>; })}</div>}</div>{typed && <p className={`customer-hint ${owed ? 'warn' : ''}`}>{match ? `${match.name} · ${match.loyalty_points}/11 points · ${match.refill_count} refills${owed ? ` · Unpaid ${money(owed)}` : ''}` : 'New customer. Completing this order saves the name to the customer list.'}</p>}<div className="borrow-box">{needsBorrower && !typed && <p className="customer-hint warn">Enter the customer name. It is required for a borrowed container.</p>}<span className="customer-label">Record borrowed container</span><div className="borrow-add"><input value={borrowDraft} onChange={(event) => setBorrowDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addBorrowed(); } }} placeholder="Container code" /><button type="button" className="outline-button" onClick={addBorrowed}>Add</button></div>{borrowedCodes.length > 0 && <div className="borrow-list">{borrowedCodes.map((code) => <span className="borrow-chip" key={code}>{code}<button type="button" onClick={() => setBorrowedCodes((current) => current.filter((item) => item !== code))} aria-label={`Remove ${code}`}>×</button></span>)}</div>}</div><div className="cart-summary"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Discount</span><strong>₱0.00</strong></div><div className="total-line"><span>Total</span><strong>{money(subtotal)}</strong></div><label className="customer-field cash-field">Enter cash<input value={cashInput} onChange={(event) => setCashInput(event.target.value)} inputMode="decimal" placeholder="₱ 0.00" /></label><div className={`change-line ${cashReady && !cashCovers ? 'short' : ''}`}><span>Change</span><strong>{cashReady && !cashCovers ? 'Short' : money(Math.max(change, 0))}</strong></div>{cashReady && !cashCovers && <p className="cash-short">Short by {money(Math.abs(change))}</p>}<p className="points-note">{points ? (typed ? `${points} point${points === 1 ? '' : 's'} if this order is paid` : `Add a customer name to keep these ${points} point${points === 1 ? '' : 's'}`) : 'Only products checked for loyalty earn points.'}</p><div className="checkout-actions"><button className="checkout-button" type="button" onClick={() => void submit(true)} disabled={!cart.length || saving || !cashCovers || (needsBorrower && !typed)}>{saving ? 'Saving...' : 'Complete as paid'}</button><button className="unpaid-button" type="button" onClick={() => void submit(false)} disabled={!cart.length || saving || (needsBorrower && !typed)}>Complete as unpaid</button></div><p className="secure-note">1 point for each paid product checked for loyalty. Unpaid orders do not earn points.</p></div></aside></div>;
}

function InventoryView({ products, search, setSearch, setProducts, setCart, setToast }: { products: Product[]; search: string; setSearch: (value: string) => void; setProducts: (items: Product[]) => void; setCart: (items: CartItem[] | ((current: CartItem[]) => CartItem[])) => void; setToast: (message: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Water Refill');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [earnsPoints, setEarnsPoints] = useState(true);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const visible = products.filter((product) => {
    const matchesName = product.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || product.category === categoryFilter;
    return matchesName && matchesCategory;
  });

  const choosePhoto = (file: File | null) => {
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    if (file && !file.type.startsWith('image/')) {
      setToast('Choose an image file.');
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      setToast('Use a photo smaller than 5 MB.');
      return;
    }
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : '');
  };

  const closeForm = () => {
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    setIsOpen(false);
    setEditingId(null);
    setName('');
    setCategory('Water Refill');
    setPrice('');
    setStock('');
    setEarnsPoints(true);
    setPhoto(null);
    setPreview('');
  };

  const addProduct = async () => {
    const productName = name.trim();
    const isRefill = category === 'Water Refill';
    if (!productName || !price) {
      setToast('Enter the product name and price.');
      return;
    }
    if (!photo && !editingId) {
      setToast('Add a product photo.');
      return;
    }
    setSaving(true);
    let imageUrl = preview;
    if (photo) {
      const extension = photo.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
      const path = `${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, photo, { contentType: photo.type });
      if (uploadError) {
        setSaving(false);
        setToast('Photo could not be uploaded.');
        return;
      }
      imageUrl = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    }
    const payload = { name: productName, category, unit: isRefill ? 'refill' : 'piece', price: Number(price), stock: isRefill ? 0 : Number(stock || 0), reorder_level: LOW_STOCK_LEVEL, image_url: imageUrl || null, active: true, earns_points: earnsPoints };
    const query = editingId
      ? supabase.from('station_products').update(payload).eq('id', editingId).select('*').maybeSingle()
      : supabase.from('station_products').insert(payload).select('*').maybeSingle();
    const { data, error } = await query;
    setSaving(false);
    if (error || !data) {
      setToast(/earns_points/i.test(error?.message ?? '') ? 'Run the latest SQL migration in Supabase so the loyalty checkbox can be saved.' : 'Product could not be saved.');
      return;
    }
    const saved = normalizeProduct(data);
    setProducts((editingId ? products.map((item) => item.id === saved.id ? saved : item) : [...products, saved]).sort((left, right) => left.name.localeCompare(right.name)));
    setCart((current) => current.map((item) => item.id === saved.id ? { ...saved, quantity: item.quantity } : item));
    setToast(editingId ? 'Product updated.' : 'Product added.');
    closeForm();
  };

  const openCreate = () => {
    closeForm();
    setIsOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingId(product.id);
    setName(product.name);
    setCategory(product.category === 'Water Refill' ? 'Water Refill' : 'Others');
    setPrice(String(product.price));
    setStock(String(product.stock ?? ''));
    setEarnsPoints(product.earns_points == null ? product.category === 'Water Refill' : Boolean(product.earns_points));
    setPhoto(null);
    setPreview(product.image_url || '');
    setIsOpen(true);
  };

  const removeProduct = async () => {
    if (!pendingDelete) return;
    const product = pendingDelete;
    setDeleting(true);
    const { error } = await supabase.from('station_products').delete().eq('id', product.id);
    if (error) {
      setDeleting(false);
      setToast('Product could not be removed.');
      return;
    }
    const marker = '/product-images/';
    const index = product.image_url?.indexOf(marker) ?? -1;
    if (product.image_url && index >= 0) {
      const path = decodeURIComponent(product.image_url.slice(index + marker.length).split('?')[0]);
      await supabase.storage.from('product-images').remove([path]);
    }
    setProducts(products.filter((item) => item.id !== product.id));
    setCart((current) => current.filter((item) => item.id !== product.id));
    setDeleting(false);
    setPendingDelete(null);
    setToast('Product removed.');
  };

  return <><section className="panel table-panel"><div className="table-toolbar"><div className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." /></div><div className="segmented inventory-filter">{['All', 'Water Refill', 'Others'].map((item) => <button type="button" key={item} className={categoryFilter === item ? 'selected' : ''} onClick={() => setCategoryFilter(item)}>{item}</button>)}</div><button className="outline-button" onClick={openCreate}><Plus size={16} /> Add product</button></div><div className="table-scroll"><table className="inventory-table stack-table"><thead><tr><th>Product</th><th>Category</th><th>Loyalty</th><th>Price</th><th>Stock level</th><th>Status</th><th /></tr></thead><tbody>{visible.length ? visible.map((product) => <tr key={product.id}><td data-label="Product"><div className="table-product"><div className="mini-product">{product.image_url ? <img src={product.image_url} alt="" /> : <Droplets size={15} />}</div><strong>{product.name}</strong></div></td><td data-label="Category">{product.category}</td><td data-label="Loyalty">{product.earns_points ? 'Earns points' : 'No points'}</td><td data-label="Price">{money(product.price)}</td><td data-label="Stock">{product.category === 'Water Refill' ? <span>Not tracked</span> : <div className="table-stock"><span>{product.stock} {product.unit}s</span><div><i className={isLowStock(product) ? 'low' : ''} style={{ width: `${Math.min(product.stock, 100)}%` }} /></div></div>}</td><td data-label="Status"><span className={`status-pill ${product.category !== 'Water Refill' && isLowStock(product) ? 'attention' : ''}`}>{product.category === 'Water Refill' ? 'Refill' : isLowStock(product) ? 'Restock soon' : 'In stock'}</span></td><td className="row-actions" data-label="Actions"><button type="button" className="outline-button" onClick={() => openEdit(product)}><Pencil size={14} /> Edit</button><button type="button" className="text-danger" onClick={() => setPendingDelete(product)}><Trash2 size={14} /> Delete</button></td></tr>) : <tr><td colSpan={7}>{products.length ? 'No products match this filter.' : 'No products yet.'}</td></tr>}</tbody></table></div></section>{isOpen && <div className="modal-backdrop" onClick={closeForm}><form className="product-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void addProduct(); }}><p className="eyebrow">{editingId ? 'EDIT PRODUCT' : 'NEW PRODUCT'}</p><h2>{editingId ? 'Edit product' : 'Add a product'}</h2><p className="muted">The photo appears on the POS and in inventory.</p><div className="photo-picker">{preview ? <img src={preview} alt="" /> : <div className="photo-placeholder"><ImagePlus size={22} /></div>}<label className="outline-button photo-button">Choose photo<input type="file" accept="image/*" hidden onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)} /></label></div><div className="product-form"><label>Category<select value={category} onChange={(event) => { const next = event.target.value; setCategory(next); if (!editingId) setEarnsPoints(next === 'Water Refill'); }}><option>Water Refill</option><option value="Others">Others (container, takip, etc.)</option></select></label><label>Product name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="5 Gallon container, takip, etc." /></label><label>Price<input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" placeholder="0.00" /></label>{category !== 'Water Refill' && <label>Stock<input value={stock} onChange={(event) => setStock(event.target.value)} inputMode="decimal" placeholder="0" /></label>}<label className="points-check product-span"><input type="checkbox" checked={earnsPoints} onChange={(event) => setEarnsPoints(event.target.checked)} /><span><strong>Earns loyalty points</strong><em>Each paid unit is 1 point. Leave this off for small containers.</em></span></label></div><div className="modal-actions"><button type="button" className="outline-button" onClick={closeForm}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Save changes' : 'Save product'}</button></div></form></div>}{pendingDelete && <div className="modal-backdrop" onClick={() => { if (!deleting) setPendingDelete(null); }}><div className="product-modal confirm-modal" onClick={(event) => event.stopPropagation()}><div className="confirm-icon"><Trash2 size={22} /></div><p className="eyebrow">REMOVE PRODUCT</p><h2>Remove {pendingDelete.name}?</h2><p className="muted">This takes it off the inventory and the POS. Past sales stay on record.</p>{pendingDelete.image_url && <img className="confirm-photo" src={pendingDelete.image_url} alt="" />}<div className="modal-actions"><button type="button" className="outline-button" onClick={() => setPendingDelete(null)} disabled={deleting}>Cancel</button><button type="button" className="danger-button" onClick={() => void removeProduct()} disabled={deleting}>{deleting ? 'Removing...' : 'Remove product'}</button></div></div></div>}</>;
}

function AnalyticsView({ sales: allSales, customers, borrowed, setToast }: { sales: Sale[]; customers: Customer[]; borrowed: BorrowedContainer[]; setToast: (message: string) => void }) {
  const ORDER_PAGE = 10;
  const ranges: AnalyticsRange[] = ['Day', 'Week', 'Month', 'Year'];
  const [range, setRange] = useState<AnalyticsRange>('Day');
  const [anchorKey, setAnchorKey] = useState(dayKey(new Date()));
  const [orderLimit, setOrderLimit] = useState(ORDER_PAGE);
  const [exporting, setExporting] = useState(false);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [detailLines, setDetailLines] = useState<{ product_name: string; quantity: number; unit_price: number | null; line_total: number | null }[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const anchor = parseDayKey(anchorKey);
  const period = periodFor(range, anchor);
  const label = periodLabel(range, period.start, period.end);
  const paid = allSales.filter((sale) => !isUnpaid(sale));
  const currentSales = salesBetween(paid, period.start, period.end);
  const previousSales = salesBetween(paid, period.previousStart, period.previousEnd);
  const average = (items: Sale[]) => items.length ? sumSales(items) / items.length : 0;
  const changeClass = (value: string) => value.startsWith('-') ? 'warning-text' : 'positive-text';
  const salesChange = percentChange(sumSales(currentSales), sumSales(previousSales));
  const ordersChange = percentChange(currentSales.length, previousSales.length);
  const averageChange = percentChange(average(currentSales), average(previousSales));
  const bars = range === 'Day'
    ? Array.from({ length: 24 }, (_, hour) => ({ key: String(hour), label: hour % 3 === 0 ? hourLabel(hour) : '', detail: new Date(2000, 0, 1, hour).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }), total: sumSales(currentSales.filter((sale) => new Date(sale.created_at).getHours() === hour)), active: hour === new Date().getHours() && anchorKey === dayKey(new Date()) }))
    : range === 'Week'
      ? Array.from({ length: 7 }, (_, index) => { const date = addDays(period.start, index); return { key: dayKey(date), label: date.toLocaleDateString('en-PH', { weekday: 'short' }), detail: date.toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' }), total: sumSales(currentSales.filter((sale) => dayKey(new Date(sale.created_at)) === dayKey(date))), active: dayKey(date) === anchorKey }; })
      : range === 'Month'
        ? Array.from({ length: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate() }, (_, index) => { const date = new Date(anchor.getFullYear(), anchor.getMonth(), index + 1); return { key: dayKey(date), label: String(index + 1), detail: date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }), total: sumSales(currentSales.filter((sale) => dayKey(new Date(sale.created_at)) === dayKey(date))), active: dayKey(date) === anchorKey }; })
        : Array.from({ length: 12 }, (_, month) => { const start = new Date(anchor.getFullYear(), month, 1); return { key: String(month), label: start.toLocaleDateString('en-PH', { month: 'short' }), detail: start.toLocaleDateString('en-PH', { month: 'long' }), total: sumSales(salesBetween(currentSales, start, new Date(anchor.getFullYear(), month + 1, 1))), active: month === anchor.getMonth() }; });
  const breakdownTitle = range === 'Day' ? 'Revenue by hour' : range === 'Week' ? 'Revenue by day' : range === 'Month' ? 'Revenue by date' : 'Revenue by month';
  const breakdownHeading = range === 'Day' ? 'Hour' : range === 'Week' ? 'Day' : range === 'Month' ? 'Date' : 'Month';
  const axisMax = niceMax(Math.max(...bars.map((bar) => bar.total), 0));
  const orders = allSales.filter((sale) => { const created = new Date(sale.created_at); return created >= period.start && created < period.end; });
  const visibleOrders = orders.slice(0, orderLimit);
  const customerName = (id: string | null) => customers.find((customer) => customer.id === id)?.name || 'Walk-in';
  const openBorrowedCodes = (customerId: string | null) => customerId ? borrowed.filter((item) => item.customer_id === customerId && !item.returned_at).map((item) => item.container_code) : [];
  const orderWhen = (value: string) => {
    const created = new Date(value);
    const time = created.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    return range === 'Day' ? time : `${shortDate(value)} · ${time}`;
  };
  const chooseRange = (next: AnalyticsRange) => { setRange(next); setOrderLimit(ORDER_PAGE); };
  const chooseDate = (value: string) => {
    if (!value) return;
    const picked = parseDayKey(value);
    const today = startOfDay(new Date());
    setAnchorKey(dayKey(picked > today ? today : picked));
    setOrderLimit(ORDER_PAGE);
  };
  const selectedDate = anchor.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const unpaidOrders = orders.filter(isUnpaid);
  const listedTotal = sumSales(orders);
  const exportReport = async () => {
    setExporting(true);
    try {
      const { data } = await supabase.from('station_settings').select('station_name').eq('id', 1).maybeSingle();
      const stationName = typeof data?.station_name === 'string' && data.station_name.trim() ? data.station_name.trim() : 'CRMA Water Station';
      const { downloadSalesReport } = await import('@/lib/exportSales');
      const ids = orders.map((sale) => sale.id);
      const itemRows: { sale_id: string; product_name: string; quantity: number; unit_price?: number | null; line_total?: number | null }[] = [];
      let itemsMissing = false;
      for (let index = 0; index < ids.length; index += 100) {
        const chunk = ids.slice(index, index + 100);
        const full = await supabase.from('station_sale_items').select('sale_id,product_name,quantity,unit_price,line_total').in('sale_id', chunk);
        const result = full.error && /unit_price|line_total|schema cache/i.test(full.error.message)
          ? await supabase.from('station_sale_items').select('sale_id,product_name,quantity').in('sale_id', chunk)
          : full;
        if (result.error) {
          itemsMissing = true;
          break;
        }
        itemRows.push(...((result.data ?? []) as { sale_id: string; product_name: string; quantity: number; unit_price?: number | null; line_total?: number | null }[]));
      }
      const itemsBySale = new Map<string, { product: string; quantity: number; unitPrice: number | null; lineTotal: number | null }[]>();
      itemRows.forEach((row) => {
        const quantity = Number(row.quantity) || 0;
        const unitPrice = row.unit_price == null ? null : Number(row.unit_price);
        const lineTotal = row.line_total == null ? (unitPrice == null ? null : unitPrice * quantity) : Number(row.line_total);
        const list = itemsBySale.get(row.sale_id) ?? [];
        list.push({ product: row.product_name || 'Item', quantity, unitPrice, lineTotal });
        itemsBySale.set(row.sale_id, list);
      });
      downloadSalesReport({
        stationName,
        range,
        periodLabel: label,
        selectedDate,
        compare: period.compare,
        grossSales: sumSales(currentSales),
        salesChange,
        orderCount: currentSales.length,
        ordersChange,
        averageOrder: average(currentSales),
        averageChange,
        unpaidCount: unpaidOrders.length,
        unpaidTotal: sumSales(unpaidOrders),
        breakdownTitle,
        breakdownHeading,
        breakdown: bars.map((bar) => ({ label: bar.detail, total: bar.total })),
        orders: orders.map((sale) => ({ created: new Date(sale.created_at), customer: customerName(sale.customer_id), payment: sale.payment_method, status: isUnpaid(sale) ? 'Unpaid' as const : 'Paid' as const, total: Number(sale.total) || 0, items: itemsMissing ? [] : (itemsBySale.get(sale.id) ?? []) })),
        filename: `CRMA Sales - ${range} - ${anchorKey}.xlsx`,
      });
      setToast(itemsMissing ? 'Sales report downloaded, but item quantities could not be loaded.' : 'Sales report downloaded.');
    } catch {
      setToast('Sales report could not be exported.');
    } finally {
      setExporting(false);
    }
  };
  const openOrder = async (sale: Sale) => {
    setDetailSale(sale);
    setDetailLines([]);
    setDetailLoading(true);
    const full = await supabase.from('station_sale_items').select('product_name,quantity,unit_price,line_total').eq('sale_id', sale.id);
    const result = full.error && /unit_price|line_total|schema cache/i.test(full.error.message)
      ? await supabase.from('station_sale_items').select('product_name,quantity').eq('sale_id', sale.id)
      : full;
    setDetailLoading(false);
    if (result.error) {
      setToast('Order details could not be loaded.');
      return;
    }
    const rows = (result.data ?? []) as { product_name: string | null; quantity: number; unit_price?: number | null; line_total?: number | null }[];
    setDetailLines(rows.map((row) => {
      const quantity = Number(row.quantity) || 0;
      const unitPrice = row.unit_price == null ? null : Number(row.unit_price);
      const lineTotal = row.line_total == null ? (unitPrice == null ? null : unitPrice * quantity) : Number(row.line_total);
      return { product_name: row.product_name || 'Item', quantity, unit_price: unitPrice, line_total: lineTotal };
    }));
  };
  return <>
    <div className="analytics-toolbar">
      <div className="segmented analytics-range">{ranges.map((item) => <button type="button" key={item} className={range === item ? 'selected' : ''} onClick={() => chooseRange(item)}>{item}</button>)}</div>
      <div className="analytics-tools">
        <label className="analytics-date">Specific date<input type="date" value={anchorKey} max={dayKey(new Date())} onChange={(event) => chooseDate(event.target.value)} /></label>
        <button type="button" className="primary-button" onClick={() => void exportReport()} disabled={exporting}><Download size={16} /> {exporting ? 'Exporting...' : 'Export Excel'}</button>
      </div>
    </div>
    <section className="analytics-banner">
      <div>
        <p className="eyebrow">SALES REPORT</p>
        <h2>{label}</h2>
      </div>
      <div className="analytics-banner-meta"><span>{range} view</span><span>Selected {anchor.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
    </section>
    <section className="stats-grid analytics-stats"><div className="stat-card"><div className="stat-icon blue"><TrendingUp size={19} /></div><p>Gross sales</p><strong>{money(sumSales(currentSales))}</strong><span className={changeClass(salesChange)}>{salesChange} {period.compare}</span></div><div className="stat-card"><div className="stat-icon green"><Receipt size={19} /></div><p>Total orders</p><strong>{currentSales.length}</strong><span className={changeClass(ordersChange)}>{ordersChange} {period.compare}</span></div><div className="stat-card"><div className="stat-icon teal"><Tag size={19} /></div><p>Average order value</p><strong>{money(average(currentSales))}</strong><span className={changeClass(averageChange)}>{averageChange} {period.compare}</span></div></section>
    <section className="panel analytics-panel"><div className="panel-header"><h2>{breakdownTitle}</h2><span className="analytics-period">{label}</span></div><div className={`chart-wrap analytics-bars ${range === 'Day' || range === 'Month' ? 'dense' : ''}`}><div className="chart-y">{[1, 0.75, 0.5, 0.25, 0].map((step) => <span key={step}>{moneyAxis(axisMax * step)}</span>)}</div><div className="chart"><div className="chart-grid-lines"><i /><i /><i /><i /><i /></div><div className="bars">{bars.map((bar) => <div className="bar-column" key={bar.key}><div className={`bar ${bar.active ? 'today' : ''}`} style={{ height: `${axisMax ? (bar.total / axisMax) * 100 : 0}%` }} title={money(bar.total)} /><span>{bar.label}</span></div>)}</div></div></div></section>
    <section className="panel recent-orders">
      <div className="panel-header"><h2>Orders</h2><span className="analytics-period">{label}</span></div>
      <p className="order-hint">Click an order to see each product, quantity, and price.</p>
      <div className="table-scroll">
        <table className="orders-table stack-table">
          <thead><tr><th>Customer</th><th>When</th><th>Payment</th><th className="num">Amount</th><th>Status</th></tr></thead>
          <tbody>
            {visibleOrders.length ? visibleOrders.map((sale) => {
              const borrowedCodes = openBorrowedCodes(sale.customer_id);
              return <tr className="order-row" key={sale.id} role="button" tabIndex={0} aria-label={`View ${customerName(sale.customer_id)} order`} onClick={() => void openOrder(sale)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openOrder(sale); } }}><td data-label="Customer"><div className="order-customer"><strong>{customerName(sale.customer_id)}</strong>{borrowedCodes.length > 0 && <span className="status-pill borrowed">Borrowed: {borrowedCodes.join(', ')}</span>}</div></td><td data-label="When">{orderWhen(sale.created_at)}</td><td data-label="Payment">{sale.payment_method}</td><td className="num" data-label="Amount"><strong>{money(Number(sale.total))}</strong></td><td data-label="Status"><span className={`status-pill ${isUnpaid(sale) ? 'attention' : ''}`}>{isUnpaid(sale) ? 'Unpaid' : 'Paid'}</span></td></tr>;
            }) : <tr><td colSpan={5}>{allSales.length ? 'No orders for this date.' : 'No orders yet.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {orders.length > 0 && <div className="orders-summary"><span>{orders.length} order{orders.length === 1 ? '' : 's'}{unpaidOrders.length ? ` · ${unpaidOrders.length} unpaid` : ''}</span><strong>{money(listedTotal)}</strong></div>}
      {orders.length > visibleOrders.length && <button type="button" className="outline-button full show-more" onClick={() => setOrderLimit((count) => count + ORDER_PAGE)}>Show more</button>}
    </section>
    {detailSale && <div className="modal-backdrop" onClick={() => setDetailSale(null)}><div className="product-modal order-detail" onClick={(event) => event.stopPropagation()}><p className="eyebrow">ORDER DETAILS</p><h2>{customerName(detailSale.customer_id)}</h2><p className="muted">{orderWhen(detailSale.created_at)} · {detailSale.payment_method}</p>{detailLoading ? <div className="empty-state">Loading items...</div> : detailLines.length ? <div className="order-lines">{detailLines.map((line, index) => <div className="order-line" key={`${line.product_name}-${index}`}><div><strong>{line.product_name}</strong><span>{line.quantity} × {line.unit_price == null ? 'Price not recorded' : money(line.unit_price)}</span></div><strong>{line.line_total == null ? '—' : money(line.line_total)}</strong></div>)}</div> : <div className="empty-state">Items were not recorded for this order.</div>}<div className="order-total"><span>Total</span><strong>{money(Number(detailSale.total))}</strong></div>{detailSale.cash_received != null && <div className="order-cash"><div><span>Cash received</span><strong>{money(Number(detailSale.cash_received))}</strong></div>{detailSale.change_amount != null && <div><span>Change</span><strong>{money(Number(detailSale.change_amount))}</strong></div>}</div>}<div className="modal-actions"><button type="button" className="outline-button" onClick={() => setDetailSale(null)}>Close</button></div></div></div>}
  </>;
}

function LoyaltyView({ customers, sales, setCustomers, setToast, setActiveView }: { customers: Customer[]; sales: Sale[]; setCustomers: (items: Customer[]) => void; setToast: (message: string) => void; setActiveView: (view: View) => void }) {
  const [pending, setPending] = useState<Customer | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matchesSearch = (customer: Customer) => !needle || customer.name.toLowerCase().includes(needle);
  const pointsLeft = (points: number) => points >= FREE_REFILL_POINTS ? 'Ready for a free refill' : `${FREE_REFILL_POINTS - points} point${FREE_REFILL_POINTS - points === 1 ? '' : 's'} to go`;
  const closest = [...customers].filter((customer) => matchesSearch(customer) && customer.loyalty_points > 0 && customer.loyalty_points < FREE_REFILL_POINTS).sort((a, b) => b.loyalty_points - a.loyalty_points).slice(0, 4);
  const ready = [...customers].filter((customer) => matchesSearch(customer) && customer.loyalty_points >= FREE_REFILL_POINTS).sort((a, b) => b.loyalty_points - a.loyalty_points);
  const ranked = [...customers].filter(matchesSearch).sort((a, b) => b.loyalty_points - a.loyalty_points || a.name.localeCompare(b.name));
  const giveFreeRefill = async () => {
    if (!pending || pending.loyalty_points < FREE_REFILL_POINTS) return;
    setClaiming(true);
    const loyalty_points = pending.loyalty_points - FREE_REFILL_POINTS;
    const free_refills_claimed = pending.free_refills_claimed + 1;
    const { error } = await supabase.from('station_customers').update({ loyalty_points, free_refills_claimed }).eq('id', pending.id);
    setClaiming(false);
    if (error) {
      setToast('Free refill could not be saved.');
      return;
    }
    setCustomers(customers.map((item) => item.id === pending.id ? { ...item, loyalty_points, free_refills_claimed } : item));
    setToast(`${pending.name} received 1 free refill. ${loyalty_points} point${loyalty_points === 1 ? '' : 's'} left.`);
    setPending(null);
  };
  return <>
    <section className="loyalty-hero">
      <div className="loyalty-copy">
        <p className="eyebrow">LOYALTY REWARDS</p>
        <h2>11 points, 1 free refill.</h2>
        <p>Each paid product checked for loyalty is 1 point. Leave small containers unchecked. Unpaid orders do not earn points.</p>
      </div>
      <div className="loyalty-orbit"><Sparkles size={29} /><strong>11</strong><span>1 free refill</span></div>
    </section>
    <div className="loyalty-search"><div className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a customer" /></div></div>
    {needle && <section className="panel loyalty-block"><PanelHeader title="Search results" />{ranked.length ? <div className="loyalty-spotlight">{ranked.map((customer) => <div className="loyalty-person" key={customer.id}><strong>{customer.name}</strong><div className="points-meta"><span>{customer.loyalty_points} / {FREE_REFILL_POINTS}</span><span>{pointsLeft(customer.loyalty_points)}</span></div><div className="points-track"><i style={{ width: `${Math.min(customer.loyalty_points / FREE_REFILL_POINTS, 1) * 100}%` }} /></div>{customer.loyalty_points >= FREE_REFILL_POINTS && <button className="primary-button loyalty-search-claim" type="button" onClick={() => setPending(customer)}><Gift size={16} /> Give 1 free refill</button>}</div>)}</div> : <div className="empty-state">No customer matches that search.</div>}</section>}
    {!needle && <section className="panel loyalty-block">
      <PanelHeader title="Closest to a free refill" />
      {closest.length ? <div className="loyalty-spotlight">{closest.map((customer) => <div className="loyalty-person" key={customer.id}><strong>{customer.name}</strong><div className="points-meta"><span>{customer.loyalty_points} / {FREE_REFILL_POINTS}</span><span>{FREE_REFILL_POINTS - customer.loyalty_points} to go</span></div><div className="points-track"><i style={{ width: `${(customer.loyalty_points / FREE_REFILL_POINTS) * 100}%` }} /></div></div>)}</div> : <div className="empty-state">No one is close yet. Points start on the next paid refill.</div>}
    </section>}
    {!needle && <section className="panel loyalty-block">
      <PanelHeader title="Ready for a free refill" />
      {ready.length ? <div className="claim-list">{ready.map((customer) => <div className="claim-row" key={customer.id}><div><strong>{customer.name}</strong><span>{customer.loyalty_points} points · {customer.free_refills_claimed} free refill{customer.free_refills_claimed === 1 ? '' : 's'} claimed</span></div><button className="primary-button" type="button" onClick={() => setPending(customer)}><Gift size={16} /> Give 1 free refill</button></div>)}</div> : <div className="empty-state">Nobody has 11 points yet.</div>}
    </section>}
    <section className="panel table-panel">
      <PanelHeader title="All loyalty customers" action="View customer list" onAction={() => setActiveView('Customer List')} />
      <div className="table-scroll"><table className="stack-table"><thead><tr><th>Customer</th><th>Refills</th><th>Points</th><th>Unpaid</th><th /></tr></thead><tbody>{ranked.length ? ranked.map((customer) => {
        const owed = unpaidTotal(sales, customer.id);
        return <tr key={customer.id}><td data-label="Customer"><div className="customer-cell"><div className="customer-avatar">{customer.name.slice(0, 2).toUpperCase()}</div><strong>{customer.name}</strong></div></td><td data-label="Refills">{customer.refill_count}</td><td data-label="Points"><strong className="points-text">{customer.loyalty_points} / {FREE_REFILL_POINTS}</strong></td><td data-label="Unpaid">{owed ? <strong className="unpaid-text">{money(owed)}</strong> : '—'}</td><td className="row-actions" data-label="Reward">{customer.loyalty_points >= FREE_REFILL_POINTS ? <button className="outline-button" type="button" onClick={() => setPending(customer)}>Give free refill</button> : <span>{FREE_REFILL_POINTS - customer.loyalty_points} to go</span>}</td></tr>;
      }) : <tr><td colSpan={5}>{needle ? 'No customer matches that search.' : 'No customers yet. Add a name on the POS.'}</td></tr>}</tbody></table></div>
    </section>
    {pending && <div className="modal-backdrop" onClick={() => { if (!claiming) setPending(null); }}><div className="product-modal confirm-modal" onClick={(event) => event.stopPropagation()}><div className="confirm-icon reward"><Gift size={22} /></div><p className="eyebrow">FREE REFILL</p><h2>Give {pending.name} 1 free refill?</h2><p className="muted">This uses 11 points. {Math.max(pending.loyalty_points - FREE_REFILL_POINTS, 0)} point{pending.loyalty_points - FREE_REFILL_POINTS === 1 ? '' : 's'} will stay on the account.</p><div className="modal-actions"><button type="button" className="outline-button" onClick={() => setPending(null)} disabled={claiming}>Cancel</button><button type="button" className="primary-button" onClick={() => void giveFreeRefill()} disabled={claiming}>{claiming ? 'Saving...' : 'Give 1 free refill'}</button></div></div></div>}
  </>;
}

function CustomersView({ customers, products, sales, borrowed, setBorrowed, setCustomers, setSales, setToast }: { customers: Customer[]; products: Product[]; sales: Sale[]; borrowed: BorrowedContainer[]; setBorrowed: (value: BorrowedContainer[] | ((current: BorrowedContainer[]) => BorrowedContainer[])) => void; setCustomers: (items: Customer[]) => void; setSales: (items: Sale[]) => void; setToast: (message: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [historyLines, setHistoryLines] = useState<SaleLine[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [returnCustomer, setReturnCustomer] = useState<Customer | null>(null);
  const [selectedReturns, setSelectedReturns] = useState<string[]>([]);
  const [returning, setReturning] = useState(false);
  const [formError, setFormError] = useState('');
  const closeForm = () => { if (!saving) { setIsOpen(false); setName(''); setEmail(''); setPhone(''); setFormError(''); } };
  const addCustomer = async () => {
    const trimmed = exactCustomerName(name);
    const nextEmail = email.trim();
    if (!trimmed) { setFormError('Enter the customer name.'); return; }
    if (nextEmail && !nextEmail.includes('@')) { setFormError('Enter a valid email.'); return; }
    if (customers.some((item) => exactCustomerName(item.name) === trimmed)) { setFormError('This exact name is already on the customer list.'); return; }
    setSaving(true);
    const { data: existingRows, error: lookupError } = await supabase.from('station_customers').select('id,name').eq('name', trimmed);
    if (lookupError) { setSaving(false); setFormError('Customer could not be checked. Try again.'); return; }
    if ((existingRows ?? []).some((row) => exactCustomerName(row.name) === trimmed)) { setSaving(false); setFormError('This exact name is already on the customer list.'); return; }
    const { data, error } = await insertStationCustomer({ name: trimmed, phone: phone.trim() || null, email: nextEmail || null, loyalty_points: 0, refill_count: 0, total_spent: 0, last_visit_at: null });
    setSaving(false);
    if (error && isExactNameConflict(error.message)) { setFormError('This exact name is already on the customer list.'); return; }
    if (error || !data) { setFormError(error?.message ? `Customer could not be saved. ${error.message}` : 'Customer could not be saved.'); return; }
    setCustomers([normalizeCustomer(data), ...customers]);
    setToast(`${trimmed} was added to the customer list.`);
    setIsOpen(false);
    setName('');
    setEmail('');
    setPhone('');
    setFormError('');
  };
  const openHistory = async (customer: Customer) => {
    setHistoryCustomer(customer);
    setHistoryLines([]);
    const ids = sales.filter((sale) => sale.customer_id === customer.id).map((sale) => sale.id);
    if (!ids.length) return;
    setHistoryLoading(true);
    const { data, error } = await supabase.from('station_sale_items').select('sale_id,product_name,quantity,product_id').in('sale_id', ids);
    setHistoryLoading(false);
    if (error) { setToast('Order history could not be loaded.'); return; }
    setHistoryLines(data ?? []);
  };
  const removeCustomer = async () => {
    if (!pendingDelete) return;
    const customer = pendingDelete;
    setDeleting(true);
    const { error } = await supabase.from('station_customers').delete().eq('id', customer.id);
    setDeleting(false);
    if (error) { setToast('Customer could not be removed.'); return; }
    setCustomers(customers.filter((item) => item.id !== customer.id));
    setSales(sales.map((sale) => sale.customer_id === customer.id ? { ...sale, customer_id: null } : sale));
    if (historyCustomer?.id === customer.id) setHistoryCustomer(null);
    setPendingDelete(null);
    setToast(`${customer.name} was removed.`);
  };
  const markPaid = async (sale: Sale) => {
    if (!historyCustomer || payingId) return;
    setPayingId(sale.id);
    const { error } = await supabase.from('station_sales').update({ status: 'paid', payment_method: 'Paid' }).eq('id', sale.id);
    if (error) { setPayingId(null); setToast('This order could not be marked as paid.'); return; }
    const earned = refillPoints(historyLines.filter((line) => line.sale_id === sale.id).map((line) => { const product = products.find((item) => item.id === line.product_id); return { category: product?.category ?? '', earns_points: product?.earns_points, quantity: Number(line.quantity) }; }));
    const current = customers.find((item) => item.id === historyCustomer.id) ?? historyCustomer;
    const patch = { loyalty_points: current.loyalty_points + earned, refill_count: current.refill_count + earned, total_spent: Number(current.total_spent) + Number(sale.total || 0), last_visit_at: new Date().toISOString() };
    const { error: updateError } = await updateStationCustomer(current.id, patch);
    setSales(sales.map((item) => item.id === sale.id ? { ...item, status: 'paid', payment_method: 'Paid' } : item));
    if (!updateError) {
      const saved = { ...current, ...patch };
      setCustomers(customers.map((item) => item.id === saved.id ? saved : item));
      setHistoryCustomer(saved);
    }
    setPayingId(null);
    setToast(updateError ? 'Order marked as paid, but points could not be updated.' : earned ? `${current.name}'s order is paid. ${earned} point${earned === 1 ? '' : 's'} added.` : `${current.name}'s order is marked as paid.`);
  };
  const openBorrowed = (customerId: string) => borrowed.filter((item) => item.customer_id === customerId && !item.returned_at);
  const openReturn = (customer: Customer) => { setReturnCustomer(customer); setSelectedReturns([]); };
  const markReturned = async (ids: string[]) => {
    if (!ids.length || returning) return;
    setReturning(true);
    const stamp = new Date().toISOString();
    const { error } = await supabase.from('station_borrowed_containers').update({ returned_at: stamp }).in('id', ids);
    setReturning(false);
    if (error) { setToast('Containers could not be marked as returned.'); return; }
    setBorrowed((current) => current.map((item) => ids.includes(item.id) ? { ...item, returned_at: stamp } : item));
    setToast(ids.length === 1 ? '1 container returned.' : `${ids.length} containers returned.`);
    setReturnCustomer(null);
    setSelectedReturns([]);
  };
  const needle = query.trim().toLowerCase();
  const visible = [...customers].filter((customer) => `${customer.name} ${customer.email ?? ''} ${customer.phone ?? ''}`.toLowerCase().includes(needle)).sort((a, b) => a.name.localeCompare(b.name));
  const lastOrder = (customerId: string) => sales.find((sale) => sale.customer_id === customerId);
  const historyOrders = historyCustomer ? sales.filter((sale) => sale.customer_id === historyCustomer.id) : [];
  const linesFor = (saleId: string) => historyLines.filter((line) => line.sale_id === saleId).map((line) => `${Number(line.quantity)}× ${line.product_name}`).join(', ');
  const orderStamp = (value: string) => new Date(value).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const returnOpen = returnCustomer ? openBorrowed(returnCustomer.id) : [];
  const toggleReturn = (id: string) => setSelectedReturns((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return <>
    <section className="panel table-panel">
      <div className="table-toolbar">
        <div><h2>All customers</h2><p className="muted">{customers.length} customer{customers.length === 1 ? '' : 's'}. Added here or from the POS.</p></div>
        <div className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or number" /></div>
        <button className="outline-button" type="button" onClick={() => setIsOpen(true)}><Plus size={16} /> Add customer</button>
      </div>
      <div className="table-scroll">
        <table className="customer-table stack-table">
          <thead><tr><th>Name</th><th>Email</th><th>Contact no.</th><th>Last order</th><th /></tr></thead>
          <tbody>{visible.length ? visible.map((customer) => {
            const latest = lastOrder(customer.id);
            const borrowedOpen = openBorrowed(customer.id);
            return <tr key={customer.id}>
              <td data-label="Name"><div className="customer-cell"><div className="customer-avatar">{customer.name.slice(0, 2).toUpperCase()}</div><strong>{customer.name}</strong>{unpaidTotal(sales, customer.id) > 0 && <span className="status-pill attention">Unpaid order</span>}{borrowedOpen.length > 0 && <span className="status-pill borrowed">Borrowed</span>}</div></td>
              <td data-label="Email">{customer.email || '—'}</td>
              <td data-label="Contact no.">{customer.phone || '—'}</td>
              <td data-label="Last order">{latest ? `${shortDate(latest.created_at)} · ${money(Number(latest.total))}` : 'No orders yet'}</td>
              <td className="row-actions" data-label="Actions">{borrowedOpen.length > 0 && <button type="button" className="outline-button" onClick={() => openReturn(customer)}>Return</button>}<button type="button" className="outline-button" onClick={() => void openHistory(customer)}><Receipt size={14} /> History</button><button type="button" className="text-danger" onClick={() => setPendingDelete(customer)}><Trash2 size={14} /> Delete</button></td>
            </tr>;
          }) : <tr><td colSpan={5}>{customers.length ? 'No customers match this search.' : 'No customers yet. Add one here or enter a name on the next POS order.'}</td></tr>}</tbody>
        </table>
      </div>
    </section>
    {isOpen && <div className="modal-backdrop" onClick={closeForm}><form className="product-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void addCustomer(); }}><p className="eyebrow">NEW CUSTOMER</p><h2>Add a customer</h2><p className="muted">They can earn points the next time you record a paid refill under this name.</p><div className="product-form"><label className="product-span">Customer name<input value={name} onChange={(event) => { setName(event.target.value); setFormError(''); }} placeholder="Juan Cruz" /></label>{formError && <p className="auth-alert" role="alert">{formError}</p>}<label className="product-span">Email<input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setFormError(''); }} placeholder="name@email.com" /></label><label className="product-span">Contact no.<input value={phone} onChange={(event) => { setPhone(event.target.value); setFormError(''); }} inputMode="tel" placeholder="09xxxxxxxxx" /></label></div><div className="modal-actions"><button type="button" className="outline-button" onClick={closeForm} disabled={saving}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save customer'}</button></div></form></div>}
    {historyCustomer && <div className="modal-backdrop" onClick={() => setHistoryCustomer(null)}><div className="product-modal history-modal" onClick={(event) => event.stopPropagation()}><p className="eyebrow">ORDER HISTORY</p><h2>{historyCustomer.name}</h2><p className="muted">{historyCustomer.email || 'No email'} · {historyCustomer.phone || 'No contact number'}</p>{historyLoading ? <div className="empty-state">Loading orders...</div> : historyOrders.length ? <div className="history-list">{historyOrders.map((sale) => <div className="history-order" key={sale.id}><div><strong>{orderStamp(sale.created_at)}</strong><span>{linesFor(sale.id) || 'Items not recorded'}</span></div><strong className="history-total">{money(Number(sale.total))}</strong><span className={`status-pill ${isUnpaid(sale) ? 'attention' : ''}`}>{isUnpaid(sale) ? 'Unpaid' : 'Paid'}</span>{isUnpaid(sale) && <button type="button" className="primary-button history-pay" onClick={() => void markPaid(sale)} disabled={payingId === sale.id}>{payingId === sale.id ? 'Saving...' : 'Mark as paid'}</button>}</div>)}</div> : <div className="empty-state">No orders yet for this customer.</div>}<div className="modal-actions"><button type="button" className="outline-button" onClick={() => setHistoryCustomer(null)}>Close</button></div></div></div>}
    {returnCustomer && <div className="modal-backdrop" onClick={() => { if (!returning) setReturnCustomer(null); }}><div className="product-modal" onClick={(event) => event.stopPropagation()}><p className="eyebrow">BORROWED CONTAINERS</p><h2>{returnCustomer.name}</h2><p className="muted">Select the codes to return, or return all of them.</p>{returnOpen.length ? <div className="return-list">{returnOpen.map((item) => <label className="return-item" key={item.id}><input type="checkbox" checked={selectedReturns.includes(item.id)} onChange={() => toggleReturn(item.id)} />{item.container_code}</label>)}</div> : <div className="empty-state">No borrowed containers left.</div>}<div className="modal-actions"><button type="button" className="outline-button" onClick={() => setReturnCustomer(null)} disabled={returning}>Cancel</button><button type="button" className="outline-button" onClick={() => void markReturned(selectedReturns)} disabled={returning || !selectedReturns.length}>{returning ? 'Saving...' : 'Return selected'}</button><button type="button" className="primary-button" onClick={() => void markReturned(returnOpen.map((item) => item.id))} disabled={returning || !returnOpen.length}>Return all</button></div></div></div>}
    {pendingDelete && <div className="modal-backdrop" onClick={() => { if (!deleting) setPendingDelete(null); }}><div className="product-modal confirm-modal" onClick={(event) => event.stopPropagation()}><div className="confirm-icon"><Trash2 size={22} /></div><p className="eyebrow">REMOVE CUSTOMER</p><h2>Remove {pendingDelete.name}?</h2><p className="muted">They leave the customer list and their loyalty points. Past orders stay in sales.</p><div className="delete-customer-card"><div className="customer-avatar large">{pendingDelete.name.slice(0, 2).toUpperCase()}</div><div><strong>{pendingDelete.name}</strong><span>{pendingDelete.phone || 'No contact number'}</span></div></div><div className="modal-actions"><button type="button" className="outline-button" onClick={() => setPendingDelete(null)} disabled={deleting}>Cancel</button><button type="button" className="danger-button" onClick={() => void removeCustomer()} disabled={deleting}>{deleting ? 'Removing...' : 'Remove customer'}</button></div></div></div>}
  </>;
}

const expenseCategories = ['Water Bill', 'Electric Bill', 'Internet', 'Gas', 'Foods', 'Others'];

function ExpensesView({ expenses, setExpenses, setToast }: { expenses: Expense[]; setExpenses: (items: Expense[]) => void; setToast: (message: string) => void }) {
  const [category, setCategory] = useState(expenseCategories[0]);
  const [otherName, setOtherName] = useState('');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(dayKey(new Date()));
  const addExpense = async () => {
    const value = Number(amount);
    if (!amount || !Number.isFinite(value) || value <= 0) {
      setToast('Enter an amount greater than zero.');
      return;
    }
    if (!expenseDate) {
      setToast('Select the expense date.');
      return;
    }
    const customName = otherName.trim();
    if (category === 'Others' && !customName) {
      setToast('Enter what this expense is for.');
      return;
    }
    const payload = { title: category === 'Others' ? customName : category, category, amount: value, expense_date: expenseDate, notes: notes.trim() || null };
    const { data, error } = await supabase.from('station_expenses').insert(payload).select('id,title,category,amount,expense_date,notes').maybeSingle();
    if (error || !data) {
      setToast('Expense could not be saved.');
      return;
    }
    setExpenses([data, ...expenses].sort((a, b) => b.expense_date.localeCompare(a.expense_date)));
    setOtherName('');
    setNotes('');
    setAmount('');
    setExpenseDate(dayKey(new Date()));
    setToast('Expense added to your records.');
  };
  return <div className="expenses-grid"><section className="panel expense-form"><p className="eyebrow">NEW EXPENSE</p><h2>Keep every peso accounted for.</h2><p className="muted">Log utilities, supplies, delivery, and other operating costs.</p><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{expenseCategories.map((item) => <option key={item}>{item}</option>)}</select></label>{category === 'Others' && <label>Expense name<input value={otherName} onChange={(event) => setOtherName(event.target.value)} placeholder="What is this expense?" /></label>}<label>Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional details" /></label><label>Amount<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="₱ 0.00" /></label><label>Date<input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} /></label><button className="primary-button full" onClick={addExpense}><Plus size={17} /> Add expense</button></section><section className="panel table-panel"><PanelHeader title="Recent expenses" action="This month" /><div className="expense-list">{expenses.length ? expenses.map((expense) => { const detail = expense.notes || (expense.category !== expense.title ? expense.category : ''); return <div className="expense-row" key={expense.id}><div className="expense-icon"><Wallet size={17} /></div><div><strong>{expense.title}</strong><span>{detail ? `${detail} · ${shortDate(expense.expense_date)}` : shortDate(expense.expense_date)}</span></div><strong>{money(Number(expense.amount))}</strong></div>; }) : <div className="empty-state">No expenses recorded yet.</div>}</div></section></div>;
}

function SettingsView({ session, section, setSection, darkMode, setDarkMode, notify, setNotify, setToast }: { session: Session; section: SettingsSection; setSection: (section: SettingsSection) => void; darkMode: boolean; setDarkMode: (value: boolean) => void; notify: NotifyPrefs; setNotify: (patch: Partial<NotifyPrefs>) => void; setToast: (message: string) => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('');
  const [ownerName, setOwnerName] = useState(typeof session.user.user_metadata.full_name === 'string' ? session.user.user_metadata.full_name : '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void supabase.from('station_settings').select('station_name,address,phone,opening_hours').eq('id', 1).maybeSingle().then(({ data }) => {
      if (!data) return;
      setName(data.station_name ?? '');
      setAddress(data.address ?? '');
      setPhone(data.phone ?? '');
      setHours(data.opening_hours ?? '');
    });
  }, []);
  const saveGeneral = async () => {
    const { error } = await supabase.from('station_settings').upsert({ id: 1, station_name: name, address, phone, opening_hours: hours });
    setToast(error ? 'Settings could not be saved.' : 'General settings saved.');
  };
  const saveAccount = async () => {
    const trimmed = ownerName.trim();
    if (!trimmed) { setToast('Enter your name.'); return; }
    if (password && password.length < 6) { setToast('Use a password with at least 6 characters.'); return; }
    if (password !== confirmPassword) { setToast('Those passwords do not match.'); return; }
    setSaving(true);
    const payload: { password?: string; data: { full_name: string } } = { data: { full_name: trimmed } };
    if (password) payload.password = password;
    const { error } = await supabase.auth.updateUser(payload);
    if (error) { setSaving(false); setToast(error.message); return; }
    await supabase.from('station_owners').update({ full_name: trimmed }).eq('id', session.user.id);
    setSaving(false);
    setPassword('');
    setConfirmPassword('');
    setToast('Account settings saved.');
  };
  return <section className="panel settings-panel">
    <div className="settings-menu">
      {(['general', 'account', 'notifications'] as SettingsSection[]).map((item) => <button type="button" key={item} className={section === item ? 'selected' : ''} onClick={() => setSection(item)}>{settingsCopy[item].title}</button>)}
      <div className="nav-toggle settings-theme"><span>Dark mode <em>{darkMode ? 'On' : 'Off'}</em></span><label className="theme-switch"><input type="checkbox" checked={darkMode} onChange={(event) => setDarkMode(event.target.checked)} aria-label="Dark mode" /><i /></label></div>
    </div>
    {section === 'general' && <><div className="settings-heading"><div className="settings-logo"><Droplets size={27} /></div><div><p className="eyebrow">GENERAL SETTINGS</p><h2>Make it yours.</h2><p className="muted">These details appear across your station workspace.</p></div></div><div className="settings-form"><label>Station name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Address<input value={address} onChange={(event) => setAddress(event.target.value)} /></label><label>Contact number<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label>Operating hours<input value={hours} onChange={(event) => setHours(event.target.value)} /></label></div><div className="settings-footer"><span>Saved to your station profile</span><button className="primary-button" onClick={() => void saveGeneral()}>Save changes</button></div></>}
    {section === 'account' && <><div className="settings-heading"><div className="settings-logo"><UserRound size={27} /></div><div><p className="eyebrow">ACCOUNT SETTINGS</p><h2>Owner account</h2><p className="muted">Leave the password blank if you only want to change the name. The email cannot be changed.</p></div></div><div className="settings-form"><label>Full name<input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} /></label><label>Email<input type="email" value={session.user.email ?? ''} readOnly disabled aria-readonly="true" /></label><label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" autoComplete="new-password" /></label><label>Confirm password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat the new password" autoComplete="new-password" /></label></div><div className="settings-footer"><span>{session.user.email}</span><button className="primary-button" onClick={() => void saveAccount()} disabled={saving}>{saving ? 'Saving...' : 'Save account'}</button></div></>}
    {section === 'notifications' && <><div className="settings-heading"><div className="settings-logo"><Bell size={27} /></div><div><p className="eyebrow">NOTIFICATION</p><h2>Alerts for this station</h2><p className="muted">Turn a reminder off if you do not want it to pop up.</p></div></div><div className="settings-switches"><div className="nav-toggle"><div><strong>Low stock</strong><span>Remind once a day when an item is at {LOW_STOCK_LEVEL} or below.</span></div><label className="theme-switch"><input type="checkbox" checked={notify.lowStock} onChange={(event) => setNotify({ lowStock: event.target.checked })} aria-label="Low stock alerts" /><i /></label></div><div className="nav-toggle"><div><strong>Unpaid orders</strong><span>Remind once a day when a customer still has an unpaid balance.</span></div><label className="theme-switch"><input type="checkbox" checked={notify.unpaid} onChange={(event) => setNotify({ unpaid: event.target.checked })} aria-label="Unpaid order alerts" /><i /></label></div></div></>}
  </section>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!ready) return <AuthLoading />;
  if (!session) return <AuthPage />;
  return <StationWorkspace key={session.user.id} session={session} />;
}

export default App;
