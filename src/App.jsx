import React, { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Package, Users, ShoppingCart, Plus, Search, Edit2, Trash2, Check, X, 
  Eye, FileText, Truck, Clock, Leaf, Building2, UtensilsCrossed, BarChart3, 
  Euro, ArrowUpRight, ArrowDownRight, Menu, Bell, LogOut, 
  MapPin, Sprout, Sun, AlertTriangle, CheckCircle, Calendar,
  Phone, Mail, Receipt, Layers, Loader2, User, Lock, Eye as EyeIcon, EyeOff,
  Wallet, TrendingUp, Send, FileDown, AlertCircle, Printer,
  CreditCard, MoreVertical, Zap, List, Table, FileSpreadsheet, LayoutGrid,
  Target, UserPlus, Upload, Map, Filter, Download, RefreshCw, Star, TrendingDown,
  Moon, Repeat, History, BellRing, XCircle, Settings, Navigation, ChevronDown
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

// ==================== SUPABASE CONFIG ====================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== DATOS DE EMPRESA ====================
const EMPRESA = {
  nombre: 'ROOTFLOW HYDROPONICS SL',
  direccion: 'C. Nueva, 16, P6',
  cp: '28231',
  ciudad: 'Las Rozas de Madrid, Madrid',
  telefono: '+34 638 161 990',
  email: 'info@rootflow.es',
  web: 'www.rootflow.es',
  cif: 'B27535137'
};

// ==================== ROOTFLOW LOGO OFICIAL ====================
const LOGO_URL = 'https://www.rootflow.es/lovable-uploads/70262e87-198c-4788-b2e9-7b89bef45202.png';

const RootFlowLogo = ({ size = 40, showERP = true }) => (
  <div className="relative">
    <img 
      src={LOGO_URL} 
      alt="RootFlow" 
      style={{ width: size, height: 'auto' }}
      className="object-contain"
    />
    {showERP && <span className="absolute -bottom-1 -right-1 bg-neutral-900 text-white text-[8px] font-black px-1.5 py-0.5 rounded">ERP</span>}
  </div>
);

const RootFlowLogoFull = ({ showERP = true }) => (
  <div className="flex items-center gap-3">
    <RootFlowLogo size={36} showERP={showERP} />
    <div>
      <h1 className="font-black text-lg tracking-tight"><span className="text-neutral-900">Root</span><span className="text-orange-500">Flow</span></h1>
      <p className="text-[9px] text-neutral-400 tracking-wider uppercase">Hydroponics</p>
    </div>
  </div>
);

// Logo para facturas (sin badge ERP)
const RootFlowLogoFactura = () => (
  <img 
    src={LOGO_URL} 
    alt="RootFlow" 
    style={{ width: 60, height: 'auto' }}
  />
);

// ==================== AUTH CONTEXT ====================
const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

const ALLOWED_DOMAIN = 'rootflow.es';

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUserProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUserProfile(session.user.id);
      else setUserProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId) => {
    const { data } = await supabase.from('usuarios').select('*').eq('id', userId).single();
    setUserProfile(data);
  };

  const validateEmail = (email) => {
    const domain = email.split('@')[1];
    return domain === ALLOWED_DOMAIN;
  };

  const signIn = async (email, password) => {
    if (!validateEmail(email)) {
      return { data: null, error: { message: `Solo se permiten emails de @${ALLOWED_DOMAIN}` } };
    }
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email, password, nombre) => {
    if (!validateEmail(email)) {
      return { data: null, error: { message: `Solo se permiten emails de @${ALLOWED_DOMAIN}` } };
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (data?.user && !error) {
      await supabase.from('usuarios').insert({ id: data.user.id, email, nombre, rol: 'socio' });
    }
    return { data, error };
  };

  const signOut = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signIn, signUp, signOut, supabase }}>
      {children}
    </AuthContext.Provider>
  );
};

// ==================== REALTIME HOOK ====================
const useRealtime = (table) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      const { data: d, error: e } = await supabase.from(table).select('*').order('created_at', { ascending: false });
      if (e) {
        console.warn(`Error cargando ${table}:`, e.message);
        setError(e);
        setData([]);
      } else {
        setData(d || []);
      }
    } catch (err) {
      console.warn(`Error en ${table}:`, err);
      setData([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const subscription = supabase
      .channel(`${table}_realtime_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        // Refetch en lugar de actualizar parcialmente (más confiable)
        fetchData();
      })
      .subscribe();

    return () => subscription.unsubscribe();
  }, [table]);

  return { data, loading, setData, error, refetch: fetchData };
};

// ==================== HELPERS ====================
const formatCurrency = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const formatDateShort = (d) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '-';

const CHART_COLORS = ['#F97316', '#22C55E', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B'];

// Coordenadas aproximadas por código postal de Madrid
const MADRID_CP_COORDS = {
  '28001': { lat: 40.4234, lng: -3.6883, name: 'Salamanca' },
  '28002': { lat: 40.4398, lng: -3.6773, name: 'Guindalera' },
  '28003': { lat: 40.4412, lng: -3.7058, name: 'Trafalgar' },
  '28004': { lat: 40.4262, lng: -3.7012, name: 'Justicia' },
  '28005': { lat: 40.4089, lng: -3.7123, name: 'La Latina' },
  '28006': { lat: 40.4356, lng: -3.6812, name: 'Recoletos' },
  '28007': { lat: 40.4089, lng: -3.6723, name: 'Ibiza' },
  '28008': { lat: 40.4234, lng: -3.7189, name: 'Argüelles' },
  '28009': { lat: 40.4189, lng: -3.6723, name: 'Retiro' },
  '28010': { lat: 40.4312, lng: -3.7012, name: 'Alonso Martínez' },
  '28013': { lat: 40.4189, lng: -3.7089, name: 'Gran Vía' },
  '28014': { lat: 40.4156, lng: -3.6956, name: 'Cortes' },
  '28015': { lat: 40.4289, lng: -3.7123, name: 'Universidad' },
  '28016': { lat: 40.4512, lng: -3.6789, name: 'Hispanoamérica' },
  '28020': { lat: 40.4589, lng: -3.6923, name: 'Castillejos' },
  '28023': { lat: 40.4712, lng: -3.7856, name: 'Aravaca' },
  '28033': { lat: 40.4789, lng: -3.6423, name: 'Pinar del Rey' },
  '28036': { lat: 40.4623, lng: -3.6889, name: 'Nueva España' },
  '28043': { lat: 40.4623, lng: -3.6523, name: 'Piovera' },
  '28046': { lat: 40.4689, lng: -3.6956, name: 'AZCA' },
  '28053': { lat: 40.3756, lng: -3.6523, name: 'Mercamadrid' },
};

const getCoordsByCP = (cp) => MADRID_CP_COORDS[cp] || { lat: 40.4168, lng: -3.7038, name: 'Madrid Centro' };

// ==================== EXPORT TO EXCEL ====================
const exportToExcel = (data, filename, columns) => {
  const exportData = data.map(item => {
    const row = {};
    columns.forEach(col => { row[col.header] = col.accessor(item); });
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  ws['!cols'] = columns.map(col => ({ wch: Math.max(col.header.length, 15) }));
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// ==================== SOCIOS/EMPLEADOS ====================
const SOCIOS = [
  { id: 'nico', nombre: 'Nico', color: 'bg-blue-100 text-blue-700' },
  { id: 'peri', nombre: 'Peri', color: 'bg-green-100 text-green-700' },
  { id: 'guzman', nombre: 'Guzmán', color: 'bg-purple-100 text-purple-700' },
];

// ==================== CONFIGS ====================
const estadoConfig = {
  pendiente: { label: "Pendiente", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  en_preparacion: { label: "Preparando", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Package },
  enviado: { label: "Enviado", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Truck },
  entregado: { label: "Entregado", color: "bg-green-100 text-green-700 border-green-200", icon: Check },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700 border-red-200", icon: X },
};

const estadoFacturaConfig = {
  pendiente: { label: "Pendiente", color: "bg-amber-100 text-amber-700" },
  pagada: { label: "Pagada", color: "bg-green-100 text-green-700" },
  vencida: { label: "Vencida", color: "bg-red-100 text-red-700" },
  cancelada: { label: "Cancelada", color: "bg-neutral-100 text-neutral-700" },
};

const estadoLoteConfig = {
  sembrado: { label: "Sembrado", color: "bg-amber-100 text-amber-700", icon: Sprout },
  creciendo: { label: "Creciendo", color: "bg-green-100 text-green-700", icon: Sun },
  cosechado: { label: "Cosechado", color: "bg-blue-100 text-blue-700", icon: Check },
  descartado: { label: "Descartado", color: "bg-red-100 text-red-700", icon: X },
};

const estadoLeadConfig = {
  nuevo: { label: "Nuevo", color: "bg-blue-100 text-blue-700", icon: Star },
  contactado: { label: "Contactado", color: "bg-purple-100 text-purple-700", icon: Phone },
  interesado: { label: "Interesado", color: "bg-amber-100 text-amber-700", icon: Target },
  negociando: { label: "Negociando", color: "bg-orange-100 text-orange-700", icon: TrendingUp },
  ganado: { label: "Ganado", color: "bg-green-100 text-green-700", icon: Check },
  perdido: { label: "Perdido", color: "bg-red-100 text-red-700", icon: X },
};

const tipoClienteConfig = {
  mercamadrid: { label: "Mercamadrid (Mayorista)", icon: Building2, color: "text-orange-600 bg-orange-50 border-orange-200" },
  hotel: { label: "Hotel (HORECA)", icon: Building2, color: "text-blue-600 bg-blue-50 border-blue-200" },
  restaurante: { label: "Restaurante (HORECA)", icon: UtensilsCrossed, color: "text-green-600 bg-green-50 border-green-200" },
  catering: { label: "Catering (HORECA)", icon: Truck, color: "text-purple-600 bg-purple-50 border-purple-200" },
  tienda: { label: "Tienda/Frutería (Minorista)", icon: Package, color: "text-pink-600 bg-pink-50 border-pink-200" },
  otro: { label: "Otro", icon: MoreVertical, color: "text-neutral-600 bg-neutral-50 border-neutral-200" },
};

// Tipos de IVA en España
const TIPOS_IVA = {
  general: { valor: 21, label: '21% General', re: 5.2 },
  reducido: { valor: 10, label: '10% Reducido', re: 1.4 },
  superreducido: { valor: 4, label: '4% Superreducido (Alimentos)', re: 0.5 },
  exento: { valor: 0, label: '0% Exento', re: 0 },
};

// IVA para productos alimenticios (microbrotes) = 4%
const IVA_VENTAS = 4; // Superreducido para alimentos
const RE_VENTAS = 0.5; // Recargo de equivalencia para alimentos

const zonaConfig = {
  norte: { label: "Norte", color: "bg-sky-100 text-sky-700" },
  centro: { label: "Centro", color: "bg-violet-100 text-violet-700" },
  sur: { label: "Sur", color: "bg-rose-100 text-rose-700" },
  este: { label: "Este", color: "bg-emerald-100 text-emerald-700" },
  oeste: { label: "Oeste", color: "bg-amber-100 text-amber-700" },
  mercamadrid: { label: "Mercamadrid", color: "bg-orange-100 text-orange-700" },
};

const origenLeadConfig = {
  web: { label: "Web", color: "bg-blue-100 text-blue-700" },
  referido: { label: "Referido", color: "bg-green-100 text-green-700" },
  feria: { label: "Feria", color: "bg-purple-100 text-purple-700" },
  llamada: { label: "Llamada", color: "bg-amber-100 text-amber-700" },
  email: { label: "Email", color: "bg-sky-100 text-sky-700" },
  redes: { label: "Redes", color: "bg-pink-100 text-pink-700" },
  importado: { label: "Importado", color: "bg-orange-100 text-orange-700" },
  otro: { label: "Otro", color: "bg-neutral-100 text-neutral-700" },
};

// Categorías de gasto alineadas con PGC español
const categoriasGasto = {
  semillas: { label: "🌱 Semillas/Materias primas (601)", icon: Sprout, color: "bg-green-100 text-green-700", cuenta: "601" },
  sustratos: { label: "🪴 Sustratos/Aprovisionamientos (602)", icon: Layers, color: "bg-amber-100 text-amber-700", cuenta: "602" },
  embalajes: { label: "📦 Embalajes y envases (602)", icon: Package, color: "bg-blue-100 text-blue-700", cuenta: "602" },
  alquiler: { label: "🏠 Alquiler local (621)", icon: Building2, color: "bg-neutral-100 text-neutral-700", cuenta: "621" },
  reparaciones: { label: "🔧 Reparaciones/Mantenimiento (622)", icon: AlertTriangle, color: "bg-orange-100 text-orange-700", cuenta: "622" },
  asesoria: { label: "👔 Asesoría/Gestoría (623)", icon: FileText, color: "bg-slate-100 text-slate-700", cuenta: "623" },
  transporte: { label: "🚚 Transporte/Logística (624)", icon: Truck, color: "bg-purple-100 text-purple-700", cuenta: "624" },
  seguros: { label: "🛡️ Seguros (625)", icon: FileText, color: "bg-teal-100 text-teal-700", cuenta: "625" },
  banco: { label: "🏦 Comisiones bancarias (626)", icon: Receipt, color: "bg-gray-100 text-gray-700", cuenta: "626" },
  publicidad: { label: "📣 Publicidad/Marketing (627)", icon: TrendingUp, color: "bg-indigo-100 text-indigo-700", cuenta: "627" },
  energia: { label: "💡 Suministros: Luz/Agua/Gas (628)", icon: Zap, color: "bg-yellow-100 text-yellow-700", cuenta: "628" },
  servicios: { label: "⚙️ Otros servicios (629)", icon: MoreVertical, color: "bg-cyan-100 text-cyan-700", cuenta: "629" },
  tributos: { label: "📋 Tributos e impuestos (631)", icon: Receipt, color: "bg-red-100 text-red-700", cuenta: "631" },
  nominas: { label: "👥 Sueldos y salarios (640)", icon: Users, color: "bg-pink-100 text-pink-700", cuenta: "640" },
  seguridad_social: { label: "🏥 Seg. Social empresa (642)", icon: Users, color: "bg-rose-100 text-rose-700", cuenta: "642" },
  software: { label: "💻 Software/IT (629)", icon: BarChart3, color: "bg-violet-100 text-violet-700", cuenta: "629" },
  formacion: { label: "📚 Formación (649)", icon: Star, color: "bg-emerald-100 text-emerald-700", cuenta: "649" },
  otros: { label: "📝 Otros gastos (629)", icon: MoreVertical, color: "bg-gray-100 text-gray-700", cuenta: "629" },
};

const prioridadTareaConfig = {
  alta: { label: "Alta", color: "bg-red-100 text-red-700" },
  media: { label: "Media", color: "bg-amber-100 text-amber-700" },
  baja: { label: "Baja", color: "bg-green-100 text-green-700" },
};

const categoriaTareaConfig = {
  cliente: { label: "Cliente", icon: Users, color: "bg-blue-100 text-blue-700" },
  produccion: { label: "Producción", icon: Sprout, color: "bg-green-100 text-green-700" },
  compras: { label: "Compras", icon: ShoppingCart, color: "bg-purple-100 text-purple-700" },
  admin: { label: "Admin", icon: FileText, color: "bg-neutral-100 text-neutral-700" },
  otro: { label: "Otro", icon: MoreVertical, color: "bg-gray-100 text-gray-700" },
};

const categoriaProveedorConfig = {
  semillas: { label: "Semillas", color: "bg-green-100 text-green-700" },
  sustratos: { label: "Sustratos", color: "bg-amber-100 text-amber-700" },
  envases: { label: "Envases", color: "bg-blue-100 text-blue-700" },
  equipamiento: { label: "Equipamiento", color: "bg-purple-100 text-purple-700" },
  servicios: { label: "Servicios", color: "bg-pink-100 text-pink-700" },
  transporte: { label: "Transporte", color: "bg-indigo-100 text-indigo-700" },
  tecnologia: { label: "Tecnología", color: "bg-violet-100 text-violet-700" },
  limpieza: { label: "Limpieza", color: "bg-teal-100 text-teal-700" },
  alimentacion: { label: "Alimentación", color: "bg-orange-100 text-orange-700" },
  otros: { label: "Otros", color: "bg-gray-100 text-gray-700" },
};

// ==================== UI COMPONENTS ====================
const Card = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-white rounded-2xl border border-neutral-200 shadow-sm ${className}`}>
    {children}
  </div>
);

const Button = ({ children, variant = "primary", size = "md", className = "", ...props }) => {
  const variants = {
    primary: "bg-orange-500 text-white hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/25",
    secondary: "bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50",
    ghost: "text-neutral-600 hover:bg-neutral-100",
    danger: "bg-red-500 text-white hover:bg-red-600",
    success: "bg-green-500 text-white hover:bg-green-600",
  };
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2.5", lg: "px-6 py-3 text-lg" };
  return (
    <button className={`font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Input = ({ label, icon: Icon, className = "", ...props }) => (
  <div className={className}>
    {label && <label className="block text-sm font-semibold text-neutral-700 mb-1.5">{label}</label>}
    <div className="relative">
      {Icon && <Icon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />}
      <input className={`w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-white`} {...props} />
    </div>
  </div>
);

const Select = ({ label, options, className = "", ...props }) => (
  <div className={className}>
    {label && <label className="block text-sm font-semibold text-neutral-700 mb-1.5">{label}</label>}
    <select className="w-full px-4 py-2.5 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white" {...props}>
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

const Badge = ({ children, variant = "default", className = "" }) => {
  const variants = {
    default: "bg-neutral-100 text-neutral-700",
    success: "bg-green-100 text-green-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
    info: "bg-blue-100 text-blue-700",
    orange: "bg-orange-100 text-orange-700",
  };
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}>{children}</span>;
};

const StatCard = ({ icon: Icon, label, value, subvalue, trend, color, onClick }) => (
  <Card className={`p-3 md:p-5 hover:shadow-md transition-all cursor-pointer ${onClick ? 'hover:-translate-y-1' : ''}`} onClick={onClick}>
    <div className="flex items-start justify-between">
      <div className={`p-2 md:p-3 rounded-xl ${color}`}><Icon size={18} className="md:w-[22px] md:h-[22px]" /></div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs md:text-sm font-bold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(trend)}%
        </div>
      )}
    </div>
    <div className="mt-2 md:mt-4">
      <p className="text-lg md:text-2xl font-black text-neutral-900 truncate">{value}</p>
      <p className="text-neutral-500 text-xs md:text-sm mt-0.5 font-medium truncate">{label}</p>
      {subvalue && <p className="text-xs text-neutral-400 mt-1 truncate">{subvalue}</p>}
    </div>
  </Card>
);

const Modal = ({ title, children, onClose, size = "max-w-2xl" }) => (
  <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 md:p-4" onClick={onClose}>
    <div className={`bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full ${size} max-h-[95vh] md:max-h-[90vh] overflow-hidden`} onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between p-4 md:p-5 border-b border-neutral-200">
        <h3 className="text-lg md:text-xl font-bold text-neutral-900">{title}</h3>
        <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-xl"><X size={20} /></button>
      </div>
      <div className="p-4 md:p-5 overflow-y-auto max-h-[calc(95vh-70px)] md:max-h-[calc(90vh-80px)]">{children}</div>
    </div>
  </div>
);

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-neutral-50">
    <div className="flex flex-col items-center gap-4">
      <RootFlowLogo size={80} />
      <div className="flex items-center gap-2">
        <Loader2 size={24} className="animate-spin text-orange-500" />
        <span className="text-neutral-600 font-semibold">Cargando...</span>
      </div>
    </div>
  </div>
);

const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4"><Icon size={32} className="text-neutral-400" /></div>
    <h3 className="text-lg font-bold text-neutral-800 mb-1">{title}</h3>
    <p className="text-neutral-500 text-sm mb-4 max-w-sm">{description}</p>
    {action}
  </div>
);

// ==================== VIEW SWITCHER ====================
const ViewSwitcher = ({ view, setView, onExport, showMap = false, onMapToggle }) => (
  <div className="flex items-center gap-2">
    <div className="flex items-center bg-neutral-100 rounded-xl p-1">
      <button onClick={() => setView('grid')} className={`p-2 rounded-lg transition-all ${view === 'grid' ? 'bg-white shadow-sm text-orange-600' : 'text-neutral-500 hover:text-neutral-700'}`} title="Cuadrícula"><LayoutGrid size={18} /></button>
      <button onClick={() => setView('list')} className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-white shadow-sm text-orange-600' : 'text-neutral-500 hover:text-neutral-700'}`} title="Lista"><List size={18} /></button>
      <button onClick={() => setView('table')} className={`p-2 rounded-lg transition-all ${view === 'table' ? 'bg-white shadow-sm text-orange-600' : 'text-neutral-500 hover:text-neutral-700'}`} title="Tabla"><Table size={18} /></button>
      {showMap && <button onClick={onMapToggle} className={`p-2 rounded-lg transition-all ${view === 'map' ? 'bg-white shadow-sm text-orange-600' : 'text-neutral-500 hover:text-neutral-700'}`} title="Mapa"><Map size={18} /></button>}
    </div>
    <Button variant="secondary" size="sm" onClick={onExport}><FileSpreadsheet size={16} /> Excel</Button>
  </div>
);

// ==================== MAP COMPONENT ====================
const MapView = ({ items, type = 'clientes' }) => {
  const groupedByCP = useMemo(() => {
    const groups = {};
    items.forEach(item => {
      const cp = item.codigo_postal || '28013';
      if (!groups[cp]) groups[cp] = { items: [], coords: getCoordsByCP(cp) };
      groups[cp].items.push(item);
    });
    return groups;
  }, [items]);

  const totalItems = items.length;
  const cpList = Object.keys(groupedByCP);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-neutral-900">Mapa de {type === 'clientes' ? 'Clientes' : 'Leads'}</h3>
            <p className="text-sm text-neutral-500">{totalItems} {type} en {cpList.length} zonas</p>
          </div>
          <Badge variant="orange"><MapPin size={14} /> Por Código Postal</Badge>
        </div>
        
        {/* Mapa visual simplificado */}
        <div className="relative bg-gradient-to-br from-green-50 to-blue-50 rounded-xl h-96 overflow-hidden border-2 border-neutral-200">
          {/* Grid de Madrid */}
          <div className="absolute inset-0 p-4">
            <div className="grid grid-cols-4 grid-rows-4 h-full gap-2">
              {Object.entries(groupedByCP).map(([cp, data]) => {
                const size = Math.min(60, 20 + data.items.length * 10);
                const color = type === 'clientes' ? 'bg-orange-500' : 'bg-green-500';
                return (
                  <div key={cp} className="relative flex items-center justify-center group cursor-pointer" style={{ gridColumn: Math.ceil(Math.random() * 4), gridRow: Math.ceil(Math.random() * 4) }}>
                    <div className={`${color} rounded-full flex items-center justify-center text-white font-bold shadow-lg transition-transform hover:scale-110`} style={{ width: size, height: size }}>
                      {data.items.length}
                    </div>
                    <div className="absolute bottom-full mb-2 bg-neutral-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      <p className="font-bold">{cp} - {data.coords.name}</p>
                      <p>{data.items.length} {type}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Leyenda */}
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg p-3 shadow">
            <p className="text-xs font-bold text-neutral-700 mb-2">Leyenda</p>
            <div className="flex items-center gap-2 text-xs">
              <div className={`w-4 h-4 rounded-full ${type === 'clientes' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
              <span>= {type}</span>
            </div>
            <p className="text-[10px] text-neutral-400 mt-1">Tamaño = cantidad</p>
          </div>
        </div>
      </Card>

      {/* Lista de zonas */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-neutral-100">
          <h4 className="font-bold text-neutral-900">Distribución por Código Postal</h4>
        </div>
        <div className="divide-y divide-neutral-100">
          {Object.entries(groupedByCP).sort((a, b) => b[1].items.length - a[1].items.length).map(([cp, data]) => (
            <div key={cp} className="p-4 flex items-center justify-between hover:bg-neutral-50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${type === 'clientes' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'} flex items-center justify-center font-bold`}>
                  {data.items.length}
                </div>
                <div>
                  <p className="font-semibold text-neutral-900">{cp} - {data.coords.name}</p>
                  <p className="text-xs text-neutral-500">{data.items.map(i => i.nombre).slice(0, 3).join(', ')}{data.items.length > 3 ? '...' : ''}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-neutral-700">{((data.items.length / totalItems) * 100).toFixed(0)}%</p>
                <div className="w-20 h-2 bg-neutral-200 rounded-full overflow-hidden">
                  <div className={`h-full ${type === 'clientes' ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${(data.items.length / totalItems) * 100}%` }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ==================== LOGIN PAGE ====================
const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    } else {
      if (!nombre.trim()) { setError('El nombre es obligatorio'); setLoading(false); return; }
      const { error } = await signUp(email, password, nombre);
      if (error) setError(error.message);
      else { setSuccess('¡Cuenta creada! Revisa tu email.'); setIsLogin(true); }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><RootFlowLogo size={80} /></div>
          <h1 className="text-3xl font-black"><span className="text-white">Root</span><span className="text-orange-500">Flow</span></h1>
          <p className="text-neutral-400 mt-1 font-medium">Sistema de Gestión ERP</p>
        </div>

        <Card className="p-8">
          <h2 className="text-2xl font-bold text-neutral-900 mb-1">{isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</h2>
          <p className="text-neutral-500 mb-6">{isLogin ? 'Accede a tu panel' : 'Únete al equipo'}</p>

          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2"><AlertTriangle size={16} />{error}</div>}
          {success && <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-600 text-sm flex items-center gap-2"><CheckCircle size={16} />{success}</div>}

          <div className="mb-4 p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-sm flex items-center gap-2">
            <Mail size={16} />
            <span>Solo emails <strong>@rootflow.es</strong></span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && <Input label="Nombre" icon={User} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" />}
            <Input label="Email corporativo" icon={Mail} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@rootflow.es" required />
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="••••••••" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                  {showPassword ? <EyeOff size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <><Loader2 size={20} className="animate-spin" />Procesando...</> : (isLogin ? 'Entrar' : 'Crear Cuenta')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }} className="text-sm text-orange-600 hover:text-orange-700 font-semibold">
              {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>
        </Card>

        <p className="text-center text-neutral-500 text-xs mt-6">© 2024 RootFlow · Microgreens Madrid</p>
      </div>
    </div>
  );
};

// ==================== MAIN APP ====================
const MainApp = () => {
  const { user, userProfile, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [filterEstado, setFilterEstado] = useState('todos');
  const [selectedFactura, setSelectedFactura] = useState(null);
  
  // Modo oscuro
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true';
    }
    return false;
  });
  
  // Panel de alertas
  const [showAlertasPanel, setShowAlertasPanel] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  // Dashboard - selector de periodo
  const [dashboardPeriodo, setDashboardPeriodo] = useState('mes_actual');
  
  // Facturas - filtros y selección
  const [filtroFacturasMes, setFiltroFacturasMes] = useState('todos');
  const [selectedFacturas, setSelectedFacturas] = useState([]);
  
  // Gastos - filtros y selección
  const [filtroGastosMes, setFiltroGastosMes] = useState('todos');
  const [selectedGastos, setSelectedGastos] = useState([]);
  
  // Selección múltiple para todas las secciones
  const [selectedClientes, setSelectedClientes] = useState([]);
  const [selectedProductos, setSelectedProductos] = useState([]);
  const [selectedPedidos, setSelectedPedidos] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [selectedProveedores, setSelectedProveedores] = useState([]);
  const [selectedTareas, setSelectedTareas] = useState([]);
  const [selectedLotes, setSelectedLotes] = useState([]);
  const [selectedAsientos, setSelectedAsientos] = useState([]);
  
  // Informes - periodo
  const [informesPeriodo, setInformesPeriodo] = useState('mes_actual');
  
  // Calendario - mes actual
  const [mesCalendario, setMesCalendario] = useState(new Date());
  
  // Rutas - fecha seleccionada
  const [fechaRuta, setFechaRuta] = useState(new Date().toISOString().split('T')[0]);
  
  // Refs para inputs de archivo
  const fileInputRef = useRef(null);
  
  const [viewClientes, setViewClientes] = useState('grid');
  const [viewLeads, setViewLeads] = useState('table');
  const [viewPedidos, setViewPedidos] = useState('table');
  const [viewProductos, setViewProductos] = useState('table');
  const [viewFacturas, setViewFacturas] = useState('table');
  const [viewGastos, setViewGastos] = useState('table');
  const [viewLotes, setViewLotes] = useState('table');

  // Estados de ordenación para tablas
  const [sortGastos, setSortGastos] = useState({ field: 'fecha', direction: 'desc' });
  const [sortFacturas, setSortFacturas] = useState({ field: 'fecha', direction: 'desc' });
  const [sortLeads, setSortLeads] = useState({ field: 'created_at', direction: 'desc' });

  // Función genérica de ordenación
  const sortData = (data, sortConfig) => {
    if (!sortConfig.field) return data;
    return [...data].sort((a, b) => {
      let aVal = a[sortConfig.field];
      let bVal = b[sortConfig.field];
      
      // Manejar valores nulos
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';
      
      // Detectar tipo y comparar
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      // Fechas (string ISO)
      if (sortConfig.field.includes('fecha') || sortConfig.field.includes('created') || sortConfig.field.includes('vencimiento')) {
        const dateA = new Date(aVal);
        const dateB = new Date(bVal);
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      // Strings
      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Componente cabecera ordenable
  const SortableHeader = ({ label, field, sortConfig, onSort }) => {
    const isActive = sortConfig.field === field;
    return (
      <th 
        className="text-left px-5 py-4 text-sm font-bold cursor-pointer hover:bg-neutral-800 select-none"
        onClick={() => onSort({ 
          field, 
          direction: isActive && sortConfig.direction === 'asc' ? 'desc' : 'asc' 
        })}
      >
        <div className="flex items-center gap-1">
          {label}
          <span className="text-neutral-400">
            {isActive ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        </div>
      </th>
    );
  };

  // ==================== SISTEMA DE FILTROS AVANZADO ====================
  const [filtrosActivos, setFiltrosActivos] = useState({});
  const [filtroAbierto, setFiltroAbierto] = useState(null);

  // Componente cabecera con filtro y ordenación
  const FilterableHeader = ({ label, field, sortConfig, onSort, filters, onFilter, options, type = 'text' }) => {
    const isActive = sortConfig?.field === field;
    const tieneFiltroPendiente = filters?.[field] && filters[field] !== '';
    const ref = useRef(null);
    
    // Cerrar al hacer clic fuera
    useEffect(() => {
      const handleClickOutside = (e) => {
        if (ref.current && !ref.current.contains(e.target)) {
          setFiltroAbierto(null);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <th className="text-left px-4 py-3 text-sm font-bold relative" ref={ref}>
        <div className="flex items-center gap-1">
          <span 
            className="cursor-pointer hover:text-orange-400 select-none flex items-center gap-1"
            onClick={() => onSort?.({ field, direction: isActive && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
          >
            {label}
            {onSort && (
              <span className="text-neutral-400 text-xs">
                {isActive ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
              </span>
            )}
          </span>
          <button 
            onClick={() => setFiltroAbierto(filtroAbierto === field ? null : field)}
            className={`p-1 rounded hover:bg-neutral-700 ${tieneFiltroPendiente ? 'text-orange-400' : 'text-neutral-500'}`}
          >
            <Filter size={12} />
          </button>
        </div>
        
        {filtroAbierto === field && (
          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-neutral-800 border rounded-xl shadow-xl z-50 p-3 min-w-[200px]">
            {type === 'select' && options ? (
              <select
                value={filters?.[field] || ''}
                onChange={e => { onFilter(field, e.target.value); setFiltroAbierto(null); }}
                className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-neutral-700 dark:border-neutral-600 dark:text-white"
              >
                <option value="">-- Todos --</option>
                {options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : type === 'date' ? (
              <div className="space-y-2">
                <input
                  type="date"
                  placeholder="Desde"
                  value={filters?.[`${field}_desde`] || ''}
                  onChange={e => onFilter(`${field}_desde`, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-neutral-700 dark:border-neutral-600 dark:text-white"
                />
                <input
                  type="date"
                  placeholder="Hasta"
                  value={filters?.[`${field}_hasta`] || ''}
                  onChange={e => onFilter(`${field}_hasta`, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-neutral-700 dark:border-neutral-600 dark:text-white"
                />
                <button 
                  onClick={() => { onFilter(`${field}_desde`, ''); onFilter(`${field}_hasta`, ''); setFiltroAbierto(null); }}
                  className="w-full text-xs text-red-500 hover:text-red-600"
                >
                  Limpiar
                </button>
              </div>
            ) : type === 'number' ? (
              <div className="space-y-2">
                <input
                  type="number"
                  placeholder="Mínimo"
                  value={filters?.[`${field}_min`] || ''}
                  onChange={e => onFilter(`${field}_min`, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-neutral-700 dark:border-neutral-600 dark:text-white"
                />
                <input
                  type="number"
                  placeholder="Máximo"
                  value={filters?.[`${field}_max`] || ''}
                  onChange={e => onFilter(`${field}_max`, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-neutral-700 dark:border-neutral-600 dark:text-white"
                />
                <button 
                  onClick={() => { onFilter(`${field}_min`, ''); onFilter(`${field}_max`, ''); setFiltroAbierto(null); }}
                  className="w-full text-xs text-red-500 hover:text-red-600"
                >
                  Limpiar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder={`Filtrar ${label}...`}
                  value={filters?.[field] || ''}
                  onChange={e => onFilter(field, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-neutral-700 dark:border-neutral-600 dark:text-white"
                  autoFocus
                />
                {filters?.[field] && (
                  <button 
                    onClick={() => { onFilter(field, ''); setFiltroAbierto(null); }}
                    className="w-full text-xs text-red-500 hover:text-red-600"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </th>
    );
  };

  // Función genérica para aplicar filtros a datos
  const aplicarFiltros = (data, filters, fieldGetters = {}) => {
    if (!filters || Object.keys(filters).length === 0) return data;
    
    return data.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        if (!value && value !== 0) return true;
        
        // Filtros de rango para fechas
        if (key.endsWith('_desde')) {
          const field = key.replace('_desde', '');
          const getter = fieldGetters[field] || (i => i[field]);
          const itemValue = getter(item);
          if (!itemValue) return true;
          return new Date(itemValue) >= new Date(value);
        }
        if (key.endsWith('_hasta')) {
          const field = key.replace('_hasta', '');
          const getter = fieldGetters[field] || (i => i[field]);
          const itemValue = getter(item);
          if (!itemValue) return true;
          return new Date(itemValue) <= new Date(value);
        }
        
        // Filtros de rango para números
        if (key.endsWith('_min')) {
          const field = key.replace('_min', '');
          const getter = fieldGetters[field] || (i => i[field]);
          const itemValue = getter(item);
          return itemValue >= parseFloat(value);
        }
        if (key.endsWith('_max')) {
          const field = key.replace('_max', '');
          const getter = fieldGetters[field] || (i => i[field]);
          const itemValue = getter(item);
          return itemValue <= parseFloat(value);
        }
        
        // Filtro de texto/selección normal
        const getter = fieldGetters[key] || (i => i[key]);
        const itemValue = getter(item);
        
        if (typeof itemValue === 'string') {
          return itemValue.toLowerCase().includes(value.toString().toLowerCase());
        }
        return itemValue === value || itemValue?.toString() === value.toString();
      });
    });
  };

  // Estados de filtros por sección
  const [filtrosClientes, setFiltrosClientes] = useState({});
  const [filtrosProductos, setFiltrosProductos] = useState({});
  const [filtrosPedidos, setFiltrosPedidos] = useState({});
  const [filtrosGastos, setFiltrosGastos] = useState({});
  const [filtrosFacturas, setFiltrosFacturas] = useState({});
  const [filtrosLeads, setFiltrosLeads] = useState({});
  const [filtrosProveedores, setFiltrosProveedores] = useState({});
  const [filtrosTareas, setFiltrosTareas] = useState({});
  const [filtrosLotes, setFiltrosLotes] = useState({});
  const [filtrosAsientos, setFiltrosAsientos] = useState({});

  // Función helper para actualizar filtros
  const updateFilter = (setter) => (field, value) => {
    setter(prev => ({ ...prev, [field]: value }));
  };

  // ==================== CONTABILIDAD PARTIDA DOBLE ====================
  // Plan General Contable para PYME agrícola (España)
  const PLAN_CUENTAS = {
    // Grupo 1 - Financiación básica
    '100': { nombre: 'Capital social', tipo: 'P', grupo: '1' },
    '112': { nombre: 'Reserva legal', tipo: 'P', grupo: '1' },
    '113': { nombre: 'Reservas voluntarias', tipo: 'P', grupo: '1' },
    '120': { nombre: 'Remanente', tipo: 'P', grupo: '1' },
    '121': { nombre: 'Resultados negativos ejercicios anteriores', tipo: 'P', grupo: '1' },
    '129': { nombre: 'Resultado del ejercicio', tipo: 'P', grupo: '1' },
    '170': { nombre: 'Deudas a L/P con entidades de crédito', tipo: 'P', grupo: '1' },
    '171': { nombre: 'Deudas a L/P', tipo: 'P', grupo: '1' },
    // Grupo 2 - Activo no corriente
    '206': { nombre: 'Aplicaciones informáticas', tipo: 'A', grupo: '2' },
    '210': { nombre: 'Terrenos y bienes naturales', tipo: 'A', grupo: '2' },
    '211': { nombre: 'Construcciones', tipo: 'A', grupo: '2' },
    '212': { nombre: 'Instalaciones técnicas', tipo: 'A', grupo: '2' },
    '213': { nombre: 'Maquinaria', tipo: 'A', grupo: '2' },
    '214': { nombre: 'Utillaje', tipo: 'A', grupo: '2' },
    '215': { nombre: 'Otras instalaciones', tipo: 'A', grupo: '2' },
    '216': { nombre: 'Mobiliario', tipo: 'A', grupo: '2' },
    '217': { nombre: 'Equipos informáticos', tipo: 'A', grupo: '2' },
    '218': { nombre: 'Elementos de transporte', tipo: 'A', grupo: '2' },
    '219': { nombre: 'Otro inmovilizado material', tipo: 'A', grupo: '2' },
    '280': { nombre: 'Amortización acum. inmov. intangible', tipo: 'XA', grupo: '2' },
    '281': { nombre: 'Amortización acum. inmov. material', tipo: 'XA', grupo: '2' },
    // Grupo 3 - Existencias
    '300': { nombre: 'Mercaderías', tipo: 'A', grupo: '3' },
    '310': { nombre: 'Materias primas (semillas)', tipo: 'A', grupo: '3' },
    '320': { nombre: 'Elementos y conjuntos incorporables', tipo: 'A', grupo: '3' },
    '326': { nombre: 'Embalajes', tipo: 'A', grupo: '3' },
    '327': { nombre: 'Envases', tipo: 'A', grupo: '3' },
    '328': { nombre: 'Material de oficina', tipo: 'A', grupo: '3' },
    '350': { nombre: 'Productos terminados (microbrotes)', tipo: 'A', grupo: '3' },
    // Grupo 4 - Acreedores y deudores
    '400': { nombre: 'Proveedores', tipo: 'P', grupo: '4' },
    '401': { nombre: 'Proveedores, efectos comerciales a pagar', tipo: 'P', grupo: '4' },
    '410': { nombre: 'Acreedores por prestación de servicios', tipo: 'P', grupo: '4' },
    '430': { nombre: 'Clientes', tipo: 'A', grupo: '4' },
    '431': { nombre: 'Clientes, efectos comerciales a cobrar', tipo: 'A', grupo: '4' },
    '435': { nombre: 'Clientes de dudoso cobro', tipo: 'A', grupo: '4' },
    '440': { nombre: 'Deudores varios', tipo: 'A', grupo: '4' },
    '465': { nombre: 'Remuneraciones pendientes de pago', tipo: 'P', grupo: '4' },
    '472': { nombre: 'HP IVA soportado', tipo: 'A', grupo: '4' },
    '473': { nombre: 'HP retenciones y pagos a cuenta', tipo: 'A', grupo: '4' },
    '475': { nombre: 'HP acreedora por conceptos fiscales', tipo: 'P', grupo: '4' },
    '4750': { nombre: 'HP acreedora por IVA', tipo: 'P', grupo: '4' },
    '4751': { nombre: 'HP acreedora por retenciones', tipo: 'P', grupo: '4' },
    '476': { nombre: 'Organismos SS acreedores', tipo: 'P', grupo: '4' },
    '477': { nombre: 'HP IVA repercutido', tipo: 'P', grupo: '4' },
    // Grupo 5 - Cuentas financieras
    '520': { nombre: 'Deudas a C/P con entidades de crédito', tipo: 'P', grupo: '5' },
    '521': { nombre: 'Deudas a C/P', tipo: 'P', grupo: '5' },
    '551': { nombre: 'Cuenta corriente con socios y administradores', tipo: 'P', grupo: '5' }, // DEUDA A SOCIO
    '555': { nombre: 'Partidas pendientes de aplicación', tipo: 'A', grupo: '5' },
    '570': { nombre: 'Caja, euros', tipo: 'A', grupo: '5' },
    '572': { nombre: 'Bancos c/c vista, euros', tipo: 'A', grupo: '5' },
    '573': { nombre: 'Bancos c/c moneda extranjera', tipo: 'A', grupo: '5' },
    // Grupo 6 - Compras y gastos
    '600': { nombre: 'Compras de mercaderías', tipo: 'G', grupo: '6' },
    '601': { nombre: 'Compras de materias primas', tipo: 'G', grupo: '6' }, // SEMILLAS
    '602': { nombre: 'Compras de otros aprovisionamientos', tipo: 'G', grupo: '6' },
    '606': { nombre: 'Descuentos sobre compras por pronto pago', tipo: 'G', grupo: '6' },
    '607': { nombre: 'Trabajos realizados por otras empresas', tipo: 'G', grupo: '6' },
    '608': { nombre: 'Devoluciones de compras', tipo: 'G', grupo: '6' },
    '610': { nombre: 'Variación de existencias de mercaderías', tipo: 'G', grupo: '6' },
    '611': { nombre: 'Variación de existencias de materias primas', tipo: 'G', grupo: '6' },
    '621': { nombre: 'Arrendamientos y cánones', tipo: 'G', grupo: '6' }, // ALQUILER
    '622': { nombre: 'Reparaciones y conservación', tipo: 'G', grupo: '6' },
    '623': { nombre: 'Servicios profesionales independientes', tipo: 'G', grupo: '6' }, // ASESORÍA
    '624': { nombre: 'Transportes', tipo: 'G', grupo: '6' },
    '625': { nombre: 'Primas de seguros', tipo: 'G', grupo: '6' },
    '626': { nombre: 'Servicios bancarios y similares', tipo: 'G', grupo: '6' },
    '627': { nombre: 'Publicidad, propaganda y RRPP', tipo: 'G', grupo: '6' },
    '628': { nombre: 'Suministros', tipo: 'G', grupo: '6' }, // LUZ, AGUA, GAS
    '629': { nombre: 'Otros servicios', tipo: 'G', grupo: '6' },
    '631': { nombre: 'Otros tributos', tipo: 'G', grupo: '6' },
    '640': { nombre: 'Sueldos y salarios', tipo: 'G', grupo: '6' }, // NÓMINAS
    '641': { nombre: 'Indemnizaciones', tipo: 'G', grupo: '6' },
    '642': { nombre: 'Seguridad Social a cargo de la empresa', tipo: 'G', grupo: '6' },
    '649': { nombre: 'Otros gastos sociales', tipo: 'G', grupo: '6' },
    '662': { nombre: 'Intereses de deudas', tipo: 'G', grupo: '6' },
    '669': { nombre: 'Otros gastos financieros', tipo: 'G', grupo: '6' },
    '678': { nombre: 'Gastos excepcionales', tipo: 'G', grupo: '6' },
    '680': { nombre: 'Amortización del inmovilizado intangible', tipo: 'G', grupo: '6' },
    '681': { nombre: 'Amortización del inmovilizado material', tipo: 'G', grupo: '6' },
    '694': { nombre: 'Pérdidas por deterioro de créditos comerciales', tipo: 'G', grupo: '6' },
    // Grupo 7 - Ventas e ingresos
    '700': { nombre: 'Ventas de mercaderías', tipo: 'I', grupo: '7' },
    '701': { nombre: 'Ventas de productos terminados', tipo: 'I', grupo: '7' }, // MICROBROTES
    '705': { nombre: 'Prestaciones de servicios', tipo: 'I', grupo: '7' },
    '706': { nombre: 'Descuentos sobre ventas por pronto pago', tipo: 'I', grupo: '7' },
    '708': { nombre: 'Devoluciones de ventas', tipo: 'I', grupo: '7' },
    '709': { nombre: 'Rappels sobre ventas', tipo: 'I', grupo: '7' },
    '710': { nombre: 'Variación de existencias de productos', tipo: 'I', grupo: '7' },
    '759': { nombre: 'Ingresos por servicios diversos', tipo: 'I', grupo: '7' },
    '762': { nombre: 'Ingresos de créditos', tipo: 'I', grupo: '7' },
    '769': { nombre: 'Otros ingresos financieros', tipo: 'I', grupo: '7' },
    '778': { nombre: 'Ingresos excepcionales', tipo: 'I', grupo: '7' },
    '794': { nombre: 'Reversión del deterioro de créditos comerciales', tipo: 'I', grupo: '7' },
  };

  // Mapeo de categorías de gasto a cuentas PGC
  const CATEGORIA_A_CUENTA = {
    'semillas': { cuenta: '601', nombre: 'Compras de materias primas' },
    'materias_primas': { cuenta: '601', nombre: 'Compras de materias primas' },
    'sustratos': { cuenta: '602', nombre: 'Compras de otros aprovisionamientos' },
    'embalajes': { cuenta: '602', nombre: 'Compras de otros aprovisionamientos' },
    'suministros': { cuenta: '628', nombre: 'Suministros' },
    'agua': { cuenta: '628', nombre: 'Suministros' },
    'luz': { cuenta: '628', nombre: 'Suministros' },
    'gas': { cuenta: '628', nombre: 'Suministros' },
    'energia': { cuenta: '628', nombre: 'Suministros' },
    'alquiler': { cuenta: '621', nombre: 'Arrendamientos y cánones' },
    'transporte': { cuenta: '624', nombre: 'Transportes' },
    'logistica': { cuenta: '624', nombre: 'Transportes' },
    'servicios': { cuenta: '629', nombre: 'Otros servicios' },
    'asesoria': { cuenta: '623', nombre: 'Servicios profesionales independientes' },
    'legal': { cuenta: '623', nombre: 'Servicios profesionales independientes' },
    'gestoria': { cuenta: '623', nombre: 'Servicios profesionales independientes' },
    'nominas': { cuenta: '640', nombre: 'Sueldos y salarios' },
    'salarios': { cuenta: '640', nombre: 'Sueldos y salarios' },
    'seguridad_social': { cuenta: '642', nombre: 'Seguridad Social a cargo empresa' },
    'seguros': { cuenta: '625', nombre: 'Primas de seguros' },
    'banco': { cuenta: '626', nombre: 'Servicios bancarios y similares' },
    'comisiones_bancarias': { cuenta: '626', nombre: 'Servicios bancarios y similares' },
    'publicidad': { cuenta: '627', nombre: 'Publicidad, propaganda y RRPP' },
    'marketing': { cuenta: '627', nombre: 'Publicidad, propaganda y RRPP' },
    'reparaciones': { cuenta: '622', nombre: 'Reparaciones y conservación' },
    'mantenimiento': { cuenta: '622', nombre: 'Reparaciones y conservación' },
    'tributos': { cuenta: '631', nombre: 'Otros tributos' },
    'impuestos': { cuenta: '631', nombre: 'Otros tributos' },
    'software': { cuenta: '629', nombre: 'Otros servicios' },
    'formacion': { cuenta: '649', nombre: 'Otros gastos sociales' },
    'otros': { cuenta: '629', nombre: 'Otros servicios' },
  };

  // Categorías de gasto para el formulario (ordenadas por grupo PGC)
  const CATEGORIAS_GASTO = [
    { value: 'semillas', label: '🌱 Semillas y materias primas (601)', cuenta: '601' },
    { value: 'sustratos', label: '🪴 Sustratos y aprovisionamientos (602)', cuenta: '602' },
    { value: 'embalajes', label: '📦 Embalajes y envases (602)', cuenta: '602' },
    { value: 'alquiler', label: '🏠 Alquiler local (621)', cuenta: '621' },
    { value: 'reparaciones', label: '🔧 Reparaciones y mantenimiento (622)', cuenta: '622' },
    { value: 'asesoria', label: '👔 Asesoría/Gestoría (623)', cuenta: '623' },
    { value: 'transporte', label: '🚚 Transporte y logística (624)', cuenta: '624' },
    { value: 'seguros', label: '🛡️ Seguros (625)', cuenta: '625' },
    { value: 'banco', label: '🏦 Comisiones bancarias (626)', cuenta: '626' },
    { value: 'publicidad', label: '📣 Publicidad y marketing (627)', cuenta: '627' },
    { value: 'energia', label: '💡 Suministros: luz/agua/gas (628)', cuenta: '628' },
    { value: 'servicios', label: '⚙️ Otros servicios (629)', cuenta: '629' },
    { value: 'tributos', label: '📋 Tributos e impuestos (631)', cuenta: '631' },
    { value: 'nominas', label: '👥 Sueldos y salarios (640)', cuenta: '640' },
    { value: 'seguridad_social', label: '🏥 Seguridad Social empresa (642)', cuenta: '642' },
    { value: 'otros', label: '📝 Otros gastos (629)', cuenta: '629' },
  ];

  // Formas de pago para gastos
  const FORMAS_PAGO = [
    { value: 'banco', label: '🏦 Banco sociedad (572)', cuenta: '572' },
    { value: 'caja', label: '💵 Caja (570)', cuenta: '570' },
    { value: 'socio_nico', label: '👤 Deuda a Nico (551)', cuenta: '551' },
    { value: 'socio_peri', label: '👤 Deuda a Peri (551)', cuenta: '551' },
    { value: 'socio_guzman', label: '👤 Deuda a Guzmán (551)', cuenta: '551' },
    { value: 'tarjeta_empresa', label: '💳 Tarjeta empresa (572)', cuenta: '572' },
    { value: 'transferencia', label: '📤 Transferencia (572)', cuenta: '572' },
  ];

  // Estados de cobro
  const ESTADOS_COBRO = {
    'pendiente': { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    'cobrada': { label: 'Cobrada', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    'vencida': { label: 'Vencida', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
    'parcial': { label: 'Cobro parcial', color: 'bg-blue-100 text-blue-700', icon: Clock },
  };

  // Estado para formulario de asientos
  const [showAsientoForm, setShowAsientoForm] = useState(false);
  const [editingAsiento, setEditingAsiento] = useState(null);
  const [vistaContable, setVistaContable] = useState('diario'); // diario, mayor, balance

  // Guardar asiento en Supabase
  const guardarAsiento = async (asiento) => {
    try {
      if (editingAsiento) {
        // Actualizar asiento existente
        await supabase.from('asientos_contables').update({
          fecha: asiento.fecha,
          numero: asiento.numero,
          concepto: asiento.concepto,
          referencia: asiento.referencia,
        }).eq('id', editingAsiento.id);
        
        // Eliminar líneas antiguas y crear nuevas
        await supabase.from('asiento_lineas').delete().eq('asiento_id', editingAsiento.id);
        
        const lineasConId = asiento.lineas.map(l => ({
          asiento_id: editingAsiento.id,
          cuenta: l.cuenta,
          concepto: l.concepto,
          debe: l.debe || 0,
          haber: l.haber || 0,
        }));
        await supabase.from('asiento_lineas').insert(lineasConId);
      } else {
        // Crear nuevo asiento
        const { data: nuevoAsiento, error } = await supabase.from('asientos_contables').insert({
          fecha: asiento.fecha,
          numero: asiento.numero,
          concepto: asiento.concepto,
          referencia: asiento.referencia,
        }).select().single();
        
        if (error) throw error;
        
        // Crear líneas del asiento
        const lineasConId = asiento.lineas.map(l => ({
          asiento_id: nuevoAsiento.id,
          cuenta: l.cuenta,
          concepto: l.concepto,
          debe: l.debe || 0,
          haber: l.haber || 0,
        }));
        await supabase.from('asiento_lineas').insert(lineasConId);
      }
      
      refetchAsientos();
      refetchAsientoLineas();
      setShowAsientoForm(false);
      setEditingAsiento(null);
    } catch (error) {
      console.error('Error guardando asiento:', error);
      alert('Error al guardar el asiento');
    }
  };

  const eliminarAsiento = async (id) => {
    if (confirm('¿Eliminar este asiento?')) {
      try {
        // Las líneas se eliminan automáticamente por ON DELETE CASCADE
        await supabase.from('asientos_contables').delete().eq('id', id);
        refetchAsientos();
        refetchAsientoLineas();
      } catch (error) {
        console.error('Error eliminando asiento:', error);
      }
    }
  };

  // Generar asientos automáticos desde facturas y gastos
  const generarAsientosAutomaticos = async () => {
    const nuevosAsientos = [];
    const asientosExistentes = new Set(asientosContables.map(a => a.referencia));
    
    // Asientos de ventas (facturas emitidas)
    facturas.forEach(f => {
      const ref = `FAC-${f.id}`;
      if (!asientosExistentes.has(ref)) {
        const cliente = clientes.find(c => c.id === f.cliente_id);
        nuevosAsientos.push({
          fecha: f.fecha,
          numero: `A${nuevosAsientos.length + asientosContables.length + 1}`,
          concepto: `Factura ${f.id} - ${cliente?.nombre || 'Cliente'}`,
          referencia: ref,
          lineas: [
            { cuenta: '430', concepto: 'Clientes', debe: f.total || 0, haber: 0 },
            { cuenta: '700', concepto: 'Ventas', debe: 0, haber: f.subtotal || 0 },
            { cuenta: '477', concepto: 'IVA Repercutido', debe: 0, haber: f.iva || 0 },
          ]
        });
      }
    });
    
    // Asientos de compras (gastos)
    gastos.forEach(g => {
      const ref = `GAS-${g.id}`;
      if (!asientosExistentes.has(ref)) {
        const proveedor = proveedores.find(p => p.id === g.proveedor_id);
        const base = g.importe / 1.21;
        const iva = g.importe - base;
        const cuentaGasto = g.categoria === 'semillas' ? '601' : 
                           g.categoria === 'suministros' ? '628' :
                           g.categoria === 'transporte' ? '624' :
                           g.categoria === 'servicios' ? '629' : '602';
        nuevosAsientos.push({
          fecha: g.fecha,
          numero: `A${nuevosAsientos.length + asientosContables.length + 1}`,
          concepto: `${g.concepto} - ${proveedor?.nombre || 'Proveedor'}`,
          referencia: ref,
          lineas: [
            { cuenta: cuentaGasto, concepto: PLAN_CUENTAS[cuentaGasto]?.nombre || 'Gasto', debe: base, haber: 0 },
            { cuenta: '472', concepto: 'IVA Soportado', debe: iva, haber: 0 },
            { cuenta: '400', concepto: 'Proveedores', debe: 0, haber: g.importe },
          ]
        });
      }
    });
    
    if (nuevosAsientos.length > 0) {
      try {
        for (const asiento of nuevosAsientos) {
          const { data: nuevoAsiento, error } = await supabase.from('asientos_contables').insert({
            fecha: asiento.fecha,
            numero: asiento.numero,
            concepto: asiento.concepto,
            referencia: asiento.referencia,
          }).select().single();
          
          if (error) throw error;
          
          const lineasConId = asiento.lineas.map(l => ({
            asiento_id: nuevoAsiento.id,
            cuenta: l.cuenta,
            concepto: l.concepto,
            debe: l.debe || 0,
            haber: l.haber || 0,
          }));
          await supabase.from('asiento_lineas').insert(lineasConId);
        }
        
        refetchAsientos();
        refetchAsientoLineas();
        alert(`✅ Se han generado ${nuevosAsientos.length} asientos automáticos`);
      } catch (error) {
        console.error('Error generando asientos:', error);
        alert('Error al generar asientos');
      }
    } else {
      alert('No hay nuevos asientos para generar');
    }
  };

  // Eliminar múltiples registros
  const handleDeleteMultiple = async (table, ids, refetchFn, setSelectedFn) => {
    if (ids.length === 0) return;
    if (!window.confirm(`¿Eliminar ${ids.length} elemento(s)?`)) return;
    
    try {
      for (const id of ids) {
        await supabase.from(table).delete().eq('id', id);
      }
      refetchFn();
      setSelectedFn([]);
    } catch (error) {
      console.error('Error eliminando:', error);
      alert('Error al eliminar');
    }
  };

  // Estado para exportación contable con selector de fechas
  const [exportPeriodo, setExportPeriodo] = useState('mes_actual');
  const [exportFechaInicio, setExportFechaInicio] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [exportFechaFin, setExportFechaFin] = useState(new Date().toISOString().split('T')[0]);

  // Configuración de notificaciones por email (guardado en localStorage)
  const [configNotificaciones, setConfigNotificaciones] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('configNotificaciones');
      return saved ? JSON.parse(saved) : {
        stock_bajo: true,
        stock_agotado: true,
        pedidos_atrasados: true,
        pedidos_hoy: false,
        facturas_vencidas: true,
        facturas_por_vencer: false,
        lotes_cosechar: true,
        tareas_vencidas: true,
        ambiente_alerta: true,
        recordatorio_iva: true,
        recordatorio_asesoria: true,
      };
    }
    return {};
  });

  // Guardar config en localStorage cuando cambie
  const updateConfigNotificaciones = (key, value) => {
    const newConfig = { ...configNotificaciones, [key]: value };
    setConfigNotificaciones(newConfig);
    localStorage.setItem('configNotificaciones', JSON.stringify(newConfig));
  };

  const { data: clientesData, loading: l1, refetch: refetchClientes } = useRealtime('clientes');
  const { data: leadsData, setData: setLeadsData, refetch: refetchLeads } = useRealtime('leads');
  const { data: productosData, loading: l2, refetch: refetchProductos } = useRealtime('productos');
  const { data: pedidosData, loading: l3, refetch: refetchPedidos } = useRealtime('pedidos');
  const { data: pedidoItemsData, refetch: refetchPedidoItems } = useRealtime('pedido_items');
  const { data: facturasData, refetch: refetchFacturas } = useRealtime('facturas');
  const { data: gastosData, refetch: refetchGastos } = useRealtime('gastos');
  const { data: lotesData, refetch: refetchLotes } = useRealtime('lotes');
  const { data: proveedoresData, refetch: refetchProveedores } = useRealtime('proveedores');
  const { data: tareasData, refetch: refetchTareas } = useRealtime('tareas');
  const { data: mermasData, refetch: refetchMermas } = useRealtime('mermas');
  const { data: pedidosRecurrentesData, refetch: refetchPedidosRecurrentes } = useRealtime('pedidos_recurrentes');
  const { data: pedidosRecurrentesItemsData, refetch: refetchPedidosRecurrentesItems } = useRealtime('pedidos_recurrentes_items');
  const { data: historicoPreciosData, refetch: refetchHistoricoPrecios } = useRealtime('historico_precios');
  const { data: condicionesData, refetch: refetchCondiciones } = useRealtime('condiciones_ambientales');
  const { data: asientosData, refetch: refetchAsientos } = useRealtime('asientos_contables');
  const { data: asientoLineasData, refetch: refetchAsientoLineas } = useRealtime('asiento_lineas');
  const { data: auditLogData, refetch: refetchAuditLog } = useRealtime('audit_log');
  const { data: userProfilesData, refetch: refetchUserProfiles } = useRealtime('user_profiles');

  // Función para refrescar todo
  const refetchAll = () => {
    refetchClientes();
    refetchLeads();
    refetchProductos();
    refetchPedidos();
    refetchPedidoItems();
    refetchFacturas();
    refetchGastos();
    refetchLotes();
    refetchProveedores();
    refetchTareas();
    refetchMermas();
    refetchPedidosRecurrentes();
    refetchAsientos();
  };

  // Variables seguras (nunca undefined)
  const clientes = clientesData || [];
  const leads = leadsData || [];
  const productos = productosData || [];
  const pedidos = pedidosData || [];
  const pedidoItems = pedidoItemsData || [];
  const facturas = facturasData || [];
  const gastos = gastosData || [];
  const lotes = lotesData || [];
  const proveedores = proveedoresData || [];
  const tareas = tareasData || [];
  const mermas = mermasData || [];
  const pedidosRecurrentes = pedidosRecurrentesData || [];
  const pedidosRecurrentesItems = pedidosRecurrentesItemsData || [];
  const historicoPrecios = historicoPreciosData || [];
  const condiciones = condicionesData || [];
  const asientosDB = asientosData || [];
  const auditLog = auditLogData || [];
  const userProfiles = userProfilesData || [];
  const asientoLineasDB = asientoLineasData || [];
  const setLeads = setLeadsData;

  // Combinar asientos con sus líneas
  const asientosContables = useMemo(() => {
    return asientosDB.map(a => ({
      ...a,
      lineas: asientoLineasDB.filter(l => l.asiento_id === a.id)
    }));
  }, [asientosDB, asientoLineasDB]);

  // Crear asiento automático desde una factura
  const crearAsientoDesdeFactura = async (factura, cliente) => {
    try {
      const { count } = await supabase.from('asientos_contables').select('*', { count: 'exact', head: true });
      const numero = `A${(count || 0) + 1}`;
      
      const { data: nuevoAsiento, error } = await supabase.from('asientos_contables').insert({
        fecha: factura.fecha,
        numero,
        concepto: `Factura ${factura.id} - ${cliente?.nombre || 'Cliente'}`,
        referencia: `FAC-${factura.id}`,
      }).select().single();
      
      if (error) {
        alert('❌ Error creando asiento: ' + error.message);
        console.error('Error creando asiento:', error);
        return;
      }
      
      const totalFactura = parseFloat((factura.total || 0).toFixed(2));
      const baseImponible = parseFloat((factura.base_imponible || factura.subtotal || 0).toFixed(2));
      const ivaFactura = parseFloat((factura.iva || 0).toFixed(2));
      const reImporte = parseFloat((factura.re_importe || 0).toFixed(2));
      const ivaPorcentaje = factura.iva_porcentaje || IVA_VENTAS;
      
      const lineas = [
        { asiento_id: nuevoAsiento.id, cuenta: '430', concepto: 'Clientes', debe: totalFactura, haber: 0 },
        { asiento_id: nuevoAsiento.id, cuenta: '701', concepto: 'Ventas de productos terminados (microbrotes)', debe: 0, haber: baseImponible },
        { asiento_id: nuevoAsiento.id, cuenta: '477', concepto: `H.P. IVA Repercutido (${ivaPorcentaje}%)`, debe: 0, haber: ivaFactura },
      ];
      
      // Si hay recargo de equivalencia, añadir línea
      if (reImporte > 0) {
        lineas.push({ asiento_id: nuevoAsiento.id, cuenta: '477', concepto: 'H.P. Recargo Equivalencia (0,5%)', debe: 0, haber: reImporte });
      }
      
      console.log('Insertando líneas:', lineas);
      
      const { data: lineasCreadas, error: errorLineas } = await supabase.from('asiento_lineas').insert(lineas).select();
      
      if (errorLineas) {
        alert('❌ Error creando líneas del asiento: ' + errorLineas.message + '\n\nPosible causa: La tabla asiento_lineas no existe o no tiene permisos RLS.');
        console.error('Error creando líneas:', errorLineas);
        return;
      }
      
      console.log('Líneas creadas:', lineasCreadas);
      
      refetchAsientos();
      refetchAsientoLineas();
      
      let mensajeRE = reImporte > 0 ? `\n477 RE: ${reImporte}€ (HABER)` : '';
      alert(`✅ Asiento ${numero} creado:\n\n430 Clientes: ${totalFactura}€ (DEBE)\n701 Ventas: ${baseImponible}€ (HABER)\n477 IVA ${ivaPorcentaje}%: ${ivaFactura}€ (HABER)${mensajeRE}`);
    } catch (error) {
      console.error('Error creando asiento desde factura:', error);
      alert('❌ Error inesperado: ' + error.message);
    }
  };

  // Crear asiento automático desde un gasto
  const crearAsientoDesdeGasto = async (gasto, proveedor) => {
    try {
      const { count } = await supabase.from('asientos_contables').select('*', { count: 'exact', head: true });
      const numero = `A${(count || 0) + 1}`;
      
      const importeTotal = parseFloat(gasto.importe) || 0;
      
      // Usar el tipo de IVA seleccionado o por defecto 21%
      const ivaTipo = gasto.iva_tipo || 'general';
      const ivaPorcentaje = TIPOS_IVA[ivaTipo]?.valor || 21;
      const divisor = 1 + (ivaPorcentaje / 100);
      const base = parseFloat((importeTotal / divisor).toFixed(2));
      const iva = parseFloat((importeTotal - base).toFixed(2));
      
      // Determinar cuenta de gasto según categoría usando el mapeo PGC
      const mapeo = CATEGORIA_A_CUENTA[gasto.categoria] || { cuenta: '629', nombre: 'Otros servicios' };
      const cuentaGasto = mapeo.cuenta;
      
      // Determinar cuenta de pago según forma de pago
      const formaPago = gasto.forma_pago || 'banco';
      let cuentaPago, conceptoPago;
      
      if (formaPago.startsWith('socio_')) {
        cuentaPago = '551';
        const socio = formaPago.replace('socio_', '');
        conceptoPago = `C/C con socios - ${socio.charAt(0).toUpperCase() + socio.slice(1)}`;
      } else if (formaPago === 'caja') {
        cuentaPago = '570';
        conceptoPago = 'Caja, euros';
      } else {
        cuentaPago = '572';
        conceptoPago = 'Bancos c/c vista, euros';
      }
      
      const { data: nuevoAsiento, error } = await supabase.from('asientos_contables').insert({
        fecha: gasto.fecha,
        numero,
        concepto: `${gasto.concepto} - ${proveedor?.nombre || 'Proveedor'}`,
        referencia: `GAS-${gasto.id}`,
      }).select().single();
      
      if (error) {
        alert('❌ Error creando asiento: ' + error.message);
        console.error('Error creando asiento:', error);
        return;
      }
      
      const nombreCuenta = PLAN_CUENTAS[cuentaGasto]?.nombre || mapeo.nombre;
      
      // Asiento con cuenta de gasto, IVA y contrapartida (pago)
      const lineas = [
        { asiento_id: nuevoAsiento.id, cuenta: cuentaGasto, concepto: nombreCuenta, debe: base, haber: 0 },
      ];
      
      // Solo añadir línea de IVA si hay IVA
      if (iva > 0) {
        lineas.push({ asiento_id: nuevoAsiento.id, cuenta: '472', concepto: `H.P. IVA Soportado (${ivaPorcentaje}%)`, debe: iva, haber: 0 });
      }
      
      lineas.push({ asiento_id: nuevoAsiento.id, cuenta: cuentaPago, concepto: conceptoPago, debe: 0, haber: importeTotal });
      
      console.log('Insertando líneas de gasto:', lineas);
      
      const { data: lineasCreadas, error: errorLineas } = await supabase.from('asiento_lineas').insert(lineas).select();
      
      if (errorLineas) {
        alert('❌ Error creando líneas del asiento: ' + errorLineas.message + '\n\nPosible causa: La tabla asiento_lineas no existe o no tiene permisos RLS.');
        console.error('Error creando líneas:', errorLineas);
        return;
      }
      
      console.log('Líneas creadas:', lineasCreadas);
      
      refetchAsientos();
      refetchAsientoLineas();
      
      alert(`✅ Asiento ${numero} creado:\n\n${cuentaGasto} ${nombreCuenta}: ${base.toFixed(2)}€ (DEBE)\n472 IVA Soportado: ${iva.toFixed(2)}€ (DEBE)\n${cuentaPago} ${conceptoPago}: ${importeTotal.toFixed(2)}€ (HABER)`);
    } catch (error) {
      console.error('Error creando asiento desde gasto:', error);
      alert('❌ Error inesperado: ' + error.message);
    }
  };

  // ==================== EXPORTACIÓN DE INFORMES CONTABLES ====================
  
  // Calcular saldos por cuenta
  const calcularSaldosCuentas = () => {
    const saldos = {};
    
    asientoLineasDB.forEach(linea => {
      const cuenta = linea.cuenta;
      if (!saldos[cuenta]) {
        saldos[cuenta] = { debe: 0, haber: 0, saldo: 0 };
      }
      saldos[cuenta].debe += parseFloat(linea.debe) || 0;
      saldos[cuenta].haber += parseFloat(linea.haber) || 0;
    });
    
    // Calcular saldos
    Object.keys(saldos).forEach(cuenta => {
      const tipo = PLAN_CUENTAS[cuenta]?.tipo || 'A';
      if (['A', 'G'].includes(tipo)) {
        // Activo y Gastos: saldo deudor
        saldos[cuenta].saldo = saldos[cuenta].debe - saldos[cuenta].haber;
      } else {
        // Pasivo, Ingresos, Patrimonio: saldo acreedor
        saldos[cuenta].saldo = saldos[cuenta].haber - saldos[cuenta].debe;
      }
    });
    
    return saldos;
  };

  // Exportar Libro Diario a Excel
  const exportarLibroDiario = () => {
    const data = [];
    
    // Cabecera
    data.push(['LIBRO DIARIO - ' + EMPRESA.nombre]);
    data.push(['CIF: ' + EMPRESA.cif]);
    data.push(['Ejercicio: ' + new Date().getFullYear()]);
    data.push([]);
    data.push(['Asiento', 'Fecha', 'Cuenta', 'Concepto', 'Debe', 'Haber']);
    
    asientosDB.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).forEach(asiento => {
      const lineas = asientoLineasDB.filter(l => l.asiento_id === asiento.id);
      lineas.forEach((linea, idx) => {
        data.push([
          idx === 0 ? asiento.numero : '',
          idx === 0 ? formatDate(asiento.fecha) : '',
          linea.cuenta + ' - ' + (PLAN_CUENTAS[linea.cuenta]?.nombre || linea.concepto),
          linea.concepto,
          parseFloat(linea.debe) || 0,
          parseFloat(linea.haber) || 0,
        ]);
      });
      data.push([]); // Línea vacía entre asientos
    });
    
    // Totales
    const totalDebe = asientoLineasDB.reduce((sum, l) => sum + (parseFloat(l.debe) || 0), 0);
    const totalHaber = asientoLineasDB.reduce((sum, l) => sum + (parseFloat(l.haber) || 0), 0);
    data.push(['', '', '', 'TOTALES', totalDebe, totalHaber]);
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Libro Diario');
    XLSX.writeFile(wb, `Libro_Diario_${EMPRESA.cif}_${new Date().getFullYear()}.xlsx`);
    alert('✅ Libro Diario exportado');
  };

  // Exportar Libro Mayor a Excel
  const exportarLibroMayor = () => {
    const wb = XLSX.utils.book_new();
    const saldos = calcularSaldosCuentas();
    
    // Una hoja por cada cuenta con movimientos
    Object.entries(PLAN_CUENTAS).forEach(([codigo, cuenta]) => {
      const movimientos = asientosDB.flatMap(a => 
        asientoLineasDB.filter(l => l.asiento_id === a.id && l.cuenta === codigo)
          .map(l => ({ ...l, fecha: a.fecha, asiento: a.numero, conceptoAsiento: a.concepto }))
      );
      
      if (movimientos.length === 0) return;
      
      const data = [];
      data.push([`LIBRO MAYOR - Cuenta ${codigo}: ${cuenta.nombre}`]);
      data.push(['CIF: ' + EMPRESA.cif]);
      data.push([]);
      data.push(['Fecha', 'Asiento', 'Concepto', 'Debe', 'Haber', 'Saldo']);
      
      let saldoAcum = 0;
      movimientos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).forEach(m => {
        const debe = parseFloat(m.debe) || 0;
        const haber = parseFloat(m.haber) || 0;
        saldoAcum += (['A', 'G'].includes(cuenta.tipo) ? debe - haber : haber - debe);
        data.push([
          formatDate(m.fecha),
          m.asiento,
          m.conceptoAsiento,
          debe,
          haber,
          saldoAcum,
        ]);
      });
      
      data.push([]);
      data.push(['', '', 'SALDO FINAL', saldos[codigo]?.debe || 0, saldos[codigo]?.haber || 0, saldos[codigo]?.saldo || 0]);
      
      const ws = XLSX.utils.aoa_to_sheet(data);
      const nombreHoja = `${codigo}_${cuenta.nombre}`.substring(0, 31).replace(/[\\/*?[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
    });
    
    XLSX.writeFile(wb, `Libro_Mayor_${EMPRESA.cif}_${new Date().getFullYear()}.xlsx`);
    alert('✅ Libro Mayor exportado');
  };

  // Exportar Balance de Sumas y Saldos
  const exportarSumasYSaldos = () => {
    const saldos = calcularSaldosCuentas();
    const data = [];
    
    data.push(['BALANCE DE SUMAS Y SALDOS - ' + EMPRESA.nombre]);
    data.push(['CIF: ' + EMPRESA.cif]);
    data.push(['Fecha: ' + formatDate(new Date().toISOString())]);
    data.push([]);
    data.push(['Cuenta', 'Nombre', 'Sumas Debe', 'Sumas Haber', 'Saldo Deudor', 'Saldo Acreedor']);
    
    let totalSumasDebe = 0, totalSumasHaber = 0, totalSaldoDeudor = 0, totalSaldoAcreedor = 0;
    
    Object.entries(saldos).sort((a, b) => a[0].localeCompare(b[0])).forEach(([cuenta, s]) => {
      const nombre = PLAN_CUENTAS[cuenta]?.nombre || 'Cuenta no definida';
      const saldoDeudor = s.saldo > 0 ? s.saldo : 0;
      const saldoAcreedor = s.saldo < 0 ? Math.abs(s.saldo) : 0;
      
      data.push([cuenta, nombre, s.debe, s.haber, saldoDeudor, saldoAcreedor]);
      
      totalSumasDebe += s.debe;
      totalSumasHaber += s.haber;
      totalSaldoDeudor += saldoDeudor;
      totalSaldoAcreedor += saldoAcreedor;
    });
    
    data.push([]);
    data.push(['', 'TOTALES', totalSumasDebe, totalSumasHaber, totalSaldoDeudor, totalSaldoAcreedor]);
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sumas y Saldos');
    XLSX.writeFile(wb, `Balance_Sumas_Saldos_${EMPRESA.cif}_${new Date().getFullYear()}.xlsx`);
    alert('✅ Balance de Sumas y Saldos exportado');
  };

  // Exportar Balance de Situación
  const exportarBalanceSituacion = () => {
    const saldos = calcularSaldosCuentas();
    const data = [];
    
    data.push(['BALANCE DE SITUACIÓN - ' + EMPRESA.nombre]);
    data.push(['CIF: ' + EMPRESA.cif]);
    data.push(['Fecha cierre: ' + formatDate(new Date().toISOString())]);
    data.push([]);
    
    // ACTIVO
    data.push(['ACTIVO', '', '']);
    data.push(['']);
    
    data.push(['A) ACTIVO NO CORRIENTE', '', '']);
    let totalActivoNoCorrente = 0;
    Object.entries(saldos).filter(([c]) => c.startsWith('2')).forEach(([cuenta, s]) => {
      if (s.saldo !== 0) {
        data.push(['  ' + cuenta + ' ' + (PLAN_CUENTAS[cuenta]?.nombre || ''), s.saldo, '']);
        totalActivoNoCorrente += s.saldo;
      }
    });
    data.push(['  Total Activo No Corriente', '', totalActivoNoCorrente]);
    data.push(['']);
    
    data.push(['B) ACTIVO CORRIENTE', '', '']);
    let totalActivoCorrente = 0;
    
    // Existencias (grupo 3)
    data.push(['  I. Existencias', '', '']);
    Object.entries(saldos).filter(([c]) => c.startsWith('3')).forEach(([cuenta, s]) => {
      if (s.saldo !== 0) {
        data.push(['    ' + cuenta + ' ' + (PLAN_CUENTAS[cuenta]?.nombre || ''), s.saldo, '']);
        totalActivoCorrente += s.saldo;
      }
    });
    
    // Deudores (grupo 4 activo)
    data.push(['  II. Deudores comerciales', '', '']);
    Object.entries(saldos).filter(([c]) => ['430', '431', '435', '440'].includes(c)).forEach(([cuenta, s]) => {
      if (s.saldo !== 0) {
        data.push(['    ' + cuenta + ' ' + (PLAN_CUENTAS[cuenta]?.nombre || ''), s.saldo, '']);
        totalActivoCorrente += s.saldo;
      }
    });
    
    // HP deudora
    data.push(['  III. Administraciones Públicas deudoras', '', '']);
    Object.entries(saldos).filter(([c]) => ['472', '473'].includes(c)).forEach(([cuenta, s]) => {
      if (s.saldo !== 0) {
        data.push(['    ' + cuenta + ' ' + (PLAN_CUENTAS[cuenta]?.nombre || ''), s.saldo, '']);
        totalActivoCorrente += s.saldo;
      }
    });
    
    // Tesorería (grupo 5 activo)
    data.push(['  IV. Efectivo y equivalentes', '', '']);
    Object.entries(saldos).filter(([c]) => ['570', '572', '573', '555'].includes(c)).forEach(([cuenta, s]) => {
      if (s.saldo !== 0) {
        data.push(['    ' + cuenta + ' ' + (PLAN_CUENTAS[cuenta]?.nombre || ''), s.saldo, '']);
        totalActivoCorrente += s.saldo;
      }
    });
    
    data.push(['  Total Activo Corriente', '', totalActivoCorrente]);
    data.push(['']);
    data.push(['TOTAL ACTIVO', '', totalActivoNoCorrente + totalActivoCorrente]);
    
    data.push(['']);
    data.push(['']);
    
    // PATRIMONIO NETO Y PASIVO
    data.push(['PATRIMONIO NETO Y PASIVO', '', '']);
    data.push(['']);
    
    data.push(['A) PATRIMONIO NETO', '', '']);
    let totalPatrimonioNeto = 0;
    Object.entries(saldos).filter(([c]) => c.startsWith('1') && ['100', '112', '113', '120', '121', '129'].includes(c)).forEach(([cuenta, s]) => {
      if (s.saldo !== 0) {
        data.push(['  ' + cuenta + ' ' + (PLAN_CUENTAS[cuenta]?.nombre || ''), s.saldo, '']);
        totalPatrimonioNeto += s.saldo;
      }
    });
    data.push(['  Total Patrimonio Neto', '', totalPatrimonioNeto]);
    data.push(['']);
    
    data.push(['B) PASIVO NO CORRIENTE', '', '']);
    let totalPasivoNoCorrente = 0;
    Object.entries(saldos).filter(([c]) => ['170', '171'].includes(c)).forEach(([cuenta, s]) => {
      if (s.saldo !== 0) {
        data.push(['  ' + cuenta + ' ' + (PLAN_CUENTAS[cuenta]?.nombre || ''), s.saldo, '']);
        totalPasivoNoCorrente += s.saldo;
      }
    });
    data.push(['  Total Pasivo No Corriente', '', totalPasivoNoCorrente]);
    data.push(['']);
    
    data.push(['C) PASIVO CORRIENTE', '', '']);
    let totalPasivoCorrente = 0;
    
    // Proveedores
    Object.entries(saldos).filter(([c]) => ['400', '401', '410'].includes(c)).forEach(([cuenta, s]) => {
      if (s.saldo !== 0) {
        data.push(['  ' + cuenta + ' ' + (PLAN_CUENTAS[cuenta]?.nombre || ''), s.saldo, '']);
        totalPasivoCorrente += s.saldo;
      }
    });
    
    // HP acreedora
    Object.entries(saldos).filter(([c]) => ['475', '4750', '4751', '476', '477'].includes(c)).forEach(([cuenta, s]) => {
      if (s.saldo !== 0) {
        data.push(['  ' + cuenta + ' ' + (PLAN_CUENTAS[cuenta]?.nombre || ''), s.saldo, '']);
        totalPasivoCorrente += s.saldo;
      }
    });
    
    // Deudas a C/P
    Object.entries(saldos).filter(([c]) => ['520', '521', '551', '465'].includes(c)).forEach(([cuenta, s]) => {
      if (s.saldo !== 0) {
        data.push(['  ' + cuenta + ' ' + (PLAN_CUENTAS[cuenta]?.nombre || ''), s.saldo, '']);
        totalPasivoCorrente += s.saldo;
      }
    });
    
    data.push(['  Total Pasivo Corriente', '', totalPasivoCorrente]);
    data.push(['']);
    data.push(['TOTAL PATRIMONIO NETO Y PASIVO', '', totalPatrimonioNeto + totalPasivoNoCorrente + totalPasivoCorrente]);
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Balance Situación');
    XLSX.writeFile(wb, `Balance_Situacion_${EMPRESA.cif}_${new Date().getFullYear()}.xlsx`);
    alert('✅ Balance de Situación exportado');
  };

  // Exportar Cuenta de Pérdidas y Ganancias (PyG)
  const exportarPyG = () => {
    try {
      const saldos = calcularSaldosCuentas();
      
      if (Object.keys(saldos).length === 0) {
        alert('⚠️ No hay asientos contables para generar el PyG.\n\nCrea algunos gastos o pedidos primero.');
        return;
      }
      
      const data = [];
      
      data.push(['CUENTA DE PÉRDIDAS Y GANANCIAS - ' + EMPRESA.nombre]);
      data.push(['CIF: ' + EMPRESA.cif]);
      data.push(['Ejercicio: ' + new Date().getFullYear()]);
      data.push([]);
      
      // 1. RESULTADO DE EXPLOTACIÓN
      data.push(['A) RESULTADO DE EXPLOTACIÓN', '', '']);
      data.push(['']);
      
      // Ingresos de explotación
      data.push(['1. Importe neto de la cifra de negocios', '', '']);
      let totalVentas = 0;
      Object.entries(saldos).filter(([c]) => ['700', '701', '705'].includes(c)).forEach(([cuenta, s]) => {
        data.push(['  ' + cuenta + ' ' + (PLAN_CUENTAS[cuenta]?.nombre || ''), s.saldo, '']);
        totalVentas += s.saldo;
      });
      // Devoluciones y rappels (restan)
      Object.entries(saldos).filter(([c]) => ['708', '709'].includes(c)).forEach(([cuenta, s]) => {
        data.push(['  ' + cuenta + ' ' + (PLAN_CUENTAS[cuenta]?.nombre || ''), -s.saldo, '']);
        totalVentas -= s.saldo;
      });
      data.push(['  TOTAL VENTAS', '', totalVentas]);
      data.push(['']);
      
      // Aprovisionamientos
      data.push(['2. Aprovisionamientos', '', '']);
      let totalAprov = 0;
      Object.entries(saldos).filter(([c]) => ['600', '601', '602', '607'].includes(c)).forEach(([cuenta, s]) => {
        data.push(['  ' + cuenta + ' ' + (PLAN_CUENTAS[cuenta]?.nombre || ''), -s.saldo, '']);
        totalAprov += s.saldo;
      });
      data.push(['  TOTAL APROVISIONAMIENTOS', '', -totalAprov]);
      data.push(['']);
      
      // Gastos de personal
      data.push(['3. Gastos de personal', '', '']);
      let gastosPersonal = 0;
      Object.entries(saldos).filter(([c]) => ['640', '641', '642', '649'].includes(c)).forEach(([cuenta, s]) => {
        data.push(['  ' + cuenta + ' ' + (PLAN_CUENTAS[cuenta]?.nombre || ''), -s.saldo, '']);
        gastosPersonal += s.saldo;
      });
      data.push(['  TOTAL GASTOS PERSONAL', '', -gastosPersonal]);
      data.push(['']);
      
      // Otros gastos de explotación
      data.push(['4. Otros gastos de explotación', '', '']);
      let otrosGastos = 0;
      Object.entries(saldos).filter(([c]) => ['621', '622', '623', '624', '625', '626', '627', '628', '629', '631'].includes(c)).forEach(([cuenta, s]) => {
        data.push(['  ' + cuenta + ' ' + (PLAN_CUENTAS[cuenta]?.nombre || ''), -s.saldo, '']);
        otrosGastos += s.saldo;
      });
      data.push(['  TOTAL OTROS GASTOS', '', -otrosGastos]);
      data.push(['']);
      
      // Amortizaciones
      let amortizaciones = 0;
      Object.entries(saldos).filter(([c]) => ['680', '681'].includes(c)).forEach(([cuenta, s]) => {
        data.push(['5. Amortizaciones ' + cuenta, -s.saldo, '']);
        amortizaciones += s.saldo;
      });
      data.push(['']);
      
      const resultadoExplotacion = totalVentas - totalAprov - gastosPersonal - otrosGastos - amortizaciones;
      data.push(['A) RESULTADO DE EXPLOTACIÓN', '', resultadoExplotacion]);
      data.push(['']);
      
      // B) RESULTADO FINANCIERO
      data.push(['B) RESULTADO FINANCIERO', '', '']);
      let ingresosFinancieros = 0;
      let gastosFinancieros = 0;
      Object.entries(saldos).filter(([c]) => ['762', '769'].includes(c)).forEach(([cuenta, s]) => {
        ingresosFinancieros += s.saldo;
      });
      Object.entries(saldos).filter(([c]) => ['662', '669'].includes(c)).forEach(([cuenta, s]) => {
        gastosFinancieros += s.saldo;
      });
      const resultadoFinanciero = ingresosFinancieros - gastosFinancieros;
      data.push(['  Ingresos financieros', ingresosFinancieros, '']);
      data.push(['  Gastos financieros', -gastosFinancieros, '']);
      data.push(['B) RESULTADO FINANCIERO', '', resultadoFinanciero]);
      data.push(['']);
      
      // C) RESULTADO ANTES DE IMPUESTOS
      const resultadoAI = resultadoExplotacion + resultadoFinanciero;
      data.push(['C) RESULTADO ANTES DE IMPUESTOS', '', resultadoAI]);
      data.push(['']);
      
      // Estimación IS (25% para PYMEs)
      const impuestoEstimado = resultadoAI > 0 ? resultadoAI * 0.25 : 0;
      data.push(['Impuesto sobre beneficios (estimado 25%)', '', -impuestoEstimado]);
      data.push(['']);
      
      const resultadoEjercicio = resultadoAI - impuestoEstimado;
      data.push(['D) RESULTADO DEL EJERCICIO', '', resultadoEjercicio]);
      
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'PyG');
      XLSX.writeFile(wb, `PyG_${EMPRESA.cif}_${new Date().getFullYear()}.xlsx`);
      alert('✅ Cuenta de Pérdidas y Ganancias exportada');
    } catch (error) {
      console.error('Error exportando PyG:', error);
      alert('❌ Error exportando PyG: ' + error.message);
    }
  };

  // Registrar cobro de factura
  const registrarCobro = async (facturaId, fechaCobro = new Date().toISOString().split('T')[0]) => {
    try {
      const factura = facturas.find(f => f.id === facturaId);
      if (!factura) return;
      
      await supabase.from('facturas').update({
        estado_cobro: 'cobrada',
        fecha_cobro: fechaCobro,
      }).eq('id', facturaId);
      
      // Crear asiento de cobro
      const { count } = await supabase.from('asientos_contables').select('*', { count: 'exact', head: true });
      const numero = `A${(count || 0) + 1}`;
      
      const { data: nuevoAsiento, error } = await supabase.from('asientos_contables').insert({
        fecha: fechaCobro,
        numero,
        concepto: `Cobro Factura ${factura.numero_factura}`,
        referencia: `COB-${facturaId}`,
      }).select().single();
      
      if (!error) {
        const lineas = [
          { asiento_id: nuevoAsiento.id, cuenta: '572', concepto: 'Bancos c/c', debe: factura.total, haber: 0 },
          { asiento_id: nuevoAsiento.id, cuenta: '430', concepto: 'Clientes', debe: 0, haber: factura.total },
        ];
        await supabase.from('asiento_lineas').insert(lineas);
      }
      
      refetchFacturas();
      refetchAsientos();
      refetchAsientoLineas();
      alert(`✅ Cobro registrado para factura ${factura.numero_factura}`);
    } catch (error) {
      console.error('Error registrando cobro:', error);
      alert('❌ Error: ' + error.message);
    }
  };

  // ==================== SISTEMA DE AUDITORÍA ====================
  
  // Registrar acción en el log de auditoría
  const registrarAuditoria = async (accion, tabla, registroId, datosAnteriores = null, datosNuevos = null, descripcion = '') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('audit_log').insert({
        user_id: user?.id || null,
        user_email: user?.email || 'Anónimo',
        user_nombre: user?.user_metadata?.nombre || user?.email?.split('@')[0] || 'Usuario',
        accion,
        tabla,
        registro_id: registroId?.toString(),
        datos_anteriores: datosAnteriores,
        datos_nuevos: datosNuevos,
        descripcion: descripcion || `${accion} en ${tabla}`,
      });
      
      refetchAuditLog();
    } catch (error) {
      console.error('Error registrando auditoría:', error);
    }
  };

  // Obtener usuario actual
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setCurrentUserProfile(profile);
        } else {
          // Crear perfil si no existe
          const newProfile = {
            id: user.id,
            email: user.email,
            nombre: user.user_metadata?.nombre || user.email?.split('@')[0],
          };
          await supabase.from('user_profiles').insert(newProfile);
          setCurrentUserProfile(newProfile);
        }
        
        // Actualizar último login
        await supabase.from('user_profiles').update({ last_login: new Date().toISOString() }).eq('id', user.id);
      }
    };
    
    getUser();
    
    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user || null);
      if (session?.user) {
        getUser();
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // Actualizar perfil de usuario
  const actualizarPerfil = async (updates) => {
    if (!currentUser) return;
    
    try {
      await supabase.from('user_profiles').update(updates).eq('id', currentUser.id);
      setCurrentUserProfile(prev => ({ ...prev, ...updates }));
      await registrarAuditoria('ACTUALIZAR', 'user_profiles', currentUser.id, null, updates, 'Perfil actualizado');
      alert('✅ Perfil actualizado');
    } catch (error) {
      alert('❌ Error: ' + error.message);
    }
  };

  const loading = l1 || l2 || l3;

  // Métricas de tareas
  const tareasPendientes = tareas.filter(t => !t.completada).length;

  // Funciones de filtro por periodo
  const getMesesDisponibles = () => {
    const meses = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      meses.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      });
    }
    return meses;
  };

  const filtrarPorPeriodo = (items, campo, periodo) => {
    if (periodo === 'todos') return items;
    const now = new Date();
    const year = now.getFullYear();
    
    if (periodo === 'mes_actual') {
      const mes = now.getMonth();
      return items.filter(item => {
        const fecha = new Date(item[campo]);
        return fecha.getFullYear() === year && fecha.getMonth() === mes;
      });
    } else if (periodo === 'año_actual') {
      return items.filter(item => new Date(item[campo]).getFullYear() === year);
    } else {
      // Formato: "2024-03" (año-mes)
      const [pYear, pMonth] = periodo.split('-').map(Number);
      return items.filter(item => {
        const fecha = new Date(item[campo]);
        return fecha.getFullYear() === pYear && fecha.getMonth() === pMonth - 1;
      });
    }
  };

  // Métricas filtradas por periodo del dashboard
  const pedidosFiltrados = filtrarPorPeriodo(pedidos, 'fecha', dashboardPeriodo);
  const gastosFiltrados = filtrarPorPeriodo(gastos, 'fecha', dashboardPeriodo);
  const facturasFiltradas = filtrarPorPeriodo(facturas, 'fecha', dashboardPeriodo);

  const ventasPeriodo = pedidosFiltrados.filter(p => p.estado === 'entregado').reduce((sum, p) => sum + (p.total || 0), 0);
  const gastosPeriodo = gastosFiltrados.reduce((sum, g) => sum + (g.importe || 0), 0);

  // Métricas generales (no afectadas por periodo)
  const pedidosPendientes = pedidos.filter(p => ['pendiente', 'confirmado', 'preparando'].includes(p.estado)).length;
  const facturasPendientesTotal = facturas.filter(f => f.estado === 'pendiente').reduce((sum, f) => sum + (f.total || 0), 0);
  const stockBajo = productos.filter(p => p.stock < (p.stock_minimo || 20)).length;
  const lotesActivos = lotes.filter(l => ['sembrado', 'germinando', 'creciendo'].includes(l.estado)).length;
  const leadsNuevos = leads.filter(l => l.estado === 'nuevo').length;

  // ==================== SISTEMA DE ALERTAS AUTOMÁTICAS ====================
  const alertas = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const alertasList = [];

    // 1. Stock bajo
    productos.filter(p => p.stock < (p.stock_minimo || 20)).forEach(p => {
      alertasList.push({
        id: `stock-${p.id}`,
        tipo: 'stock',
        prioridad: p.stock === 0 ? 'critica' : 'alta',
        titulo: p.stock === 0 ? `Sin stock: ${p.nombre}` : `Stock bajo: ${p.nombre}`,
        mensaje: `Quedan ${p.stock} unidades (mínimo: ${p.stock_minimo || 20})`,
        icono: Package,
        color: p.stock === 0 ? 'bg-red-500' : 'bg-amber-500',
        accion: () => setActiveSection('productos')
      });
    });

    // 2. Pedidos pendientes de entrega hoy o atrasados
    pedidos.filter(p => ['pendiente', 'confirmado', 'preparando', 'enviado'].includes(p.estado) && p.fecha_entrega).forEach(p => {
      const fechaEntrega = new Date(p.fecha_entrega);
      fechaEntrega.setHours(0, 0, 0, 0);
      const cliente = clientes.find(c => c.id === p.cliente_id);
      
      if (fechaEntrega < hoy) {
        alertasList.push({
          id: `pedido-atrasado-${p.id}`,
          tipo: 'pedido',
          prioridad: 'critica',
          titulo: `Pedido #${p.id} ATRASADO`,
          mensaje: `${cliente?.nombre || 'Cliente'} - Debía entregarse ${formatDate(p.fecha_entrega)}`,
          icono: Truck,
          color: 'bg-red-500',
          accion: () => setActiveSection('pedidos')
        });
      } else if (fechaEntrega.getTime() === hoy.getTime()) {
        alertasList.push({
          id: `pedido-hoy-${p.id}`,
          tipo: 'pedido',
          prioridad: 'alta',
          titulo: `Entrega HOY: Pedido #${p.id}`,
          mensaje: `${cliente?.nombre || 'Cliente'} - ${formatCurrency(p.total)}`,
          icono: Truck,
          color: 'bg-blue-500',
          accion: () => setActiveSection('rutas')
        });
      }
    });

    // 3. Facturas vencidas o por vencer
    facturas.filter(f => f.estado === 'pendiente' && f.fecha_vencimiento).forEach(f => {
      const fechaVenc = new Date(f.fecha_vencimiento);
      fechaVenc.setHours(0, 0, 0, 0);
      const diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
      const cliente = clientes.find(c => c.id === f.cliente_id);

      if (diasRestantes < 0) {
        alertasList.push({
          id: `factura-vencida-${f.id}`,
          tipo: 'factura',
          prioridad: 'critica',
          titulo: `Factura ${f.id} VENCIDA`,
          mensaje: `${cliente?.nombre || 'Cliente'} - ${formatCurrency(f.total)} (${Math.abs(diasRestantes)} días)`,
          icono: Receipt,
          color: 'bg-red-500',
          accion: () => setActiveSection('facturacion')
        });
      } else if (diasRestantes <= 3) {
        alertasList.push({
          id: `factura-vencer-${f.id}`,
          tipo: 'factura',
          prioridad: 'media',
          titulo: `Factura ${f.id} vence ${diasRestantes === 0 ? 'HOY' : `en ${diasRestantes}d`}`,
          mensaje: `${cliente?.nombre || 'Cliente'} - ${formatCurrency(f.total)}`,
          icono: Receipt,
          color: 'bg-amber-500',
          accion: () => setActiveSection('facturacion')
        });
      }
    });

    // 4. Lotes listos para cosechar
    lotes.filter(l => l.estado === 'creciendo' && l.fecha_cosecha_prevista).forEach(l => {
      const fechaCosecha = new Date(l.fecha_cosecha_prevista);
      fechaCosecha.setHours(0, 0, 0, 0);
      const diasRestantes = Math.ceil((fechaCosecha - hoy) / (1000 * 60 * 60 * 24));
      const producto = productos.find(p => p.id === l.producto_id);

      if (diasRestantes <= 0) {
        alertasList.push({
          id: `lote-cosechar-${l.id}`,
          tipo: 'produccion',
          prioridad: 'alta',
          titulo: `Lote ${l.codigo || l.id} listo para cosechar`,
          mensaje: `${producto?.nombre || 'Producto'} - ${l.bandejas} bandejas`,
          icono: Sprout,
          color: 'bg-green-500',
          accion: () => setActiveSection('produccion')
        });
      } else if (diasRestantes <= 2) {
        alertasList.push({
          id: `lote-pronto-${l.id}`,
          tipo: 'produccion',
          prioridad: 'baja',
          titulo: `Lote ${l.codigo || l.id} cosecha en ${diasRestantes}d`,
          mensaje: `${producto?.nombre || 'Producto'} - ${l.bandejas} bandejas`,
          icono: Sprout,
          color: 'bg-emerald-400',
          accion: () => setActiveSection('produccion')
        });
      }
    });

    // 5. Tareas vencidas o urgentes
    tareas.filter(t => !t.completada && t.fecha_limite).forEach(t => {
      const fechaLimite = new Date(t.fecha_limite);
      fechaLimite.setHours(0, 0, 0, 0);
      const diasRestantes = Math.ceil((fechaLimite - hoy) / (1000 * 60 * 60 * 24));

      if (diasRestantes < 0) {
        alertasList.push({
          id: `tarea-vencida-${t.id}`,
          tipo: 'tarea',
          prioridad: 'alta',
          titulo: `Tarea vencida: ${t.titulo}`,
          mensaje: `Venció hace ${Math.abs(diasRestantes)} días`,
          icono: CheckCircle,
          color: 'bg-red-500',
          accion: () => setActiveSection('tareas')
        });
      } else if (diasRestantes === 0 && t.prioridad === 'alta') {
        alertasList.push({
          id: `tarea-hoy-${t.id}`,
          tipo: 'tarea',
          prioridad: 'alta',
          titulo: `Tarea urgente HOY: ${t.titulo}`,
          mensaje: t.descripcion || 'Sin descripción',
          icono: CheckCircle,
          color: 'bg-amber-500',
          accion: () => setActiveSection('tareas')
        });
      }
    });

    // 6. Condiciones ambientales fuera de rango
    const ultimaCondicion = condiciones.length > 0 ? condiciones[0] : null;
    if (ultimaCondicion) {
      const rangos = { temperatura: { min: 18, max: 24 }, humedad: { min: 50, max: 70 } };
      
      if (ultimaCondicion.temperatura < rangos.temperatura.min) {
        alertasList.push({
          id: 'temp-baja',
          tipo: 'ambiente',
          prioridad: 'alta',
          titulo: 'Temperatura BAJA',
          mensaje: `${ultimaCondicion.temperatura}°C (mínimo: ${rangos.temperatura.min}°C)`,
          icono: Sun,
          color: 'bg-blue-500',
          accion: () => setActiveSection('ambiente')
        });
      } else if (ultimaCondicion.temperatura > rangos.temperatura.max) {
        alertasList.push({
          id: 'temp-alta',
          tipo: 'ambiente',
          prioridad: 'alta',
          titulo: 'Temperatura ALTA',
          mensaje: `${ultimaCondicion.temperatura}°C (máximo: ${rangos.temperatura.max}°C)`,
          icono: Sun,
          color: 'bg-red-500',
          accion: () => setActiveSection('ambiente')
        });
      }
      
      if (ultimaCondicion.humedad < rangos.humedad.min) {
        alertasList.push({
          id: 'hum-baja',
          tipo: 'ambiente',
          prioridad: 'media',
          titulo: 'Humedad BAJA',
          mensaje: `${ultimaCondicion.humedad}% (mínimo: ${rangos.humedad.min}%)`,
          icono: Sprout,
          color: 'bg-amber-500',
          accion: () => setActiveSection('ambiente')
        });
      } else if (ultimaCondicion.humedad > rangos.humedad.max) {
        alertasList.push({
          id: 'hum-alta',
          tipo: 'ambiente',
          prioridad: 'media',
          titulo: 'Humedad ALTA',
          mensaje: `${ultimaCondicion.humedad}% (máximo: ${rangos.humedad.max}%)`,
          icono: Sprout,
          color: 'bg-amber-500',
          accion: () => setActiveSection('ambiente')
        });
      }
    }

    // 7. Alertas de IVA trimestral y asesoría
    const diaDelMes = hoy.getDate();
    const mesActual = hoy.getMonth();
    
    // Recordatorio IVA trimestral (días 1-20 de Abril, Julio, Octubre, Enero)
    const mesesIVA = [0, 3, 6, 9]; // Enero, Abril, Julio, Octubre
    if (mesesIVA.includes(mesActual) && diaDelMes <= 20) {
      const trimestre = mesActual === 0 ? 'T4' : `T${Math.floor((mesActual) / 3)}`;
      alertasList.push({
        id: 'iva-trimestral',
        tipo: 'fiscal',
        prioridad: diaDelMes >= 15 ? 'critica' : 'alta',
        titulo: `Presentar IVA ${trimestre}`,
        mensaje: `Modelo 303 - Fecha límite: día 20`,
        icono: Euro,
        color: diaDelMes >= 15 ? 'bg-red-500' : 'bg-amber-500',
        accion: () => setActiveSection('contabilidad')
      });
    }
    
    // Recordatorio envío mensual a asesoría (primeros 5 días del mes)
    if (diaDelMes <= 5) {
      const mesAnterior = new Date(hoy.getFullYear(), mesActual - 1).toLocaleDateString('es-ES', { month: 'long' });
      alertasList.push({
        id: 'asesoria-mensual',
        tipo: 'fiscal',
        prioridad: diaDelMes >= 3 ? 'alta' : 'media',
        titulo: `Enviar docs a asesoría`,
        mensaje: `Documentación de ${mesAnterior}`,
        icono: Mail,
        color: diaDelMes >= 3 ? 'bg-amber-500' : 'bg-blue-500',
        accion: () => setActiveSection('contabilidad')
      });
    }

    // Ordenar por prioridad
    const prioridadOrden = { critica: 0, alta: 1, media: 2, baja: 3 };
    return alertasList.sort((a, b) => prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]);
  }, [productos, pedidos, facturas, lotes, tareas, clientes, condiciones]);

  const alertasNoLeidas = alertas.length;
  const alertasCriticas = alertas.filter(a => a.prioridad === 'critica').length;

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());
  };

  // CRUD
  const handleSave = async (table, form, id = null) => {
    try {
      let result;
      let newRecordId = null;
      let datosAnteriores = null;
      
      // Si es actualización, guardar datos anteriores
      if (id) {
        const { data: anterior } = await supabase.from(table).select('*').eq('id', id).single();
        datosAnteriores = anterior;
        result = await supabase.from(table).update(form).eq('id', id); 
      } else {
        // Para lotes, generar código legible (no tocar el id que es auto-increment)
        if (table === 'lotes') {
          const year = new Date().getFullYear();
          const { count } = await supabase.from('lotes').select('*', { count: 'exact', head: true });
          form.codigo = `L-${year}-${String((count || 0) + 1).padStart(3, '0')}`;
        }
        result = await supabase.from(table).insert(form).select();
        if (result.data && result.data[0]) {
          newRecordId = result.data[0].id;
        }
      }
      
      if (result.error) {
        console.error('Error guardando:', result.error);
        alert('Error: ' + result.error.message);
        return;
      }
      
      // REGISTRAR AUDITORÍA
      const accion = id ? 'ACTUALIZAR' : 'CREAR';
      const registroId = id || newRecordId;
      const descripcion = id 
        ? `Actualizado ${table} #${registroId}` 
        : `Creado nuevo ${table} #${registroId}`;
      await registrarAuditoria(accion, table, registroId, datosAnteriores, form, descripcion);
      
      // ASIENTO CONTABLE AUTOMÁTICO para gastos nuevos
      if (table === 'gastos' && !id && newRecordId) {
        const proveedor = proveedores.find(p => p.id === form.proveedor_id);
        await crearAsientoDesdeGasto({ ...form, id: newRecordId }, proveedor);
      }
      
      setShowModal(null);
      setEditingItem(null);
      // Refrescar datos inmediatamente
      if (table === 'clientes') refetchClientes();
      else if (table === 'productos') refetchProductos();
      else if (table === 'leads') refetchLeads();
      else if (table === 'gastos') refetchGastos();
      else if (table === 'lotes') refetchLotes();
      else if (table === 'proveedores') refetchProveedores();
      else if (table === 'tareas') refetchTareas();
      else if (table === 'mermas') refetchMermas();
    } catch (error) { 
      console.error('Error:', error); 
      alert('Error: ' + error.message);
    }
  };

  const handleDelete = async (table, id) => {
    if (window.confirm('¿Eliminar este elemento?')) {
      // Guardar datos antes de eliminar para auditoría
      const { data: datosAnteriores } = await supabase.from(table).select('*').eq('id', id).single();
      
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) {
        alert('Error al eliminar: ' + error.message);
        return;
      }
      
      // REGISTRAR AUDITORÍA
      await registrarAuditoria('ELIMINAR', table, id, datosAnteriores, null, `Eliminado ${table} #${id}`);
      
      // Refrescar datos inmediatamente
      if (table === 'clientes') refetchClientes();
      else if (table === 'productos') refetchProductos();
      else if (table === 'leads') refetchLeads();
      else if (table === 'gastos') refetchGastos();
      else if (table === 'lotes') refetchLotes();
      else if (table === 'pedidos') { refetchPedidos(); refetchFacturas(); }
      else if (table === 'proveedores') refetchProveedores();
      else if (table === 'tareas') refetchTareas();
      else if (table === 'mermas') refetchMermas();
    }
  };

  // Import Leads from Excel
  const handleImportLeads = async (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        
        const leadsToInsert = json.map(row => ({
          nombre: row.nombre || row.Nombre || row.NOMBRE || '',
          empresa: row.empresa || row.Empresa || row.EMPRESA || '',
          tipo: (row.tipo || row.Tipo || 'otro').toLowerCase(),
          contacto: row.contacto || row.Contacto || '',
          email: row.email || row.Email || row.EMAIL || '',
          telefono: String(row.telefono || row.Telefono || row.TELEFONO || ''),
          direccion: row.direccion || row.Direccion || '',
          codigo_postal: String(row.codigo_postal || row.cp || row.CP || ''),
          ciudad: row.ciudad || row.Ciudad || 'Madrid',
          zona: (row.zona || row.Zona || 'centro').toLowerCase(),
          estado: 'nuevo',
          origen: 'importado',
          valor_estimado: parseFloat(row.valor_estimado || row.valor || 0) || 0,
          notas: row.notas || row.Notas || ''
        })).filter(l => l.nombre);

        if (leadsToInsert.length > 0) {
          const { error } = await supabase.from('leads').insert(leadsToInsert);
          if (error) throw error;
          refetchLeads(); // Refrescar inmediatamente
          alert(`✅ ${leadsToInsert.length} leads importados correctamente`);
        } else {
          alert('No se encontraron leads válidos en el archivo');
        }
      } catch (err) {
        console.error(err);
        alert('Error al importar: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ==================== MANEJO DE LOTES CON STOCK ====================
  const handleCambiarEstadoLote = async (lote, nuevoEstado) => {
    await supabase.from('lotes').update({ estado: nuevoEstado }).eq('id', lote.id);
    refetchLotes();
  };

  const handleCosecharLote = async (lote) => {
    // Actualizar estado del lote
    await supabase.from('lotes').update({ 
      estado: 'cosechado', 
      fecha_cosecha_real: new Date().toISOString().split('T')[0] 
    }).eq('id', lote.id);
    
    // REPONER STOCK: Añadir bandejas cosechadas al stock del producto
    const producto = productos.find(p => p.id === lote.producto_id);
    if (producto) {
      const nuevoStock = (producto.stock || 0) + (lote.bandejas || 0);
      await supabase.from('productos').update({ stock: nuevoStock }).eq('id', lote.producto_id);
      refetchProductos();
    }
    
    refetchLotes();
    alert(`✅ Lote cosechado. Se añadieron ${lote.bandejas} unidades al stock de ${producto?.nombre}`);
  };

  const handleCreatePedido = async (form) => {
    try {
      const cliente = clientes.find(c => c.id === form.cliente_id);
      const descuento = cliente?.descuento || 0;
      let subtotal = 0;
      const itemsData = form.items.map(item => {
        const prod = productos.find(p => p.id === item.producto_id);
        const itemSubtotal = (prod?.precio || 0) * item.cantidad;
        subtotal += itemSubtotal;
        return { ...item, precio_unitario: prod?.precio || 0, subtotal: itemSubtotal };
      });
      const descuentoAplicado = subtotal * (descuento / 100);
      const total = subtotal - descuentoAplicado;

      const pedidoData = { 
        cliente_id: form.cliente_id, 
        fecha: form.fecha, 
        fecha_entrega: form.fecha_entrega, 
        estado: form.estado, 
        notas: form.notas || '', 
        total 
      };

      let pedidoId;
      if (editingItem) {
        await supabase.from('pedidos').update(pedidoData).eq('id', editingItem.id);
        await supabase.from('pedido_items').delete().eq('pedido_id', editingItem.id);
        pedidoId = editingItem.id;
      } else {
        const { data: newPedido, error: pedidoError } = await supabase.from('pedidos').insert(pedidoData).select().single();
        if (pedidoError) {
          console.error('Error creando pedido:', pedidoError);
          alert('Error al crear pedido: ' + pedidoError.message);
          return;
        }
        pedidoId = newPedido.id;
      }

      // Insertar items
      for (const item of itemsData) {
        await supabase.from('pedido_items').insert({ 
          pedido_id: pedidoId, 
          producto_id: item.producto_id, 
          cantidad: item.cantidad, 
          precio_unitario: item.precio_unitario, 
          subtotal: item.subtotal 
        });
      }

      // STOCK AUTOMÁTICO: Descontar stock de productos (solo para pedidos nuevos)
      if (!editingItem) {
        for (const item of itemsData) {
          const prod = productos.find(p => p.id === item.producto_id);
          if (prod) {
            const nuevoStock = Math.max(0, (prod.stock || 0) - item.cantidad);
            await supabase.from('productos').update({ stock: nuevoStock }).eq('id', item.producto_id);
          }
        }
        refetchProductos();
      }

      // Crear factura automáticamente si es pedido nuevo
      if (!editingItem) {
        const year = new Date().getFullYear();
        const { count } = await supabase.from('facturas').select('*', { count: 'exact', head: true });
        const facturaId = `F-${year}-${String((count || 0) + 1).padStart(4, '0')}`;
        const fechaVencimiento = new Date(); 
        fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
        const baseImponible = total;
        
        // IVA 4% para alimentos (microbrotes)
        const ivaPorcentaje = IVA_VENTAS; // 4%
        const iva = baseImponible * (ivaPorcentaje / 100);
        
        // Recargo de Equivalencia (0.5%) para autónomos minoristas
        const clienteFactura = clientes.find(c => c.id === form.cliente_id);
        const aplicaRE = clienteFactura?.recargo_equivalencia || false;
        const rePorcentaje = aplicaRE ? RE_VENTAS : 0; // 0.5%
        const reImporte = baseImponible * (rePorcentaje / 100);
        
        const fechaHoy = new Date().toISOString().split('T')[0];
        
        const facturaData = { 
          id: facturaId, 
          pedido_id: pedidoId, 
          cliente_id: form.cliente_id, 
          fecha: fechaHoy, 
          fecha_vencimiento: fechaVencimiento.toISOString().split('T')[0], 
          estado: 'pendiente', 
          subtotal, 
          descuento_aplicado: descuentoAplicado, 
          base_imponible: baseImponible, 
          iva_porcentaje: ivaPorcentaje, 
          iva,
          recargo_equivalencia: aplicaRE,
          re_porcentaje: rePorcentaje,
          re_importe: reImporte,
          total: baseImponible + iva + reImporte
        };
        
        await supabase.from('facturas').insert(facturaData);
        
        // ASIENTO CONTABLE AUTOMÁTICO para la factura
        const cliente = clientes.find(c => c.id === form.cliente_id);
        await crearAsientoDesdeFactura({ ...facturaData, id: facturaId }, cliente);
      }
      
      // Refrescar datos inmediatamente
      refetchPedidos();
      refetchPedidoItems();
      refetchFacturas();
      
      setShowModal(null);
      setEditingItem(null);
    } catch (error) { 
      console.error('Error:', error); 
      alert('Error al procesar el pedido. Revisa la consola.');
    }
  };

  // ==================== FORMS ====================
  const ClienteForm = ({ cliente, onSave, onCancel }) => {
    const [form, setForm] = useState(cliente || { 
      nombre: '', tipo: 'restaurante', contacto: '', email: '', telefono: '', 
      direccion: '', codigo_postal: '', ciudad: 'Madrid', zona: 'centro', 
      descuento: 0, cif: '', recargo_equivalencia: false, tipo_fiscal: 'empresa' 
    });
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre" className="col-span-2" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
          <Input label="CIF/NIF" value={form.cif} onChange={e => setForm({...form, cif: e.target.value})} placeholder="B12345678 / 12345678A" />
          <Select label="Tipo Cliente" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} options={[
            { value: 'mercamadrid', label: '🏪 Mercamadrid (Mayorista)' }, 
            { value: 'hotel', label: '🏨 Hotel (HORECA)' }, 
            { value: 'restaurante', label: '🍽️ Restaurante (HORECA)' }, 
            { value: 'catering', label: '🚚 Catering (HORECA)' }, 
            { value: 'tienda', label: '🍎 Tienda/Frutería (Minorista)' },
            { value: 'otro', label: '📦 Otro' }
          ]} />
          <Select label="Tipo Fiscal" value={form.tipo_fiscal || 'empresa'} onChange={e => {
            const esAutonomo = e.target.value === 'autonomo';
            setForm({...form, tipo_fiscal: e.target.value, recargo_equivalencia: esAutonomo && form.tipo === 'tienda'});
          }} options={[
            { value: 'empresa', label: '🏢 Empresa (S.L., S.A.)' },
            { value: 'autonomo', label: '👤 Autónomo (persona física)' },
          ]} />
          <Select label="Zona" value={form.zona} onChange={e => setForm({...form, zona: e.target.value})} options={Object.entries(zonaConfig).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Input label="Descuento (%)" type="number" value={form.descuento} onChange={e => setForm({...form, descuento: parseInt(e.target.value) || 0})} />
          <Input label="Contacto" value={form.contacto} onChange={e => setForm({...form, contacto: e.target.value})} />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <Input label="Teléfono" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} />
          <Input label="Dirección" className="col-span-2" value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})} />
          <Input label="Código Postal" value={form.codigo_postal} onChange={e => setForm({...form, codigo_postal: e.target.value})} placeholder="28001" />
          <Input label="Ciudad" value={form.ciudad} onChange={e => setForm({...form, ciudad: e.target.value})} />
        </div>
        
        {/* Recargo de Equivalencia */}
        {form.tipo_fiscal === 'autonomo' && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={form.recargo_equivalencia || false} 
                onChange={e => setForm({...form, recargo_equivalencia: e.target.checked})} 
                className="w-5 h-5 rounded border-neutral-300 text-amber-500" 
              />
              <div>
                <span className="font-semibold text-amber-800">Aplicar Recargo de Equivalencia (0,5%)</span>
                <p className="text-xs text-amber-600">Obligatorio para autónomos minoristas sujetos a este régimen fiscal</p>
              </div>
            </label>
          </div>
        )}
        
        <p className="text-xs text-neutral-500 p-3 bg-blue-50 rounded-lg">
          <strong>💡 IVA Alimentos:</strong> Los microbrotes tributan al <strong>4% IVA superreducido</strong>. 
          Si el cliente es autónomo minorista, añade el <strong>0,5% de Recargo de Equivalencia</strong>.
        </p>
        
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onSave(form)}>{cliente ? 'Guardar' : 'Crear'}</Button>
        </div>
      </div>
    );
  };

  const LeadForm = ({ lead, onSave, onCancel }) => {
    const [form, setForm] = useState(lead || { nombre: '', empresa: '', tipo: 'restaurante', contacto: '', email: '', telefono: '', direccion: '', codigo_postal: '', ciudad: 'Madrid', zona: 'centro', estado: 'nuevo', origen: 'web', valor_estimado: 0, notas: '' });
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre/Empresa" className="col-span-2" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
          <Input label="Empresa" value={form.empresa} onChange={e => setForm({...form, empresa: e.target.value})} />
          <Select label="Tipo" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} options={Object.entries(tipoClienteConfig).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Select label="Estado" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})} options={Object.entries(estadoLeadConfig).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Select label="Origen" value={form.origen} onChange={e => setForm({...form, origen: e.target.value})} options={Object.entries(origenLeadConfig).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Select label="Zona" value={form.zona} onChange={e => setForm({...form, zona: e.target.value})} options={Object.entries(zonaConfig).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Input label="Valor Estimado (€)" type="number" value={form.valor_estimado} onChange={e => setForm({...form, valor_estimado: parseFloat(e.target.value) || 0})} />
          <Input label="Contacto" value={form.contacto} onChange={e => setForm({...form, contacto: e.target.value})} />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <Input label="Teléfono" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} />
          <Input label="Dirección" className="col-span-2" value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})} />
          <Input label="Código Postal" value={form.codigo_postal} onChange={e => setForm({...form, codigo_postal: e.target.value})} placeholder="28001" />
          <Input label="Ciudad" value={form.ciudad} onChange={e => setForm({...form, ciudad: e.target.value})} />
        </div>
        <div><label className="block text-sm font-semibold text-neutral-700 mb-1.5">Notas</label><textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-orange-500 outline-none" rows={3} /></div>
        <div className="flex justify-end gap-3 pt-4 border-t"><Button variant="secondary" onClick={onCancel}>Cancelar</Button><Button onClick={() => onSave(form)}>{lead ? 'Guardar' : 'Crear'}</Button></div>
      </div>
    );
  };

  const ProductoForm = ({ producto, onSave, onCancel }) => {
    const [form, setForm] = useState(producto || { nombre: '', categoria: 'nutritivos', precio: 0, coste: 0, stock: 0, stock_minimo: 20, unidad: 'bandeja 100g', dias_crecimiento: 7 });
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre" className="col-span-2" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
          <Select label="Categoría" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} options={[{ value: 'picantes', label: 'Picantes' }, { value: 'dulces', label: 'Dulces' }, { value: 'coloridos', label: 'Coloridos' }, { value: 'nutritivos', label: 'Nutritivos' }, { value: 'aromaticos', label: 'Aromáticos' }, { value: 'mix', label: 'Mix' }]} />
          <Input label="Unidad" value={form.unidad} onChange={e => setForm({...form, unidad: e.target.value})} />
          <Input label="Precio (€)" type="number" step="0.5" value={form.precio} onChange={e => setForm({...form, precio: parseFloat(e.target.value) || 0})} />
          <Input label="Coste (€)" type="number" step="0.5" value={form.coste} onChange={e => setForm({...form, coste: parseFloat(e.target.value) || 0})} />
          <Input label="Stock" type="number" value={form.stock} onChange={e => setForm({...form, stock: parseInt(e.target.value) || 0})} />
          <Input label="Stock Mínimo" type="number" value={form.stock_minimo} onChange={e => setForm({...form, stock_minimo: parseInt(e.target.value) || 20})} />
          <Input label="Días Crecimiento" type="number" value={form.dias_crecimiento || 7} onChange={e => setForm({...form, dias_crecimiento: parseInt(e.target.value) || 7})} />
        </div>
        <p className="text-xs text-neutral-500">💡 Los días de crecimiento se usan para calcular la planificación de siembras</p>
        <div className="flex justify-end gap-3 pt-4 border-t"><Button variant="secondary" onClick={onCancel}>Cancelar</Button><Button onClick={() => onSave(form)}>{producto ? 'Guardar' : 'Crear'}</Button></div>
      </div>
    );
  };

  const PedidoForm = ({ pedido, onSave, onCancel }) => {
    const existingItems = pedido ? pedidoItems.filter(i => i.pedido_id === pedido.id).map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad })) : [];
    
    const [form, setForm] = useState({ 
      cliente_id: pedido?.cliente_id || (clientes.length > 0 ? clientes[0].id : null), 
      fecha: pedido?.fecha || new Date().toISOString().split('T')[0], 
      fecha_entrega: pedido?.fecha_entrega || new Date(Date.now() + 2*24*60*60*1000).toISOString().split('T')[0], 
      estado: pedido?.estado || 'pendiente', 
      items: existingItems.length > 0 ? existingItems : (productos.length > 0 ? [{ producto_id: productos[0].id, cantidad: 1 }] : []), 
      notas: pedido?.notas || '' 
    });

    // Verificar que hay clientes y productos DESPUÉS de los hooks
    if (clientes.length === 0) {
      return (
        <div className="text-center py-8">
          <AlertTriangle size={48} className="mx-auto text-amber-500 mb-4" />
          <h3 className="text-lg font-bold text-neutral-900 mb-2">No hay clientes</h3>
          <p className="text-neutral-500 mb-4">Primero debes crear al menos un cliente para poder hacer pedidos.</p>
          <Button onClick={onCancel}>Cerrar</Button>
        </div>
      );
    }
    
    if (productos.length === 0) {
      return (
        <div className="text-center py-8">
          <AlertTriangle size={48} className="mx-auto text-amber-500 mb-4" />
          <h3 className="text-lg font-bold text-neutral-900 mb-2">No hay productos</h3>
          <p className="text-neutral-500 mb-4">Primero debes crear al menos un producto para poder hacer pedidos.</p>
          <Button onClick={onCancel}>Cerrar</Button>
        </div>
      );
    }

    const addItem = () => setForm({...form, items: [...form.items, { producto_id: productos[0].id, cantidad: 1 }]});
    const removeItem = (idx) => setForm({...form, items: form.items.filter((_, i) => i !== idx)});
    const updateItem = (idx, field, value) => { const newItems = [...form.items]; newItems[idx] = {...newItems[idx], [field]: value}; setForm({...form, items: newItems}); };
    const cliente = clientes.find(c => c.id === form.cliente_id);
    const subtotal = form.items.reduce((sum, item) => { const prod = productos.find(p => p.id === item.producto_id); return sum + (prod?.precio || 0) * item.cantidad; }, 0);
    const descuento = cliente?.descuento || 0;
    const total = subtotal * (1 - descuento / 100);
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select label="Cliente" value={form.cliente_id} onChange={e => setForm({...form, cliente_id: parseInt(e.target.value)})} options={clientes.map(c => ({ value: c.id, label: `${c.nombre} (${c.descuento}% dto)` }))} />
          <Select label="Estado" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})} options={Object.entries(estadoConfig).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
          <Input label="Entrega" type="date" value={form.fecha_entrega} onChange={e => setForm({...form, fecha_entrega: e.target.value})} />
        </div>
        <div>
          <div className="flex justify-between mb-2"><label className="text-sm font-semibold text-neutral-700">Productos</label><button type="button" onClick={addItem} className="text-sm text-orange-600 font-semibold flex items-center gap-1"><Plus size={16} />Añadir</button></div>
          <div className="space-y-2 bg-neutral-50 rounded-xl p-3 border">
            {form.items.map((item, idx) => {
              const prod = productos.find(p => p.id === item.producto_id);
              return (
                <div key={idx} className="flex items-center gap-2 bg-white rounded-lg p-2 border">
                  <select value={item.producto_id} onChange={e => updateItem(idx, 'producto_id', parseInt(e.target.value))} className="flex-1 px-3 py-2 rounded-lg border text-sm">
                    {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.unidad || 'ud'}) - {formatCurrency(p.precio)}</option>)}
                  </select>
                  <input type="number" value={item.cantidad} onChange={e => updateItem(idx, 'cantidad', parseInt(e.target.value) || 1)} className="w-20 px-3 py-2 rounded-lg border text-sm text-center" min="1" />
                  <span className="text-sm font-semibold w-24 text-right">{formatCurrency((prod?.precio || 0) * item.cantidad)}</span>
                  {form.items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>}
                </div>
              );
            })}
          </div>
        </div>
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal:</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
            {descuento > 0 && <div className="flex justify-between text-green-600"><span>Descuento ({descuento}%):</span><span>-{formatCurrency(subtotal * descuento / 100)}</span></div>}
            <div className="flex justify-between text-lg font-black pt-2 border-t border-orange-200"><span>Total:</span><span className="text-orange-600">{formatCurrency(total)}</span></div>
          </div>
        </Card>
        <div className="flex justify-end gap-3 pt-4 border-t"><Button variant="secondary" onClick={onCancel}>Cancelar</Button><Button onClick={() => onSave(form)}>{pedido ? 'Guardar' : 'Crear Pedido'}</Button></div>
      </div>
    );
  };

  const GastoForm = ({ gasto, onSave, onCancel }) => {
    const [form, setForm] = useState(gasto || { 
      fecha: new Date().toISOString().split('T')[0], 
      categoria: 'otros', 
      concepto: '', 
      proveedor_id: null, 
      importe: 0, 
      iva_tipo: 'general', // general, reducido, superreducido, exento
      pagado: false, 
      forma_pago: 'banco', 
      factura_url: '' 
    });
    const [uploading, setUploading] = useState(false);
    const [fileName, setFileName] = useState(gasto?.factura_url ? 'Archivo adjunto' : '');

    // Opciones de forma de pago
    const formasPago = [
      { value: 'banco', label: '🏦 Cuenta bancaria empresa (572)' },
      { value: 'caja', label: '💵 Caja efectivo (570)' },
      { value: 'tarjeta_empresa', label: '💳 Tarjeta empresa (572)' },
      { value: 'socio_nico', label: '👤 Pagado por Nico - Deuda a socio (551)' },
      { value: 'socio_peri', label: '👤 Pagado por Peri - Deuda a socio (551)' },
      { value: 'socio_guzman', label: '👤 Pagado por Guzmán - Deuda a socio (551)' },
    ];

    // Tipos de IVA
    const tiposIVA = [
      { value: 'general', label: '21% General (servicios, suministros)' },
      { value: 'reducido', label: '10% Reducido (transporte, hostelería)' },
      { value: 'superreducido', label: '4% Superreducido (alimentos básicos)' },
      { value: 'exento', label: '0% Exento (seguros, formación)' },
    ];

    const handleFileUpload = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setUploading(true);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('facturas-gastos')
          .upload(fileName, file);
        
        if (error) {
          if (error.message.includes('bucket') || error.message.includes('not found')) {
            alert('⚠️ El bucket de almacenamiento no está configurado.\n\nVe a Supabase → Storage → New Bucket → Nombre: "facturas-gastos" → Public: ON');
          } else {
            throw error;
          }
        } else {
          const { data: urlData } = supabase.storage.from('facturas-gastos').getPublicUrl(fileName);
          setForm({...form, factura_url: urlData.publicUrl});
          setFileName(file.name);
        }
      } catch (err) {
        console.error('Error subiendo archivo:', err);
        alert('Error al subir el archivo: ' + err.message);
      }
      setUploading(false);
    };

    const removeFile = () => {
      setForm({...form, factura_url: ''});
      setFileName('');
    };

    // Calcular base e IVA según el tipo seleccionado
    const ivaPorcentaje = TIPOS_IVA[form.iva_tipo || 'general']?.valor || 21;
    const divisor = 1 + (ivaPorcentaje / 100);
    const base = form.importe ? (parseFloat(form.importe) / divisor).toFixed(2) : '0.00';
    const iva = form.importe ? (parseFloat(form.importe) - parseFloat(base)).toFixed(2) : '0.00';
    const cuentaGasto = categoriasGasto[form.categoria]?.cuenta || '629';

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
          <Select label="Categoría (cuenta PGC)" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} options={Object.entries(categoriasGasto).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Input label="Concepto" className="col-span-2" value={form.concepto} onChange={e => setForm({...form, concepto: e.target.value})} />
          <Select 
            label="Proveedor" 
            value={form.proveedor_id || ''} 
            onChange={e => setForm({...form, proveedor_id: e.target.value ? parseInt(e.target.value) : null})} 
            options={[{ value: '', label: 'Sin proveedor' }, ...proveedores.map(p => ({ value: p.id, label: p.nombre }))]} 
          />
          <Select 
            label="Tipo de IVA" 
            value={form.iva_tipo || 'general'} 
            onChange={e => setForm({...form, iva_tipo: e.target.value})} 
            options={tiposIVA} 
          />
          <Input label="Importe TOTAL con IVA (€)" type="number" step="0.01" value={form.importe} onChange={e => setForm({...form, importe: parseFloat(e.target.value) || 0})} />
          <Select 
            label="Forma de pago" 
            value={form.forma_pago || 'banco'} 
            onChange={e => setForm({...form, forma_pago: e.target.value})} 
            options={formasPago} 
          />
        </div>

        {/* Desglose contable */}
        {form.importe > 0 && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-sm">
            <p className="font-semibold text-purple-800 mb-2">📊 Desglose contable (asiento automático):</p>
            <div className="grid grid-cols-3 gap-2 text-purple-700">
              <div><span className="font-mono">{cuentaGasto}</span> Gasto: <strong>{base}€</strong> (D)</div>
              <div><span className="font-mono">472</span> IVA {ivaPorcentaje}%: <strong>{iva}€</strong> (D)</div>
              <div><span className="font-mono">{form.forma_pago?.startsWith('socio_') ? '551' : form.forma_pago === 'caja' ? '570' : '572'}</span> Pago: <strong>{form.importe}€</strong> (H)</div>
            </div>
          </div>
        )}
        
        {/* Adjuntar factura */}
        <div className="border-t pt-4">
          <label className="block text-sm font-semibold text-neutral-700 mb-2">Factura / Justificante</label>
          {form.factura_url ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
              <FileText size={24} className="text-green-600" />
              <div className="flex-1">
                <p className="font-medium text-green-800">{fileName || 'Archivo adjunto'}</p>
                <a href={form.factura_url} target="_blank" rel="noopener noreferrer" className="text-sm text-green-600 hover:underline">Ver archivo</a>
              </div>
              <button type="button" onClick={removeFile} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-3 p-4 border-2 border-dashed border-neutral-300 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileUpload} disabled={uploading} />
              {uploading ? (
                <><Loader2 size={24} className="animate-spin text-orange-500" /><span className="text-neutral-600">Subiendo...</span></>
              ) : (
                <><Upload size={24} className="text-neutral-400" /><span className="text-neutral-600">Click para adjuntar PDF o imagen</span></>
              )}
            </label>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.pagado} onChange={e => setForm({...form, pagado: e.target.checked})} className="w-5 h-5 rounded border-neutral-300 text-orange-500" />
            <span className="font-semibold">Pagado</span>
          </label>
        </div>
        
        <div className="flex justify-end gap-3 pt-4 border-t"><Button variant="secondary" onClick={onCancel}>Cancelar</Button><Button onClick={() => onSave(form)}>{gasto ? 'Guardar' : 'Crear Gasto'}</Button></div>
      </div>
    );
  };

  const LoteForm = ({ lote, onSave, onCancel }) => {
    const [form, setForm] = useState({ 
      producto_id: lote?.producto_id || (productos.length > 0 ? productos[0].id : null), 
      fecha_siembra: lote?.fecha_siembra || new Date().toISOString().split('T')[0], 
      fecha_cosecha_prevista: lote?.fecha_cosecha_prevista || '', 
      bandejas: lote?.bandejas || 20, 
      estado: lote?.estado || 'sembrado' 
    });
    
    useEffect(() => {
      if (form.producto_id && form.fecha_siembra && productos.length > 0) {
        const prod = productos.find(p => p.id === form.producto_id);
        if (prod) { 
          const fecha = new Date(form.fecha_siembra); 
          fecha.setDate(fecha.getDate() + (prod.dias_crecimiento || 7)); 
          setForm(f => ({...f, fecha_cosecha_prevista: fecha.toISOString().split('T')[0]})); 
        }
      }
    }, [form.producto_id, form.fecha_siembra]);

    // Verificar que hay productos
    if (productos.length === 0) {
      return (
        <div className="text-center py-8">
          <AlertTriangle size={48} className="mx-auto text-amber-500 mb-4" />
          <h3 className="text-lg font-bold text-neutral-900 mb-2">No hay productos</h3>
          <p className="text-neutral-500 mb-4">Primero debes crear al menos un producto para crear lotes de producción.</p>
          <Button onClick={onCancel}>Cerrar</Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select label="Producto" className="col-span-2" value={form.producto_id} onChange={e => setForm({...form, producto_id: parseInt(e.target.value)})} options={productos.map(p => ({ value: p.id, label: `${p.nombre} (${p.dias_crecimiento || 7}d)` }))} />
          <Input label="Siembra" type="date" value={form.fecha_siembra} onChange={e => setForm({...form, fecha_siembra: e.target.value})} />
          <Input label="Cosecha Prevista" type="date" value={form.fecha_cosecha_prevista} readOnly className="bg-neutral-100" />
          <Input label="Bandejas" type="number" value={form.bandejas} onChange={e => setForm({...form, bandejas: parseInt(e.target.value) || 1})} />
          <Select label="Estado" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})} options={Object.entries(estadoLoteConfig).map(([k, v]) => ({ value: k, label: v.label }))} />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t"><Button variant="secondary" onClick={onCancel}>Cancelar</Button><Button onClick={() => onSave(form)}>{lote ? 'Guardar' : 'Crear Lote'}</Button></div>
      </div>
    );
  };

  // ==================== PROVEEDOR FORM ====================
  const ProveedorForm = ({ proveedor, onSave, onCancel }) => {
    const [form, setForm] = useState(proveedor || { 
      nombre: '', 
      categoria: 'otros', 
      contacto: '', 
      email: '', 
      telefono: '', 
      direccion: '', 
      notas: '' 
    });
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre" className="col-span-2" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
          <Select label="Categoría" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} options={Object.entries(categoriaProveedorConfig).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Input label="Contacto" value={form.contacto} onChange={e => setForm({...form, contacto: e.target.value})} />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <Input label="Teléfono" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} />
          <Input label="Dirección" className="col-span-2" value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})} />
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Notas</label>
            <textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-orange-500 outline-none" rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t"><Button variant="secondary" onClick={onCancel}>Cancelar</Button><Button onClick={() => onSave(form)}>{proveedor ? 'Guardar' : 'Crear Proveedor'}</Button></div>
      </div>
    );
  };

  // ==================== TAREA FORM ====================
  const TareaForm = ({ tarea, onSave, onCancel }) => {
    const [form, setForm] = useState(tarea || { 
      titulo: '', 
      descripcion: '', 
      categoria: 'otro', 
      prioridad: 'media', 
      fecha_limite: '', 
      cliente_id: null,
      asignado_a: null,
      completada: false 
    });
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Título" className="col-span-2" value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} />
          <Select label="Categoría" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} options={Object.entries(categoriaTareaConfig).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Select label="Prioridad" value={form.prioridad} onChange={e => setForm({...form, prioridad: e.target.value})} options={Object.entries(prioridadTareaConfig).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Input label="Fecha límite" type="date" value={form.fecha_limite} onChange={e => setForm({...form, fecha_limite: e.target.value})} />
          <Select label="Asignar a" value={form.asignado_a || ''} onChange={e => setForm({...form, asignado_a: e.target.value || null})} options={[{ value: '', label: 'Sin asignar' }, ...SOCIOS.map(s => ({ value: s.id, label: s.nombre }))]} />
          <Select label="Cliente (opcional)" className="col-span-2" value={form.cliente_id || ''} onChange={e => setForm({...form, cliente_id: e.target.value ? parseInt(e.target.value) : null})} options={[{ value: '', label: 'Sin cliente' }, ...clientes.map(c => ({ value: c.id, label: c.nombre }))]} />
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Descripción</label>
            <textarea value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-orange-500 outline-none" rows={3} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t"><Button variant="secondary" onClick={onCancel}>Cancelar</Button><Button onClick={() => onSave(form)}>{tarea ? 'Guardar' : 'Crear Tarea'}</Button></div>
      </div>
    );
  };

  // ==================== MERMA FORM ====================
  const MermaForm = ({ merma, onSave, onCancel }) => {
    const [form, setForm] = useState(merma || { 
      lote_id: lotes.length > 0 ? lotes[0].id : '', 
      cantidad: 1, 
      motivo: 'plagas', 
      fecha: new Date().toISOString().split('T')[0],
      notas: '' 
    });

    const motivosConfig = {
      plagas: 'Plagas',
      hongos: 'Hongos/Moho',
      riego: 'Problemas de riego',
      temperatura: 'Temperatura',
      germinacion: 'Fallo germinación',
      manipulacion: 'Manipulación',
      caducidad: 'Caducidad',
      otros: 'Otros'
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select label="Lote" className="col-span-2" value={form.lote_id} onChange={e => setForm({...form, lote_id: e.target.value})} options={lotes.map(l => ({ value: l.id, label: `${l.codigo || 'L-'+l.id} - ${productos.find(p => p.id === l.producto_id)?.nombre || 'Producto'}` }))} />
          <Input label="Cantidad perdida" type="number" value={form.cantidad} onChange={e => setForm({...form, cantidad: parseInt(e.target.value) || 0})} />
          <Select label="Motivo" value={form.motivo} onChange={e => setForm({...form, motivo: e.target.value})} options={Object.entries(motivosConfig).map(([k, v]) => ({ value: k, label: v }))} />
          <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Notas</label>
            <textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-orange-500 outline-none" rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t"><Button variant="secondary" onClick={onCancel}>Cancelar</Button><Button onClick={() => onSave(form)}>{merma ? 'Guardar' : 'Registrar Merma'}</Button></div>
      </div>
    );
  };

  // ==================== PEDIDO RECURRENTE FORM ====================
  const PedidoRecurrenteForm = ({ onSave, onCancel }) => {
    const [form, setForm] = useState({
      nombre: '',
      cliente_id: clientes.length > 0 ? clientes[0].id : '',
      frecuencia: 'semanal',
      dia_semana: 1,
      notas: ''
    });
    const [items, setItems] = useState([{ producto_id: productos.length > 0 ? productos[0].id : '', cantidad: 1 }]);

    const diasSemana = [
      { value: 1, label: 'Lunes' },
      { value: 2, label: 'Martes' },
      { value: 3, label: 'Miércoles' },
      { value: 4, label: 'Jueves' },
      { value: 5, label: 'Viernes' },
      { value: 6, label: 'Sábado' },
      { value: 0, label: 'Domingo' }
    ];

    const frecuencias = [
      { value: 'semanal', label: 'Semanal (cada semana)' },
      { value: 'quincenal', label: 'Quincenal (cada 2 semanas)' },
      { value: 'mensual', label: 'Mensual (cada mes)' }
    ];

    const addItem = () => {
      setItems([...items, { producto_id: productos.length > 0 ? productos[0].id : '', cantidad: 1 }]);
    };

    const removeItem = (index) => {
      if (items.length > 1) {
        setItems(items.filter((_, i) => i !== index));
      }
    };

    const updateItem = (index, field, value) => {
      const newItems = [...items];
      newItems[index][field] = value;
      setItems(newItems);
    };

    const totalEstimado = items.reduce((sum, item) => {
      const prod = productos.find(p => p.id === parseInt(item.producto_id));
      return sum + ((prod?.precio || 0) * item.cantidad);
    }, 0);

    const handleSubmit = async () => {
      if (!form.nombre.trim()) {
        alert('Por favor ingresa un nombre para el pedido recurrente');
        return;
      }
      if (!form.cliente_id) {
        alert('Por favor selecciona un cliente');
        return;
      }
      if (items.length === 0 || items.some(i => !i.producto_id)) {
        alert('Por favor añade al menos un producto');
        return;
      }

      // Crear pedido recurrente
      const { data: pr, error } = await supabase.from('pedidos_recurrentes').insert({
        ...form,
        dia_semana: parseInt(form.dia_semana),
        activo: true
      }).select().single();

      if (error) {
        alert('Error al crear: ' + error.message);
        return;
      }

      // Insertar items
      for (const item of items) {
        await supabase.from('pedidos_recurrentes_items').insert({
          pedido_recurrente_id: pr.id,
          producto_id: parseInt(item.producto_id),
          cantidad: item.cantidad
        });
      }

      refetchPedidosRecurrentes();
      refetchPedidosRecurrentesItems();
      onSave();
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="Nombre del pedido" 
            className="col-span-2" 
            value={form.nombre} 
            onChange={e => setForm({...form, nombre: e.target.value})} 
            placeholder="Ej: Pedido semanal Hotel Palace"
          />
          <Select 
            label="Cliente" 
            className="col-span-2"
            value={form.cliente_id} 
            onChange={e => setForm({...form, cliente_id: e.target.value})} 
            options={clientes.map(c => ({ value: c.id, label: c.nombre }))} 
          />
          <Select 
            label="Frecuencia" 
            value={form.frecuencia} 
            onChange={e => setForm({...form, frecuencia: e.target.value})} 
            options={frecuencias} 
          />
          <Select 
            label="Día de entrega" 
            value={form.dia_semana} 
            onChange={e => setForm({...form, dia_semana: e.target.value})} 
            options={diasSemana} 
          />
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-neutral-700">Productos</label>
            <button onClick={addItem} className="text-sm text-orange-500 hover:text-orange-600 font-semibold flex items-center gap-1">
              <Plus size={16} /> Añadir producto
            </button>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-neutral-50 rounded-lg">
                <select 
                  value={item.producto_id} 
                  onChange={e => updateItem(index, 'producto_id', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border text-sm"
                >
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} - {formatCurrency(p.precio)}</option>
                  ))}
                </select>
                <input 
                  type="number" 
                  min="1" 
                  value={item.cantidad} 
                  onChange={e => updateItem(index, 'cantidad', parseInt(e.target.value) || 1)}
                  className="w-20 px-3 py-2 rounded-lg border text-sm text-center"
                />
                <button 
                  onClick={() => removeItem(index)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-700">Total estimado por pedido:</span>
            <span className="text-2xl font-black text-orange-600">{formatCurrency(totalEstimado)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleSubmit}><Repeat size={18} /> Crear Recurrente</Button>
        </div>
      </div>
    );
  };

  // ==================== NAV ====================
  const NavItem = ({ icon: Icon, label, section, badge }) => (
    <button onClick={() => { setActiveSection(section); if (window.innerWidth < 768) setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeSection === section ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}>
      <Icon size={20} />
      {sidebarOpen && <><span className="font-semibold flex-1 text-left">{label}</span>{badge > 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeSection === section ? 'bg-white/20' : 'bg-orange-500 text-white'}`}>{badge}</span>}</>}
    </button>
  );

  // ==================== RENDER SECTIONS ====================
  const renderDashboard = () => {
    const last7Days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toISOString().split('T')[0]; });
    const ventasData = last7Days.map(fecha => ({ fecha: formatDateShort(fecha), ventas: pedidos.filter(p => p.fecha === fecha && p.estado === 'entregado').reduce((sum, p) => sum + (p.total || 0), 0) }));
    const gastosPorCategoria = Object.entries(categoriasGasto).map(([key, val]) => ({ name: val.label, value: gastosFiltrados.filter(g => g.categoria === key).reduce((sum, g) => sum + (g.importe || 0), 0) })).filter(g => g.value > 0);
    const beneficio = ventasPeriodo - gastosPeriodo;

    const periodoLabel = dashboardPeriodo === 'mes_actual' ? 'Este mes' : 
                         dashboardPeriodo === 'año_actual' ? 'Este año' : 
                         getMesesDisponibles().find(m => m.value === dashboardPeriodo)?.label || 'Periodo';

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-neutral-900">¡Hola, {userProfile?.nombre?.split(' ')[0] || 'Usuario'}!</h1>
            <p className="text-neutral-500 mt-1 font-medium text-sm md:text-base">Panel de control de RootFlow ERP</p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-neutral-400 hidden sm:block" />
            <select 
              value={dashboardPeriodo} 
              onChange={e => setDashboardPeriodo(e.target.value)}
              className="px-3 md:px-4 py-2 rounded-xl border border-neutral-200 bg-white font-semibold text-neutral-700 focus:ring-2 focus:ring-orange-500 outline-none text-sm md:text-base w-full sm:w-auto"
            >
              <option value="mes_actual">Este mes</option>
              <option value="año_actual">Año {new Date().getFullYear()}</option>
              <optgroup label="Meses anteriores">
                {getMesesDisponibles().slice(1).map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
        
        <Card className="p-3 md:p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
          <p className="text-xs md:text-sm font-medium text-orange-700">📊 Mostrando datos de: <span className="font-bold">{periodoLabel}</span></p>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4">
          <StatCard icon={Euro} label="Ventas" value={formatCurrency(ventasPeriodo)} color="bg-green-100 text-green-600" />
          <StatCard icon={Wallet} label="Gastos" value={formatCurrency(gastosPeriodo)} color="bg-red-100 text-red-600" />
          <StatCard icon={TrendingUp} label="Beneficio" value={formatCurrency(beneficio)} color={beneficio >= 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"} />
          <StatCard icon={ShoppingCart} label="Pedidos" value={pedidosPendientes} color="bg-amber-100 text-amber-600" onClick={() => setActiveSection('pedidos')} />
          <StatCard icon={Target} label="Leads" value={leadsNuevos} color="bg-purple-100 text-purple-600" onClick={() => setActiveSection('leads')} />
          <StatCard icon={Users} label="Clientes" value={clientes.length} color="bg-blue-100 text-blue-600" onClick={() => setActiveSection('clientes')} />
          <StatCard icon={AlertCircle} label="Stock Bajo" value={stockBajo} color="bg-red-100 text-red-600" onClick={() => setActiveSection('productos')} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5"><h3 className="text-lg font-bold text-neutral-900 mb-4">Ventas 7 Días</h3><div className="h-64"><ResponsiveContainer><AreaChart data={ventasData}><defs><linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F97316" stopOpacity={0.3}/><stop offset="95%" stopColor="#F97316" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" /><XAxis dataKey="fecha" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip formatter={(v) => formatCurrency(v)} /><Area type="monotone" dataKey="ventas" stroke="#F97316" strokeWidth={3} fill="url(#colorVentas)" /></AreaChart></ResponsiveContainer></div></Card>
          <Card className="p-5"><h3 className="text-lg font-bold text-neutral-900 mb-4">Gastos por Categoría ({periodoLabel})</h3><div className="h-64">{gastosPorCategoria.length > 0 ? <ResponsiveContainer><RechartsPie><Pie data={gastosPorCategoria} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>{gastosPorCategoria.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={(v) => formatCurrency(v)} /></RechartsPie></ResponsiveContainer> : <div className="h-full flex items-center justify-center text-neutral-400">Sin gastos en este periodo</div>}</div></Card>
        </div>
      </div>
    );
  };

  const renderClientes = () => {
    // Aplicar filtros
    const clientesFiltrados = aplicarFiltros(
      clientes.filter(c => c.nombre?.toLowerCase().includes(searchTerm.toLowerCase())),
      filtrosClientes,
      {
        tipo: c => c.tipo,
        zona: c => c.zona,
        descuento: c => c.descuento,
        codigo_postal: c => c.codigo_postal,
      }
    );
    const filtered = clientesFiltrados;
    const exportColumns = [{ header: 'Nombre', accessor: c => c.nombre },{ header: 'Tipo', accessor: c => tipoClienteConfig[c.tipo]?.label },{ header: 'CP', accessor: c => c.codigo_postal },{ header: 'Zona', accessor: c => zonaConfig[c.zona]?.label },{ header: 'Email', accessor: c => c.email },{ header: 'Teléfono', accessor: c => c.telefono },{ header: 'Descuento', accessor: c => c.descuento }];
    
    const tipoOptions = Object.entries(tipoClienteConfig).map(([k, v]) => ({ value: k, label: v.label }));
    const zonaOptions = Object.entries(zonaConfig).map(([k, v]) => ({ value: k, label: v.label }));
    
    // Limpiar todos los filtros
    const limpiarFiltrosClientes = () => setFiltrosClientes({});
    const hayFiltrosActivos = Object.values(filtrosClientes).some(v => v && v !== '');

    // Vista Grid (tarjetas)
    const renderGridView = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(cliente => {
          const config = tipoClienteConfig[cliente.tipo] || tipoClienteConfig.restaurante;
          const Icon = config.icon;
          return (
            <Card key={cliente.id} className="p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${config.color} border`}><Icon size={20} /></div>
                <Badge className={zonaConfig[cliente.zona]?.color}>{zonaConfig[cliente.zona]?.label}</Badge>
              </div>
              <h3 className="font-bold text-neutral-900 text-lg truncate">{cliente.nombre}</h3>
              <p className="text-sm text-neutral-500 mb-3">{cliente.contacto}</p>
              {cliente.codigo_postal && <p className="text-xs text-neutral-400 mb-2 flex items-center gap-1"><MapPin size={12} />{cliente.codigo_postal} - {cliente.ciudad}</p>}
              <div className="flex items-center justify-between pt-3 border-t">
                <Badge variant="orange">{cliente.descuento}% dto</Badge>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingItem(cliente); setShowModal('cliente'); }} className="p-2 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete('clientes', cliente.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );

    // Vista Lista
    const renderListView = () => (
      <div className="space-y-3">
        {filtered.map(cliente => {
          const config = tipoClienteConfig[cliente.tipo] || tipoClienteConfig.restaurante;
          const Icon = config.icon;
          return (
            <Card key={cliente.id} className="p-4 hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${config.color} border flex-shrink-0`}><Icon size={24} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-neutral-900">{cliente.nombre}</h3>
                    <Badge className={zonaConfig[cliente.zona]?.color}>{zonaConfig[cliente.zona]?.label}</Badge>
                    <Badge variant="orange">{cliente.descuento}% dto</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-neutral-500 flex-wrap">
                    {cliente.contacto && <span>{cliente.contacto}</span>}
                    {cliente.email && <span className="flex items-center gap-1"><Mail size={12} />{cliente.email}</span>}
                    {cliente.telefono && <span className="flex items-center gap-1"><Phone size={12} />{cliente.telefono}</span>}
                    {cliente.codigo_postal && <span className="flex items-center gap-1"><MapPin size={12} />{cliente.codigo_postal}</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditingItem(cliente); setShowModal('cliente'); }} className="p-2 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Edit2 size={18} /></button>
                  <button onClick={() => handleDelete('clientes', cliente.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );

    // Vista Tabla con filtros
    const renderTableView = () => (
      <Card className="overflow-hidden">
        {hayFiltrosActivos && (
          <div className="p-3 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
            <span className="text-sm text-orange-700">🔍 Filtros activos - {filtered.length} resultados</span>
            <button onClick={limpiarFiltrosClientes} className="text-xs text-orange-600 hover:text-orange-800 font-medium">Limpiar filtros</button>
          </div>
        )}
        {selectedClientes.length > 0 && (
          <div className="p-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
            <span className="font-semibold text-blue-700">{selectedClientes.length} cliente(s) seleccionado(s)</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedClientes([])}>Deseleccionar</Button>
              <Button variant="secondary" size="sm" className="text-red-600" onClick={() => handleDeleteMultiple('clientes', selectedClientes, refetchClientes, setSelectedClientes)}>
                <Trash2 size={14} /> Eliminar
              </Button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-neutral-900 text-white">
            <tr>
              <th className="px-3 py-3 text-left w-10">
                <input type="checkbox" checked={filtered.length > 0 && selectedClientes.length === filtered.length} onChange={e => setSelectedClientes(e.target.checked ? filtered.map(c => c.id) : [])} className="w-4 h-4 rounded" />
              </th>
              <FilterableHeader label="Cliente" field="nombre" filters={filtrosClientes} onFilter={updateFilter(setFiltrosClientes)} type="text" />
              <FilterableHeader label="Tipo" field="tipo" filters={filtrosClientes} onFilter={updateFilter(setFiltrosClientes)} type="select" options={tipoOptions} />
              <FilterableHeader label="Zona" field="zona" filters={filtrosClientes} onFilter={updateFilter(setFiltrosClientes)} type="select" options={zonaOptions} />
              <FilterableHeader label="CP" field="codigo_postal" filters={filtrosClientes} onFilter={updateFilter(setFiltrosClientes)} type="text" />
              <FilterableHeader label="Dto" field="descuento" filters={filtrosClientes} onFilter={updateFilter(setFiltrosClientes)} type="number" />
              <th className="text-right px-3 md:px-5 py-3 md:py-4 text-xs md:text-sm font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(cliente => {
              const config = tipoClienteConfig[cliente.tipo] || tipoClienteConfig.restaurante;
              const isSelected = selectedClientes.includes(cliente.id);
              return (
                <tr key={cliente.id} className={`border-b border-neutral-100 hover:bg-neutral-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={isSelected} onChange={e => setSelectedClientes(e.target.checked ? [...selectedClientes, cliente.id] : selectedClientes.filter(id => id !== cliente.id))} className="w-4 h-4 rounded" />
                  </td>
                  <td className="px-3 md:px-5 py-3 md:py-4">
                    <p className="font-bold text-neutral-900 text-sm">{cliente.nombre}</p>
                    <p className="text-xs text-neutral-400">{cliente.cif || cliente.email}</p>
                  </td>
                  <td className="px-5 py-4"><Badge className={config?.color}>{config?.label}</Badge></td>
                  <td className="px-5 py-4"><Badge className={zonaConfig[cliente.zona]?.color}>{zonaConfig[cliente.zona]?.label || '-'}</Badge></td>
                  <td className="px-5 py-4 text-sm">{cliente.codigo_postal || '-'}</td>
                  <td className="px-5 py-4 font-bold text-orange-600">{cliente.descuento}%</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditingItem(cliente); setShowModal('cliente'); }} className="p-2 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete('clientes', cliente.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </Card>
    );

    // Vista Mapa
    if (viewClientes === 'map') return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-black text-neutral-900">Clientes</h1><p className="text-neutral-500 font-medium">{clientes.length} registros</p></div>
          <div className="flex items-center gap-3">
            <ViewSwitcher view={viewClientes} setView={setViewClientes} onExport={() => exportToExcel(filtered, 'clientes', exportColumns)} showMap onMapToggle={() => setViewClientes('map')} />
            <Button onClick={() => { setEditingItem(null); setShowModal('cliente'); }}><Plus size={20} /> Nuevo</Button>
          </div>
        </div>
        <MapView items={clientes} type="clientes" />
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-black text-neutral-900">Clientes</h1><p className="text-neutral-500 font-medium">{clientes.length} registros</p></div>
          <div className="flex items-center gap-3">
            <ViewSwitcher view={viewClientes} setView={setViewClientes} onExport={() => exportToExcel(filtered, 'clientes', exportColumns)} showMap onMapToggle={() => setViewClientes('map')} />
            <Button onClick={() => { setEditingItem(null); setShowModal('cliente'); }}><Plus size={20} /> Nuevo</Button>
          </div>
        </div>
        <Card className="p-4"><div className="relative"><Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" /><input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-orange-500 outline-none" /></div></Card>
        
        {viewClientes === 'grid' && renderGridView()}
        {viewClientes === 'list' && renderListView()}
        {viewClientes === 'table' && renderTableView()}
        
        {filtered.length === 0 && <EmptyState icon={Users} title="No hay clientes" description="Añade tu primer cliente" action={<Button onClick={() => setShowModal('cliente')}><Plus size={16} />Nuevo</Button>} />}
      </div>
    );
  };

  const renderLeads = () => {
    // Aplicar filtros
    let filtered = leads.filter(l => { 
      const matchesSearch = l.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || l.empresa?.toLowerCase().includes(searchTerm.toLowerCase()); 
      const matchesFilter = filterEstado === 'todos' || l.estado === filterEstado; 
      return matchesSearch && matchesFilter; 
    });
    
    // Aplicar filtros de columna
    filtered = aplicarFiltros(filtered, filtrosLeads, {
      nombre: l => l.nombre,
      tipo: l => l.tipo,
      estado: l => l.estado,
      origen: l => l.origen,
      codigo_postal: l => l.codigo_postal,
      valor_estimado: l => l.valor_estimado,
    });
    
    const hayFiltrosActivos = Object.values(filtrosLeads).some(v => v && v !== '');
    
    const exportColumns = [{ header: 'Nombre', accessor: l => l.nombre },{ header: 'Empresa', accessor: l => l.empresa },{ header: 'Tipo', accessor: l => tipoClienteConfig[l.tipo]?.label },{ header: 'CP', accessor: l => l.codigo_postal },{ header: 'Estado', accessor: l => estadoLeadConfig[l.estado]?.label },{ header: 'Origen', accessor: l => origenLeadConfig[l.origen]?.label },{ header: 'Valor', accessor: l => l.valor_estimado },{ header: 'Email', accessor: l => l.email },{ header: 'Teléfono', accessor: l => l.telefono }];

    const estadoOptions = Object.entries(estadoLeadConfig).map(([k, v]) => ({ value: k, label: v.label }));
    const origenOptions = Object.entries(origenLeadConfig).map(([k, v]) => ({ value: k, label: v.label }));
    const tipoLeadOptions = Object.entries(tipoClienteConfig).map(([k, v]) => ({ value: k, label: v.label }));

    const handleConvertToClient = async (lead) => {
      if (!window.confirm(`¿Convertir "${lead.nombre}" a cliente?`)) return;
      const clienteData = { nombre: lead.nombre || lead.empresa, tipo: ['mercamadrid', 'hotel', 'restaurante'].includes(lead.tipo) ? lead.tipo : 'restaurante', contacto: lead.contacto, email: lead.email, telefono: lead.telefono, direccion: lead.direccion, codigo_postal: lead.codigo_postal, ciudad: lead.ciudad, zona: lead.zona, descuento: 0 };
      const { data: newCliente } = await supabase.from('clientes').insert(clienteData).select().single();
      if (newCliente) { 
        await supabase.from('leads').update({ estado: 'ganado', convertido_cliente_id: newCliente.id }).eq('id', lead.id); 
        refetchClientes();
        refetchLeads();
        alert('✅ Lead convertido a cliente'); 
      }
    };

    if (viewLeads === 'map') return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-black text-neutral-900">Leads</h1><p className="text-neutral-500 font-medium">{leads.length} registros</p></div>
          <ViewSwitcher view={viewLeads} setView={setViewLeads} onExport={() => exportToExcel(filtered, 'leads', exportColumns)} showMap onMapToggle={() => setViewLeads('map')} />
        </div>
        <MapView items={leads} type="leads" />
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-black text-neutral-900">Leads</h1><p className="text-neutral-500 font-medium">{leads.length} registros</p></div>
          <div className="flex items-center gap-3">
            <ViewSwitcher view={viewLeads} setView={setViewLeads} onExport={() => exportToExcel(filtered, 'leads', exportColumns)} showMap onMapToggle={() => setViewLeads('map')} />
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={e => { if (e.target.files[0]) handleImportLeads(e.target.files[0]); e.target.value = ''; }} />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}><Upload size={18} /> Importar Excel</Button>
            <Button onClick={() => { setEditingItem(null); setShowModal('lead'); }}><Plus size={20} /> Nuevo Lead</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {Object.entries(estadoLeadConfig).map(([key, config]) => {
            const count = leads.filter(l => l.estado === key).length;
            const Icon = config.icon;
            return <Card key={key} className={`p-4 cursor-pointer hover:shadow-md ${filterEstado === key ? 'ring-2 ring-orange-500' : ''}`} onClick={() => setFilterEstado(filterEstado === key ? 'todos' : key)}>
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${config.color}`}><Icon size={16} /></div>
                <span className="text-2xl font-black">{count}</span>
              </div>
              <p className="text-sm text-neutral-600 mt-2 font-medium">{config.label}</p>
            </Card>;
          })}
        </div>

        <Card className="p-4 flex items-center gap-4">
          <div className="flex-1 relative"><Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" /><input type="text" placeholder="Buscar lead..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-orange-500 outline-none" /></div>
          {filterEstado !== 'todos' && <Button variant="ghost" size="sm" onClick={() => setFilterEstado('todos')}><X size={16} /> Limpiar filtro</Button>}
        </Card>

        <Card className="overflow-hidden">
          {hayFiltrosActivos && (
            <div className="p-3 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
              <span className="text-sm text-orange-700">🔍 Filtros activos - {filtered.length} resultados</span>
              <button onClick={() => setFiltrosLeads({})} className="text-xs text-orange-600 hover:text-orange-800 font-medium">Limpiar filtros</button>
            </div>
          )}
          <table className="w-full">
            <thead className="bg-neutral-900 text-white">
              <tr>
                <FilterableHeader label="Lead" field="nombre" sortConfig={sortLeads} onSort={setSortLeads} filters={filtrosLeads} onFilter={updateFilter(setFiltrosLeads)} type="text" />
                <FilterableHeader label="Tipo" field="tipo" filters={filtrosLeads} onFilter={updateFilter(setFiltrosLeads)} type="select" options={tipoLeadOptions} />
                <FilterableHeader label="Contacto" field="email" sortConfig={sortLeads} onSort={setSortLeads} filters={filtrosLeads} onFilter={updateFilter(setFiltrosLeads)} type="text" />
                <FilterableHeader label="CP" field="codigo_postal" sortConfig={sortLeads} onSort={setSortLeads} filters={filtrosLeads} onFilter={updateFilter(setFiltrosLeads)} type="text" />
                <FilterableHeader label="Estado" field="estado" sortConfig={sortLeads} onSort={setSortLeads} filters={filtrosLeads} onFilter={updateFilter(setFiltrosLeads)} type="select" options={estadoOptions} />
                <FilterableHeader label="Origen" field="origen" filters={filtrosLeads} onFilter={updateFilter(setFiltrosLeads)} type="select" options={origenOptions} />
                <FilterableHeader label="Valor" field="valor_estimado" sortConfig={sortLeads} onSort={setSortLeads} filters={filtrosLeads} onFilter={updateFilter(setFiltrosLeads)} type="number" />
                <th className="text-right px-5 py-4 text-sm font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortData(filtered, sortLeads).map(lead => {
                const tipoConfig = tipoClienteConfig[lead.tipo] || tipoClienteConfig.otro;
                const estadoConf = estadoLeadConfig[lead.estado];
                const origenConf = origenLeadConfig[lead.origen] || origenLeadConfig.otro;
                const Icon = estadoConf?.icon || Star;
                return (
                  <tr key={lead.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-5 py-4"><p className="font-bold text-neutral-900">{lead.nombre}</p><p className="text-xs text-neutral-400">{lead.empresa}</p></td>
                    <td className="px-5 py-4"><Badge className={tipoConfig.color}>{tipoConfig.label}</Badge></td>
                    <td className="px-5 py-4"><p className="text-sm">{lead.email}</p><p className="text-xs text-neutral-400">{lead.telefono}</p></td>
                    <td className="px-5 py-4 text-sm">{lead.codigo_postal || '-'}</td>
                    <td className="px-5 py-4"><Badge className={estadoConf?.color}><Icon size={12} />{estadoConf?.label}</Badge></td>
                    <td className="px-5 py-4"><Badge className={origenConf.color}>{origenConf.label}</Badge></td>
                    <td className="px-5 py-4 font-bold">{formatCurrency(lead.valor_estimado)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        {lead.estado !== 'ganado' && lead.estado !== 'perdido' && <button onClick={() => handleConvertToClient(lead)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Convertir a cliente"><UserPlus size={16} /></button>}
                        <button onClick={() => { setEditingItem(lead); setShowModal('lead'); }} className="p-2 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete('leads', lead.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState icon={Target} title="No hay leads" description="Añade o importa leads" action={<Button onClick={() => setShowModal('lead')}><Plus size={16} />Nuevo</Button>} />}
        </Card>
      </div>
    );
  };

  // Estado para pestaña de pedidos
  const [pedidosTab, setPedidosTab] = useState('lista');

  const renderPedidos = () => {
    // Aplicar filtros
    let filtered = pedidos.filter(p => { 
      const cliente = clientes.find(c => c.id === p.cliente_id); 
      const matchesSearch = cliente?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toString().includes(searchTerm); 
      const matchesFilter = filterEstado === 'todos' || p.estado === filterEstado; 
      return matchesSearch && matchesFilter; 
    });
    
    // Aplicar filtros de columna
    filtered = aplicarFiltros(filtered, filtrosPedidos, {
      cliente_id: p => clientes.find(c => c.id === p.cliente_id)?.nombre?.toLowerCase(),
      estado: p => p.estado,
      total: p => p.total,
    });
    
    const hayFiltrosActivos = Object.values(filtrosPedidos).some(v => v && v !== '');
    const estadoOptions = Object.entries(estadoConfig).map(([k, v]) => ({ value: k, label: v.label }));
    const clienteOptions = clientes.map(c => ({ value: c.nombre?.toLowerCase(), label: c.nombre }));
    
    const exportColumns = [{ header: 'ID', accessor: p => p.id },{ header: 'Cliente', accessor: p => clientes.find(c => c.id === p.cliente_id)?.nombre },{ header: 'Fecha', accessor: p => formatDate(p.fecha) },{ header: 'Entrega', accessor: p => formatDate(p.fecha_entrega) },{ header: 'Estado', accessor: p => estadoConfig[p.estado]?.label },{ header: 'Total', accessor: p => p.total }];
    
    const frecuenciaConfig = {
      semanal: { label: 'Semanal', color: 'bg-blue-100 text-blue-700' },
      quincenal: { label: 'Quincenal', color: 'bg-purple-100 text-purple-700' },
      mensual: { label: 'Mensual', color: 'bg-green-100 text-green-700' }
    };
    
    const diasSemana = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    // Ejecutar pedido recurrente (crear pedido normal a partir del recurrente)
    const ejecutarPedidoRecurrente = async (pr) => {
      const items = pedidosRecurrentesItems.filter(i => i.pedido_recurrente_id === pr.id);
      if (items.length === 0) {
        alert('Este pedido recurrente no tiene productos');
        return;
      }
      
      const cliente = clientes.find(c => c.id === pr.cliente_id);
      let total = 0;
      const itemsData = items.map(item => {
        const prod = productos.find(p => p.id === item.producto_id);
        const subtotal = (prod?.precio || 0) * item.cantidad;
        total += subtotal;
        return { producto_id: item.producto_id, cantidad: item.cantidad, precio_unitario: prod?.precio || 0, subtotal };
      });

      // Aplicar descuento del cliente
      const descuento = cliente?.descuento || 0;
      total = total * (1 - descuento / 100);

      // Crear pedido
      const hoy = new Date().toISOString().split('T')[0];
      const { data: newPedido, error: pedidoError } = await supabase.from('pedidos').insert({
        cliente_id: pr.cliente_id,
        fecha: hoy,
        fecha_entrega: hoy,
        estado: 'pendiente',
        notas: `Generado desde pedido recurrente: ${pr.nombre}`,
        total
      }).select().single();

      if (pedidoError) {
        alert('Error al crear pedido: ' + pedidoError.message);
        return;
      }

      // Insertar items
      for (const item of itemsData) {
        await supabase.from('pedido_items').insert({ pedido_id: newPedido.id, ...item });
      }

      // Actualizar fecha de última ejecución
      await supabase.from('pedidos_recurrentes').update({ 
        ultima_ejecucion: hoy,
        proxima_ejecucion: calcularProximaEjecucion(pr.frecuencia, pr.dia_semana)
      }).eq('id', pr.id);

      refetchPedidos();
      refetchPedidoItems();
      refetchPedidosRecurrentes();
      alert(`✅ Pedido #${newPedido.id} creado para ${cliente?.nombre}`);
    };

    const calcularProximaEjecucion = (frecuencia, diaSemana) => {
      const hoy = new Date();
      let proxima = new Date(hoy);
      
      if (frecuencia === 'semanal') {
        proxima.setDate(hoy.getDate() + 7);
      } else if (frecuencia === 'quincenal') {
        proxima.setDate(hoy.getDate() + 14);
      } else {
        proxima.setMonth(hoy.getMonth() + 1);
      }
      
      // Ajustar al día de la semana
      while (proxima.getDay() !== diaSemana) {
        proxima.setDate(proxima.getDate() + 1);
      }
      
      return proxima.toISOString().split('T')[0];
    };

    const toggleActivoPedidoRecurrente = async (pr) => {
      await supabase.from('pedidos_recurrentes').update({ activo: !pr.activo }).eq('id', pr.id);
      refetchPedidosRecurrentes();
    };

    const eliminarPedidoRecurrente = async (id) => {
      if (window.confirm('¿Eliminar este pedido recurrente?')) {
        await supabase.from('pedidos_recurrentes_items').delete().eq('pedido_recurrente_id', id);
        await supabase.from('pedidos_recurrentes').delete().eq('id', id);
        refetchPedidosRecurrentes();
        refetchPedidosRecurrentesItems();
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className={`text-2xl md:text-3xl font-black ${darkMode ? 'text-white' : 'text-neutral-900'}`}>Pedidos</h1>
            <p className={`font-medium text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>{pedidos.length} pedidos • {pedidosRecurrentes.filter(p => p.activo).length} recurrentes activos</p>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button variant="secondary" size="sm" onClick={() => exportToExcel(filtered, 'pedidos', exportColumns)}><FileSpreadsheet size={16} /><span className="hidden sm:inline">Excel</span></Button>
            {pedidosTab === 'lista' ? (
              <Button onClick={() => { setEditingItem(null); setShowModal('pedido'); }}><Plus size={18} /><span className="hidden sm:inline">Nuevo Pedido</span></Button>
            ) : (
              <Button onClick={() => setShowModal('pedido_recurrente')}><Repeat size={18} /><span className="hidden sm:inline">Nuevo Recurrente</span></Button>
            )}
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex gap-2">
          <button 
            onClick={() => setPedidosTab('lista')} 
            className={`px-4 py-2 rounded-xl font-semibold transition-colors ${pedidosTab === 'lista' ? 'bg-orange-500 text-white' : darkMode ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-white text-neutral-600 hover:bg-neutral-100'}`}
          >
            <ShoppingCart size={18} className="inline mr-2" />Pedidos
          </button>
          <button 
            onClick={() => setPedidosTab('recurrentes')} 
            className={`px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-2 ${pedidosTab === 'recurrentes' ? 'bg-orange-500 text-white' : darkMode ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-white text-neutral-600 hover:bg-neutral-100'}`}
          >
            <Repeat size={18} />Recurrentes
            {pedidosRecurrentes.filter(p => p.activo).length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${pedidosTab === 'recurrentes' ? 'bg-white/20' : 'bg-orange-500 text-white'}`}>
                {pedidosRecurrentes.filter(p => p.activo).length}
              </span>
            )}
          </button>
        </div>

        {pedidosTab === 'lista' ? (
          <>
            <Card className={`p-4 flex items-center gap-4 ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
              <div className="flex-1 relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`w-full pl-10 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-orange-500 outline-none ${darkMode ? 'bg-neutral-700 border-neutral-600 text-white' : ''}`} />
              </div>
              <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className={`px-4 py-2.5 rounded-xl border font-medium ${darkMode ? 'bg-neutral-700 border-neutral-600 text-white' : ''}`}>
                <option value="todos">Todos</option>
                {Object.entries(estadoConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Card>
            <Card className={`overflow-hidden ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
              <div className="overflow-x-auto">
              {hayFiltrosActivos && (
                <div className="p-3 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
                  <span className="text-sm text-orange-700">🔍 Filtros activos - {filtered.length} resultados</span>
                  <button onClick={() => setFiltrosPedidos({})} className="text-xs text-orange-600 hover:text-orange-800 font-medium">Limpiar filtros</button>
                </div>
              )}
              {selectedPedidos.length > 0 && (
                <div className="p-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                  <span className="font-semibold text-blue-700">{selectedPedidos.length} pedido(s) seleccionado(s)</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setSelectedPedidos([])}>Deseleccionar</Button>
                    <Button variant="secondary" size="sm" className="text-red-600" onClick={() => handleDeleteMultiple('pedidos', selectedPedidos, refetchPedidos, setSelectedPedidos)}>
                      <Trash2 size={14} /> Eliminar
                    </Button>
                  </div>
                </div>
              )}
              <table className="w-full min-w-[600px]">
                <thead className="bg-neutral-900 text-white"><tr>
                  <th className="px-3 py-3 text-left w-10">
                    <input type="checkbox" checked={filtered.length > 0 && selectedPedidos.length === filtered.length} onChange={e => setSelectedPedidos(e.target.checked ? filtered.map(p => p.id) : [])} className="w-4 h-4 rounded" />
                  </th>
                  <th className="text-left px-3 md:px-5 py-3 md:py-4 text-xs md:text-sm font-bold">Pedido</th>
                  <FilterableHeader label="Cliente" field="cliente_id" filters={filtrosPedidos} onFilter={updateFilter(setFiltrosPedidos)} type="text" />
                  <FilterableHeader label="Entrega" field="fecha_entrega" filters={filtrosPedidos} onFilter={updateFilter(setFiltrosPedidos)} type="date" />
                  <FilterableHeader label="Total" field="total" filters={filtrosPedidos} onFilter={updateFilter(setFiltrosPedidos)} type="number" />
                  <FilterableHeader label="Estado" field="estado" filters={filtrosPedidos} onFilter={updateFilter(setFiltrosPedidos)} type="select" options={estadoOptions} />
                  <th className="text-right px-3 md:px-5 py-3 md:py-4 text-xs md:text-sm font-bold">Acc.</th>
                </tr></thead>
                <tbody>
                  {filtered.map(pedido => {
                    const cliente = clientes.find(c => c.id === pedido.cliente_id);
                    const config = estadoConfig[pedido.estado];
                    const Icon = config?.icon || Clock;
                    const isSelected = selectedPedidos.includes(pedido.id);
                    return (
                      <tr key={pedido.id} className={`border-b ${darkMode ? 'border-neutral-700 hover:bg-neutral-700' : 'border-neutral-100 hover:bg-neutral-50'} ${isSelected ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-3">
                          <input type="checkbox" checked={isSelected} onChange={e => setSelectedPedidos(e.target.checked ? [...selectedPedidos, pedido.id] : selectedPedidos.filter(id => id !== pedido.id))} className="w-4 h-4 rounded" />
                        </td>
                        <td className="px-3 md:px-5 py-3 md:py-4"><p className={`font-black text-sm ${darkMode ? 'text-white' : 'text-neutral-900'}`}>#{pedido.id}</p><p className="text-xs text-neutral-400">{formatDate(pedido.fecha)}</p></td>
                        <td className={`px-3 md:px-5 py-3 md:py-4 font-semibold text-sm ${darkMode ? 'text-neutral-200' : ''}`}>{cliente?.nombre}</td>
                        <td className="px-3 md:px-5 py-3 md:py-4 text-sm hidden sm:table-cell">{formatDate(pedido.fecha_entrega)}</td>
                        <td className={`px-3 md:px-5 py-3 md:py-4 font-bold text-sm ${darkMode ? 'text-white' : ''}`}>{formatCurrency(pedido.total)}</td>
                        <td className="px-3 md:px-5 py-3 md:py-4"><Badge className={config?.color}><Icon size={12} /><span className="hidden sm:inline">{config?.label}</span></Badge></td>
                        <td className="px-3 md:px-5 py-3 md:py-4"><div className="flex justify-end gap-1"><button onClick={() => { setEditingItem(pedido); setShowModal('pedido'); }} className="p-2 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Edit2 size={16} /></button><button onClick={() => handleDelete('pedidos', pedido.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              {filtered.length === 0 && <EmptyState icon={ShoppingCart} title="No hay pedidos" description="Crea tu primer pedido" action={<Button onClick={() => setShowModal('pedido')}><Plus size={16} />Nuevo</Button>} />}
            </Card>
          </>
        ) : (
          /* Vista de Pedidos Recurrentes */
          <div className="space-y-4">
            {pedidosRecurrentes.length === 0 ? (
              <Card className={`p-8 text-center ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
                <Repeat size={48} className="mx-auto text-neutral-300 mb-4" />
                <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-neutral-900'}`}>No hay pedidos recurrentes</h3>
                <p className={`text-sm mb-4 ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Crea pedidos que se repiten automáticamente cada semana, quincena o mes</p>
                <Button onClick={() => setShowModal('pedido_recurrente')}><Repeat size={18} />Crear Pedido Recurrente</Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pedidosRecurrentes.map(pr => {
                  const cliente = clientes.find(c => c.id === pr.cliente_id);
                  const items = pedidosRecurrentesItems.filter(i => i.pedido_recurrente_id === pr.id);
                  const totalEstimado = items.reduce((sum, item) => {
                    const prod = productos.find(p => p.id === item.producto_id);
                    return sum + ((prod?.precio || 0) * item.cantidad);
                  }, 0);
                  const frecConfig = frecuenciaConfig[pr.frecuencia] || frecuenciaConfig.semanal;

                  return (
                    <Card key={pr.id} className={`overflow-hidden ${!pr.activo ? 'opacity-60' : ''} ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
                      <div className={`p-4 ${pr.activo ? 'bg-gradient-to-r from-orange-500 to-amber-500' : 'bg-neutral-400'} text-white`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Repeat size={20} />
                            <h3 className="font-bold truncate">{pr.nombre}</h3>
                          </div>
                          <Badge className={frecConfig.color}>{frecConfig.label}</Badge>
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-neutral-400" />
                          <span className={`font-semibold ${darkMode ? 'text-white' : ''}`}>{cliente?.nombre || 'Cliente'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className="text-neutral-400" />
                          <span className={`text-sm ${darkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                            {diasSemana[pr.dia_semana] || 'Lunes'} • {frecConfig.label}
                          </span>
                        </div>
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-neutral-700' : 'bg-neutral-50'}`}>
                          <p className={`text-xs font-medium mb-2 ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Productos ({items.length})</p>
                          {items.slice(0, 3).map(item => {
                            const prod = productos.find(p => p.id === item.producto_id);
                            return (
                              <p key={item.id} className={`text-sm truncate ${darkMode ? 'text-neutral-200' : ''}`}>
                                • {prod?.nombre || 'Producto'} x{item.cantidad}
                              </p>
                            );
                          })}
                          {items.length > 3 && <p className="text-xs text-neutral-400">+{items.length - 3} más...</p>}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
                          <span className={`text-lg font-black ${darkMode ? 'text-white' : ''}`}>{formatCurrency(totalEstimado)}</span>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => toggleActivoPedidoRecurrente(pr)} 
                              className={`p-2 rounded-lg ${pr.activo ? 'text-green-600 hover:bg-green-50' : 'text-neutral-400 hover:bg-neutral-100'}`}
                              title={pr.activo ? 'Desactivar' : 'Activar'}
                            >
                              {pr.activo ? <CheckCircle size={18} /> : <XCircle size={18} />}
                            </button>
                            <button 
                              onClick={() => ejecutarPedidoRecurrente(pr)} 
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Ejecutar ahora"
                            >
                              <Zap size={18} />
                            </button>
                            <button 
                              onClick={() => eliminarPedidoRecurrente(pr.id)} 
                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Eliminar"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderProductos = () => {
    const categoriaOptions = [...new Set(productos.map(p => p.categoria).filter(Boolean))].map(c => ({ value: c, label: c }));
    
    const productosFiltrados = aplicarFiltros(productos, filtrosProductos, {
      nombre: p => p.nombre,
      categoria: p => p.categoria,
      precio: p => p.precio,
      stock: p => p.stock,
    });
    
    const hayFiltrosActivos = Object.values(filtrosProductos).some(v => v && v !== '');
    const limpiarFiltros = () => setFiltrosProductos({});
    
    const exportColumns = [{ header: 'Nombre', accessor: p => p.nombre },{ header: 'Categoría', accessor: p => p.categoria },{ header: 'Precio', accessor: p => p.precio },{ header: 'Coste', accessor: p => p.coste },{ header: 'Stock', accessor: p => p.stock },{ header: 'Stock Mínimo', accessor: p => p.stock_minimo }];
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h1 className="text-2xl md:text-3xl font-black text-neutral-900">Productos</h1><p className="text-neutral-500 font-medium text-sm">{productosFiltrados.length} de {productos.length} registros</p></div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button variant="secondary" size="sm" onClick={() => exportToExcel(productosFiltrados, 'productos', exportColumns)}><FileSpreadsheet size={16} /><span className="hidden sm:inline">Excel</span></Button>
            <Button onClick={() => { setEditingItem(null); setShowModal('producto'); }}><Plus size={18} /><span className="hidden sm:inline">Nuevo</span></Button>
          </div>
        </div>
        <Card className="overflow-hidden">
          {hayFiltrosActivos && (
            <div className="p-3 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
              <span className="text-sm text-orange-700">🔍 Filtros activos - {productosFiltrados.length} resultados</span>
              <button onClick={limpiarFiltros} className="text-xs text-orange-600 hover:text-orange-800 font-medium">Limpiar filtros</button>
            </div>
          )}
          {selectedProductos.length > 0 && (
            <div className="p-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
              <span className="font-semibold text-blue-700">{selectedProductos.length} producto(s) seleccionado(s)</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSelectedProductos([])}>Deseleccionar</Button>
                <Button variant="secondary" size="sm" className="text-red-600" onClick={() => handleDeleteMultiple('productos', selectedProductos, refetchProductos, setSelectedProductos)}>
                  <Trash2 size={14} /> Eliminar
                </Button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead className="bg-neutral-900 text-white"><tr>
              <th className="px-3 py-3 text-left w-10">
                <input type="checkbox" checked={productosFiltrados.length > 0 && selectedProductos.length === productosFiltrados.length} onChange={e => setSelectedProductos(e.target.checked ? productosFiltrados.map(p => p.id) : [])} className="w-4 h-4 rounded" />
              </th>
              <FilterableHeader label="Producto" field="nombre" filters={filtrosProductos} onFilter={updateFilter(setFiltrosProductos)} type="text" />
              <FilterableHeader label="Categoría" field="categoria" filters={filtrosProductos} onFilter={updateFilter(setFiltrosProductos)} type="select" options={categoriaOptions} />
              <FilterableHeader label="Precio" field="precio" filters={filtrosProductos} onFilter={updateFilter(setFiltrosProductos)} type="number" />
              <FilterableHeader label="Stock" field="stock" filters={filtrosProductos} onFilter={updateFilter(setFiltrosProductos)} type="number" />
              <th className="text-left px-3 md:px-5 py-3 md:py-4 text-xs md:text-sm font-bold hidden md:table-cell">Margen</th>
              <th className="text-right px-3 md:px-5 py-3 md:py-4 text-xs md:text-sm font-bold">Acc.</th>
            </tr></thead>
            <tbody>
              {productosFiltrados.map(producto => {
                const margen = producto.precio > 0 && producto.coste > 0 ? ((producto.precio - producto.coste) / producto.precio * 100).toFixed(0) : '-';
                const stockBajoFlag = producto.stock < (producto.stock_minimo || 20);
                const isSelected = selectedProductos.includes(producto.id);
                return (
                  <tr key={producto.id} className={`border-b border-neutral-100 hover:bg-neutral-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={isSelected} onChange={e => setSelectedProductos(e.target.checked ? [...selectedProductos, producto.id] : selectedProductos.filter(id => id !== producto.id))} className="w-4 h-4 rounded" />
                    </td>
                    <td className="px-3 md:px-5 py-3 md:py-4"><div className="flex items-center gap-2 md:gap-3"><div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-green-500 flex items-center justify-center text-white"><Leaf size={16} /></div><div><p className="font-semibold text-sm">{producto.nombre}</p><p className="text-xs text-neutral-400 hidden sm:block">{producto.unidad}</p></div></div></td>
                    <td className="px-3 md:px-5 py-3 md:py-4"><Badge>{producto.categoria}</Badge></td>
                    <td className="px-3 md:px-5 py-3 md:py-4"><p className="font-bold text-sm">{formatCurrency(producto.precio)}</p><p className="text-xs text-neutral-400 hidden md:block">Coste: {formatCurrency(producto.coste)}</p></td>
                    <td className="px-3 md:px-5 py-3 md:py-4"><div className="flex items-center gap-2"><div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${stockBajoFlag ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} /><span className={`text-sm ${stockBajoFlag ? 'text-red-600 font-bold' : 'font-medium'}`}>{producto.stock}</span></div></td>
                    <td className="px-3 md:px-5 py-3 md:py-4 hidden md:table-cell"><Badge variant={margen > 50 ? 'success' : margen > 30 ? 'warning' : 'danger'}>{margen}%</Badge></td>
                    <td className="px-3 md:px-5 py-3 md:py-4"><div className="flex justify-end gap-1"><button onClick={() => { setEditingItem(producto); setShowModal('producto'); }} className="p-2 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Edit2 size={16} /></button><button onClick={() => handleDelete('productos', producto.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </Card>
      </div>
    );
  };

  // Componente para ver factura
  const FacturaPreview = ({ factura, cliente, pedidoItemsList, onClose }) => {
    const items = pedidoItemsList.filter(i => i.pedido_id === factura.pedido_id);
    const logoUrl = 'https://www.rootflow.es/lovable-uploads/70262e87-198c-4788-b2e9-7b89bef45202.png';
    
    const handlePrint = () => {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Factura ${factura.id}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
            body { padding: 40px; background: white; color: #333; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .logo-section { display: flex; align-items: center; gap: 15px; }
            .logo { width: 50px; }
            .logo img { width: 50px; height: auto; }
            .company-name { font-size: 24px; font-weight: 800; }
            .company-name .root { color: #1a1a1a; }
            .company-name .flow { color: #f97316; }
            .company-sub { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
            .factura-num { text-align: right; }
            .factura-num h1 { font-size: 28px; color: #2D6A4F; margin-bottom: 5px; }
            .factura-num p { color: #666; font-size: 13px; }
            .addresses { display: flex; justify-content: space-between; margin-bottom: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
            .address h3 { font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 8px; }
            .address p { font-size: 13px; line-height: 1.6; }
            .address strong { font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #2D6A4F; color: white; padding: 12px 15px; text-align: left; font-size: 12px; text-transform: uppercase; }
            td { padding: 12px 15px; border-bottom: 1px solid #eee; font-size: 13px; }
            .text-right { text-align: right; }
            .totals { margin-left: auto; width: 300px; }
            .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .totals-row.total { border-top: 2px solid #2D6A4F; border-bottom: none; padding-top: 15px; font-size: 18px; font-weight: 800; color: #2D6A4F; }
            .footer { margin-top: 60px; text-align: center; color: #999; font-size: 11px; }
            .footer p { margin: 3px 0; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <div class="logo">
                <img src="${logoUrl}" alt="RootFlow">
              </div>
              <div>
                <div class="company-name"><span class="root">Root</span><span class="flow">Flow</span></div>
                <div class="company-sub">Hydroponics</div>
              </div>
            </div>
            <div class="factura-num">
              <h1>FACTURA</h1>
              <p><strong>${factura.id}</strong></p>
              <p>Fecha: ${formatDate(factura.fecha)}</p>
              <p>Vencimiento: ${formatDate(factura.fecha_vencimiento)}</p>
            </div>
          </div>
          
          <div class="addresses">
            <div class="address">
              <h3>Datos del emisor</h3>
              <p><strong>${EMPRESA.nombre}</strong></p>
              <p>${EMPRESA.direccion}</p>
              <p>${EMPRESA.cp} ${EMPRESA.ciudad}</p>
              <p>Tel: ${EMPRESA.telefono}</p>
              <p>Email: ${EMPRESA.email}</p>
            </div>
            <div class="address">
              <h3>Datos del cliente</h3>
              <p><strong>${cliente?.nombre || 'Cliente'}</strong></p>
              <p>${cliente?.direccion || ''}</p>
              <p>${cliente?.codigo_postal || ''} ${cliente?.ciudad || ''}</p>
              <p>CIF: ${cliente?.cif || '-'}</p>
              <p>Email: ${cliente?.email || ''}</p>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th class="text-right">Cantidad</th>
                <th class="text-right">Precio Unit.</th>
                <th class="text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => {
                const prod = productos.find(p => p.id === item.producto_id);
                return `<tr>
                  <td>${prod?.nombre || 'Producto'}</td>
                  <td class="text-right">${item.cantidad}</td>
                  <td class="text-right">${formatCurrency(item.precio_unitario)}</td>
                  <td class="text-right">${formatCurrency(item.subtotal)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(factura.subtotal)}</span></div>
            ${factura.descuento_aplicado > 0 ? `<div class="totals-row"><span>Descuento</span><span>-${formatCurrency(factura.descuento_aplicado)}</span></div>` : ''}
            <div class="totals-row"><span>Base Imponible</span><span>${formatCurrency(factura.base_imponible)}</span></div>
            <div class="totals-row"><span>IVA (${factura.iva_porcentaje || 4}%)</span><span>${formatCurrency(factura.iva)}</span></div>
            ${factura.recargo_equivalencia ? `<div class="totals-row"><span>Recargo Equiv. (${factura.re_porcentaje || 0.5}%)</span><span>${formatCurrency(factura.re_importe || 0)}</span></div>` : ''}
            <div class="totals-row total"><span>TOTAL</span><span>${formatCurrency(factura.total)}</span></div>
          </div>
          
          <div class="footer">
            <p><strong>${EMPRESA.nombre}</strong> · CIF: ${EMPRESA.cif}</p>
            <p>${EMPRESA.direccion}, ${EMPRESA.cp} ${EMPRESA.ciudad}</p>
            <p>${EMPRESA.telefono} · ${EMPRESA.email} · ${EMPRESA.web}</p>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); }, 500);
    };

    return (
      <Modal title={`Factura ${factura.id}`} onClose={onClose} size="max-w-4xl">
        <div className="bg-white p-6 rounded-lg">
          {/* Header */}
          <div className="flex justify-between items-start mb-8 pb-6 border-b">
            <div className="flex items-center gap-4">
              <RootFlowLogoFactura />
              <div>
                <h2 className="text-xl font-bold"><span className="text-neutral-900">Root</span><span className="text-orange-500">Flow</span></h2>
                <p className="text-xs text-neutral-500 uppercase tracking-wider">Hydroponics</p>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-black text-emerald-700">FACTURA</h1>
              <p className="text-lg font-bold">{factura.id}</p>
              <p className="text-sm text-neutral-500">Fecha: {formatDate(factura.fecha)}</p>
              <p className="text-sm text-neutral-500">Vencimiento: {formatDate(factura.fecha_vencimiento)}</p>
            </div>
          </div>
          
          {/* Direcciones */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="p-4 bg-neutral-50 rounded-lg">
              <h3 className="text-xs font-bold text-neutral-400 uppercase mb-2">Emisor</h3>
              <p className="font-bold text-neutral-900">{EMPRESA.nombre}</p>
              <p className="text-sm text-neutral-600">{EMPRESA.direccion}</p>
              <p className="text-sm text-neutral-600">{EMPRESA.cp} {EMPRESA.ciudad}</p>
              <p className="text-sm text-neutral-600">{EMPRESA.telefono}</p>
              <p className="text-sm text-neutral-600">{EMPRESA.email}</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-lg">
              <h3 className="text-xs font-bold text-neutral-400 uppercase mb-2">Cliente</h3>
              <p className="font-bold text-neutral-900">{cliente?.nombre}</p>
              <p className="text-sm text-neutral-600">{cliente?.direccion}</p>
              <p className="text-sm text-neutral-600">{cliente?.codigo_postal} {cliente?.ciudad}</p>
              <p className="text-sm text-neutral-600">CIF: {cliente?.cif || '-'}</p>
              <p className="text-sm text-neutral-600">{cliente?.email}</p>
            </div>
          </div>
          
          {/* Items */}
          <table className="w-full mb-6">
            <thead className="bg-emerald-700 text-white">
              <tr>
                <th className="text-left px-4 py-3 text-sm">Descripción</th>
                <th className="text-right px-4 py-3 text-sm">Cantidad</th>
                <th className="text-right px-4 py-3 text-sm">Precio Unit.</th>
                <th className="text-right px-4 py-3 text-sm">Importe</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const prod = productos.find(p => p.id === item.producto_id);
                return (
                  <tr key={idx} className="border-b">
                    <td className="px-4 py-3">{prod?.nombre}</td>
                    <td className="px-4 py-3 text-right">{item.cantidad}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(item.precio_unitario)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.subtotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {/* Totales */}
          <div className="flex justify-end">
            <div className="w-72">
              <div className="flex justify-between py-2 border-b"><span>Subtotal</span><span>{formatCurrency(factura.subtotal)}</span></div>
              {factura.descuento_aplicado > 0 && <div className="flex justify-between py-2 border-b text-green-600"><span>Descuento</span><span>-{formatCurrency(factura.descuento_aplicado)}</span></div>}
              <div className="flex justify-between py-2 border-b"><span>Base Imponible</span><span>{formatCurrency(factura.base_imponible)}</span></div>
              <div className="flex justify-between py-2 border-b"><span>IVA ({factura.iva_porcentaje || 4}%)</span><span>{formatCurrency(factura.iva)}</span></div>
              {factura.recargo_equivalencia && <div className="flex justify-between py-2 border-b text-amber-600"><span>R.E. ({factura.re_porcentaje || 0.5}%)</span><span>{formatCurrency(factura.re_importe || 0)}</span></div>}
              <div className="flex justify-between py-3 text-xl font-black text-emerald-700 border-t-2 border-emerald-700"><span>TOTAL</span><span>{formatCurrency(factura.total)}</span></div>
            </div>
          </div>
          
          {/* Acciones */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <Button variant="secondary" onClick={onClose}>Cerrar</Button>
            <Button variant="secondary" onClick={() => {
              const itemsTexto = items.map(item => {
                const prod = productos.find(p => p.id === item.producto_id);
                return `- ${prod?.nombre || 'Producto'} x${item.cantidad}: ${formatCurrency(item.subtotal)}`;
              }).join('%0A');
              
              const reTexto = factura.recargo_equivalencia ? `%0ARecargo Equiv. (${factura.re_porcentaje || 0.5}%): ${formatCurrency(factura.re_importe || 0)}` : '';
              const asunto = `Factura ${factura.id} - RootFlow Hydroponics`;
              const cuerpo = `Estimado/a ${cliente?.nombre},%0A%0AAdjunto encontrará la factura ${factura.id} correspondiente a su pedido.%0A%0ARESUMEN:%0A${itemsTexto}%0A%0ASubtotal: ${formatCurrency(factura.subtotal)}%0AIVA (${factura.iva_porcentaje || 4}%): ${formatCurrency(factura.iva)}${reTexto}%0ATOTAL: ${formatCurrency(factura.total)}%0A%0AFecha vencimiento: ${formatDate(factura.fecha_vencimiento)}%0A%0ADatos de pago:%0AIBAN: ES00 0000 0000 0000 0000 0000%0AConcepto: ${factura.id}%0A%0AGracias por su confianza.%0A%0AAtentamente,%0ARootFlow Hydroponics SL%0A${EMPRESA.telefono}`;
              
              window.open(`mailto:${cliente?.email || ''}?subject=${asunto}&body=${cuerpo}`, '_blank');
            }}>
              <Mail size={18} /> Enviar Email
            </Button>
            <Button onClick={handlePrint}><Printer size={18} /> Imprimir / PDF</Button>
          </div>
        </div>
      </Modal>
    );
  };

  const renderFacturacion = () => {
    // Filtrar facturas por mes
    let facturasFiltradas = filtrarPorPeriodo(facturas, 'fecha', filtroFacturasMes);
    
    // Aplicar filtros de columna
    facturasFiltradas = aplicarFiltros(facturasFiltradas, filtrosFacturas, {
      cliente_id: f => clientes.find(c => c.id === f.cliente_id)?.nombre?.toLowerCase(),
      estado: f => f.estado,
      total: f => f.total,
    });
    
    const hayFiltrosActivos = Object.values(filtrosFacturas).some(v => v && v !== '');
    const estadoFacturaOptions = Object.entries(estadoFacturaConfig).map(([k, v]) => ({ value: k, label: v.label }));
    
    // Exportar seleccionadas
    const exportColumns = [
      { header: 'Factura', accessor: f => f.id },
      { header: 'Cliente', accessor: f => clientes.find(c => c.id === f.cliente_id)?.nombre },
      { header: 'Fecha', accessor: f => formatDate(f.fecha) },
      { header: 'Vencimiento', accessor: f => formatDate(f.fecha_vencimiento) },
      { header: 'Subtotal', accessor: f => f.subtotal },
      { header: 'IVA', accessor: f => f.iva },
      { header: 'Total', accessor: f => f.total },
      { header: 'Estado', accessor: f => estadoFacturaConfig[f.estado]?.label }
    ];

    const handleSelectAll = (checked) => {
      if (checked) {
        setSelectedFacturas(facturasFiltradas.map(f => f.id));
      } else {
        setSelectedFacturas([]);
      }
    };

    const handleSelectOne = (id, checked) => {
      if (checked) {
        setSelectedFacturas([...selectedFacturas, id]);
      } else {
        setSelectedFacturas(selectedFacturas.filter(fId => fId !== id));
      }
    };

    const handleDeleteFactura = async (id) => {
      if (window.confirm('¿Eliminar esta factura?')) {
        await supabase.from('facturas').delete().eq('id', id);
        refetchFacturas();
        setSelectedFacturas(selectedFacturas.filter(fId => fId !== id));
      }
    };

    const handleExportSelected = () => {
      const toExport = selectedFacturas.length > 0 
        ? facturas.filter(f => selectedFacturas.includes(f.id))
        : facturasFiltradas;
      exportToExcel(toExport, 'facturas', exportColumns);
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-neutral-900">Facturación</h1>
            <p className="text-neutral-500 font-medium">{facturasFiltradas.length} facturas</p>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={filtroFacturasMes} 
              onChange={e => { setFiltroFacturasMes(e.target.value); setSelectedFacturas([]); }}
              className="px-3 py-2 rounded-xl border bg-white font-medium text-sm"
            >
              <option value="todos">Todas las fechas</option>
              <option value="mes_actual">Este mes</option>
              <option value="año_actual">Este año</option>
              {getMesesDisponibles().slice(1).map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <Button variant="secondary" size="sm" onClick={handleExportSelected}>
              <Download size={16} /> {selectedFacturas.length > 0 ? `Exportar (${selectedFacturas.length})` : 'Exportar'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard icon={Receipt} label="Total Facturado" value={formatCurrency(facturasFiltradas.reduce((sum, f) => sum + (f.total || 0), 0))} color="bg-green-100 text-green-600" />
          <StatCard icon={Clock} label="Pendiente Cobro" value={formatCurrency(facturasFiltradas.filter(f => f.estado === 'pendiente').reduce((sum, f) => sum + (f.total || 0), 0))} color="bg-amber-100 text-amber-600" />
          <StatCard icon={CheckCircle} label="Cobrado" value={formatCurrency(facturasFiltradas.filter(f => f.estado === 'pagada').reduce((sum, f) => sum + (f.total || 0), 0))} color="bg-blue-100 text-blue-600" />
          <StatCard icon={AlertCircle} label="Vencidas" value={facturasFiltradas.filter(f => f.estado === 'vencida' || (f.estado === 'pendiente' && new Date(f.fecha_vencimiento) < new Date())).length} color="bg-red-100 text-red-600" />
        </div>

        {/* Alertas de cobros pendientes/vencidos */}
        {(() => {
          const pendientes = facturasFiltradas.filter(f => f.estado === 'pendiente');
          const vencidas = pendientes.filter(f => f.fecha_vencimiento && new Date(f.fecha_vencimiento) < new Date());
          const porVencer = pendientes.filter(f => {
            if (!f.fecha_vencimiento) return false;
            const venc = new Date(f.fecha_vencimiento);
            const hoy = new Date();
            const diff = (venc - hoy) / (1000 * 60 * 60 * 24);
            return diff >= 0 && diff <= 7;
          });
          
          return (vencidas.length > 0 || porVencer.length > 0) && (
            <Card className="p-4 bg-red-50 border-red-200">
              <h3 className="font-bold text-red-800 mb-3 flex items-center gap-2"><AlertTriangle size={20} /> Seguimiento de Cobros</h3>
              {vencidas.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-red-700 mb-2">🚨 Facturas VENCIDAS ({vencidas.length}):</p>
                  <div className="space-y-2">
                    {vencidas.slice(0, 5).map(f => {
                      const cliente = clientes.find(c => c.id === f.cliente_id);
                      const diasVencida = Math.floor((new Date() - new Date(f.fecha_vencimiento)) / (1000 * 60 * 60 * 24));
                      return (
                        <div key={f.id} className="flex items-center justify-between bg-white p-2 rounded-lg">
                          <div>
                            <span className="font-bold">{f.numero_factura || f.id}</span>
                            <span className="mx-2">-</span>
                            <span>{cliente?.nombre}</span>
                            <span className="ml-2 text-red-600 text-sm">({diasVencida} días vencida)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-red-700">{formatCurrency(f.total)}</span>
                            <Button size="sm" onClick={() => registrarCobro(f.id)}>
                              <Check size={14} /> Cobrar
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {porVencer.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-amber-700 mb-2">⚠️ Por vencer en 7 días ({porVencer.length}):</p>
                  <div className="space-y-2">
                    {porVencer.slice(0, 3).map(f => {
                      const cliente = clientes.find(c => c.id === f.cliente_id);
                      const diasRestantes = Math.ceil((new Date(f.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24));
                      return (
                        <div key={f.id} className="flex items-center justify-between bg-white p-2 rounded-lg">
                          <div>
                            <span className="font-bold">{f.numero_factura || f.id}</span>
                            <span className="mx-2">-</span>
                            <span>{cliente?.nombre}</span>
                            <span className="ml-2 text-amber-600 text-sm">(vence en {diasRestantes} días)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{formatCurrency(f.total)}</span>
                            <Button size="sm" variant="secondary" onClick={() => registrarCobro(f.id)}>
                              <Check size={14} /> Cobrar
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          );
        })()}

        {/* Política de cobros */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Euro size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-blue-800">Política de Cobros: AL CONTADO</p>
                <p className="text-sm text-blue-600">Vencimiento: mismo día de entrega del pedido</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-700">Pendiente total:</p>
              <p className="text-xl font-black text-blue-800">
                {formatCurrency(facturasFiltradas.filter(f => f.estado === 'pendiente').reduce((sum, f) => sum + (f.total || 0), 0))}
              </p>
            </div>
          </div>
        </Card>

        {selectedFacturas.length > 0 && (
          <Card className="p-3 bg-orange-50 border-orange-200 flex items-center justify-between">
            <span className="font-semibold text-orange-700">{selectedFacturas.length} factura(s) seleccionada(s)</span>
            <Button variant="secondary" size="sm" onClick={() => setSelectedFacturas([])}>Limpiar selección</Button>
          </Card>
        )}

        <Card className="overflow-hidden">
          {hayFiltrosActivos && (
            <div className="p-3 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
              <span className="text-sm text-orange-700">🔍 Filtros activos - {facturasFiltradas.length} resultados</span>
              <button onClick={() => setFiltrosFacturas({})} className="text-xs text-orange-600 hover:text-orange-800 font-medium">Limpiar filtros</button>
            </div>
          )}
          <table className="w-full">
            <thead className="bg-neutral-900 text-white">
              <tr>
                <th className="px-5 py-4 text-left">
                  <input 
                    type="checkbox" 
                    checked={facturasFiltradas.length > 0 && selectedFacturas.length === facturasFiltradas.length}
                    onChange={e => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                </th>
                <FilterableHeader label="Factura" field="id" sortConfig={sortFacturas} onSort={setSortFacturas} filters={filtrosFacturas} onFilter={updateFilter(setFiltrosFacturas)} type="text" />
                <FilterableHeader label="Cliente" field="cliente_id" sortConfig={sortFacturas} onSort={setSortFacturas} filters={filtrosFacturas} onFilter={updateFilter(setFiltrosFacturas)} type="text" />
                <FilterableHeader label="Fecha" field="fecha" sortConfig={sortFacturas} onSort={setSortFacturas} filters={filtrosFacturas} onFilter={updateFilter(setFiltrosFacturas)} type="date" />
                <FilterableHeader label="Total" field="total" sortConfig={sortFacturas} onSort={setSortFacturas} filters={filtrosFacturas} onFilter={updateFilter(setFiltrosFacturas)} type="number" />
                <FilterableHeader label="Estado" field="estado" sortConfig={sortFacturas} onSort={setSortFacturas} filters={filtrosFacturas} onFilter={updateFilter(setFiltrosFacturas)} type="select" options={estadoFacturaOptions} />
                <th className="text-right px-5 py-4 text-sm font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortData(facturasFiltradas, sortFacturas).map(factura => {
                const cliente = clientes.find(c => c.id === factura.cliente_id);
                const config = estadoFacturaConfig[factura.estado];
                const isSelected = selectedFacturas.includes(factura.id);
                return (
                  <tr key={factura.id} className={`border-b border-neutral-100 hover:bg-neutral-50 ${isSelected ? 'bg-orange-50' : ''}`}>
                    <td className="px-5 py-4">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={e => handleSelectOne(factura.id, e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                    </td>
                    <td className="px-5 py-4"><p className="font-black">{factura.id}</p><p className="text-xs text-neutral-400">Pedido #{factura.pedido_id}</p></td>
                    <td className="px-5 py-4 font-semibold">{cliente?.nombre}</td>
                    <td className="px-5 py-4 text-sm">{formatDate(factura.fecha)}</td>
                    <td className="px-5 py-4 font-bold text-lg">{formatCurrency(factura.total)}</td>
                    <td className="px-5 py-4"><Badge className={config?.color}>{config?.label}</Badge></td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setSelectedFactura(factura)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Ver factura"><Eye size={16} /></button>
                        {factura.estado === 'pendiente' && (
                          <button 
                            onClick={() => registrarCobro(factura.id)} 
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg" 
                            title="Registrar cobro (genera asiento 572/430)"
                          >
                            <Check size={16} />
                          </button>
                        )}
                        <button onClick={() => handleDeleteFactura(factura.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Eliminar"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {facturasFiltradas.length === 0 && <EmptyState icon={Receipt} title="No hay facturas" description="Las facturas se generan al crear pedidos" />}
        </Card>
        
        {/* Modal de factura */}
        {selectedFactura && (
          <FacturaPreview 
            factura={selectedFactura} 
            cliente={clientes.find(c => c.id === selectedFactura.cliente_id)} 
            pedidoItemsList={pedidoItems}
            onClose={() => setSelectedFactura(null)} 
          />
        )}
      </div>
    );
  };

  const renderGastos = () => {
    // Filtrar gastos por mes y luego por filtros de columna
    let gastosFiltradosPorMes = filtrarPorPeriodo(gastos, 'fecha', filtroGastosMes);
    
    // Aplicar filtros de columna
    gastosFiltradosPorMes = aplicarFiltros(gastosFiltradosPorMes, filtrosGastos, {
      concepto: g => g.concepto,
      categoria: g => g.categoria,
      proveedor_id: g => g.proveedor_id,
      importe: g => g.importe,
      pagado: g => g.pagado?.toString(),
    });
    
    const exportColumns = [
      { header: 'Fecha', accessor: g => formatDate(g.fecha) },
      { header: 'Categoría', accessor: g => categoriasGasto[g.categoria]?.label },
      { header: 'Concepto', accessor: g => g.concepto },
      { header: 'Proveedor', accessor: g => g.proveedor },
      { header: 'Importe', accessor: g => g.importe },
      { header: 'Estado', accessor: g => g.pagado ? 'Pagado' : 'Pendiente' },
      { header: 'Factura', accessor: g => g.factura_url ? 'Sí' : 'No' }
    ];
    
    const handleMarcarPagado = async (id) => {
      await supabase.from('gastos').update({ pagado: true }).eq('id', id);
      refetchGastos();
    };

    const handleSelectAllGastos = (checked) => {
      if (checked) {
        setSelectedGastos(gastosFiltradosPorMes.map(g => g.id));
      } else {
        setSelectedGastos([]);
      }
    };

    const handleSelectOneGasto = (id, checked) => {
      if (checked) {
        setSelectedGastos([...selectedGastos, id]);
      } else {
        setSelectedGastos(selectedGastos.filter(gId => gId !== id));
      }
    };

    const handleExportSelectedGastos = () => {
      const toExport = selectedGastos.length > 0 
        ? gastos.filter(g => selectedGastos.includes(g.id))
        : gastosFiltradosPorMes;
      exportToExcel(toExport, 'gastos', exportColumns);
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-neutral-900">Gastos</h1>
            <p className="text-neutral-500 font-medium">{gastosFiltradosPorMes.length} gastos</p>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={filtroGastosMes} 
              onChange={e => { setFiltroGastosMes(e.target.value); setSelectedGastos([]); }}
              className="px-3 py-2 rounded-xl border bg-white font-medium text-sm"
            >
              <option value="todos">Todas las fechas</option>
              <option value="mes_actual">Este mes</option>
              <option value="año_actual">Este año</option>
              {getMesesDisponibles().slice(1).map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <Button variant="secondary" size="sm" onClick={handleExportSelectedGastos}>
              <Download size={16} /> {selectedGastos.length > 0 ? `Exportar (${selectedGastos.length})` : 'Exportar'}
            </Button>
            <Button onClick={() => { setEditingItem(null); setShowModal('gasto'); }}><Plus size={20} /> Nuevo</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard icon={Wallet} label="Total" value={formatCurrency(gastosFiltradosPorMes.reduce((sum, g) => sum + (g.importe || 0), 0))} color="bg-red-100 text-red-600" />
          <StatCard icon={CreditCard} label="Pagados" value={formatCurrency(gastosFiltradosPorMes.filter(g => g.pagado).reduce((sum, g) => sum + (g.importe || 0), 0))} color="bg-green-100 text-green-600" />
          <StatCard icon={Clock} label="Pendientes" value={formatCurrency(gastosFiltradosPorMes.filter(g => !g.pagado).reduce((sum, g) => sum + (g.importe || 0), 0))} color="bg-amber-100 text-amber-600" />
          <StatCard icon={FileText} label="Con Factura" value={gastosFiltradosPorMes.filter(g => g.factura_url).length} color="bg-blue-100 text-blue-600" />
        </div>

        {selectedGastos.length > 0 && (
          <Card className="p-3 bg-orange-50 border-orange-200 flex items-center justify-between">
            <span className="font-semibold text-orange-700">{selectedGastos.length} gasto(s) seleccionado(s) - Total: {formatCurrency(gastos.filter(g => selectedGastos.includes(g.id)).reduce((sum, g) => sum + (g.importe || 0), 0))}</span>
            <Button variant="secondary" size="sm" onClick={() => setSelectedGastos([])}>Limpiar selección</Button>
          </Card>
        )}

        <Card className="overflow-hidden">
          {Object.values(filtrosGastos).some(v => v && v !== '') && (
            <div className="p-3 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
              <span className="text-sm text-orange-700">🔍 Filtros activos</span>
              <button onClick={() => setFiltrosGastos({})} className="text-xs text-orange-600 hover:text-orange-800 font-medium">Limpiar filtros</button>
            </div>
          )}
          <table className="w-full">
            <thead className="bg-neutral-900 text-white">
              <tr>
                <th className="px-5 py-4 text-left">
                  <input 
                    type="checkbox" 
                    checked={gastosFiltradosPorMes.length > 0 && selectedGastos.length === gastosFiltradosPorMes.length}
                    onChange={e => handleSelectAllGastos(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                </th>
                <FilterableHeader label="Fecha" field="fecha" sortConfig={sortGastos} onSort={setSortGastos} filters={filtrosGastos} onFilter={updateFilter(setFiltrosGastos)} type="date" />
                <FilterableHeader label="Concepto" field="concepto" sortConfig={sortGastos} onSort={setSortGastos} filters={filtrosGastos} onFilter={updateFilter(setFiltrosGastos)} type="text" />
                <FilterableHeader label="Categoría" field="categoria" filters={filtrosGastos} onFilter={updateFilter(setFiltrosGastos)} type="select" options={Object.entries(categoriasGasto).map(([k, v]) => ({ value: k, label: v.label }))} />
                <FilterableHeader label="Proveedor" field="proveedor_id" filters={filtrosGastos} onFilter={updateFilter(setFiltrosGastos)} type="select" options={proveedores.map(p => ({ value: p.id, label: p.nombre }))} />
                <FilterableHeader label="Importe" field="importe" sortConfig={sortGastos} onSort={setSortGastos} filters={filtrosGastos} onFilter={updateFilter(setFiltrosGastos)} type="number" />
                <th className="text-left px-5 py-4 text-sm font-bold">Factura</th>
                <FilterableHeader label="Estado" field="pagado" filters={filtrosGastos} onFilter={updateFilter(setFiltrosGastos)} type="select" options={[{ value: 'true', label: 'Pagado' }, { value: 'false', label: 'Pendiente' }]} />
                <th className="text-right px-5 py-4 text-sm font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortData(gastosFiltradosPorMes, sortGastos).map(gasto => {
                const catConfig = categoriasGasto[gasto.categoria] || categoriasGasto.otros;
                const Icon = catConfig.icon;
                const isSelected = selectedGastos.includes(gasto.id);
                return (
                  <tr key={gasto.id} className={`border-b border-neutral-100 hover:bg-neutral-50 ${isSelected ? 'bg-orange-50' : ''}`}>
                    <td className="px-5 py-4">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={e => handleSelectOneGasto(gasto.id, e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                    </td>
                    <td className="px-5 py-4 text-sm">{formatDate(gasto.fecha)}</td>
                    <td className="px-5 py-4 font-semibold">{gasto.concepto}</td>
                    <td className="px-5 py-4"><Badge className={catConfig.color}><Icon size={12} />{catConfig.label}</Badge></td>
                    <td className="px-5 py-4 text-sm font-medium">{gasto.proveedor_id ? proveedores.find(p => p.id === gasto.proveedor_id)?.nombre || '-' : '-'}</td>
                    <td className="px-5 py-4 font-bold">{formatCurrency(gasto.importe)}</td>
                    <td className="px-5 py-4">
                      {gasto.factura_url ? (
                        <a href={gasto.factura_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-600 hover:text-green-700">
                          <FileText size={16} />
                          <span className="text-sm font-medium">Ver</span>
                        </a>
                      ) : (
                        <span className="text-neutral-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4"><Badge variant={gasto.pagado ? 'success' : 'warning'}>{gasto.pagado ? 'Pagado' : 'Pendiente'}</Badge></td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        {!gasto.pagado && <button onClick={() => handleMarcarPagado(gasto.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Marcar como pagado"><Check size={16} /></button>}
                        <button onClick={() => { setEditingItem(gasto); setShowModal('gasto'); }} className="p-2 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete('gastos', gasto.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {gastosFiltradosPorMes.length === 0 && <EmptyState icon={Wallet} title="No hay gastos" description="Registra tus gastos" action={<Button onClick={() => setShowModal('gasto')}><Plus size={16} />Nuevo</Button>} />}
        </Card>
      </div>
    );
  };

  // Estado para pestaña de producción
  const [produccionTab, setProduccionTab] = useState('lotes');

  const renderProduccion = () => {
    // Aplicar filtros de columna
    const lotesFiltrados = aplicarFiltros(lotes, filtrosLotes, {
      codigo: l => l.codigo || `L-${l.id}`,
      producto_id: l => productos.find(p => p.id === l.producto_id)?.nombre?.toLowerCase(),
      estado: l => l.estado,
      bandejas: l => l.bandejas,
    });
    
    const hayFiltrosActivos = Object.values(filtrosLotes).some(v => v && v !== '');
    const estadoLoteOptions = Object.entries(estadoLoteConfig).map(([k, v]) => ({ value: k, label: v.label }));
    const productoOptions = productos.map(p => ({ value: p.nombre?.toLowerCase(), label: p.nombre }));
    
    const exportColumns = [{ header: 'Lote', accessor: l => l.id },{ header: 'Producto', accessor: l => productos.find(p => p.id === l.producto_id)?.nombre },{ header: 'Siembra', accessor: l => formatDate(l.fecha_siembra) },{ header: 'Cosecha', accessor: l => formatDate(l.fecha_cosecha_prevista) },{ header: 'Bandejas', accessor: l => l.bandejas },{ header: 'Estado', accessor: l => estadoLoteConfig[l.estado]?.label }];
    
    // Función para imprimir etiquetas
    const imprimirEtiquetas = (lote) => {
      const producto = productos.find(p => p.id === lote.producto_id);
      const fechaCosecha = new Date(lote.fecha_cosecha_real || lote.fecha_cosecha_prevista);
      const fechaConsumo = new Date(fechaCosecha);
      fechaConsumo.setDate(fechaConsumo.getDate() + 7);
      
      const logoUrl = 'https://www.rootflow.es/lovable-uploads/70262e87-198c-4788-b2e9-7b89bef45202.png';
      
      const etiquetas = [];
      for (let i = 0; i < lote.bandejas; i++) {
        etiquetas.push(`
          <div class="etiqueta">
            <div class="header">
              <div class="logo"><img src="${logoUrl}" alt="RootFlow" class="logo-img"><span class="logo-text"><span class="root">Root</span><span class="flow">Flow</span></span></div>
              <div class="categoria">PRODUCTO AGRÍCOLA FRESCO</div>
            </div>
            <div class="producto">${producto?.nombre || 'Brotes Tiernos'}</div>
            <div class="descripcion">Brotes tiernos cultivados en invernadero</div>
            
            <div class="aviso-lavar">
              LAVAR ANTES DE CONSUMIR
            </div>
            
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Lote</span>
                <span class="value">${lote.codigo || 'L-'+lote.id}</span>
              </div>
              <div class="info-item">
                <span class="label">Peso neto</span>
                <span class="value">100g aprox.</span>
              </div>
              <div class="info-item">
                <span class="label">F. Recolección</span>
                <span class="value">${formatDate(lote.fecha_cosecha_real || lote.fecha_cosecha_prevista)}</span>
              </div>
              <div class="info-item">
                <span class="label">Consumir antes de</span>
                <span class="value">${formatDate(fechaConsumo.toISOString().split('T')[0])}</span>
              </div>
            </div>
            
            <div class="conservacion">
              <strong>Conservación:</strong> Mantener refrigerado entre 2°C y 5°C
            </div>
            
            <div class="footer">
              <div class="origen">Origen: Madrid, España</div>
              <div class="productor">
                <strong>Productor:</strong> ROOTFLOW HYDROPONICS SL<br>
                C. Nueva, 16 • 28231 Las Rozas de Madrid<br>
                CIF: B27535137
              </div>
            </div>
          </div>
        `);
      }

      const ventana = window.open('', '_blank');
      ventana.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Etiquetas - ${lote.codigo || 'L-'+lote.id}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 8mm; background: #f5f5f5; }
            .etiquetas-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6mm; }
            .etiqueta { 
              background: white;
              border: 1.5px solid #333; 
              padding: 10px;
              border-radius: 6px;
              page-break-inside: avoid;
              font-size: 9px;
              line-height: 1.3;
            }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid #ddd; }
            .logo { display: flex; align-items: center; gap: 6px; }
            .logo-img { width: 24px; height: auto; }
            .logo-text { font-weight: bold; font-size: 13px; }
            .logo-text .root { color: #000; }
            .logo-text .flow { color: #f97316; }
            .categoria { font-size: 7px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
            .producto { font-size: 15px; font-weight: bold; color: #1a1a1a; margin-bottom: 2px; }
            .descripcion { font-size: 8px; color: #666; margin-bottom: 8px; font-style: italic; }
            .aviso-lavar { 
              background: #f5f5f5; 
              border: 2px solid #000;
              color: #000;
              padding: 6px 8px; 
              border-radius: 4px; 
              text-align: center; 
              font-weight: bold;
              font-size: 10px;
              margin: 8px 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 8px 0; }
            .info-item { background: #f8f8f8; padding: 4px 6px; border-radius: 3px; }
            .info-item .label { display: block; font-size: 7px; color: #666; text-transform: uppercase; }
            .info-item .value { display: block; font-size: 9px; font-weight: 600; color: #333; }
            .conservacion { background: #E0F2FE; padding: 6px 8px; border-radius: 4px; font-size: 8px; color: #0369A1; margin: 8px 0; }
            .footer { border-top: 1px solid #ddd; padding-top: 6px; margin-top: 8px; }
            .origen { font-size: 9px; font-weight: bold; color: #2D6A4F; margin-bottom: 4px; }
            .productor { font-size: 7px; color: #666; line-height: 1.4; }
            @media print {
              body { padding: 5mm; background: white; }
              .etiqueta { border: 1.5px solid #000; }
              .etiquetas-grid { gap: 4mm; }
            }
          </style>
        </head>
        <body>
          <div class="etiquetas-grid">
            ${etiquetas.join('')}
          </div>
        </body>
        </html>
      `);
      ventana.document.close();
      ventana.print();
    };

    // Planificación de siembras
    const calcularPlanificacion = () => {
      const plan = [];
      const hoy = new Date();
      
      // Analizar pedidos recurrentes activos
      pedidosRecurrentes.filter(pr => pr.activo).forEach(pr => {
        const cliente = clientes.find(c => c.id === pr.cliente_id);
        const items = pedidosRecurrentesItems.filter(i => i.pedido_recurrente_id === pr.id);
        
        items.forEach(item => {
          const producto = productos.find(p => p.id === item.producto_id);
          if (!producto) return;
          
          const diasCrecimiento = producto.dias_crecimiento || 7;
          
          // Calcular próxima entrega
          let proximaEntrega = new Date(hoy);
          proximaEntrega.setDate(proximaEntrega.getDate() + (7 - proximaEntrega.getDay() + pr.dia_semana) % 7);
          if (proximaEntrega <= hoy) proximaEntrega.setDate(proximaEntrega.getDate() + 7);
          
          // Fecha de siembra necesaria
          const fechaSiembra = new Date(proximaEntrega);
          fechaSiembra.setDate(fechaSiembra.getDate() - diasCrecimiento);
          
          const diasParaSembrar = Math.ceil((fechaSiembra - hoy) / (1000 * 60 * 60 * 24));
          
          plan.push({
            producto: producto.nombre,
            cliente: cliente?.nombre || 'Cliente',
            cantidad: item.cantidad,
            fechaSiembra: fechaSiembra.toISOString().split('T')[0],
            fechaEntrega: proximaEntrega.toISOString().split('T')[0],
            diasParaSembrar,
            diasCrecimiento,
            frecuencia: pr.frecuencia,
            urgente: diasParaSembrar <= 2
          });
        });
      });
      
      // Ordenar por fecha de siembra
      return plan.sort((a, b) => new Date(a.fechaSiembra) - new Date(b.fechaSiembra));
    };

    const planificacion = calcularPlanificacion();
    const siembrasUrgentes = planificacion.filter(p => p.urgente).length;

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className={`text-2xl md:text-3xl font-black ${darkMode ? 'text-white' : 'text-neutral-900'}`}>Producción</h1>
            <p className={`font-medium text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              {lotes.length} lotes • {lotes.filter(l => ['sembrado', 'creciendo'].includes(l.estado)).reduce((sum, l) => sum + l.bandejas, 0)} bandejas activas
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button variant="secondary" size="sm" onClick={() => exportToExcel(lotes, 'produccion', exportColumns)}><FileSpreadsheet size={16} /></Button>
            <Button onClick={() => { setEditingItem(null); setShowModal('lote'); }}><Plus size={18} /><span className="hidden sm:inline">Nuevo Lote</span></Button>
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => setProduccionTab('lotes')} 
            className={`px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-2 ${produccionTab === 'lotes' ? 'bg-orange-500 text-white' : darkMode ? 'bg-neutral-800 text-neutral-300' : 'bg-white text-neutral-600 hover:bg-neutral-100'}`}
          >
            <Sprout size={18} />Lotes
          </button>
          <button 
            onClick={() => setProduccionTab('etiquetas')} 
            className={`px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-2 ${produccionTab === 'etiquetas' ? 'bg-orange-500 text-white' : darkMode ? 'bg-neutral-800 text-neutral-300' : 'bg-white text-neutral-600 hover:bg-neutral-100'}`}
          >
            <FileText size={18} />Etiquetas
          </button>
          <button 
            onClick={() => setProduccionTab('planificacion')} 
            className={`px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-2 ${produccionTab === 'planificacion' ? 'bg-orange-500 text-white' : darkMode ? 'bg-neutral-800 text-neutral-300' : 'bg-white text-neutral-600 hover:bg-neutral-100'}`}
          >
            <Calendar size={18} />Planificación
            {siembrasUrgentes > 0 && <span className={`text-xs px-2 py-0.5 rounded-full ${produccionTab === 'planificacion' ? 'bg-white/20' : 'bg-red-500 text-white'}`}>{siembrasUrgentes}</span>}
          </button>
        </div>

        {produccionTab === 'lotes' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Sprout} label="Sembrados" value={lotes.filter(l => l.estado === 'sembrado').length} color="bg-amber-100 text-amber-600" />
              <StatCard icon={Sun} label="Creciendo" value={lotes.filter(l => l.estado === 'creciendo').length} color="bg-green-100 text-green-600" />
              <StatCard icon={Check} label="Cosechados" value={lotes.filter(l => l.estado === 'cosechado').length} color="bg-blue-100 text-blue-600" />
              <StatCard icon={Layers} label="Bandejas Activas" value={lotes.filter(l => ['sembrado', 'creciendo'].includes(l.estado)).reduce((sum, l) => sum + l.bandejas, 0)} color="bg-orange-100 text-orange-600" />
            </div>
            <Card className={`overflow-hidden ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
              {hayFiltrosActivos && (
                <div className="p-3 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
                  <span className="text-sm text-orange-700">🔍 Filtros activos - {lotesFiltrados.length} resultados</span>
                  <button onClick={() => setFiltrosLotes({})} className="text-xs text-orange-600 hover:text-orange-800 font-medium">Limpiar filtros</button>
                </div>
              )}
              <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-neutral-900 text-white"><tr>
                  <FilterableHeader label="Lote" field="codigo" filters={filtrosLotes} onFilter={updateFilter(setFiltrosLotes)} type="text" />
                  <FilterableHeader label="Producto" field="producto_id" filters={filtrosLotes} onFilter={updateFilter(setFiltrosLotes)} type="text" />
                  <FilterableHeader label="Siembra" field="fecha_siembra" filters={filtrosLotes} onFilter={updateFilter(setFiltrosLotes)} type="date" />
                  <FilterableHeader label="Cosecha" field="fecha_cosecha_prevista" filters={filtrosLotes} onFilter={updateFilter(setFiltrosLotes)} type="date" />
                  <FilterableHeader label="Bandejas" field="bandejas" filters={filtrosLotes} onFilter={updateFilter(setFiltrosLotes)} type="number" />
                  <FilterableHeader label="Estado" field="estado" filters={filtrosLotes} onFilter={updateFilter(setFiltrosLotes)} type="select" options={estadoLoteOptions} />
                  <th className="text-right px-4 py-3 text-sm font-bold">Acciones</th>
                </tr></thead>
                <tbody>
                  {lotesFiltrados.map(lote => {
                    const producto = productos.find(p => p.id === lote.producto_id);
                    const config = estadoLoteConfig[lote.estado];
                    const Icon = config?.icon || Sprout;
                    const diasRestantes = Math.ceil((new Date(lote.fecha_cosecha_prevista) - new Date()) / (1000*60*60*24));
                    return (
                      <tr key={lote.id} className={`border-b ${darkMode ? 'border-neutral-700 hover:bg-neutral-700' : 'border-neutral-100 hover:bg-neutral-50'}`}>
                        <td className={`px-4 py-3 font-black ${darkMode ? 'text-white' : ''}`}>{lote.codigo || `L-${lote.id}`}</td>
                        <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-green-500 flex items-center justify-center text-white"><Leaf size={12} /></div><span className={`font-semibold text-sm ${darkMode ? 'text-neutral-200' : ''}`}>{producto?.nombre}</span></div></td>
                        <td className={`px-4 py-3 text-sm ${darkMode ? 'text-neutral-300' : ''}`}>{formatDate(lote.fecha_siembra)}</td>
                        <td className="px-4 py-3"><p className={`text-sm ${darkMode ? 'text-neutral-300' : ''}`}>{formatDate(lote.fecha_cosecha_prevista)}</p>{lote.estado !== 'cosechado' && diasRestantes <= 2 && <p className="text-xs text-amber-600 font-bold">{diasRestantes <= 0 ? '¡Hoy!' : `En ${diasRestantes}d`}</p>}</td>
                        <td className={`px-4 py-3 font-bold ${darkMode ? 'text-white' : ''}`}>{lote.bandejas}</td>
                        <td className="px-4 py-3"><Badge className={config?.color}><Icon size={12} />{config?.label}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {lote.estado === 'cosechado' && <button onClick={() => imprimirEtiquetas(lote)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="Imprimir etiquetas"><Printer size={16} /></button>}
                            {lote.estado === 'creciendo' && <button onClick={() => handleCosecharLote(lote)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Cosechar"><Check size={16} /></button>}
                            {lote.estado === 'sembrado' && <button onClick={() => handleCambiarEstadoLote(lote, 'creciendo')} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Marcar creciendo"><Sun size={16} /></button>}
                            <button onClick={() => { setEditingItem(lote); setShowModal('lote'); }} className="p-2 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Edit2 size={16} /></button>
                            <button onClick={() => handleDelete('lotes', lote.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              {lotesFiltrados.length === 0 && <EmptyState icon={Sprout} title="No hay lotes" description="Crea un lote" action={<Button onClick={() => setShowModal('lote')}><Plus size={16} />Nuevo</Button>} />}
            </Card>
          </>
        )}

        {produccionTab === 'etiquetas' && (
          <div className="space-y-4">
            <Card className={`p-4 ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
              <h3 className={`font-bold mb-2 ${darkMode ? 'text-white' : ''}`}>📦 Generar Etiquetas</h3>
              <p className={`text-sm mb-4 ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Selecciona un lote cosechado para imprimir etiquetas para cada bandeja. 
                Incluyen: producto, lote, fecha de cosecha, caducidad y conservación.
              </p>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lotes.filter(l => l.estado === 'cosechado').map(lote => {
                const producto = productos.find(p => p.id === lote.producto_id);
                return (
                  <Card key={lote.id} className={`overflow-hidden ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
                    <div className="p-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm opacity-80">Lote {lote.codigo || 'L-'+lote.id}</p>
                          <h3 className="font-bold text-lg">{producto?.nombre}</h3>
                        </div>
                        <Leaf size={32} className="opacity-50" />
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className={darkMode ? 'text-neutral-400' : 'text-neutral-500'}>Bandejas:</span>
                        <span className={`font-bold ${darkMode ? 'text-white' : ''}`}>{lote.bandejas}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={darkMode ? 'text-neutral-400' : 'text-neutral-500'}>Cosecha:</span>
                        <span className={darkMode ? 'text-neutral-200' : ''}>{formatDate(lote.fecha_cosecha_prevista)}</span>
                      </div>
                      <Button className="w-full mt-3" onClick={() => imprimirEtiquetas(lote)}>
                        <Printer size={18} /> Imprimir {lote.bandejas} Etiquetas
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
            
            {lotes.filter(l => l.estado === 'cosechado').length === 0 && (
              <Card className={`p-8 text-center ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
                <FileText size={48} className="mx-auto text-neutral-300 mb-4" />
                <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : ''}`}>No hay lotes cosechados</h3>
                <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Cosecha un lote para poder generar etiquetas</p>
              </Card>
            )}
          </div>
        )}

        {produccionTab === 'planificacion' && (
          <div className="space-y-4">
            <Card className={`p-4 bg-gradient-to-r ${siembrasUrgentes > 0 ? 'from-red-50 to-amber-50 border-red-200' : 'from-green-50 to-emerald-50 border-green-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${siembrasUrgentes > 0 ? 'bg-red-500' : 'bg-green-500'} text-white`}>
                  <Calendar size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900">
                    {siembrasUrgentes > 0 ? `⚠️ ${siembrasUrgentes} siembras urgentes` : '✅ Sin siembras urgentes'}
                  </h3>
                  <p className="text-sm text-neutral-600">
                    Planificación basada en {pedidosRecurrentes.filter(p => p.activo).length} pedidos recurrentes activos
                  </p>
                </div>
              </div>
            </Card>

            {planificacion.length === 0 ? (
              <Card className={`p-8 text-center ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
                <Calendar size={48} className="mx-auto text-neutral-300 mb-4" />
                <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : ''}`}>Sin planificación disponible</h3>
                <p className={`text-sm mb-4 ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Crea pedidos recurrentes para generar la planificación automática de siembras</p>
                <Button onClick={() => { setActiveSection('pedidos'); setPedidosTab('recurrentes'); }}>
                  <Repeat size={18} /> Ir a Pedidos Recurrentes
                </Button>
              </Card>
            ) : (
              <Card className={`overflow-hidden ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
                <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-neutral-900 text-white">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-bold">Producto</th>
                      <th className="text-left px-4 py-3 text-sm font-bold">Cliente</th>
                      <th className="text-left px-4 py-3 text-sm font-bold">Cantidad</th>
                      <th className="text-left px-4 py-3 text-sm font-bold">Sembrar</th>
                      <th className="text-left px-4 py-3 text-sm font-bold">Entrega</th>
                      <th className="text-left px-4 py-3 text-sm font-bold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planificacion.map((p, idx) => (
                      <tr key={idx} className={`border-b ${darkMode ? 'border-neutral-700' : 'border-neutral-100'} ${p.urgente ? 'bg-red-50' : ''}`}>
                        <td className={`px-4 py-3 font-semibold ${darkMode && !p.urgente ? 'text-neutral-200' : ''}`}>{p.producto}</td>
                        <td className={`px-4 py-3 text-sm ${darkMode && !p.urgente ? 'text-neutral-300' : ''}`}>{p.cliente}</td>
                        <td className={`px-4 py-3 font-bold ${darkMode && !p.urgente ? 'text-white' : ''}`}>{p.cantidad} uds</td>
                        <td className="px-4 py-3">
                          <p className={`text-sm font-medium ${p.urgente ? 'text-red-600' : darkMode ? 'text-neutral-200' : ''}`}>{formatDate(p.fechaSiembra)}</p>
                          <p className={`text-xs ${p.urgente ? 'text-red-500 font-bold' : 'text-neutral-400'}`}>
                            {p.diasParaSembrar <= 0 ? '¡HOY!' : p.diasParaSembrar === 1 ? 'Mañana' : `En ${p.diasParaSembrar} días`}
                          </p>
                        </td>
                        <td className={`px-4 py-3 text-sm ${darkMode && !p.urgente ? 'text-neutral-300' : ''}`}>{formatDate(p.fechaEntrega)}</td>
                        <td className="px-4 py-3">
                          <Badge className={p.urgente ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                            {p.urgente ? '⚠️ Urgente' : '✓ Planificado'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    );
  };

  // ==================== CALENDARIO ====================
  const renderCalendario = () => {
    const mesActual = mesCalendario || new Date();
    
    const primerDiaMes = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1);
    const ultimoDiaMes = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0);
    const diasEnMes = ultimoDiaMes.getDate();
    const primerDiaSemana = primerDiaMes.getDay() === 0 ? 6 : primerDiaMes.getDay() - 1;
    
    const diasCalendario = [];
    for (let i = 0; i < primerDiaSemana; i++) diasCalendario.push(null);
    for (let i = 1; i <= diasEnMes; i++) diasCalendario.push(i);
    
    const fechaStr = (dia) => `${mesActual.getFullYear()}-${String(mesActual.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    
    const entregasDia = (dia) => pedidos.filter(p => p.fecha_entrega && p.fecha_entrega === fechaStr(dia) && ['pendiente', 'confirmado', 'preparando'].includes(p.estado));
    const cosechasDia = (dia) => lotes.filter(l => l.fecha_cosecha_prevista && l.fecha_cosecha_prevista === fechaStr(dia) && l.estado !== 'cosechado');
    
    const cambiarMes = (delta) => setMesCalendario(new Date(mesActual.getFullYear(), mesActual.getMonth() + delta, 1));
    
    const hoy = new Date().toISOString().split('T')[0];

    // Resumen del mes (con verificación de fechas válidas)
    const entregasMes = pedidos.filter(p => {
      if (!p.fecha_entrega) return false;
      try {
        const fecha = new Date(p.fecha_entrega);
        return fecha.getMonth() === mesActual.getMonth() && fecha.getFullYear() === mesActual.getFullYear() && ['pendiente', 'confirmado', 'preparando'].includes(p.estado);
      } catch { return false; }
    });
    const cosechasMes = lotes.filter(l => {
      if (!l.fecha_cosecha_prevista) return false;
      try {
        const fecha = new Date(l.fecha_cosecha_prevista);
        return fecha.getMonth() === mesActual.getMonth() && fecha.getFullYear() === mesActual.getFullYear() && l.estado !== 'cosechado';
      } catch { return false; }
    });

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-neutral-900">Calendario</h1>
            <p className="text-neutral-500 font-medium">Entregas y cosechas programadas</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard icon={Truck} label="Entregas este mes" value={entregasMes.length} color="bg-blue-100 text-blue-600" />
          <StatCard icon={Leaf} label="Cosechas este mes" value={cosechasMes.length} color="bg-green-100 text-green-600" />
          <StatCard icon={AlertCircle} label="Próximos 3 días" value={
            pedidos.filter(p => {
              const fecha = new Date(p.fecha_entrega);
              const diff = (fecha - new Date()) / (1000*60*60*24);
              return diff >= 0 && diff <= 3 && ['pendiente', 'confirmado', 'preparando'].includes(p.estado);
            }).length
          } color="bg-amber-100 text-amber-600" />
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => cambiarMes(-1)} className="p-2 hover:bg-neutral-100 rounded-lg"><ArrowDownRight size={20} className="rotate-135" /></button>
            <h2 className="text-xl font-bold text-neutral-900">
              {mesActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </h2>
            <button onClick={() => cambiarMes(1)} className="p-2 hover:bg-neutral-100 rounded-lg"><ArrowUpRight size={20} /></button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
              <div key={d} className="text-center text-sm font-bold text-neutral-500 py-2">{d}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {diasCalendario.map((dia, idx) => {
              if (!dia) return <div key={idx} className="h-24 bg-neutral-50 rounded-lg" />;
              
              const entregas = entregasDia(dia);
              const cosechas = cosechasDia(dia);
              const esHoy = fechaStr(dia) === hoy;
              
              return (
                <div key={idx} className={`h-24 p-2 rounded-lg border ${esHoy ? 'bg-orange-50 border-orange-300' : 'bg-white border-neutral-200'} overflow-hidden`}>
                  <p className={`text-sm font-bold ${esHoy ? 'text-orange-600' : 'text-neutral-700'}`}>{dia}</p>
                  <div className="mt-1 space-y-1">
                    {entregas.slice(0, 2).map(p => (
                      <div key={p.id} className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded truncate">
                        🚚 {clientes.find(c => c.id === p.cliente_id)?.nombre?.split(' ')[0]}
                      </div>
                    ))}
                    {cosechas.slice(0, 2).map(l => (
                      <div key={l.id} className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded truncate">
                        🌱 {productos.find(p => p.id === l.producto_id)?.nombre}
                      </div>
                    ))}
                    {(entregas.length + cosechas.length > 2) && (
                      <p className="text-[10px] text-neutral-400">+{entregas.length + cosechas.length - 2} más</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2"><Truck size={20} className="text-blue-500" /> Próximas Entregas</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {pedidos.filter(p => new Date(p.fecha_entrega) >= new Date() && ['pendiente', 'confirmado', 'preparando'].includes(p.estado))
                .sort((a, b) => new Date(a.fecha_entrega) - new Date(b.fecha_entrega))
                .slice(0, 8)
                .map(p => {
                  const cliente = clientes.find(c => c.id === p.cliente_id);
                  return (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                      <div>
                        <p className="font-semibold text-neutral-900">{cliente?.nombre}</p>
                        <p className="text-sm text-neutral-500">{formatDate(p.fecha_entrega)} • {formatCurrency(p.total)}</p>
                      </div>
                      <Badge className={estadoConfig[p.estado]?.color}>{estadoConfig[p.estado]?.label}</Badge>
                    </div>
                  );
                })}
              {pedidos.filter(p => new Date(p.fecha_entrega) >= new Date() && ['pendiente', 'confirmado', 'preparando'].includes(p.estado)).length === 0 && (
                <p className="text-neutral-400 text-center py-4">No hay entregas pendientes</p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2"><Leaf size={20} className="text-green-500" /> Próximas Cosechas</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {lotes.filter(l => l.estado !== 'cosechado')
                .sort((a, b) => new Date(a.fecha_cosecha_prevista) - new Date(b.fecha_cosecha_prevista))
                .slice(0, 8)
                .map(l => {
                  const producto = productos.find(p => p.id === l.producto_id);
                  const dias = Math.ceil((new Date(l.fecha_cosecha_prevista) - new Date()) / (1000*60*60*24));
                  return (
                    <div key={l.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                      <div>
                        <p className="font-semibold text-neutral-900">{producto?.nombre}</p>
                        <p className="text-sm text-neutral-500">{formatDate(l.fecha_cosecha_prevista)} • {l.bandejas} bandejas</p>
                      </div>
                      <Badge className={dias <= 0 ? 'bg-red-100 text-red-700' : dias <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}>
                        {dias <= 0 ? '¡Hoy!' : `En ${dias}d`}
                      </Badge>
                    </div>
                  );
                })}
              {lotes.filter(l => l.estado !== 'cosechado').length === 0 && (
                <p className="text-neutral-400 text-center py-4">No hay lotes pendientes</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // ==================== RUTAS DE REPARTO ====================
  const renderRutas = () => {
    const fechaActual = fechaRuta || new Date().toISOString().split('T')[0];
    const pedidosDelDia = pedidos.filter(p => p.fecha_entrega && p.fecha_entrega === fechaActual && ['pendiente', 'confirmado', 'preparando', 'enviado'].includes(p.estado));
    
    // Ubicación del local (Las Rozas)
    const LOCAL = { lat: 40.4932, lng: -3.8737, nombre: 'RootFlow - Las Rozas' };
    
    // Función para calcular distancia entre dos puntos (Haversine)
    const calcularDistancia = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Radio de la Tierra en km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };
    
    // Optimizar ruta usando algoritmo del vecino más cercano
    const optimizarRuta = (pedidosZona) => {
      if (pedidosZona.length <= 1) return pedidosZona;
      
      const pedidosConCoords = pedidosZona.map(p => {
        const cliente = clientes.find(c => c.id === p.cliente_id);
        const coords = getCoordsByCP(cliente?.codigo_postal);
        return { ...p, cliente, coords };
      });
      
      const rutaOptimizada = [];
      const pendientes = [...pedidosConCoords];
      let puntoActual = LOCAL;
      
      while (pendientes.length > 0) {
        // Encontrar el pedido más cercano al punto actual
        let indiceMasCercano = 0;
        let distanciaMinima = Infinity;
        
        pendientes.forEach((pedido, index) => {
          const distancia = calcularDistancia(
            puntoActual.lat, puntoActual.lng,
            pedido.coords.lat, pedido.coords.lng
          );
          if (distancia < distanciaMinima) {
            distanciaMinima = distancia;
            indiceMasCercano = index;
          }
        });
        
        const pedidoMasCercano = pendientes.splice(indiceMasCercano, 1)[0];
        pedidoMasCercano.distanciaDesdeAnterior = distanciaMinima;
        rutaOptimizada.push(pedidoMasCercano);
        puntoActual = pedidoMasCercano.coords;
      }
      
      return rutaOptimizada;
    };
    
    // Agrupar por todas las zonas disponibles
    const zonasDisponibles = Object.keys(zonaConfig);
    const pedidosPorZona = {};
    zonasDisponibles.forEach(zona => {
      const pedidosZona = pedidosDelDia.filter(p => {
        const cliente = clientes.find(c => c.id === p.cliente_id);
        return cliente?.zona === zona;
      });
      // Optimizar la ruta de cada zona
      pedidosPorZona[zona] = optimizarRuta(pedidosZona);
    });

    const totalPedidos = pedidosDelDia.length;
    const totalImporte = pedidosDelDia.reduce((sum, p) => sum + (p.total || 0), 0);

    const imprimirHojaRuta = (zona) => {
      const pedidosZona = pedidosPorZona[zona] || [];
      if (pedidosZona.length === 0) return;
      
      const contenido = pedidosZona.map((p, idx) => {
        const cliente = p.cliente || clientes.find(c => c.id === p.cliente_id);
        const items = pedidoItems.filter(i => i.pedido_id === p.id);
        const distancia = p.distanciaDesdeAnterior ? `(${p.distanciaDesdeAnterior.toFixed(1)} km)` : '';
        return `
${idx + 1}. ${cliente?.nombre || 'Cliente'} ${distancia}
   📍 ${cliente?.direccion || 'Sin dirección'}, ${cliente?.codigo_postal || ''} ${cliente?.ciudad || ''}
   📞 ${cliente?.telefono || 'Sin teléfono'}
   💰 Total: ${formatCurrency(p.total)}
   📦 Productos:
${items.map(i => `      - ${productos.find(pr => pr.id === i.producto_id)?.nombre || 'Producto'} x${i.cantidad}`).join('\n')}
   📝 Notas: ${p.notas || 'Ninguna'}
─────────────────────────────────`;
      }).join('\n');
      
      // Calcular distancia total de la ruta
      const distanciaTotal = pedidosZona.reduce((sum, p) => sum + (p.distanciaDesdeAnterior || 0), 0);

      const ventana = window.open('', '_blank');
      if (!ventana) {
        alert('Por favor permite ventanas emergentes para imprimir');
        return;
      }
      ventana.document.write(`
        <html>
          <head><title>Hoja de Ruta - ${zonaConfig[zona]?.label || zona} - ${formatDate(fechaActual)}</title>
          <style>body { font-family: monospace; white-space: pre-wrap; padding: 20px; }</style></head>
          <body>
═══════════════════════════════════
ROOTFLOW HYDROPONICS SL
HOJA DE RUTA - ${formatDate(fechaActual)}
ZONA: ${(zonaConfig[zona]?.label || zona).toUpperCase()}
Total entregas: ${pedidosZona.length}
Distancia estimada: ${distanciaTotal.toFixed(1)} km
🗺️ RUTA OPTIMIZADA POR CERCANÍA
═══════════════════════════════════

${contenido}

Firma repartidor: _________________
          </body>
        </html>
      `);
      ventana.document.close();
      ventana.print();
    };
    
    // Abrir ruta en Google Maps
    const abrirEnGoogleMaps = (zona) => {
      const pedidosZona = pedidosPorZona[zona] || [];
      if (pedidosZona.length === 0) return;
      
      // Construir URL de Google Maps con waypoints
      const waypoints = pedidosZona.map(p => {
        const cliente = p.cliente || clientes.find(c => c.id === p.cliente_id);
        return encodeURIComponent(`${cliente?.direccion || ''}, ${cliente?.codigo_postal || ''} Madrid`);
      });
      
      // Google Maps permite hasta 10 waypoints en la URL
      const origin = encodeURIComponent('Calle Nueva 16, Las Rozas de Madrid');
      const destination = waypoints[waypoints.length - 1];
      const waypointsStr = waypoints.slice(0, -1).join('|');
      
      const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypointsStr}&travelmode=driving`;
      window.open(url, '_blank');
    };

    // Zonas con pedidos
    const zonasConPedidos = zonasDisponibles.filter(z => (pedidosPorZona[z]?.length || 0) > 0);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-neutral-900">Rutas de Reparto</h1>
            <p className="text-neutral-500 font-medium">Organiza las entregas por zona</p>
          </div>
          <div className="flex items-center gap-3">
            <input 
              type="date" 
              value={fechaActual} 
              onChange={e => setFechaRuta(e.target.value)}
              className="px-4 py-2 rounded-xl border font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Truck} label="Total Entregas" value={totalPedidos} color="bg-blue-100 text-blue-600" />
          <StatCard icon={Euro} label="Importe Total" value={formatCurrency(totalImporte)} color="bg-green-100 text-green-600" />
          <StatCard icon={MapPin} label="Zonas Activas" value={zonasConPedidos.length} color="bg-purple-100 text-purple-600" />
          <StatCard icon={Users} label="Clientes" value={[...new Set(pedidosDelDia.map(p => p.cliente_id))].length} color="bg-orange-100 text-orange-600" />
        </div>

        <Card className="p-4 bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-neutral-900">Resumen del día: {formatDate(fechaActual)}</p>
              <p className="text-sm text-neutral-600">{totalPedidos} entregas por valor de {formatCurrency(totalImporte)}</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {zonasDisponibles.map(zona => {
            const pedidosZona = pedidosPorZona[zona] || [];
            const config = zonaConfig[zona] || { label: zona, color: 'bg-neutral-100 text-neutral-700' };
            
            return (
              <Card key={zona} className="overflow-hidden">
                <div className={`p-4 ${config.color} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <MapPin size={20} />
                    <h3 className="font-bold">{config.label}</h3>
                    <Badge className="bg-white/30 text-inherit">{pedidosZona.length}</Badge>
                  </div>
                  {pedidosZona.length > 0 && (
                    <div className="flex gap-1">
                      <button onClick={() => abrirEnGoogleMaps(zona)} className="p-2 hover:bg-white/20 rounded-lg" title="Abrir en Google Maps">
                        <Navigation size={18} />
                      </button>
                      <button onClick={() => imprimirHojaRuta(zona)} className="p-2 hover:bg-white/20 rounded-lg" title="Imprimir hoja de ruta">
                        <Printer size={18} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
                  {pedidosZona.length > 0 && (
                    <div className="text-xs text-green-600 font-medium bg-green-50 p-2 rounded-lg flex items-center gap-2">
                      <Navigation size={14} />
                      Ruta optimizada por cercanía
                    </div>
                  )}
                  {pedidosZona.map((p, idx) => {
                    const cliente = p.cliente || clientes.find(c => c.id === p.cliente_id);
                    return (
                      <div key={p.id} className="p-3 bg-neutral-50 rounded-xl border-l-4 border-green-400">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                            <div>
                              <p className="font-semibold text-neutral-900">{cliente?.nombre || 'Cliente'}</p>
                              <p className="text-xs text-neutral-500">{cliente?.direccion || 'Sin dirección'}</p>
                              <p className="text-xs text-neutral-400">{cliente?.codigo_postal || ''} • {cliente?.telefono || ''}</p>
                              {p.distanciaDesdeAnterior && (
                                <p className="text-xs text-green-600 font-medium mt-1">📍 {p.distanciaDesdeAnterior.toFixed(1)} km desde anterior</p>
                              )}
                            </div>
                          </div>
                          <p className="font-bold text-neutral-900">{formatCurrency(p.total)}</p>
                        </div>
                      </div>
                    );
                  })}
                  {pedidosZona.length === 0 && (
                    <p className="text-center text-neutral-400 py-8">Sin entregas</p>
                  )}
                </div>
                {pedidosZona.length > 0 && (
                  <div className="p-4 bg-neutral-100 border-t">
                    <p className="text-sm font-semibold text-neutral-600">
                      Total zona: {formatCurrency(pedidosZona.reduce((sum, p) => sum + (p.total || 0), 0))}
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  // ==================== INFORMES Y ANÁLISIS ====================
  const renderInformes = () => {
    const pedidosPeriodo = filtrarPorPeriodo(pedidos, 'fecha', informesPeriodo);
    const facturasPeriodo = filtrarPorPeriodo(facturas, 'fecha', informesPeriodo);
    const gastosPeriodoInf = filtrarPorPeriodo(gastos, 'fecha', informesPeriodo);
    
    // Ranking de clientes por facturación
    const rankingClientes = clientes.map(c => {
      const totalFacturado = facturasPeriodo.filter(f => f.cliente_id === c.id).reduce((sum, f) => sum + (f.total || 0), 0);
      const numPedidos = pedidosPeriodo.filter(p => p.cliente_id === c.id).length;
      return { ...c, totalFacturado, numPedidos };
    }).filter(c => c.totalFacturado > 0).sort((a, b) => b.totalFacturado - a.totalFacturado);

    // Productos más vendidos
    const ventasPorProducto = {};
    pedidosPeriodo.forEach(p => {
      pedidoItems.filter(i => i.pedido_id === p.id).forEach(item => {
        if (!ventasPorProducto[item.producto_id]) {
          ventasPorProducto[item.producto_id] = { cantidad: 0, importe: 0 };
        }
        ventasPorProducto[item.producto_id].cantidad += item.cantidad;
        ventasPorProducto[item.producto_id].importe += item.subtotal || 0;
      });
    });
    const rankingProductos = Object.entries(ventasPorProducto).map(([id, data]) => ({
      producto: productos.find(p => p.id === parseInt(id)),
      ...data
    })).filter(p => p.producto).sort((a, b) => b.importe - a.importe);

    // Margen por producto
    const margenProductos = productos.map(p => {
      const ventas = ventasPorProducto[p.id]?.importe || 0;
      const coste = (ventasPorProducto[p.id]?.cantidad || 0) * (p.coste || 0);
      const margen = ventas - coste;
      const margenPct = ventas > 0 ? (margen / ventas * 100) : 0;
      return { ...p, ventas, coste, margen, margenPct };
    }).filter(p => p.ventas > 0).sort((a, b) => b.margen - a.margen);

    // Totales
    const totalVentas = pedidosPeriodo.filter(p => p.estado === 'entregado').reduce((sum, p) => sum + (p.total || 0), 0);
    const totalGastos = gastosPeriodoInf.reduce((sum, g) => sum + (g.importe || 0), 0);
    const totalFacturado = facturasPeriodo.reduce((sum, f) => sum + (f.total || 0), 0);
    const totalCobrado = facturasPeriodo.filter(f => f.estado === 'pagada').reduce((sum, f) => sum + (f.total || 0), 0);

    const periodoLabel = informesPeriodo === 'mes_actual' ? 'Este mes' : 
                         informesPeriodo === 'año_actual' ? 'Este año' : 
                         getMesesDisponibles().find(m => m.value === informesPeriodo)?.label || 'Periodo';

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-neutral-900">Informes y Análisis</h1>
            <p className="text-neutral-500 font-medium">Métricas y rendimiento del negocio</p>
          </div>
          <select value={informesPeriodo} onChange={e => setInformesPeriodo(e.target.value)} className="px-4 py-2 rounded-xl border font-semibold">
            <option value="mes_actual">Este mes</option>
            <option value="año_actual">Este año</option>
            {getMesesDisponibles().slice(1).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <Card className="p-4 bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
          <p className="font-bold text-neutral-900">📊 Periodo: {periodoLabel}</p>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Euro} label="Ventas" value={formatCurrency(totalVentas)} color="bg-green-100 text-green-600" />
          <StatCard icon={Wallet} label="Gastos" value={formatCurrency(totalGastos)} color="bg-red-100 text-red-600" />
          <StatCard icon={TrendingUp} label="Beneficio" value={formatCurrency(totalVentas - totalGastos)} color={totalVentas - totalGastos >= 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"} />
          <StatCard icon={Receipt} label="Facturado" value={formatCurrency(totalFacturado)} color="bg-blue-100 text-blue-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <h3 className="text-lg font-bold text-neutral-900 mb-4">🏆 Top Clientes</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {rankingClientes.slice(0, 10).map((c, idx) => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${idx < 3 ? 'bg-orange-500' : 'bg-neutral-400'}`}>{idx + 1}</span>
                    <div>
                      <p className="font-semibold">{c.nombre}</p>
                      <p className="text-xs text-neutral-500">{c.numPedidos} pedidos</p>
                    </div>
                  </div>
                  <p className="font-bold text-lg">{formatCurrency(c.totalFacturado)}</p>
                </div>
              ))}
              {rankingClientes.length === 0 && <p className="text-neutral-400 text-center py-4">Sin datos en este periodo</p>}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-lg font-bold text-neutral-900 mb-4">📦 Top Productos</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {rankingProductos.slice(0, 10).map((p, idx) => (
                <div key={p.producto.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${idx < 3 ? 'bg-green-500' : 'bg-neutral-400'}`}>{idx + 1}</span>
                    <div>
                      <p className="font-semibold">{p.producto.nombre}</p>
                      <p className="text-xs text-neutral-500">{p.cantidad} uds vendidas</p>
                    </div>
                  </div>
                  <p className="font-bold text-lg">{formatCurrency(p.importe)}</p>
                </div>
              ))}
              {rankingProductos.length === 0 && <p className="text-neutral-400 text-center py-4">Sin datos en este periodo</p>}
            </div>
          </Card>

          <Card className="p-5 lg:col-span-2">
            <h3 className="text-lg font-bold text-neutral-900 mb-4">💰 Margen por Producto</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-bold">Producto</th>
                    <th className="text-right px-4 py-3 text-sm font-bold">Ventas</th>
                    <th className="text-right px-4 py-3 text-sm font-bold">Coste</th>
                    <th className="text-right px-4 py-3 text-sm font-bold">Margen €</th>
                    <th className="text-right px-4 py-3 text-sm font-bold">Margen %</th>
                  </tr>
                </thead>
                <tbody>
                  {margenProductos.slice(0, 8).map(p => (
                    <tr key={p.id} className="border-b">
                      <td className="px-4 py-3 font-semibold">{p.nombre}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(p.ventas)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{formatCurrency(p.coste)}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(p.margen)}</td>
                      <td className="px-4 py-3 text-right"><Badge className={p.margenPct >= 50 ? 'bg-green-100 text-green-700' : p.margenPct >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>{p.margenPct.toFixed(1)}%</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // ==================== PROVEEDORES ====================
  const renderProveedores = () => {
    const handleDeleteProveedor = async (id) => {
      if (window.confirm('¿Eliminar este proveedor?')) {
        await supabase.from('proveedores').delete().eq('id', id);
        refetchProveedores();
      }
    };

    // Calcular totales por proveedor
    const proveedoresConTotales = proveedores.map(p => {
      const gastosProveedor = gastos.filter(g => g.proveedor_id === p.id);
      const total = gastosProveedor.reduce((sum, g) => sum + (g.importe || 0), 0);
      return { ...p, totalGastos: total, numFacturas: gastosProveedor.length };
    });

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-neutral-900">Proveedores</h1>
            <p className="text-neutral-500 font-medium">{proveedores.length} proveedores</p>
          </div>
          <Button onClick={() => { setEditingItem(null); setShowModal('proveedor'); }}><Plus size={20} /> Nuevo</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {proveedoresConTotales.map(prov => {
            const catConfig = categoriaProveedorConfig[prov.categoria] || categoriaProveedorConfig.otros;
            return (
              <Card key={prov.id} className="p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <Badge className={catConfig.color}>{catConfig.label}</Badge>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingItem(prov); setShowModal('proveedor'); }} className="p-2 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Edit2 size={16} /></button>
                    <button onClick={() => handleDeleteProveedor(prov.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                  </div>
                </div>
                <h3 className="font-bold text-lg text-neutral-900">{prov.nombre}</h3>
                <p className="text-sm text-neutral-500 mb-2">{prov.contacto}</p>
                <div className="text-sm text-neutral-400 space-y-1">
                  {prov.email && <p className="flex items-center gap-2"><Mail size={14} /> {prov.email}</p>}
                  {prov.telefono && <p className="flex items-center gap-2"><Phone size={14} /> {prov.telefono}</p>}
                </div>
                <div className="mt-4 pt-3 border-t flex justify-between items-center">
                  <span className="text-sm text-neutral-500">{prov.numFacturas} facturas</span>
                  <span className="font-bold text-neutral-900">{formatCurrency(prov.totalGastos)}</span>
                </div>
              </Card>
            );
          })}
          {proveedores.length === 0 && (
            <Card className="col-span-3 p-8 text-center">
              <Package size={48} className="mx-auto text-neutral-300 mb-4" />
              <h3 className="font-bold text-neutral-900 mb-2">No hay proveedores</h3>
              <p className="text-neutral-500 mb-4">Añade tus proveedores para gestionar mejor las compras</p>
              <Button onClick={() => setShowModal('proveedor')}><Plus size={16} /> Añadir Proveedor</Button>
            </Card>
          )}
        </div>
      </div>
    );
  };

  // ==================== TAREAS ====================
  const renderTareas = () => {
    const handleToggleTarea = async (tarea) => {
      await supabase.from('tareas').update({ completada: !tarea.completada }).eq('id', tarea.id);
      refetchTareas();
    };

    const handleDeleteTarea = async (id) => {
      if (window.confirm('¿Eliminar esta tarea?')) {
        await supabase.from('tareas').delete().eq('id', id);
        refetchTareas();
      }
    };

    const tareasPendientesLista = tareas.filter(t => !t.completada).sort((a, b) => {
      const prioridadOrden = { alta: 0, media: 1, baja: 2 };
      return prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad];
    });
    const tareasCompletadas = tareas.filter(t => t.completada);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-neutral-900">Tareas</h1>
            <p className="text-neutral-500 font-medium">{tareasPendientes} pendientes</p>
          </div>
          <Button onClick={() => { setEditingItem(null); setShowModal('tarea'); }}><Plus size={20} /> Nueva Tarea</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard icon={Clock} label="Pendientes" value={tareasPendientesLista.length} color="bg-amber-100 text-amber-600" />
          <StatCard icon={AlertCircle} label="Alta Prioridad" value={tareasPendientesLista.filter(t => t.prioridad === 'alta').length} color="bg-red-100 text-red-600" />
          <StatCard icon={CheckCircle} label="Completadas" value={tareasCompletadas.length} color="bg-green-100 text-green-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <h3 className="text-lg font-bold text-neutral-900 mb-4">📋 Pendientes</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {tareasPendientesLista.map(tarea => {
                const catConfig = categoriaTareaConfig[tarea.categoria] || categoriaTareaConfig.otro;
                const prioConfig = prioridadTareaConfig[tarea.prioridad];
                const cliente = tarea.cliente_id ? clientes.find(c => c.id === tarea.cliente_id) : null;
                const vencida = tarea.fecha_limite && new Date(tarea.fecha_limite) < new Date();
                return (
                  <div key={tarea.id} className={`p-4 rounded-xl border ${vencida ? 'bg-red-50 border-red-200' : 'bg-neutral-50 border-neutral-200'}`}>
                    <div className="flex items-start gap-3">
                      <button onClick={() => handleToggleTarea(tarea)} className="mt-1 w-5 h-5 rounded border-2 border-neutral-300 hover:border-green-500 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-neutral-900">{tarea.titulo}</p>
                          <Badge className={prioConfig.color}>{prioConfig.label}</Badge>
                          <Badge className={catConfig.color}>{catConfig.label}</Badge>
                        </div>
                        {tarea.descripcion && <p className="text-sm text-neutral-500 mb-2">{tarea.descripcion}</p>}
                        <div className="flex items-center gap-4 text-xs text-neutral-400">
                          {tarea.fecha_limite && <span className={vencida ? 'text-red-600 font-bold' : ''}>{vencida ? '⚠️ Vencida: ' : '📅 '}{formatDate(tarea.fecha_limite)}</span>}
                          {cliente && <span>👤 {cliente.nombre}</span>}
                          {tarea.asignado_a && (() => {
                            const socio = SOCIOS.find(s => s.id === tarea.asignado_a);
                            return socio ? <Badge className={socio.color}>{socio.nombre}</Badge> : null;
                          })()}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingItem(tarea); setShowModal('tarea'); }} className="p-2 text-neutral-400 hover:text-orange-600 rounded-lg"><Edit2 size={14} /></button>
                        <button onClick={() => handleDeleteTarea(tarea.id)} className="p-2 text-neutral-400 hover:text-red-600 rounded-lg"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {tareasPendientesLista.length === 0 && <p className="text-center text-neutral-400 py-8">🎉 ¡No hay tareas pendientes!</p>}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-lg font-bold text-neutral-900 mb-4">✅ Completadas</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {tareasCompletadas.slice(0, 10).map(tarea => (
                <div key={tarea.id} className="p-3 bg-green-50 rounded-xl border border-green-200 flex items-center gap-3">
                  <button onClick={() => handleToggleTarea(tarea)} className="w-5 h-5 rounded bg-green-500 text-white flex items-center justify-center flex-shrink-0"><Check size={12} /></button>
                  <p className="text-neutral-500 line-through flex-1">{tarea.titulo}</p>
                  <button onClick={() => handleDeleteTarea(tarea.id)} className="p-1 text-neutral-400 hover:text-red-600 rounded"><Trash2 size={14} /></button>
                </div>
              ))}
              {tareasCompletadas.length === 0 && <p className="text-center text-neutral-400 py-8">Sin tareas completadas</p>}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // ==================== MERMAS ====================
  const renderMermas = () => {
    const handleDeleteMerma = async (id) => {
      if (window.confirm('¿Eliminar este registro?')) {
        await supabase.from('mermas').delete().eq('id', id);
        refetchMermas();
      }
    };

    const motivosConfig = {
      plagas: { label: 'Plagas', color: 'bg-red-100 text-red-700' },
      hongos: { label: 'Hongos/Moho', color: 'bg-amber-100 text-amber-700' },
      riego: { label: 'Problemas de riego', color: 'bg-blue-100 text-blue-700' },
      temperatura: { label: 'Temperatura', color: 'bg-orange-100 text-orange-700' },
      germinacion: { label: 'Fallo germinación', color: 'bg-purple-100 text-purple-700' },
      manipulacion: { label: 'Manipulación', color: 'bg-pink-100 text-pink-700' },
      caducidad: { label: 'Caducidad', color: 'bg-neutral-100 text-neutral-700' },
      otros: { label: 'Otros', color: 'bg-gray-100 text-gray-700' },
    };

    const totalMermas = mermas.reduce((sum, m) => sum + (m.cantidad || 0), 0);
    const mermasPorMotivo = Object.entries(motivosConfig).map(([key, config]) => ({
      motivo: key,
      label: config.label,
      cantidad: mermas.filter(m => m.motivo === key).reduce((sum, m) => sum + (m.cantidad || 0), 0)
    })).filter(m => m.cantidad > 0);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-neutral-900">Control de Mermas</h1>
            <p className="text-neutral-500 font-medium">Registro de pérdidas en producción</p>
          </div>
          <Button onClick={() => { setEditingItem(null); setShowModal('merma'); }}><Plus size={20} /> Registrar Merma</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard icon={AlertTriangle} label="Total Mermas" value={totalMermas} color="bg-red-100 text-red-600" />
          <StatCard icon={TrendingDown} label="Este Mes" value={mermas.filter(m => new Date(m.fecha).getMonth() === new Date().getMonth()).reduce((sum, m) => sum + (m.cantidad || 0), 0)} color="bg-amber-100 text-amber-600" />
          <StatCard icon={Sprout} label="Lotes Afectados" value={[...new Set(mermas.map(m => m.lote_id))].length} color="bg-purple-100 text-purple-600" />
          <StatCard icon={Package} label="Registros" value={mermas.length} color="bg-blue-100 text-blue-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-5 lg:col-span-2">
            <h3 className="text-lg font-bold text-neutral-900 mb-4">📋 Historial de Mermas</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {mermas.map(m => {
                const lote = lotes.find(l => l.id === m.lote_id);
                const producto = lote ? productos.find(p => p.id === lote.producto_id) : null;
                const motivoConfig = motivosConfig[m.motivo] || motivosConfig.otros;
                return (
                  <div key={m.id} className="p-4 bg-neutral-50 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={motivoConfig.color}>{motivoConfig.label}</Badge>
                        <span className="font-bold text-red-600">-{m.cantidad} uds</span>
                      </div>
                      <p className="text-sm text-neutral-600">{producto?.nombre || 'Producto'} • Lote {lote?.codigo || 'L-'+m.lote_id}</p>
                      <p className="text-xs text-neutral-400">{formatDate(m.fecha)}</p>
                    </div>
                    <button onClick={() => handleDeleteMerma(m.id)} className="p-2 text-neutral-400 hover:text-red-600 rounded-lg"><Trash2 size={16} /></button>
                  </div>
                );
              })}
              {mermas.length === 0 && <p className="text-center text-neutral-400 py-8">Sin registros de mermas</p>}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-lg font-bold text-neutral-900 mb-4">📊 Por Motivo</h3>
            <div className="space-y-3">
              {mermasPorMotivo.map(m => {
                const pct = totalMermas > 0 ? (m.cantidad / totalMermas * 100) : 0;
                return (
                  <div key={m.motivo}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{m.label}</span>
                      <span className="font-bold">{m.cantidad} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {mermasPorMotivo.length === 0 && <p className="text-center text-neutral-400 py-4">Sin datos</p>}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // ==================== TRAZABILIDAD ====================
  const [trazabilidadLoteId, setTrazabilidadLoteId] = useState('');
  
  // Estado para formulario de condiciones ambientales
  const [formCondicion, setFormCondicion] = useState({
    temperatura: 22,
    humedad: 60,
    co2: 800,
    luz: 10000,
    notas: ''
  });
  
  const renderTrazabilidad = () => {
    const loteSeleccionado = trazabilidadLoteId ? lotes.find(l => l.id === parseInt(trazabilidadLoteId) || l.codigo === trazabilidadLoteId) : null;
    
    // Obtener toda la trazabilidad del lote
    const getTrazabilidad = (lote) => {
      if (!lote) return null;
      
      const producto = productos.find(p => p.id === lote.producto_id);
      
      // Encontrar pedidos que podrían contener este producto desde la fecha de cosecha
      const pedidosRelacionados = pedidos.filter(p => {
        const items = pedidoItems.filter(i => i.pedido_id === p.id && i.producto_id === lote.producto_id);
        if (items.length === 0) return false;
        // El pedido debe ser posterior o igual a la fecha de cosecha
        if (lote.fecha_cosecha_real || lote.fecha_cosecha_prevista) {
          const fechaCosecha = new Date(lote.fecha_cosecha_real || lote.fecha_cosecha_prevista);
          const fechaPedido = new Date(p.fecha);
          return fechaPedido >= fechaCosecha;
        }
        return true;
      }).slice(0, 10); // Limitar a 10 pedidos
      
      // Mermas relacionadas
      const mermasRelacionadas = mermas.filter(m => m.lote_id === lote.id);
      
      // Clientes que han recibido el producto
      const clientesRelacionados = [...new Set(pedidosRelacionados.map(p => p.cliente_id))]
        .map(id => clientes.find(c => c.id === id))
        .filter(Boolean);
      
      return {
        lote,
        producto,
        pedidos: pedidosRelacionados,
        mermas: mermasRelacionadas,
        clientes: clientesRelacionados
      };
    };

    const trazabilidad = getTrazabilidad(loteSeleccionado);

    return (
      <div className="space-y-6">
        <div>
          <h1 className={`text-2xl md:text-3xl font-black ${darkMode ? 'text-white' : 'text-neutral-900'}`}>Trazabilidad</h1>
          <p className={`font-medium text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Seguimiento completo: semilla → lote → pedido → cliente</p>
        </div>

        {/* Buscador */}
        <Card className={`p-6 ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                Buscar por Lote
              </label>
              <select 
                value={trazabilidadLoteId}
                onChange={e => setTrazabilidadLoteId(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border text-lg ${darkMode ? 'bg-neutral-700 border-neutral-600 text-white' : 'bg-white'}`}
              >
                <option value="">Selecciona un lote...</option>
                {lotes.map(l => {
                  const prod = productos.find(p => p.id === l.producto_id);
                  return (
                    <option key={l.id} value={l.id}>
                      {l.codigo || `L-${l.id}`} — {prod?.nombre || 'Producto'} — {formatDate(l.fecha_siembra)}
                    </option>
                  );
                })}
              </select>
            </div>
            {trazabilidadLoteId && (
              <Button variant="secondary" onClick={() => setTrazabilidadLoteId('')}>
                <X size={18} /> Limpiar
              </Button>
            )}
          </div>
        </Card>

        {!trazabilidad ? (
          <Card className={`p-12 text-center ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
            <History size={64} className="mx-auto text-neutral-300 mb-4" />
            <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : ''}`}>Selecciona un lote para ver su trazabilidad</h3>
            <p className={darkMode ? 'text-neutral-400' : 'text-neutral-500'}>
              Podrás ver todo el recorrido: desde la siembra hasta los clientes finales
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Timeline visual */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Paso 1: Producto/Semilla */}
              <Card className={`p-4 border-l-4 border-l-green-500 ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-100 rounded-lg text-green-600"><Leaf size={20} /></div>
                  <span className="text-xs font-bold text-green-600 uppercase">1. Producto</span>
                </div>
                <h4 className={`font-bold ${darkMode ? 'text-white' : ''}`}>{trazabilidad.producto?.nombre}</h4>
                <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  {trazabilidad.producto?.dias_crecimiento || 7} días crecimiento
                </p>
              </Card>

              {/* Paso 2: Lote */}
              <Card className={`p-4 border-l-4 border-l-amber-500 ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Sprout size={20} /></div>
                  <span className="text-xs font-bold text-amber-600 uppercase">2. Lote</span>
                </div>
                <h4 className={`font-bold ${darkMode ? 'text-white' : ''}`}>{trazabilidad.lote.codigo || `L-${trazabilidad.lote.id}`}</h4>
                <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  Siembra: {formatDate(trazabilidad.lote.fecha_siembra)}
                </p>
                <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  {trazabilidad.lote.bandejas} bandejas
                </p>
                <Badge className={estadoLoteConfig[trazabilidad.lote.estado]?.color || 'bg-neutral-100'}>
                  {estadoLoteConfig[trazabilidad.lote.estado]?.label || trazabilidad.lote.estado}
                </Badge>
              </Card>

              {/* Paso 3: Pedidos */}
              <Card className={`p-4 border-l-4 border-l-blue-500 ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><ShoppingCart size={20} /></div>
                  <span className="text-xs font-bold text-blue-600 uppercase">3. Pedidos</span>
                </div>
                <h4 className={`font-bold text-2xl ${darkMode ? 'text-white' : ''}`}>{trazabilidad.pedidos.length}</h4>
                <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  pedidos relacionados
                </p>
                {trazabilidad.pedidos.length > 0 && (
                  <p className={`text-sm font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    {formatCurrency(trazabilidad.pedidos.reduce((sum, p) => sum + (p.total || 0), 0))}
                  </p>
                )}
              </Card>

              {/* Paso 4: Clientes */}
              <Card className={`p-4 border-l-4 border-l-purple-500 ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><Users size={20} /></div>
                  <span className="text-xs font-bold text-purple-600 uppercase">4. Clientes</span>
                </div>
                <h4 className={`font-bold text-2xl ${darkMode ? 'text-white' : ''}`}>{trazabilidad.clientes.length}</h4>
                <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  clientes alcanzados
                </p>
              </Card>
            </div>

            {/* Detalles */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lista de clientes */}
              <Card className={`p-5 ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
                <h3 className={`font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : ''}`}>
                  <Users size={20} className="text-purple-500" /> Clientes que recibieron este lote
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {trazabilidad.clientes.length > 0 ? trazabilidad.clientes.map(cliente => (
                    <div key={cliente.id} className={`p-3 rounded-lg flex items-center justify-between ${darkMode ? 'bg-neutral-700' : 'bg-neutral-50'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center text-white font-bold">
                          {cliente.nombre?.charAt(0)}
                        </div>
                        <div>
                          <p className={`font-semibold ${darkMode ? 'text-white' : ''}`}>{cliente.nombre}</p>
                          <p className={`text-xs ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>{cliente.tipo}</p>
                        </div>
                      </div>
                      <Badge className={zonaConfig[cliente.zona]?.color || 'bg-neutral-100'}>
                        {zonaConfig[cliente.zona]?.label || cliente.zona}
                      </Badge>
                    </div>
                  )) : (
                    <p className={`text-center py-4 ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      No hay clientes relacionados aún
                    </p>
                  )}
                </div>
              </Card>

              {/* Pedidos relacionados */}
              <Card className={`p-5 ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
                <h3 className={`font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : ''}`}>
                  <ShoppingCart size={20} className="text-blue-500" /> Pedidos relacionados
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {trazabilidad.pedidos.length > 0 ? trazabilidad.pedidos.map(pedido => {
                    const cliente = clientes.find(c => c.id === pedido.cliente_id);
                    const config = estadoConfig[pedido.estado];
                    return (
                      <div key={pedido.id} className={`p-3 rounded-lg flex items-center justify-between ${darkMode ? 'bg-neutral-700' : 'bg-neutral-50'}`}>
                        <div>
                          <p className={`font-semibold ${darkMode ? 'text-white' : ''}`}>Pedido #{pedido.id}</p>
                          <p className={`text-xs ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                            {cliente?.nombre} • {formatDate(pedido.fecha_entrega)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${darkMode ? 'text-white' : ''}`}>{formatCurrency(pedido.total)}</p>
                          <Badge className={config?.color}>{config?.label}</Badge>
                        </div>
                      </div>
                    );
                  }) : (
                    <p className={`text-center py-4 ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      No hay pedidos relacionados
                    </p>
                  )}
                </div>
              </Card>
            </div>

            {/* Mermas */}
            {trazabilidad.mermas.length > 0 && (
              <Card className={`p-5 border-l-4 border-l-red-500 ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
                <h3 className={`font-bold mb-4 flex items-center gap-2 text-red-600`}>
                  <AlertTriangle size={20} /> Mermas registradas
                </h3>
                <div className="flex flex-wrap gap-3">
                  {trazabilidad.mermas.map(m => (
                    <div key={m.id} className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
                      <span className="font-bold text-red-700">-{m.cantidad}</span>
                      <span className="text-red-600 ml-2">{m.motivo}</span>
                      <span className="text-red-400 ml-2 text-sm">{formatDate(m.fecha)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    );
  };

  // ==================== CONTROL AMBIENTAL ====================
  const renderAmbiente = () => {
    // Rangos óptimos para microgreens
    const rangosOptimos = {
      temperatura: { min: 18, max: 24, unidad: '°C', label: 'Temperatura' },
      humedad: { min: 50, max: 70, unidad: '%', label: 'Humedad' },
      co2: { min: 400, max: 1200, unidad: 'ppm', label: 'CO₂' },
      luz: { min: 8000, max: 15000, unidad: 'lux', label: 'Luz' }
    };

    // Última lectura
    const ultimaLectura = condiciones.length > 0 ? condiciones[0] : null;

    // Evaluar si está en rango
    const evaluarRango = (valor, tipo) => {
      const rango = rangosOptimos[tipo];
      if (!rango || valor === null || valor === undefined) return 'unknown';
      if (valor < rango.min) return 'bajo';
      if (valor > rango.max) return 'alto';
      return 'optimo';
    };

    // Colores según estado
    const colorEstado = {
      optimo: 'bg-green-500',
      alto: 'bg-red-500',
      bajo: 'bg-blue-500',
      unknown: 'bg-neutral-400'
    };

    const bgEstado = {
      optimo: 'bg-green-50 border-green-200',
      alto: 'bg-red-50 border-red-200',
      bajo: 'bg-blue-50 border-blue-200',
      unknown: 'bg-neutral-50 border-neutral-200'
    };

    // Datos para gráfico (últimas 24 horas)
    const datosGrafico = condiciones.slice(0, 24).reverse().map(c => ({
      hora: new Date(c.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      temperatura: c.temperatura,
      humedad: c.humedad
    }));

    const guardarLectura = async () => {
      const { error } = await supabase.from('condiciones_ambientales').insert({
        ...formCondicion,
        fecha: new Date().toISOString()
      });
      if (error) {
        alert('Error: ' + error.message);
      } else {
        refetchCondiciones();
        alert('✅ Lectura guardada');
      }
    };

    // Alertas actuales
    const alertasAmbiente = [];
    if (ultimaLectura) {
      Object.entries(rangosOptimos).forEach(([tipo, rango]) => {
        const valor = ultimaLectura[tipo];
        const estado = evaluarRango(valor, tipo);
        if (estado === 'alto') {
          alertasAmbiente.push({ tipo, mensaje: `${rango.label} alta: ${valor}${rango.unidad} (máx: ${rango.max})`, color: 'text-red-600' });
        } else if (estado === 'bajo') {
          alertasAmbiente.push({ tipo, mensaje: `${rango.label} baja: ${valor}${rango.unidad} (mín: ${rango.min})`, color: 'text-blue-600' });
        }
      });
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className={`text-2xl md:text-3xl font-black ${darkMode ? 'text-white' : 'text-neutral-900'}`}>Control Ambiental</h1>
            <p className={`font-medium text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Monitoreo de condiciones del invernadero
            </p>
          </div>
          <div className="flex items-center gap-2">
            {ultimaLectura && (
              <span className={`text-xs px-3 py-1 rounded-full ${darkMode ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-100'}`}>
                Última: {new Date(ultimaLectura.fecha).toLocaleString('es-ES')}
              </span>
            )}
          </div>
        </div>

        {/* Alertas activas */}
        {alertasAmbiente.length > 0 && (
          <Card className={`p-4 border-l-4 border-l-amber-500 ${darkMode ? 'bg-amber-900/20 border-amber-700' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-500 flex-shrink-0" size={24} />
              <div>
                <h3 className={`font-bold ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>Condiciones fuera de rango</h3>
                <ul className="mt-1 space-y-1">
                  {alertasAmbiente.map((a, i) => (
                    <li key={i} className={`text-sm ${a.color}`}>• {a.mensaje}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}

        {/* Tarjetas de condiciones actuales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(rangosOptimos).map(([tipo, config]) => {
            const valor = ultimaLectura?.[tipo];
            const estado = evaluarRango(valor, tipo);
            const IconMap = { temperatura: Sun, humedad: Sprout, co2: Leaf, luz: Zap };
            const Icon = IconMap[tipo] || Sun;
            
            return (
              <Card key={tipo} className={`p-4 border-2 ${bgEstado[estado]} ${darkMode && estado === 'unknown' ? 'bg-neutral-800 border-neutral-700' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${colorEstado[estado]} text-white`}>
                    <Icon size={20} />
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    estado === 'optimo' ? 'bg-green-100 text-green-700' :
                    estado === 'alto' ? 'bg-red-100 text-red-700' :
                    estado === 'bajo' ? 'bg-blue-100 text-blue-700' :
                    'bg-neutral-100 text-neutral-500'
                  }`}>
                    {estado === 'optimo' ? '✓ Óptimo' : estado === 'alto' ? '↑ Alto' : estado === 'bajo' ? '↓ Bajo' : '—'}
                  </span>
                </div>
                <p className={`text-3xl font-black ${darkMode ? 'text-white' : 'text-neutral-900'}`}>
                  {valor !== undefined && valor !== null ? valor : '—'}
                  <span className="text-lg font-normal text-neutral-400">{config.unidad}</span>
                </p>
                <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>{config.label}</p>
                <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'} mt-1`}>
                  Rango: {config.min}–{config.max} {config.unidad}
                </p>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gráfico */}
          <Card className={`p-5 lg:col-span-2 ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
            <h3 className={`font-bold mb-4 ${darkMode ? 'text-white' : ''}`}>📊 Histórico (últimas lecturas)</h3>
            {datosGrafico.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={datosGrafico}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="hora" tick={{ fontSize: 11 }} stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                  <YAxis yAxisId="temp" orientation="left" domain={[15, 30]} tick={{ fontSize: 11 }} stroke="#f97316" />
                  <YAxis yAxisId="hum" orientation="right" domain={[40, 80]} tick={{ fontSize: 11 }} stroke="#3b82f6" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: darkMode ? '#1f2937' : '#fff',
                      border: darkMode ? '1px solid #374151' : '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Area yAxisId="temp" type="monotone" dataKey="temperatura" stroke="#f97316" fill="#fed7aa" name="Temp °C" />
                  <Area yAxisId="hum" type="monotone" dataKey="humedad" stroke="#3b82f6" fill="#bfdbfe" name="Humedad %" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className={darkMode ? 'text-neutral-400' : 'text-neutral-500'}>Sin datos históricos</p>
              </div>
            )}
          </Card>

          {/* Formulario nueva lectura */}
          <Card className={`p-5 ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
            <h3 className={`font-bold mb-4 ${darkMode ? 'text-white' : ''}`}>➕ Nueva Lectura</h3>
            <div className="space-y-3">
              <div>
                <label className={`text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>Temperatura (°C)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={formCondicion.temperatura} 
                  onChange={e => setFormCondicion({...formCondicion, temperatura: parseFloat(e.target.value)})}
                  className={`w-full mt-1 px-3 py-2 rounded-lg border ${darkMode ? 'bg-neutral-700 border-neutral-600 text-white' : ''}`}
                />
              </div>
              <div>
                <label className={`text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>Humedad (%)</label>
                <input 
                  type="number" 
                  value={formCondicion.humedad} 
                  onChange={e => setFormCondicion({...formCondicion, humedad: parseInt(e.target.value)})}
                  className={`w-full mt-1 px-3 py-2 rounded-lg border ${darkMode ? 'bg-neutral-700 border-neutral-600 text-white' : ''}`}
                />
              </div>
              <div>
                <label className={`text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>CO₂ (ppm)</label>
                <input 
                  type="number" 
                  value={formCondicion.co2} 
                  onChange={e => setFormCondicion({...formCondicion, co2: parseInt(e.target.value)})}
                  className={`w-full mt-1 px-3 py-2 rounded-lg border ${darkMode ? 'bg-neutral-700 border-neutral-600 text-white' : ''}`}
                />
              </div>
              <div>
                <label className={`text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>Luz (lux)</label>
                <input 
                  type="number" 
                  value={formCondicion.luz} 
                  onChange={e => setFormCondicion({...formCondicion, luz: parseInt(e.target.value)})}
                  className={`w-full mt-1 px-3 py-2 rounded-lg border ${darkMode ? 'bg-neutral-700 border-neutral-600 text-white' : ''}`}
                />
              </div>
              <div>
                <label className={`text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>Notas</label>
                <input 
                  type="text" 
                  value={formCondicion.notas} 
                  onChange={e => setFormCondicion({...formCondicion, notas: e.target.value})}
                  placeholder="Observaciones..."
                  className={`w-full mt-1 px-3 py-2 rounded-lg border ${darkMode ? 'bg-neutral-700 border-neutral-600 text-white' : ''}`}
                />
              </div>
              <Button className="w-full" onClick={guardarLectura}>
                <Plus size={18} /> Guardar Lectura
              </Button>
            </div>
          </Card>
        </div>

        {/* Historial de lecturas */}
        <Card className={`overflow-hidden ${darkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
          <div className={`p-4 border-b ${darkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
            <h3 className={`font-bold ${darkMode ? 'text-white' : ''}`}>📋 Historial de Lecturas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-neutral-900 text-white">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-bold">Fecha</th>
                  <th className="text-center px-4 py-3 text-sm font-bold">🌡️ Temp</th>
                  <th className="text-center px-4 py-3 text-sm font-bold">💧 Humedad</th>
                  <th className="text-center px-4 py-3 text-sm font-bold">🌿 CO₂</th>
                  <th className="text-center px-4 py-3 text-sm font-bold">💡 Luz</th>
                  <th className="text-left px-4 py-3 text-sm font-bold">Notas</th>
                </tr>
              </thead>
              <tbody>
                {condiciones.slice(0, 20).map(c => (
                  <tr key={c.id} className={`border-b ${darkMode ? 'border-neutral-700 hover:bg-neutral-700' : 'border-neutral-100 hover:bg-neutral-50'}`}>
                    <td className={`px-4 py-3 text-sm ${darkMode ? 'text-neutral-200' : ''}`}>
                      {new Date(c.fecha).toLocaleString('es-ES')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-sm font-bold ${
                        evaluarRango(c.temperatura, 'temperatura') === 'optimo' ? 'bg-green-100 text-green-700' :
                        evaluarRango(c.temperatura, 'temperatura') === 'alto' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {c.temperatura}°C
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-sm font-bold ${
                        evaluarRango(c.humedad, 'humedad') === 'optimo' ? 'bg-green-100 text-green-700' :
                        evaluarRango(c.humedad, 'humedad') === 'alto' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {c.humedad}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-sm ${darkMode ? 'text-neutral-200' : ''}`}>{c.co2} ppm</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-sm ${darkMode ? 'text-neutral-200' : ''}`}>{c.luz} lux</span>
                    </td>
                    <td className={`px-4 py-3 text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      {c.notas || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {condiciones.length === 0 && (
            <div className="p-8 text-center">
              <Sun size={48} className="mx-auto text-neutral-300 mb-4" />
              <p className={darkMode ? 'text-neutral-400' : 'text-neutral-500'}>Sin lecturas registradas</p>
            </div>
          )}
        </Card>
      </div>
    );
  };

  // ==================== AJUSTES ====================
  const renderAjustes = () => {
    const notificacionesConfig = [
      { key: 'stock_bajo', label: 'Stock bajo', descripcion: 'Cuando un producto tiene stock bajo' },
      { key: 'stock_agotado', label: 'Stock agotado', descripcion: 'Cuando un producto se agota' },
      { key: 'pedidos_atrasados', label: 'Pedidos atrasados', descripcion: 'Pedidos no entregados a tiempo' },
      { key: 'pedidos_hoy', label: 'Pedidos del día', descripcion: 'Resumen de pedidos para hoy' },
      { key: 'facturas_vencidas', label: 'Facturas vencidas', descripcion: 'Facturas pasadas de fecha' },
      { key: 'facturas_por_vencer', label: 'Facturas por vencer', descripcion: 'Facturas próximas a vencer' },
      { key: 'lotes_cosechar', label: 'Lotes para cosechar', descripcion: 'Lotes listos para cosecha' },
      { key: 'tareas_vencidas', label: 'Tareas vencidas', descripcion: 'Tareas pasadas de fecha límite' },
      { key: 'ambiente_alerta', label: 'Alertas ambientales', descripcion: 'Condiciones fuera de rango' },
      { key: 'recordatorio_iva', label: 'Recordatorio IVA', descripcion: 'Aviso de presentación trimestral' },
      { key: 'recordatorio_asesoria', label: 'Recordatorio asesoría', descripcion: 'Aviso de envío mensual' },
    ];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-neutral-900">Ajustes</h1>
            <p className="text-neutral-500 font-medium">Configuración del ERP</p>
          </div>
        </div>

        {/* Configuración de Notificaciones por Email */}
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange-100 rounded-xl">
              <Bell size={24} className="text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-900">Notificaciones por Email</h3>
              <p className="text-sm text-neutral-500">Selecciona qué alertas quieres recibir en tu correo</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {notificacionesConfig.map(notif => (
              <div 
                key={notif.key}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  configNotificaciones[notif.key] 
                    ? 'border-orange-500 bg-orange-50' 
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}
                onClick={() => updateConfigNotificaciones(notif.key, !configNotificaciones[notif.key])}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${
                      configNotificaciones[notif.key] ? 'bg-orange-500' : 'border-2 border-neutral-300'
                    }`}>
                      {configNotificaciones[notif.key] && <Check size={14} className="text-white" />}
                    </div>
                    <div>
                      <p className="font-semibold text-neutral-900">{notif.label}</p>
                      <p className="text-xs text-neutral-500">{notif.descripcion}</p>
                    </div>
                  </div>
                  <Mail size={18} className={configNotificaciones[notif.key] ? 'text-orange-500' : 'text-neutral-300'} />
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-sm text-blue-700">
              <strong>📧 Email configurado:</strong> {user?.email || 'No disponible'}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Las notificaciones se enviarán a este correo cuando las alertas se activen.
            </p>
          </div>
        </Card>

        {/* Socios */}
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Users size={24} className="text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-900">Equipo</h3>
              <p className="text-sm text-neutral-500">Socios y empleados del sistema</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SOCIOS.map(socio => (
              <div key={socio.id} className="p-4 rounded-xl bg-neutral-50 border">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${socio.color}`}>
                    <User size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900">{socio.nombre}</p>
                    <p className="text-xs text-neutral-500 capitalize">{socio.id}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-neutral-500 mt-3">
            Para añadir más socios, edita la constante SOCIOS en el código fuente.
          </p>
        </Card>

        {/* Empresa */}
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Building2 size={24} className="text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-900">Datos de Empresa</h3>
              <p className="text-sm text-neutral-500">Información que aparece en facturas y etiquetas</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div><span className="text-sm text-neutral-500">Nombre:</span><p className="font-semibold">{EMPRESA.nombre}</p></div>
            <div><span className="text-sm text-neutral-500">CIF:</span><p className="font-semibold">{EMPRESA.cif}</p></div>
            <div><span className="text-sm text-neutral-500">Dirección:</span><p className="font-semibold">{EMPRESA.direccion}</p></div>
            <div><span className="text-sm text-neutral-500">Ciudad:</span><p className="font-semibold">{EMPRESA.cp} {EMPRESA.ciudad}</p></div>
            <div><span className="text-sm text-neutral-500">Teléfono:</span><p className="font-semibold">{EMPRESA.telefono}</p></div>
            <div><span className="text-sm text-neutral-500">Email:</span><p className="font-semibold">{EMPRESA.email}</p></div>
          </div>
        </Card>

        {/* VeriFactu - Info */}
        <Card className="p-5 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-100 rounded-xl">
              <FileText size={24} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-900">VeriFactu</h3>
              <p className="text-sm text-amber-700">Sistema de verificación de facturas del gobierno</p>
            </div>
          </div>
          
          <div className="space-y-2 text-sm text-amber-800">
            <p>⚠️ <strong>Pendiente de implementación</strong></p>
            <p>La integración con VeriFactu requiere:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Certificado digital de la empresa</li>
              <li>Alta en el sistema de la AEAT</li>
              <li>API de terceros homologada</li>
            </ul>
            <p className="mt-3">Contacta con tu asesor para más información sobre los requisitos.</p>
          </div>
        </Card>

        {/* PANEL DE USUARIO */}
        <Card className="p-5 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <User size={24} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-900">Mi Perfil</h3>
              <p className="text-sm text-blue-700">Tu información de usuario</p>
            </div>
          </div>
          
          {currentUser ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-200 flex items-center justify-center">
                  {currentUserProfile?.avatar_url ? (
                    <img src={currentUserProfile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <User size={32} className="text-blue-600" />
                  )}
                </div>
                <div>
                  <p className="text-xl font-bold text-blue-900">{currentUserProfile?.nombre || 'Usuario'}</p>
                  <p className="text-sm text-blue-600">{currentUser.email}</p>
                  <Badge className="bg-blue-100 text-blue-700 mt-1">{currentUserProfile?.rol || 'usuario'}</Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="p-3 bg-white rounded-lg">
                  <p className="text-xs text-neutral-500">Último acceso</p>
                  <p className="font-semibold">{currentUserProfile?.last_login ? formatDate(currentUserProfile.last_login) : 'Ahora'}</p>
                </div>
                <div className="p-3 bg-white rounded-lg">
                  <p className="text-xs text-neutral-500">Miembro desde</p>
                  <p className="font-semibold">{currentUserProfile?.created_at ? formatDate(currentUserProfile.created_at) : '-'}</p>
                </div>
              </div>
              
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-semibold text-blue-800 mb-2">Editar nombre:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    defaultValue={currentUserProfile?.nombre}
                    className="flex-1 px-3 py-2 border rounded-lg"
                    id="edit-nombre-input"
                  />
                  <Button size="sm" onClick={() => {
                    const nuevoNombre = document.getElementById('edit-nombre-input').value;
                    if (nuevoNombre) actualizarPerfil({ nombre: nuevoNombre });
                  }}>
                    Guardar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-blue-700">No has iniciado sesión</p>
              <p className="text-sm text-blue-600 mt-1">Inicia sesión para ver tu perfil</p>
            </div>
          )}
        </Card>

        {/* USUARIOS REGISTRADOS */}
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <Users size={24} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-900">Usuarios del Sistema</h3>
              <p className="text-sm text-neutral-500">{userProfiles.length} usuarios registrados</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {userProfiles.length > 0 ? userProfiles.map(profile => (
              <div key={profile.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <User size={18} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold">{profile.nombre || 'Sin nombre'}</p>
                    <p className="text-xs text-neutral-500">{profile.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={profile.rol === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-neutral-100 text-neutral-600'}>
                    {profile.rol || 'usuario'}
                  </Badge>
                  <p className="text-xs text-neutral-400 mt-1">
                    {profile.last_login ? `Último: ${formatDate(profile.last_login)}` : 'Sin actividad'}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-center text-neutral-500 py-4">No hay usuarios registrados</p>
            )}
          </div>
        </Card>

        {/* HISTORIAL DE AUDITORÍA */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Clock size={24} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Historial de Cambios</h3>
                <p className="text-sm text-neutral-500">Trazabilidad de acciones en el sistema</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={refetchAuditLog}>
              <RefreshCw size={14} /> Actualizar
            </Button>
          </div>
          
          <div className="overflow-x-auto max-h-96">
            {auditLog.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-neutral-100 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Fecha/Hora</th>
                    <th className="text-left px-3 py-2 font-semibold">Usuario</th>
                    <th className="text-left px-3 py-2 font-semibold">Acción</th>
                    <th className="text-left px-3 py-2 font-semibold">Tabla</th>
                    <th className="text-left px-3 py-2 font-semibold">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50).map(log => (
                    <tr key={log.id} className="border-b hover:bg-neutral-50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <p className="font-mono text-xs">{new Date(log.created_at).toLocaleDateString('es-ES')}</p>
                        <p className="font-mono text-xs text-neutral-400">{new Date(log.created_at).toLocaleTimeString('es-ES')}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-semibold">{log.user_nombre || 'Sistema'}</p>
                        <p className="text-xs text-neutral-400">{log.user_email}</p>
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={
                          log.accion === 'CREAR' ? 'bg-green-100 text-green-700' :
                          log.accion === 'ACTUALIZAR' ? 'bg-blue-100 text-blue-700' :
                          log.accion === 'ELIMINAR' ? 'bg-red-100 text-red-700' :
                          'bg-neutral-100 text-neutral-700'
                        }>
                          {log.accion}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-1 bg-neutral-100 rounded text-xs font-mono">{log.tabla}</span>
                      </td>
                      <td className="px-3 py-2 text-neutral-600 max-w-xs truncate">
                        {log.descripcion || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-neutral-500">
                <Clock size={48} className="mx-auto mb-3 text-neutral-300" />
                <p>No hay registros de auditoría</p>
                <p className="text-xs mt-1">Las acciones se registrarán automáticamente</p>
              </div>
            )}
          </div>
          
          {auditLog.length > 50 && (
            <p className="text-xs text-neutral-500 mt-3 text-center">
              Mostrando las últimas 50 acciones de {auditLog.length} totales
            </p>
          )}
        </Card>
      </div>
    );
  };

  // ==================== CONTABILIDAD ====================
  const renderContabilidad = () => {
    const year = new Date().getFullYear();
    const trimestres = [
      { num: 1, meses: [0, 1, 2], label: 'T1 (Ene-Mar)' },
      { num: 2, meses: [3, 4, 5], label: 'T2 (Abr-Jun)' },
      { num: 3, meses: [6, 7, 8], label: 'T3 (Jul-Sep)' },
      { num: 4, meses: [9, 10, 11], label: 'T4 (Oct-Dic)' },
    ];

    const datosTrimestre = trimestres.map(t => {
      const facturasT = facturas.filter(f => {
        const fecha = new Date(f.fecha);
        return fecha.getFullYear() === year && t.meses.includes(fecha.getMonth());
      });
      const gastosT = gastos.filter(g => {
        const fecha = new Date(g.fecha);
        return fecha.getFullYear() === year && t.meses.includes(fecha.getMonth());
      });

      const ivaRepercutido = facturasT.reduce((sum, f) => sum + (f.iva || 0) + (f.re_importe || 0), 0);
      // Calcular IVA soportado usando el tipo real de cada gasto
      const ivaSoportado = gastosT.reduce((sum, g) => {
        const ivaPct = TIPOS_IVA[g.iva_tipo || 'general']?.valor || 21;
        const base = (g.importe || 0) / (1 + ivaPct/100);
        return sum + ((g.importe || 0) - base);
      }, 0);
      const resultado = ivaRepercutido - ivaSoportado;

      return {
        ...t,
        facturas: facturasT.length,
        gastos: gastosT.length,
        ivaRepercutido,
        ivaSoportado,
        resultado,
        baseImponible: facturasT.reduce((sum, f) => sum + (f.base_imponible || 0), 0),
        totalGastos: gastosT.reduce((sum, g) => sum + (g.importe || 0), 0),
      };
    });

    const totalAnual = {
      ingresos: facturas.filter(f => new Date(f.fecha).getFullYear() === year).reduce((sum, f) => sum + (f.total || 0), 0),
      gastos: gastos.filter(g => new Date(g.fecha).getFullYear() === year).reduce((sum, g) => sum + (g.importe || 0), 0),
      ivaRepercutido: datosTrimestre.reduce((sum, t) => sum + t.ivaRepercutido, 0),
      ivaSoportado: datosTrimestre.reduce((sum, t) => sum + t.ivaSoportado, 0),
    };

    // Flujo de caja por mes
    const meses = [...Array(12)].map((_, i) => {
      const facturasM = facturas.filter(f => {
        const fecha = new Date(f.fecha);
        return fecha.getFullYear() === year && fecha.getMonth() === i;
      });
      const gastosM = gastos.filter(g => {
        const fecha = new Date(g.fecha);
        return fecha.getFullYear() === year && fecha.getMonth() === i;
      });
      return {
        mes: new Date(year, i).toLocaleDateString('es-ES', { month: 'short' }),
        ingresos: facturasM.filter(f => f.estado === 'pagada').reduce((sum, f) => sum + (f.total || 0), 0),
        gastos: gastosM.filter(g => g.pagado).reduce((sum, g) => sum + (g.importe || 0), 0),
      };
    });

    // Filtrar datos por periodo seleccionado
    const filtrarPorPeriodoExport = (data, campoFecha) => {
      const hoy = new Date();
      return data.filter(item => {
        const fecha = new Date(item[campoFecha]);
        if (exportPeriodo === 'mes_actual') {
          return fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear();
        } else if (exportPeriodo === 'trimestre_actual') {
          const trimestreActual = Math.floor(hoy.getMonth() / 3);
          const trimestreFecha = Math.floor(fecha.getMonth() / 3);
          return trimestreFecha === trimestreActual && fecha.getFullYear() === hoy.getFullYear();
        } else if (exportPeriodo === 'año_actual') {
          return fecha.getFullYear() === hoy.getFullYear();
        } else if (exportPeriodo === 'personalizado') {
          const inicio = new Date(exportFechaInicio);
          const fin = new Date(exportFechaFin);
          fin.setHours(23, 59, 59);
          return fecha >= inicio && fecha <= fin;
        }
        return true;
      });
    };

    // Exportar para asesoría contable
    const exportarParaAsesoria = (tipo) => {
      const facturasFiltradas = filtrarPorPeriodoExport(facturas, 'fecha');
      const gastosFiltrados = filtrarPorPeriodoExport(gastos, 'fecha');
      
      const periodoLabel = exportPeriodo === 'personalizado' 
        ? `${exportFechaInicio}_${exportFechaFin}`
        : exportPeriodo;
      
      if (tipo === 'facturas_emitidas') {
        const columns = [
          { header: 'Nº Factura', accessor: f => f.id },
          { header: 'Fecha', accessor: f => formatDate(f.fecha) },
          { header: 'Cliente', accessor: f => clientes.find(c => c.id === f.cliente_id)?.nombre || '' },
          { header: 'CIF Cliente', accessor: f => clientes.find(c => c.id === f.cliente_id)?.cif || '' },
          { header: 'Base Imponible', accessor: f => f.base_imponible?.toFixed(2) || f.subtotal?.toFixed(2) || '0.00' },
          { header: 'Tipo IVA', accessor: f => `${f.iva_porcentaje || 4}%` },
          { header: 'IVA', accessor: f => f.iva?.toFixed(2) || '0.00' },
          { header: 'R.E.', accessor: f => f.recargo_equivalencia ? (f.re_importe?.toFixed(2) || '0.00') : '0.00' },
          { header: 'Total', accessor: f => f.total?.toFixed(2) || '0.00' },
          { header: 'Estado', accessor: f => estadoFacturaConfig[f.estado]?.label || f.estado },
          { header: 'Fecha Cobro', accessor: f => f.estado === 'pagada' ? formatDate(f.updated_at) : '' },
        ];
        exportToExcel(facturasFiltradas, `facturas_emitidas_${periodoLabel}`, columns);
      } else if (tipo === 'facturas_recibidas') {
        const columns = [
          { header: 'Fecha', accessor: g => formatDate(g.fecha) },
          { header: 'Proveedor', accessor: g => proveedores.find(p => p.id === g.proveedor_id)?.nombre || '' },
          { header: 'CIF Proveedor', accessor: g => proveedores.find(p => p.id === g.proveedor_id)?.cif || '' },
          { header: 'Concepto', accessor: g => g.concepto },
          { header: 'Categoría', accessor: g => categoriasGasto[g.categoria]?.label || g.categoria },
          { header: 'Tipo IVA', accessor: g => `${TIPOS_IVA[g.iva_tipo || 'general']?.valor || 21}%` },
          { header: 'Base Imponible', accessor: g => {
            const ivaPct = TIPOS_IVA[g.iva_tipo || 'general']?.valor || 21;
            return (g.importe / (1 + ivaPct/100)).toFixed(2);
          }},
          { header: 'IVA', accessor: g => {
            const ivaPct = TIPOS_IVA[g.iva_tipo || 'general']?.valor || 21;
            const base = g.importe / (1 + ivaPct/100);
            return (g.importe - base).toFixed(2);
          }},
          { header: 'Total', accessor: g => g.importe?.toFixed(2) || '0.00' },
          { header: 'Estado', accessor: g => g.pagado ? 'Pagado' : 'Pendiente' },
          { header: 'URL Factura', accessor: g => g.factura_url || '' },
        ];
        exportToExcel(gastosFiltrados, `facturas_recibidas_${periodoLabel}`, columns);
      } else if (tipo === 'registro_contable') {
        const registros = [
          ...facturasFiltradas.map(f => ({
            fecha: f.fecha,
            tipo: 'INGRESO',
            documento: f.id,
            tercero: clientes.find(c => c.id === f.cliente_id)?.nombre || '',
            cif: clientes.find(c => c.id === f.cliente_id)?.cif || '',
            concepto: `Factura ${f.id}`,
            base: f.base_imponible || f.subtotal || 0,
            iva_pct: f.iva_porcentaje || 4,
            iva: f.iva || 0,
            re: f.re_importe || 0,
            total: f.total || 0,
          })),
          ...gastosFiltrados.map(g => {
            const ivaPct = TIPOS_IVA[g.iva_tipo || 'general']?.valor || 21;
            const base = g.importe / (1 + ivaPct/100);
            return {
              fecha: g.fecha,
              tipo: 'GASTO',
              documento: g.id,
              tercero: proveedores.find(p => p.id === g.proveedor_id)?.nombre || '',
              cif: proveedores.find(p => p.id === g.proveedor_id)?.cif || '',
              concepto: g.concepto,
              base: base,
              iva_pct: ivaPct,
              iva: g.importe - base,
              re: 0,
              total: g.importe || 0,
            };
          }),
        ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        
        const columns = [
          { header: 'Fecha', accessor: r => formatDate(r.fecha) },
          { header: 'Tipo', accessor: r => r.tipo },
          { header: 'Nº Doc', accessor: r => r.documento },
          { header: 'Tercero', accessor: r => r.tercero },
          { header: 'CIF/NIF', accessor: r => r.cif },
          { header: 'Concepto', accessor: r => r.concepto },
          { header: 'Base Imponible', accessor: r => r.base?.toFixed(2) },
          { header: 'Tipo IVA', accessor: r => `${r.iva_pct}%` },
          { header: 'IVA', accessor: r => r.iva?.toFixed(2) },
          { header: 'R.E.', accessor: r => r.re?.toFixed(2) },
          { header: 'Total', accessor: r => r.total?.toFixed(2) },
        ];
        exportToExcel(registros, `registro_contable_${periodoLabel}`, columns);
      } else if (tipo === 'paquete_completo') {
        // Exportar todo: facturas emitidas, recibidas y registro
        exportarParaAsesoria('facturas_emitidas');
        setTimeout(() => exportarParaAsesoria('facturas_recibidas'), 500);
        setTimeout(() => exportarParaAsesoria('registro_contable'), 1000);
        
        // Crear lista de URLs de facturas adjuntas para descargar manualmente
        const facturasConArchivo = gastosFiltrados.filter(g => g.factura_url);
        if (facturasConArchivo.length > 0) {
          const listaUrls = facturasConArchivo.map(g => ({
            fecha: formatDate(g.fecha),
            concepto: g.concepto,
            url: g.factura_url,
          }));
          const columns = [
            { header: 'Fecha', accessor: r => r.fecha },
            { header: 'Concepto', accessor: r => r.concepto },
            { header: 'URL Archivo', accessor: r => r.url },
          ];
          setTimeout(() => exportToExcel(listaUrls, `archivos_facturas_${periodoLabel}`, columns), 1500);
        }
      }
    };

    // Alertas de asesoría contable
    const alertasAsesoria = [];
    const hoy = new Date();
    const diaDelMes = hoy.getDate();
    const mes = hoy.getMonth();
    
    // Recordatorio IVA trimestral (días 1-20 de Abril, Julio, Octubre, Enero)
    const mesesIVA = [0, 3, 6, 9]; // Enero, Abril, Julio, Octubre
    if (mesesIVA.includes(mes) && diaDelMes <= 20) {
      const trimestre = mes === 0 ? 'T4' : `T${Math.floor((mes) / 3)}`;
      alertasAsesoria.push({
        tipo: 'iva',
        mensaje: `📋 Presentar modelo 303 (IVA ${trimestre}) antes del día 20`,
        urgente: diaDelMes >= 15,
      });
    }
    
    // Recordatorio envío mensual a asesoría (primeros 5 días del mes)
    if (diaDelMes <= 5) {
      const mesAnterior = new Date(year, mes - 1).toLocaleDateString('es-ES', { month: 'long' });
      alertasAsesoria.push({
        tipo: 'asesoria',
        mensaje: `📧 Enviar documentación de ${mesAnterior} a la asesoría`,
        urgente: diaDelMes >= 3,
      });
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-neutral-900">Contabilidad</h1>
            <p className="text-neutral-500 font-medium">Resumen fiscal y flujo de caja - Año {year}</p>
          </div>
          <Button variant="secondary" onClick={() => setActiveSection('ajustes')}>
            <Settings size={16} /> Ajustes
          </Button>
        </div>

        {/* Alertas de asesoría */}
        {alertasAsesoria.length > 0 && (
          <div className="space-y-2">
            {alertasAsesoria.map((alerta, idx) => (
              <Card key={idx} className={`p-4 ${alerta.urgente ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${alerta.urgente ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                      {alerta.tipo === 'iva' ? <Euro size={20} /> : <Mail size={20} />}
                    </div>
                    <div>
                      <p className={`font-semibold ${alerta.urgente ? 'text-red-700' : 'text-amber-700'}`}>{alerta.mensaje}</p>
                      {alerta.urgente && <p className="text-xs text-red-600 font-medium">⚠️ Urgente - Fecha límite próxima</p>}
                    </div>
                  </div>
                  {alerta.tipo === 'asesoria' && (
                    <Button size="sm" onClick={() => exportarParaAsesoria('paquete_completo')}>
                      <Download size={14} /> Preparar envío
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Euro} label="Ingresos Año" value={formatCurrency(totalAnual.ingresos)} color="bg-green-100 text-green-600" />
          <StatCard icon={Wallet} label="Gastos Año" value={formatCurrency(totalAnual.gastos)} color="bg-red-100 text-red-600" />
          <StatCard icon={TrendingUp} label="IVA Repercutido" value={formatCurrency(totalAnual.ivaRepercutido)} color="bg-blue-100 text-blue-600" />
          <StatCard icon={TrendingDown} label="IVA Soportado" value={formatCurrency(totalAnual.ivaSoportado)} color="bg-amber-100 text-amber-600" />
        </div>

        {/* Exportar para asesoría con selector de fechas */}
        <Card className="p-5">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">📤 Exportar para Asesoría Contable</h3>
          <div className="flex flex-wrap items-end gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Periodo</label>
              <select 
                value={exportPeriodo} 
                onChange={e => setExportPeriodo(e.target.value)}
                className="px-3 py-2 rounded-xl border font-medium text-sm min-w-[180px]"
              >
                <option value="mes_actual">Este mes</option>
                <option value="trimestre_actual">Este trimestre</option>
                <option value="año_actual">Este año</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>
            {exportPeriodo === 'personalizado' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Desde</label>
                  <input 
                    type="date" 
                    value={exportFechaInicio} 
                    onChange={e => setExportFechaInicio(e.target.value)}
                    className="px-3 py-2 rounded-xl border font-medium text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Hasta</label>
                  <input 
                    type="date" 
                    value={exportFechaFin} 
                    onChange={e => setExportFechaFin(e.target.value)}
                    className="px-3 py-2 rounded-xl border font-medium text-sm"
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => exportarParaAsesoria('facturas_emitidas')}>
              <Download size={14} /> Facturas Emitidas
            </Button>
            <Button variant="secondary" size="sm" onClick={() => exportarParaAsesoria('facturas_recibidas')}>
              <Download size={14} /> Facturas Recibidas (Gastos)
            </Button>
            <Button variant="secondary" size="sm" onClick={() => exportarParaAsesoria('registro_contable')}>
              <Download size={14} /> Registro Contable
            </Button>
            <Button onClick={() => exportarParaAsesoria('paquete_completo')}>
              <Download size={16} /> 📦 Paquete Completo
            </Button>
          </div>
          <p className="text-xs text-neutral-500 mt-3">
            El paquete completo incluye: Facturas emitidas, Facturas recibidas, Registro contable y Lista de archivos adjuntos
          </p>
        </Card>

        {/* INFORMES CONTABLES OFICIALES */}
        <Card className="p-5 bg-purple-50 border-purple-200">
          <h3 className="text-lg font-bold text-purple-900 mb-4">📚 Informes Contables Oficiales (PGC España)</h3>
          <p className="text-sm text-purple-700 mb-4">Documentación para Registro Mercantil y gestiones fiscales</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Button variant="secondary" className="flex-col h-auto py-3" onClick={exportarLibroDiario}>
              <FileText size={20} className="mb-1 text-purple-600" />
              <span className="text-xs font-bold">Libro Diario</span>
            </Button>
            <Button variant="secondary" className="flex-col h-auto py-3" onClick={exportarLibroMayor}>
              <FileText size={20} className="mb-1 text-purple-600" />
              <span className="text-xs font-bold">Libro Mayor</span>
            </Button>
            <Button variant="secondary" className="flex-col h-auto py-3" onClick={exportarSumasYSaldos}>
              <FileText size={20} className="mb-1 text-purple-600" />
              <span className="text-xs font-bold">Sumas y Saldos</span>
            </Button>
            <Button variant="secondary" className="flex-col h-auto py-3" onClick={exportarBalanceSituacion}>
              <FileText size={20} className="mb-1 text-purple-600" />
              <span className="text-xs font-bold">Balance Situación</span>
            </Button>
            <Button variant="secondary" className="flex-col h-auto py-3" onClick={exportarPyG}>
              <FileText size={20} className="mb-1 text-purple-600" />
              <span className="text-xs font-bold">PyG</span>
            </Button>
          </div>
          <div className="mt-4 p-3 bg-white rounded-lg text-xs text-neutral-600">
            <p><strong>📖 Libro Diario:</strong> Registro cronológico de todos los asientos</p>
            <p><strong>📚 Libro Mayor:</strong> Movimientos por cuenta contable</p>
            <p><strong>⚖️ Sumas y Saldos:</strong> Balance de comprobación</p>
            <p><strong>📊 Balance:</strong> Activo, Pasivo y Patrimonio Neto</p>
            <p><strong>💰 PyG:</strong> Cuenta de Pérdidas y Ganancias</p>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">📊 Resumen IVA Trimestral</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-bold">Trimestre</th>
                  <th className="text-right px-4 py-3 text-sm font-bold">Base Imponible</th>
                  <th className="text-right px-4 py-3 text-sm font-bold">IVA Repercutido</th>
                  <th className="text-right px-4 py-3 text-sm font-bold">IVA Soportado</th>
                  <th className="text-right px-4 py-3 text-sm font-bold">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {datosTrimestre.map(t => (
                  <tr key={t.num} className="border-b">
                    <td className="px-4 py-3 font-semibold">{t.label}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(t.baseImponible)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(t.ivaRepercutido)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(t.ivaSoportado)}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      <span className={t.resultado >= 0 ? 'text-red-600' : 'text-green-600'}>
                        {t.resultado >= 0 ? 'A pagar: ' : 'A compensar: '}{formatCurrency(Math.abs(t.resultado))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-neutral-900 text-white">
                <tr>
                  <td className="px-4 py-3 font-bold">TOTAL ANUAL</td>
                  <td className="px-4 py-3 text-right font-bold">{formatCurrency(datosTrimestre.reduce((s, t) => s + t.baseImponible, 0))}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatCurrency(totalAnual.ivaRepercutido)}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatCurrency(totalAnual.ivaSoportado)}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatCurrency(totalAnual.ivaRepercutido - totalAnual.ivaSoportado)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">💰 Flujo de Caja Mensual (Cobros vs Pagos)</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={meses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="ingresos" name="Cobros" fill="#22c55e" />
                <Bar dataKey="gastos" name="Pagos" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>💡 Nota:</strong> El IVA soportado se calcula usando el tipo de IVA registrado en cada gasto. Si no se especifica, se asume 21% general.
          </p>
        </Card>

        {/* CONTABILIDAD PARTIDA DOBLE */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-xl">
                <FileText size={24} className="text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900">📒 Contabilidad por Partida Doble</h3>
                <p className="text-sm text-neutral-500">Libro Diario, Mayor y Plan de Cuentas (PGC)</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={generarAsientosAutomaticos}>
                <Zap size={14} /> Generar desde Facturas/Gastos
              </Button>
              <Button onClick={() => { setEditingAsiento(null); setShowAsientoForm(true); }}>
                <Plus size={16} /> Nuevo Asiento
              </Button>
            </div>
          </div>

          {/* Pestañas */}
          <div className="flex gap-2 mb-4 border-b pb-3">
            <button 
              onClick={() => setVistaContable('diario')}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${vistaContable === 'diario' ? 'bg-purple-600 text-white' : 'bg-neutral-100 hover:bg-neutral-200'}`}
            >
              📖 Libro Diario
            </button>
            <button 
              onClick={() => setVistaContable('mayor')}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${vistaContable === 'mayor' ? 'bg-purple-600 text-white' : 'bg-neutral-100 hover:bg-neutral-200'}`}
            >
              📚 Libro Mayor
            </button>
            <button 
              onClick={() => setVistaContable('cuentas')}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${vistaContable === 'cuentas' ? 'bg-purple-600 text-white' : 'bg-neutral-100 hover:bg-neutral-200'}`}
            >
              📋 Plan de Cuentas
            </button>
          </div>

          {/* Libro Diario */}
          {vistaContable === 'diario' && (
            <div className="space-y-4">
              {/* Barra de selección */}
              {selectedAsientos.length > 0 && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between">
                  <span className="font-semibold text-purple-700">{selectedAsientos.length} asiento(s) seleccionado(s)</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setSelectedAsientos([])}>Deseleccionar</Button>
                    <Button variant="secondary" size="sm" className="text-red-600 hover:bg-red-50" onClick={async () => {
                      if (window.confirm(`¿Eliminar ${selectedAsientos.length} asiento(s)?`)) {
                        for (const id of selectedAsientos) {
                          await supabase.from('asientos_contables').delete().eq('id', id);
                        }
                        refetchAsientos();
                        refetchAsientoLineas();
                        setSelectedAsientos([]);
                      }
                    }}>
                      <Trash2 size={14} /> Eliminar seleccionados
                    </Button>
                  </div>
                </div>
              )}
              
              {asientosDB.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <FileText size={48} className="mx-auto mb-3 text-neutral-300" />
                  <p>No hay asientos contables</p>
                  <p className="text-sm">Los asientos se generan automáticamente al crear pedidos y gastos</p>
                </div>
              ) : (
                <>
                  {/* Checkbox seleccionar todos */}
                  <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded-lg">
                    <input 
                      type="checkbox" 
                      checked={asientosDB.length > 0 && selectedAsientos.length === asientosDB.length}
                      onChange={e => setSelectedAsientos(e.target.checked ? asientosDB.map(a => a.id) : [])}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm font-medium text-neutral-600">Seleccionar todos ({asientosDB.length})</span>
                  </div>
                  
                  {asientosDB.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(asiento => {
                  // Filtrar líneas de este asiento
                  const lineasAsiento = asientoLineasDB.filter(l => l.asiento_id === asiento.id);
                  const totalDebe = lineasAsiento.reduce((sum, l) => sum + (parseFloat(l.debe) || 0), 0);
                  const totalHaber = lineasAsiento.reduce((sum, l) => sum + (parseFloat(l.haber) || 0), 0);
                  const cuadrado = Math.abs(totalDebe - totalHaber) < 0.01;
                  const isSelected = selectedAsientos.includes(asiento.id);
                  
                  return (
                    <div key={asiento.id} className={`border rounded-xl overflow-hidden ${isSelected ? 'ring-2 ring-purple-500' : ''}`}>
                      <div className={`p-3 flex items-center justify-between ${lineasAsiento.length > 0 ? (cuadrado ? 'bg-green-50' : 'bg-red-50') : 'bg-yellow-50'}`}>
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => setSelectedAsientos(e.target.checked ? [...selectedAsientos, asiento.id] : selectedAsientos.filter(id => id !== asiento.id))}
                            className="w-4 h-4 rounded"
                          />
                          <span className="font-mono text-sm bg-white px-2 py-1 rounded">{asiento.numero}</span>
                          <span className="text-sm text-neutral-600">{formatDate(asiento.fecha)}</span>
                          <span className="font-medium">{asiento.concepto}</span>
                          {lineasAsiento.length === 0 && <Badge className="bg-yellow-500 text-white">⚠️ Sin líneas</Badge>}
                          {lineasAsiento.length > 0 && !cuadrado && <Badge className="bg-red-500 text-white">⚠️ Descuadrado</Badge>}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingAsiento({...asiento, lineas: lineasAsiento}); setShowAsientoForm(true); }} className="p-2 hover:bg-white rounded"><Edit2 size={14} /></button>
                          <button onClick={() => eliminarAsiento(asiento.id)} className="p-2 hover:bg-white rounded text-red-500"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="bg-neutral-100">
                          <tr>
                            <th className="text-left px-3 py-2 w-24">Cuenta</th>
                            <th className="text-left px-3 py-2">Concepto</th>
                            <th className="text-right px-3 py-2 w-28">Debe</th>
                            <th className="text-right px-3 py-2 w-28">Haber</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineasAsiento.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="px-3 py-4 text-center text-neutral-400">
                                No hay líneas registradas para este asiento
                              </td>
                            </tr>
                          ) : (
                            lineasAsiento.map((linea, idx) => (
                              <tr key={linea.id || idx} className="border-t">
                                <td className="px-3 py-2 font-mono font-bold text-purple-600">{linea.cuenta}</td>
                                <td className="px-3 py-2">{linea.concepto || PLAN_CUENTAS[linea.cuenta]?.nombre || '-'}</td>
                                <td className="px-3 py-2 text-right font-bold text-green-600">{parseFloat(linea.debe) > 0 ? formatCurrency(parseFloat(linea.debe)) : ''}</td>
                                <td className="px-3 py-2 text-right font-bold text-blue-600">{parseFloat(linea.haber) > 0 ? formatCurrency(parseFloat(linea.haber)) : ''}</td>
                              </tr>
                            ))
                          )}
                          <tr className="bg-neutral-100 font-bold">
                            <td colSpan="2" className="px-3 py-2 text-right">TOTALES:</td>
                            <td className="px-3 py-2 text-right text-green-700">{formatCurrency(totalDebe)}</td>
                            <td className="px-3 py-2 text-right text-blue-700">{formatCurrency(totalHaber)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })}
                </>
              )}
            </div>
          )}

          {/* Libro Mayor */}
          {vistaContable === 'mayor' && (
            <div className="space-y-4">
              {Object.entries(PLAN_CUENTAS).map(([codigo, cuenta]) => {
                // Calcular movimientos de esta cuenta
                const movimientos = asientosContables.flatMap(a => 
                  (a.lineas || []).filter(l => l.cuenta === codigo).map(l => ({ ...l, fecha: a.fecha, asiento: a.numero }))
                );
                if (movimientos.length === 0) return null;
                
                const totalDebe = movimientos.reduce((sum, m) => sum + (m.debe || 0), 0);
                const totalHaber = movimientos.reduce((sum, m) => sum + (m.haber || 0), 0);
                const saldo = cuenta.tipo === 'A' || cuenta.tipo === 'G' ? totalDebe - totalHaber : totalHaber - totalDebe;
                
                return (
                  <div key={codigo} className="border rounded-xl overflow-hidden">
                    <div className="p-3 bg-neutral-100 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-purple-600 font-bold">{codigo}</span>
                        <span className="ml-2 font-medium">{cuenta.nombre}</span>
                        <Badge className="ml-2 text-xs">{cuenta.tipo === 'A' ? 'Activo' : cuenta.tipo === 'P' ? 'Pasivo' : cuenta.tipo === 'G' ? 'Gasto' : 'Ingreso'}</Badge>
                      </div>
                      <span className={`font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        Saldo: {formatCurrency(Math.abs(saldo))} {saldo >= 0 ? 'D' : 'H'}
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th className="text-left px-3 py-2">Fecha</th>
                          <th className="text-left px-3 py-2">Asiento</th>
                          <th className="text-right px-3 py-2">Debe</th>
                          <th className="text-right px-3 py-2">Haber</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movimientos.map((m, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2">{formatDate(m.fecha)}</td>
                            <td className="px-3 py-2 font-mono">{m.asiento}</td>
                            <td className="px-3 py-2 text-right">{m.debe > 0 ? formatCurrency(m.debe) : ''}</td>
                            <td className="px-3 py-2 text-right">{m.haber > 0 ? formatCurrency(m.haber) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }).filter(Boolean)}
            </div>
          )}

          {/* Plan de Cuentas */}
          {vistaContable === 'cuentas' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-100">
                  <tr>
                    <th className="text-left px-3 py-2">Código</th>
                    <th className="text-left px-3 py-2">Nombre</th>
                    <th className="text-center px-3 py-2">Tipo</th>
                    <th className="text-center px-3 py-2">Grupo</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(PLAN_CUENTAS).map(([codigo, cuenta]) => (
                    <tr key={codigo} className="border-t hover:bg-neutral-50">
                      <td className="px-3 py-2 font-mono text-purple-600 font-bold">{codigo}</td>
                      <td className="px-3 py-2">{cuenta.nombre}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge className={
                          cuenta.tipo === 'A' ? 'bg-green-100 text-green-700' :
                          cuenta.tipo === 'P' ? 'bg-blue-100 text-blue-700' :
                          cuenta.tipo === 'G' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }>
                          {cuenta.tipo === 'A' ? 'Activo' : cuenta.tipo === 'P' ? 'Pasivo' : cuenta.tipo === 'G' ? 'Gasto' : 'Ingreso'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center font-mono">{cuenta.grupo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Modal Formulario Asiento */}
        {showAsientoForm && (
          <Modal title={editingAsiento ? 'Editar Asiento' : 'Nuevo Asiento'} onClose={() => setShowAsientoForm(false)} size="max-w-3xl">
            <AsientoForm 
              asiento={editingAsiento} 
              onSave={guardarAsiento} 
              onCancel={() => setShowAsientoForm(false)} 
              planCuentas={PLAN_CUENTAS}
            />
          </Modal>
        )}
      </div>
    );
  };

  // Formulario de Asiento Contable
  const AsientoForm = ({ asiento, onSave, onCancel, planCuentas }) => {
    const [form, setForm] = useState({
      fecha: asiento?.fecha || new Date().toISOString().split('T')[0],
      numero: asiento?.numero || `A${asientosContables.length + 1}`,
      concepto: asiento?.concepto || '',
      referencia: asiento?.referencia || '',
      lineas: asiento?.lineas || [
        { cuenta: '', concepto: '', debe: 0, haber: 0 },
        { cuenta: '', concepto: '', debe: 0, haber: 0 },
      ]
    });

    const addLinea = () => setForm({ ...form, lineas: [...form.lineas, { cuenta: '', concepto: '', debe: 0, haber: 0 }] });
    const removeLinea = (idx) => setForm({ ...form, lineas: form.lineas.filter((_, i) => i !== idx) });
    const updateLinea = (idx, field, value) => {
      const nuevasLineas = [...form.lineas];
      nuevasLineas[idx] = { ...nuevasLineas[idx], [field]: value };
      // Auto-rellenar concepto desde plan de cuentas
      if (field === 'cuenta' && planCuentas[value]) {
        nuevasLineas[idx].concepto = planCuentas[value].nombre;
      }
      setForm({ ...form, lineas: nuevasLineas });
    };

    const totalDebe = form.lineas.reduce((sum, l) => sum + (parseFloat(l.debe) || 0), 0);
    const totalHaber = form.lineas.reduce((sum, l) => sum + (parseFloat(l.haber) || 0), 0);
    const cuadrado = Math.abs(totalDebe - totalHaber) < 0.01;

    const handleSubmit = () => {
      if (!cuadrado) {
        alert('El asiento no está cuadrado. Debe = Haber');
        return;
      }
      if (!form.concepto || form.lineas.some(l => !l.cuenta)) {
        alert('Completa todos los campos requeridos');
        return;
      }
      onSave({
        ...form,
        lineas: form.lineas.map(l => ({ ...l, debe: parseFloat(l.debe) || 0, haber: parseFloat(l.haber) || 0 }))
      });
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Fecha</label>
            <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} className="w-full px-3 py-2 rounded-xl border" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Nº Asiento</label>
            <input type="text" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} className="w-full px-3 py-2 rounded-xl border font-mono" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Referencia</label>
            <input type="text" value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })} placeholder="FAC-001, GAS-002..." className="w-full px-3 py-2 rounded-xl border" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-1">Concepto *</label>
          <input type="text" value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} placeholder="Descripción del asiento" className="w-full px-3 py-2 rounded-xl border" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-neutral-700">Líneas del asiento</label>
            <button type="button" onClick={addLinea} className="text-sm text-orange-600 hover:text-orange-700 font-medium">+ Añadir línea</button>
          </div>
          <div className="space-y-2">
            {form.lineas.map((linea, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select 
                  value={linea.cuenta} 
                  onChange={e => updateLinea(idx, 'cuenta', e.target.value)}
                  className="w-32 px-2 py-2 rounded-lg border text-sm font-mono"
                >
                  <option value="">Cuenta</option>
                  {Object.entries(planCuentas).map(([cod, cta]) => (
                    <option key={cod} value={cod}>{cod} - {cta.nombre.substring(0, 20)}</option>
                  ))}
                </select>
                <input 
                  type="text" 
                  value={linea.concepto} 
                  onChange={e => updateLinea(idx, 'concepto', e.target.value)}
                  placeholder="Concepto"
                  className="flex-1 px-2 py-2 rounded-lg border text-sm"
                />
                <input 
                  type="number" 
                  step="0.01"
                  value={linea.debe || ''} 
                  onChange={e => updateLinea(idx, 'debe', e.target.value)}
                  placeholder="Debe"
                  className="w-24 px-2 py-2 rounded-lg border text-sm text-right"
                />
                <input 
                  type="number" 
                  step="0.01"
                  value={linea.haber || ''} 
                  onChange={e => updateLinea(idx, 'haber', e.target.value)}
                  placeholder="Haber"
                  className="w-24 px-2 py-2 rounded-lg border text-sm text-right"
                />
                {form.lineas.length > 2 && (
                  <button type="button" onClick={() => removeLinea(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded"><X size={16} /></button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={`p-3 rounded-xl flex items-center justify-between ${cuadrado ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex gap-6">
            <span>Total Debe: <strong className="text-green-600">{formatCurrency(totalDebe)}</strong></span>
            <span>Total Haber: <strong className="text-blue-600">{formatCurrency(totalHaber)}</strong></span>
          </div>
          <Badge className={cuadrado ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}>
            {cuadrado ? '✓ Cuadrado' : '✗ Descuadrado'}
          </Badge>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!cuadrado}>
            <Check size={16} /> Guardar Asiento
          </Button>
        </div>
      </div>
    );
  };

  // ==================== MAIN RENDER ====================
  if (loading) return <LoadingScreen />;

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-neutral-900' : 'bg-neutral-100'} flex transition-colors duration-300`}>
      {/* Overlay para móvil cuando sidebar está abierto */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar Negro - oculto en móvil por defecto */}
      <aside className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} 
        ${sidebarOpen ? 'w-64' : 'md:w-20'} 
        w-64 bg-neutral-900 p-4 flex flex-col transition-all duration-300 fixed h-full z-40
      `}>
        <div className="flex items-center gap-3 px-2 mb-8">
          <RootFlowLogo size={40} />
          {sidebarOpen && <div><h1 className="font-black text-lg"><span className="text-white">Root</span><span className="text-orange-500">Flow</span></h1><p className="text-[10px] text-neutral-500 uppercase tracking-wider">ERP Interno</p></div>}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          <NavItem icon={BarChart3} label="Dashboard" section="dashboard" />
          <NavItem icon={Calendar} label="Calendario" section="calendario" />
          <NavItem icon={CheckCircle} label="Tareas" section="tareas" badge={tareasPendientes} />
          <div className="pt-3 mt-3 border-t border-neutral-700">{sidebarOpen && <p className="text-[10px] text-neutral-500 px-4 mb-2 uppercase tracking-wider">Comercial</p>}</div>
          <NavItem icon={Target} label="Leads" section="leads" badge={leadsNuevos} />
          <NavItem icon={Users} label="Clientes" section="clientes" />
          <NavItem icon={ShoppingCart} label="Pedidos" section="pedidos" badge={pedidosPendientes} />
          <NavItem icon={Truck} label="Rutas Reparto" section="rutas" />
          <NavItem icon={Package} label="Productos" section="productos" badge={stockBajo} />
          <div className="pt-3 mt-3 border-t border-neutral-700">{sidebarOpen && <p className="text-[10px] text-neutral-500 px-4 mb-2 uppercase tracking-wider">Finanzas</p>}</div>
          <NavItem icon={Receipt} label="Facturación" section="facturacion" />
          <NavItem icon={Wallet} label="Gastos" section="gastos" />
          <NavItem icon={Building2} label="Proveedores" section="proveedores" />
          <NavItem icon={BarChart3} label="Informes" section="informes" />
          <NavItem icon={Euro} label="Contabilidad" section="contabilidad" />
          <div className="pt-3 mt-3 border-t border-neutral-700">{sidebarOpen && <p className="text-[10px] text-neutral-500 px-4 mb-2 uppercase tracking-wider">Producción</p>}</div>
          <NavItem icon={Sprout} label="Producción" section="produccion" badge={lotesActivos} />
          <NavItem icon={AlertTriangle} label="Mermas" section="mermas" />
          <NavItem icon={History} label="Trazabilidad" section="trazabilidad" />
          <NavItem icon={Sun} label="Ambiente" section="ambiente" />
        </nav>
        <div className="pt-4 border-t border-neutral-700 space-y-1">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden md:flex w-full items-center gap-3 px-4 py-3 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-xl"><Menu size={20} />{sidebarOpen && <span className="text-sm font-medium">Colapsar</span>}</button>
          <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-xl"><LogOut size={20} />{sidebarOpen && <span className="text-sm font-medium">Salir</span>}</button>
        </div>
      </aside>

      {/* Main */}
      <main className={`flex-1 w-full transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
        <header className={`${darkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'} border-b px-4 md:px-8 py-3 md:py-4 sticky top-0 z-30`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Botón hamburguesa solo en móvil */}
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`md:hidden p-2 ${darkMode ? 'text-neutral-300 hover:bg-neutral-700' : 'text-neutral-600 hover:bg-neutral-100'} rounded-xl`}>
                <Menu size={24} />
              </button>
              <h2 className={`text-base md:text-lg font-bold capitalize ${darkMode ? 'text-white' : 'text-neutral-900'}`}>{activeSection}</h2>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              {/* Toggle modo oscuro */}
              <button 
                onClick={toggleDarkMode} 
                className={`p-2 rounded-xl transition-colors ${darkMode ? 'text-amber-400 hover:bg-neutral-700' : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100'}`}
                title={darkMode ? 'Modo claro' : 'Modo oscuro'}
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              
              {/* Botón alertas */}
              <div className="relative">
                <button 
                  onClick={() => setShowAlertasPanel(!showAlertasPanel)}
                  className={`p-2 rounded-xl relative transition-colors ${darkMode ? 'text-neutral-300 hover:bg-neutral-700' : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100'}`}
                >
                  <Bell size={20} />
                  {alertasNoLeidas > 0 && (
                    <span className={`absolute -top-1 -right-1 w-5 h-5 ${alertasCriticas > 0 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'} text-white text-xs rounded-full flex items-center justify-center font-bold`}>
                      {alertasNoLeidas > 9 ? '9+' : alertasNoLeidas}
                    </span>
                  )}
                </button>
                
                {/* Panel de alertas desplegable */}
                {showAlertasPanel && (
                  <>
                    <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowAlertasPanel(false)} />
                    <div className={`fixed md:absolute right-2 md:right-0 top-16 md:top-12 left-2 md:left-auto w-auto md:w-96 max-h-[70vh] ${darkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'} border rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col`}>
                      <div className={`p-4 border-b ${darkMode ? 'border-neutral-700' : 'border-neutral-200'} flex items-center justify-between flex-shrink-0`}>
                        <div className="flex items-center gap-2">
                          <BellRing size={20} className="text-orange-500" />
                          <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-neutral-900'}`}>Alertas</h3>
                          {alertasCriticas > 0 && <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">{alertasCriticas} críticas</span>}
                        </div>
                        <button onClick={() => setShowAlertasPanel(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}>
                          <X size={20} />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {alertas.length === 0 ? (
                          <div className="p-8 text-center">
                            <CheckCircle size={40} className="mx-auto text-green-500 mb-2" />
                            <p className={`font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>¡Todo en orden!</p>
                            <p className={`text-sm ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>No hay alertas pendientes</p>
                          </div>
                        ) : (
                          alertas.map(alerta => (
                            <button
                              key={alerta.id}
                              onClick={() => { alerta.accion(); setShowAlertasPanel(false); }}
                              className={`w-full p-3 flex items-start gap-3 border-b ${darkMode ? 'border-neutral-700 hover:bg-neutral-700' : 'border-neutral-100 hover:bg-neutral-50'} transition-colors text-left`}
                            >
                              <div className={`p-2 rounded-lg ${alerta.color} text-white flex-shrink-0`}>
                                <alerta.icono size={16} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-neutral-900'} ${alerta.prioridad === 'critica' ? 'text-red-500' : ''}`}>
                                  {alerta.titulo}
                                </p>
                                <p className={`text-xs ${darkMode ? 'text-neutral-400' : 'text-neutral-500'} truncate`}>{alerta.mensaje}</p>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                alerta.prioridad === 'critica' ? 'bg-red-100 text-red-700' :
                                alerta.prioridad === 'alta' ? 'bg-amber-100 text-amber-700' :
                                alerta.prioridad === 'media' ? 'bg-blue-100 text-blue-700' :
                                'bg-neutral-100 text-neutral-600'
                              }`}>
                                {alerta.prioridad}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                      {alertas.length > 0 && (
                        <div className={`p-3 border-t ${darkMode ? 'border-neutral-700 bg-neutral-900' : 'border-neutral-200 bg-neutral-50'} flex-shrink-0`}>
                          <p className={`text-xs text-center ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                            Haz clic en una alerta para ir a la sección
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              
              {/* Menú de usuario */}
              <div className="relative">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className={`flex items-center gap-2 px-2 md:px-3 py-2 ${darkMode ? 'bg-neutral-700 hover:bg-neutral-600' : 'bg-neutral-100 hover:bg-neutral-200'} rounded-xl transition-colors`}
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white text-sm font-bold">
                    {currentUserProfile?.nombre?.charAt(0) || userProfile?.nombre?.charAt(0) || 'U'}
                  </div>
                  <span className={`hidden md:inline text-sm font-semibold ${darkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>
                    {currentUserProfile?.nombre?.split(' ')[0] || userProfile?.nombre?.split(' ')[0] || 'Usuario'}
                  </span>
                  <ChevronDown size={16} className={`hidden md:block ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`} />
                </button>
                
                {/* Panel menú usuario desplegable */}
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className={`absolute right-0 top-12 w-64 ${darkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'} border rounded-xl shadow-2xl z-50 overflow-hidden`}>
                      {/* Info usuario */}
                      <div className={`p-4 border-b ${darkMode ? 'border-neutral-700 bg-neutral-900' : 'border-neutral-100 bg-neutral-50'}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center text-white text-lg font-bold">
                            {currentUserProfile?.nombre?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className={`font-bold ${darkMode ? 'text-white' : 'text-neutral-900'}`}>
                              {currentUserProfile?.nombre || 'Usuario'}
                            </p>
                            <p className={`text-xs ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                              {currentUser?.email || 'Sin email'}
                            </p>
                            <Badge className="mt-1 text-xs bg-orange-100 text-orange-700">
                              {currentUserProfile?.rol || 'usuario'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      {/* Opciones del menú */}
                      <div className="py-2">
                        <button
                          onClick={() => { setActiveSection('ajustes'); setShowUserMenu(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 ${darkMode ? 'hover:bg-neutral-700 text-neutral-200' : 'hover:bg-neutral-50 text-neutral-700'} transition-colors`}
                        >
                          <User size={18} className="text-blue-500" />
                          <div className="text-left">
                            <p className="font-semibold text-sm">Mi Perfil</p>
                            <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Ver y editar tu información</p>
                          </div>
                        </button>
                        
                        <button
                          onClick={() => { setActiveSection('ajustes'); setShowUserMenu(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 ${darkMode ? 'hover:bg-neutral-700 text-neutral-200' : 'hover:bg-neutral-50 text-neutral-700'} transition-colors`}
                        >
                          <Settings size={18} className="text-purple-500" />
                          <div className="text-left">
                            <p className="font-semibold text-sm">Ajustes</p>
                            <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Configuración del sistema</p>
                          </div>
                        </button>
                        
                        <button
                          onClick={() => { setActiveSection('ajustes'); setShowUserMenu(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 ${darkMode ? 'hover:bg-neutral-700 text-neutral-200' : 'hover:bg-neutral-50 text-neutral-700'} transition-colors`}
                        >
                          <Clock size={18} className="text-emerald-500" />
                          <div className="text-left">
                            <p className="font-semibold text-sm">Historial de Cambios</p>
                            <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Auditoría y trazabilidad</p>
                          </div>
                        </button>
                        
                        <button
                          onClick={() => { setActiveSection('ajustes'); setShowUserMenu(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 ${darkMode ? 'hover:bg-neutral-700 text-neutral-200' : 'hover:bg-neutral-50 text-neutral-700'} transition-colors`}
                        >
                          <Users size={18} className="text-indigo-500" />
                          <div className="text-left">
                            <p className="font-semibold text-sm">Usuarios</p>
                            <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Ver equipo registrado</p>
                          </div>
                        </button>
                      </div>
                      
                      {/* Cerrar sesión */}
                      <div className={`border-t ${darkMode ? 'border-neutral-700' : 'border-neutral-200'} py-2`}>
                        <button
                          onClick={() => { signOut(); setShowUserMenu(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-red-500 ${darkMode ? 'hover:bg-red-900/30' : 'hover:bg-red-50'} transition-colors`}
                        >
                          <LogOut size={18} />
                          <p className="font-semibold text-sm">Cerrar Sesión</p>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>
        <div className="p-4 md:p-8">
          {activeSection === 'dashboard' && renderDashboard()}
          {activeSection === 'calendario' && renderCalendario()}
          {activeSection === 'tareas' && renderTareas()}
          {activeSection === 'leads' && renderLeads()}
          {activeSection === 'clientes' && renderClientes()}
          {activeSection === 'pedidos' && renderPedidos()}
          {activeSection === 'rutas' && renderRutas()}
          {activeSection === 'productos' && renderProductos()}
          {activeSection === 'facturacion' && renderFacturacion()}
          {activeSection === 'gastos' && renderGastos()}
          {activeSection === 'proveedores' && renderProveedores()}
          {activeSection === 'informes' && renderInformes()}
          {activeSection === 'contabilidad' && renderContabilidad()}
          {activeSection === 'produccion' && renderProduccion()}
          {activeSection === 'mermas' && renderMermas()}
          {activeSection === 'trazabilidad' && renderTrazabilidad()}
          {activeSection === 'ambiente' && renderAmbiente()}
          {activeSection === 'ajustes' && renderAjustes()}
        </div>
      </main>

      {/* Modals */}
      {showModal === 'cliente' && <Modal title={editingItem ? 'Editar Cliente' : 'Nuevo Cliente'} onClose={() => { setShowModal(null); setEditingItem(null); }}><ClienteForm cliente={editingItem} onSave={form => handleSave('clientes', form, editingItem?.id)} onCancel={() => { setShowModal(null); setEditingItem(null); }} /></Modal>}
      {showModal === 'lead' && <Modal title={editingItem ? 'Editar Lead' : 'Nuevo Lead'} onClose={() => { setShowModal(null); setEditingItem(null); }}><LeadForm lead={editingItem} onSave={form => handleSave('leads', form, editingItem?.id)} onCancel={() => { setShowModal(null); setEditingItem(null); }} /></Modal>}
      {showModal === 'producto' && <Modal title={editingItem ? 'Editar Producto' : 'Nuevo Producto'} onClose={() => { setShowModal(null); setEditingItem(null); }}><ProductoForm producto={editingItem} onSave={form => handleSave('productos', form, editingItem?.id)} onCancel={() => { setShowModal(null); setEditingItem(null); }} /></Modal>}
      {showModal === 'pedido' && <Modal title={editingItem ? 'Editar Pedido' : 'Nuevo Pedido'} onClose={() => { setShowModal(null); setEditingItem(null); }} size="max-w-3xl"><PedidoForm pedido={editingItem} onSave={handleCreatePedido} onCancel={() => { setShowModal(null); setEditingItem(null); }} /></Modal>}
      {showModal === 'gasto' && <Modal title={editingItem ? 'Editar Gasto' : 'Nuevo Gasto'} onClose={() => { setShowModal(null); setEditingItem(null); }}><GastoForm gasto={editingItem} onSave={form => handleSave('gastos', form, editingItem?.id)} onCancel={() => { setShowModal(null); setEditingItem(null); }} /></Modal>}
      {showModal === 'lote' && <Modal title={editingItem ? 'Editar Lote' : 'Nuevo Lote'} onClose={() => { setShowModal(null); setEditingItem(null); }}><LoteForm lote={editingItem} onSave={form => handleSave('lotes', form, editingItem?.id)} onCancel={() => { setShowModal(null); setEditingItem(null); }} /></Modal>}
      {showModal === 'proveedor' && <Modal title={editingItem ? 'Editar Proveedor' : 'Nuevo Proveedor'} onClose={() => { setShowModal(null); setEditingItem(null); }}><ProveedorForm proveedor={editingItem} onSave={form => handleSave('proveedores', form, editingItem?.id)} onCancel={() => { setShowModal(null); setEditingItem(null); }} /></Modal>}
      {showModal === 'tarea' && <Modal title={editingItem ? 'Editar Tarea' : 'Nueva Tarea'} onClose={() => { setShowModal(null); setEditingItem(null); }}><TareaForm tarea={editingItem} onSave={form => handleSave('tareas', form, editingItem?.id)} onCancel={() => { setShowModal(null); setEditingItem(null); }} /></Modal>}
      {showModal === 'merma' && <Modal title={editingItem ? 'Editar Merma' : 'Registrar Merma'} onClose={() => { setShowModal(null); setEditingItem(null); }}><MermaForm merma={editingItem} onSave={form => handleSave('mermas', form, editingItem?.id)} onCancel={() => { setShowModal(null); setEditingItem(null); }} /></Modal>}
      {showModal === 'pedido_recurrente' && <Modal title="Nuevo Pedido Recurrente" onClose={() => setShowModal(null)} size="max-w-2xl"><PedidoRecurrenteForm onSave={() => setShowModal(null)} onCancel={() => setShowModal(null)} /></Modal>}
    </div>
  );
};

// ==================== APP WRAPPER ====================
export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}

function AppContent() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <MainApp /> : <LoginPage />;
}
