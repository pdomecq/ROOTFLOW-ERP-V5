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
  Target, UserPlus, Upload, Map, Filter, Download, RefreshCw, Star, TrendingDown
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
  cif: 'B12345678'
};

// ==================== ROOTFLOW LOGO OFICIAL ====================
const RootFlowLogo = ({ size = 40, showERP = true, variant = 'color' }) => (
  <div className="relative">
    <svg width={size} height={size * 1.4} viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
      {/* Fondo verde en forma de cápsula */}
      <rect x="5" y="5" width="90" height="130" rx="45" fill="#1B5E3B"/>
      {/* Planta/Microgreens blanca */}
      <g fill="white">
        {/* Hoja central */}
        <path d="M50 45 L50 95 L48 95 L48 45 Z"/>
        <path d="M50 35 Q50 55, 50 75 Q45 55, 50 35"/>
        {/* Hojas laterales izquierda */}
        <path d="M50 70 Q30 50, 25 65 Q35 55, 50 70"/>
        <path d="M50 85 Q20 70, 15 90 Q30 75, 50 85"/>
        {/* Hojas laterales derecha */}
        <path d="M50 70 Q70 50, 75 65 Q65 55, 50 70"/>
        <path d="M50 85 Q80 70, 85 90 Q70 75, 50 85"/>
        {/* Brotes adicionales */}
        <path d="M50 60 Q35 40, 30 50 Q40 42, 50 60"/>
        <path d="M50 60 Q65 40, 70 50 Q60 42, 50 60"/>
      </g>
    </svg>
    {showERP && <span className="absolute -bottom-1 -right-1 bg-neutral-900 text-white text-[8px] font-black px-1.5 py-0.5 rounded">ERP</span>}
  </div>
);

const RootFlowLogoFull = ({ showERP = true }) => (
  <div className="flex items-center gap-3">
    <RootFlowLogo size={32} showERP={showERP} />
    <div>
      <h1 className="font-black text-lg tracking-tight text-white">RootFlow</h1>
      <p className="text-[9px] text-neutral-400 tracking-wider uppercase">Hydroponics</p>
    </div>
  </div>
);

// Logo para facturas (sin badge ERP)
const RootFlowLogoFactura = () => (
  <svg width="60" height="84" viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="90" height="130" rx="45" fill="#1B5E3B"/>
    <g fill="white">
      <path d="M50 45 L50 95 L48 95 L48 45 Z"/>
      <path d="M50 35 Q50 55, 50 75 Q45 55, 50 35"/>
      <path d="M50 70 Q30 50, 25 65 Q35 55, 50 70"/>
      <path d="M50 85 Q20 70, 15 90 Q30 75, 50 85"/>
      <path d="M50 70 Q70 50, 75 65 Q65 55, 50 70"/>
      <path d="M50 85 Q80 70, 85 90 Q70 75, 50 85"/>
      <path d="M50 60 Q35 40, 30 50 Q40 42, 50 60"/>
      <path d="M50 60 Q65 40, 70 50 Q60 42, 50 60"/>
    </g>
  </svg>
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
  mercamadrid: { label: "Mercamadrid", icon: Building2, color: "text-orange-600 bg-orange-50 border-orange-200" },
  hotel: { label: "Hotel", icon: Building2, color: "text-blue-600 bg-blue-50 border-blue-200" },
  restaurante: { label: "Restaurante", icon: UtensilsCrossed, color: "text-green-600 bg-green-50 border-green-200" },
  catering: { label: "Catering", icon: Truck, color: "text-purple-600 bg-purple-50 border-purple-200" },
  tienda: { label: "Tienda", icon: Package, color: "text-pink-600 bg-pink-50 border-pink-200" },
  otro: { label: "Otro", icon: MoreVertical, color: "text-neutral-600 bg-neutral-50 border-neutral-200" },
};

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

const categoriasGasto = {
  semillas: { label: "Semillas", icon: Sprout, color: "bg-green-100 text-green-700" },
  sustratos: { label: "Sustratos", icon: Layers, color: "bg-amber-100 text-amber-700" },
  envases: { label: "Envases", icon: Package, color: "bg-blue-100 text-blue-700" },
  transporte: { label: "Transporte", icon: Truck, color: "bg-purple-100 text-purple-700" },
  luz: { label: "Electricidad", icon: Zap, color: "bg-yellow-100 text-yellow-700" },
  agua: { label: "Agua", icon: Layers, color: "bg-cyan-100 text-cyan-700" },
  alquiler: { label: "Alquiler", icon: Building2, color: "bg-neutral-100 text-neutral-700" },
  personal: { label: "Personal", icon: Users, color: "bg-pink-100 text-pink-700" },
  marketing: { label: "Marketing", icon: TrendingUp, color: "bg-indigo-100 text-indigo-700" },
  equipamiento: { label: "Equipamiento", icon: Package, color: "bg-slate-100 text-slate-700" },
  mantenimiento: { label: "Mantenimiento", icon: AlertTriangle, color: "bg-orange-100 text-orange-700" },
  seguros: { label: "Seguros", icon: FileText, color: "bg-teal-100 text-teal-700" },
  impuestos: { label: "Impuestos", icon: Receipt, color: "bg-red-100 text-red-700" },
  software: { label: "Software/IT", icon: BarChart3, color: "bg-violet-100 text-violet-700" },
  formacion: { label: "Formación", icon: Star, color: "bg-emerald-100 text-emerald-700" },
  viajes: { label: "Viajes", icon: MapPin, color: "bg-rose-100 text-rose-700" },
  otros: { label: "Otros", icon: MoreVertical, color: "bg-gray-100 text-gray-700" },
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
  <Card className={`p-5 hover:shadow-md transition-all cursor-pointer ${onClick ? 'hover:-translate-y-1' : ''}`} onClick={onClick}>
    <div className="flex items-start justify-between">
      <div className={`p-3 rounded-xl ${color}`}><Icon size={22} /></div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-sm font-bold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}{Math.abs(trend)}%
        </div>
      )}
    </div>
    <div className="mt-4">
      <p className="text-2xl font-black text-neutral-900">{value}</p>
      <p className="text-neutral-500 text-sm mt-0.5 font-medium">{label}</p>
      {subvalue && <p className="text-xs text-neutral-400 mt-1">{subvalue}</p>}
    </div>
  </Card>
);

const Modal = ({ title, children, onClose, size = "max-w-2xl" }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
    <div className={`bg-white rounded-2xl shadow-2xl w-full ${size} max-h-[90vh] overflow-hidden`} onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between p-5 border-b border-neutral-200">
        <h3 className="text-xl font-bold text-neutral-900">{title}</h3>
        <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-xl"><X size={20} /></button>
      </div>
      <div className="p-5 overflow-y-auto max-h-[calc(90vh-80px)]">{children}</div>
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
  
  // Dashboard - selector de periodo
  const [dashboardPeriodo, setDashboardPeriodo] = useState('mes_actual');
  
  // Facturas - filtros y selección
  const [filtroFacturasMes, setFiltroFacturasMes] = useState('todos');
  const [selectedFacturas, setSelectedFacturas] = useState([]);
  
  // Gastos - filtros y selección
  const [filtroGastosMes, setFiltroGastosMes] = useState('todos');
  const [selectedGastos, setSelectedGastos] = useState([]);
  
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
  const setLeads = setLeadsData;

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
  const alertasNoLeidas = 0;
  const leadsNuevos = leads.filter(l => l.estado === 'nuevo').length;

  // CRUD
  const handleSave = async (table, form, id = null) => {
    try {
      if (id) { await supabase.from(table).update(form).eq('id', id); }
      else {
        if (table === 'lotes') {
          const year = new Date().getFullYear();
          const { count } = await supabase.from('lotes').select('*', { count: 'exact', head: true });
          form.id = `L-${year}-${String((count || 0) + 1).padStart(3, '0')}`;
        }
        await supabase.from(table).insert(form);
      }
      setShowModal(null);
      setEditingItem(null);
      // Refrescar datos inmediatamente
      if (table === 'clientes') refetchClientes();
      else if (table === 'productos') refetchProductos();
      else if (table === 'leads') refetchLeads();
      else if (table === 'gastos') refetchGastos();
      else if (table === 'lotes') refetchLotes();
    } catch (error) { console.error('Error:', error); }
  };

  const handleDelete = async (table, id) => {
    if (window.confirm('¿Eliminar este elemento?')) {
      await supabase.from(table).delete().eq('id', id);
      // Refrescar datos inmediatamente
      if (table === 'clientes') refetchClientes();
      else if (table === 'productos') refetchProductos();
      else if (table === 'leads') refetchLeads();
      else if (table === 'gastos') refetchGastos();
      else if (table === 'lotes') refetchLotes();
      else if (table === 'pedidos') { refetchPedidos(); refetchFacturas(); }
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
        const iva = baseImponible * 0.21;
        
        await supabase.from('facturas').insert({ 
          id: facturaId, 
          pedido_id: pedidoId, 
          cliente_id: form.cliente_id, 
          fecha: new Date().toISOString().split('T')[0], 
          fecha_vencimiento: fechaVencimiento.toISOString().split('T')[0], 
          estado: 'pendiente', 
          subtotal, 
          descuento_aplicado: descuentoAplicado, 
          base_imponible: baseImponible, 
          iva_porcentaje: 21, 
          iva, 
          total: baseImponible + iva 
        });
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
    const [form, setForm] = useState(cliente || { nombre: '', tipo: 'restaurante', contacto: '', email: '', telefono: '', direccion: '', codigo_postal: '', ciudad: 'Madrid', zona: 'centro', descuento: 0, cif: '' });
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre" className="col-span-2" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
          <Input label="CIF/NIF" value={form.cif} onChange={e => setForm({...form, cif: e.target.value})} />
          <Select label="Tipo" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} options={[{ value: 'mercamadrid', label: 'Mercamadrid' }, { value: 'hotel', label: 'Hotel' }, { value: 'restaurante', label: 'Restaurante' }, { value: 'catering', label: 'Catering' }, { value: 'tienda', label: 'Tienda' }]} />
          <Select label="Zona" value={form.zona} onChange={e => setForm({...form, zona: e.target.value})} options={Object.entries(zonaConfig).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Input label="Descuento (%)" type="number" value={form.descuento} onChange={e => setForm({...form, descuento: parseInt(e.target.value) || 0})} />
          <Input label="Contacto" value={form.contacto} onChange={e => setForm({...form, contacto: e.target.value})} />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <Input label="Teléfono" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} />
          <Input label="Dirección" className="col-span-2" value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})} />
          <Input label="Código Postal" value={form.codigo_postal} onChange={e => setForm({...form, codigo_postal: e.target.value})} placeholder="28001" />
          <Input label="Ciudad" value={form.ciudad} onChange={e => setForm({...form, ciudad: e.target.value})} />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t"><Button variant="secondary" onClick={onCancel}>Cancelar</Button><Button onClick={() => onSave(form)}>{cliente ? 'Guardar' : 'Crear'}</Button></div>
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
        </div>
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
                    {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} - {formatCurrency(p.precio)}</option>)}
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
    const [form, setForm] = useState(gasto || { fecha: new Date().toISOString().split('T')[0], categoria: 'otros', concepto: '', proveedor_id: null, importe: 0, pagado: false, factura_url: '' });
    const [uploading, setUploading] = useState(false);
    const [fileName, setFileName] = useState(gasto?.factura_url ? 'Archivo adjunto' : '');

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

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
          <Select label="Categoría" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} options={Object.entries(categoriasGasto).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Input label="Concepto" className="col-span-2" value={form.concepto} onChange={e => setForm({...form, concepto: e.target.value})} />
          <Select 
            label="Proveedor" 
            value={form.proveedor_id || ''} 
            onChange={e => setForm({...form, proveedor_id: e.target.value ? parseInt(e.target.value) : null})} 
            options={[{ value: '', label: 'Sin proveedor' }, ...proveedores.map(p => ({ value: p.id, label: p.nombre }))]} 
          />
          <Input label="Importe (€)" type="number" step="0.01" value={form.importe} onChange={e => setForm({...form, importe: parseFloat(e.target.value) || 0})} />
        </div>
        
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
      completada: false 
    });
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Título" className="col-span-2" value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} />
          <Select label="Categoría" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} options={Object.entries(categoriaTareaConfig).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Select label="Prioridad" value={form.prioridad} onChange={e => setForm({...form, prioridad: e.target.value})} options={Object.entries(prioridadTareaConfig).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Input label="Fecha límite" type="date" value={form.fecha_limite} onChange={e => setForm({...form, fecha_limite: e.target.value})} />
          <Select label="Cliente (opcional)" value={form.cliente_id || ''} onChange={e => setForm({...form, cliente_id: e.target.value ? parseInt(e.target.value) : null})} options={[{ value: '', label: 'Sin cliente' }, ...clientes.map(c => ({ value: c.id, label: c.nombre }))]} />
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
          <Select label="Lote" className="col-span-2" value={form.lote_id} onChange={e => setForm({...form, lote_id: e.target.value})} options={lotes.map(l => ({ value: l.id, label: `${l.id} - ${productos.find(p => p.id === l.producto_id)?.nombre || 'Producto'}` }))} />
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

  // ==================== NAV ====================
  const NavItem = ({ icon: Icon, label, section, badge }) => (
    <button onClick={() => setActiveSection(section)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeSection === section ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}>
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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-neutral-900">¡Hola, {userProfile?.nombre?.split(' ')[0] || 'Usuario'}!</h1>
            <p className="text-neutral-500 mt-1 font-medium">Panel de control de RootFlow ERP</p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-neutral-400" />
            <select 
              value={dashboardPeriodo} 
              onChange={e => setDashboardPeriodo(e.target.value)}
              className="px-4 py-2 rounded-xl border border-neutral-200 bg-white font-semibold text-neutral-700 focus:ring-2 focus:ring-orange-500 outline-none"
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
        
        <Card className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
          <p className="text-sm font-medium text-orange-700">📊 Mostrando datos de: <span className="font-bold">{periodoLabel}</span></p>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
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
    const filtered = clientes.filter(c => c.nombre?.toLowerCase().includes(searchTerm.toLowerCase()));
    const exportColumns = [{ header: 'Nombre', accessor: c => c.nombre },{ header: 'Tipo', accessor: c => tipoClienteConfig[c.tipo]?.label },{ header: 'CP', accessor: c => c.codigo_postal },{ header: 'Zona', accessor: c => zonaConfig[c.zona]?.label },{ header: 'Email', accessor: c => c.email },{ header: 'Teléfono', accessor: c => c.telefono },{ header: 'Descuento', accessor: c => c.descuento }];

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

    // Vista Tabla
    const renderTableView = () => (
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-900 text-white">
            <tr>
              <th className="text-left px-5 py-4 text-sm font-bold">Cliente</th>
              <th className="text-left px-5 py-4 text-sm font-bold">Tipo</th>
              <th className="text-left px-5 py-4 text-sm font-bold">Zona</th>
              <th className="text-left px-5 py-4 text-sm font-bold">Contacto</th>
              <th className="text-left px-5 py-4 text-sm font-bold">Descuento</th>
              <th className="text-right px-5 py-4 text-sm font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(cliente => {
              const config = tipoClienteConfig[cliente.tipo] || tipoClienteConfig.restaurante;
              return (
                <tr key={cliente.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-5 py-4">
                    <p className="font-bold text-neutral-900">{cliente.nombre}</p>
                    <p className="text-xs text-neutral-400">{cliente.cif || cliente.codigo_postal}</p>
                  </td>
                  <td className="px-5 py-4"><Badge className={config?.color}>{config?.label}</Badge></td>
                  <td className="px-5 py-4"><Badge className={zonaConfig[cliente.zona]?.color}>{zonaConfig[cliente.zona]?.label || '-'}</Badge></td>
                  <td className="px-5 py-4">
                    <p className="text-sm">{cliente.email || '-'}</p>
                    <p className="text-xs text-neutral-400">{cliente.telefono}</p>
                  </td>
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
    const filtered = leads.filter(l => { const matchesSearch = l.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || l.empresa?.toLowerCase().includes(searchTerm.toLowerCase()); const matchesFilter = filterEstado === 'todos' || l.estado === filterEstado; return matchesSearch && matchesFilter; });
    const exportColumns = [{ header: 'Nombre', accessor: l => l.nombre },{ header: 'Empresa', accessor: l => l.empresa },{ header: 'Tipo', accessor: l => tipoClienteConfig[l.tipo]?.label },{ header: 'CP', accessor: l => l.codigo_postal },{ header: 'Estado', accessor: l => estadoLeadConfig[l.estado]?.label },{ header: 'Origen', accessor: l => origenLeadConfig[l.origen]?.label },{ header: 'Valor', accessor: l => l.valor_estimado },{ header: 'Email', accessor: l => l.email },{ header: 'Teléfono', accessor: l => l.telefono }];

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
          <table className="w-full">
            <thead className="bg-neutral-900 text-white"><tr><th className="text-left px-5 py-4 text-sm font-bold">Lead</th><th className="text-left px-5 py-4 text-sm font-bold">Tipo</th><th className="text-left px-5 py-4 text-sm font-bold">Contacto</th><th className="text-left px-5 py-4 text-sm font-bold">CP</th><th className="text-left px-5 py-4 text-sm font-bold">Estado</th><th className="text-left px-5 py-4 text-sm font-bold">Origen</th><th className="text-left px-5 py-4 text-sm font-bold">Valor</th><th className="text-right px-5 py-4 text-sm font-bold">Acciones</th></tr></thead>
            <tbody>
              {filtered.map(lead => {
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

  const renderPedidos = () => {
    const filtered = pedidos.filter(p => { const cliente = clientes.find(c => c.id === p.cliente_id); const matchesSearch = cliente?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toString().includes(searchTerm); const matchesFilter = filterEstado === 'todos' || p.estado === filterEstado; return matchesSearch && matchesFilter; });
    const exportColumns = [{ header: 'ID', accessor: p => p.id },{ header: 'Cliente', accessor: p => clientes.find(c => c.id === p.cliente_id)?.nombre },{ header: 'Fecha', accessor: p => formatDate(p.fecha) },{ header: 'Entrega', accessor: p => formatDate(p.fecha_entrega) },{ header: 'Estado', accessor: p => estadoConfig[p.estado]?.label },{ header: 'Total', accessor: p => p.total }];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-black text-neutral-900">Pedidos</h1><p className="text-neutral-500 font-medium">{pedidos.length} registros</p></div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => exportToExcel(filtered, 'pedidos', exportColumns)}><FileSpreadsheet size={16} /> Excel</Button>
            <Button onClick={() => { setEditingItem(null); setShowModal('pedido'); }}><Plus size={20} /> Nuevo Pedido</Button>
          </div>
        </div>
        <Card className="p-4 flex items-center gap-4">
          <div className="flex-1 relative"><Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" /><input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-orange-500 outline-none" /></div>
          <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="px-4 py-2.5 rounded-xl border font-medium"><option value="todos">Todos</option>{Object.entries(estadoConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        </Card>
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-900 text-white"><tr><th className="text-left px-5 py-4 text-sm font-bold">Pedido</th><th className="text-left px-5 py-4 text-sm font-bold">Cliente</th><th className="text-left px-5 py-4 text-sm font-bold">Entrega</th><th className="text-left px-5 py-4 text-sm font-bold">Total</th><th className="text-left px-5 py-4 text-sm font-bold">Estado</th><th className="text-right px-5 py-4 text-sm font-bold">Acciones</th></tr></thead>
            <tbody>
              {filtered.map(pedido => {
                const cliente = clientes.find(c => c.id === pedido.cliente_id);
                const config = estadoConfig[pedido.estado];
                const Icon = config?.icon || Clock;
                return (
                  <tr key={pedido.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-5 py-4"><p className="font-black text-neutral-900">#{pedido.id}</p><p className="text-xs text-neutral-400">{formatDate(pedido.fecha)}</p></td>
                    <td className="px-5 py-4 font-semibold">{cliente?.nombre}</td>
                    <td className="px-5 py-4 text-sm">{formatDate(pedido.fecha_entrega)}</td>
                    <td className="px-5 py-4 font-bold">{formatCurrency(pedido.total)}</td>
                    <td className="px-5 py-4"><Badge className={config?.color}><Icon size={12} />{config?.label}</Badge></td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-1"><button onClick={() => { setEditingItem(pedido); setShowModal('pedido'); }} className="p-2 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Edit2 size={16} /></button><button onClick={() => handleDelete('pedidos', pedido.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState icon={ShoppingCart} title="No hay pedidos" description="Crea tu primer pedido" action={<Button onClick={() => setShowModal('pedido')}><Plus size={16} />Nuevo</Button>} />}
        </Card>
      </div>
    );
  };

  const renderProductos = () => {
    const exportColumns = [{ header: 'Nombre', accessor: p => p.nombre },{ header: 'Categoría', accessor: p => p.categoria },{ header: 'Precio', accessor: p => p.precio },{ header: 'Coste', accessor: p => p.coste },{ header: 'Stock', accessor: p => p.stock },{ header: 'Stock Mínimo', accessor: p => p.stock_minimo }];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-black text-neutral-900">Productos</h1><p className="text-neutral-500 font-medium">{productos.length} registros</p></div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => exportToExcel(productos, 'productos', exportColumns)}><FileSpreadsheet size={16} /> Excel</Button>
            <Button onClick={() => { setEditingItem(null); setShowModal('producto'); }}><Plus size={20} /> Nuevo</Button>
          </div>
        </div>
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-900 text-white"><tr><th className="text-left px-5 py-4 text-sm font-bold">Producto</th><th className="text-left px-5 py-4 text-sm font-bold">Categoría</th><th className="text-left px-5 py-4 text-sm font-bold">Precio</th><th className="text-left px-5 py-4 text-sm font-bold">Stock</th><th className="text-left px-5 py-4 text-sm font-bold">Margen</th><th className="text-right px-5 py-4 text-sm font-bold">Acciones</th></tr></thead>
            <tbody>
              {productos.map(producto => {
                const margen = producto.precio > 0 && producto.coste > 0 ? ((producto.precio - producto.coste) / producto.precio * 100).toFixed(0) : '-';
                const stockBajoFlag = producto.stock < (producto.stock_minimo || 20);
                return (
                  <tr key={producto.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center text-white"><Leaf size={18} /></div><div><p className="font-semibold">{producto.nombre}</p><p className="text-xs text-neutral-400">{producto.unidad}</p></div></div></td>
                    <td className="px-5 py-4"><Badge>{producto.categoria}</Badge></td>
                    <td className="px-5 py-4"><p className="font-bold">{formatCurrency(producto.precio)}</p><p className="text-xs text-neutral-400">Coste: {formatCurrency(producto.coste)}</p></td>
                    <td className="px-5 py-4"><div className="flex items-center gap-2"><div className={`w-2.5 h-2.5 rounded-full ${stockBajoFlag ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} /><span className={stockBajoFlag ? 'text-red-600 font-bold' : 'font-medium'}>{producto.stock}</span></div></td>
                    <td className="px-5 py-4"><Badge variant={margen > 50 ? 'success' : margen > 30 ? 'warning' : 'danger'}>{margen}%</Badge></td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-1"><button onClick={() => { setEditingItem(producto); setShowModal('producto'); }} className="p-2 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Edit2 size={16} /></button><button onClick={() => handleDelete('productos', producto.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    );
  };

  // Componente para ver factura
  const FacturaPreview = ({ factura, cliente, pedidoItemsList, onClose }) => {
    const items = pedidoItemsList.filter(i => i.pedido_id === factura.pedido_id);
    
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
            .logo { width: 50px; height: 70px; background: #1B5E3B; border-radius: 25px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 10px; }
            .logo svg { width: 40px; height: 40px; }
            .company-name { font-size: 24px; font-weight: 800; color: #1B5E3B; }
            .company-sub { font-size: 11px; color: #666; }
            .factura-num { text-align: right; }
            .factura-num h1 { font-size: 28px; color: #1B5E3B; margin-bottom: 5px; }
            .factura-num p { color: #666; font-size: 13px; }
            .addresses { display: flex; justify-content: space-between; margin-bottom: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
            .address h3 { font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 8px; }
            .address p { font-size: 13px; line-height: 1.6; }
            .address strong { font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #1B5E3B; color: white; padding: 12px 15px; text-align: left; font-size: 12px; text-transform: uppercase; }
            td { padding: 12px 15px; border-bottom: 1px solid #eee; font-size: 13px; }
            .text-right { text-align: right; }
            .totals { margin-left: auto; width: 300px; }
            .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .totals-row.total { border-top: 2px solid #1B5E3B; border-bottom: none; padding-top: 15px; font-size: 18px; font-weight: 800; color: #1B5E3B; }
            .footer { margin-top: 60px; text-align: center; color: #999; font-size: 11px; }
            .footer p { margin: 3px 0; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <div class="logo">
                <svg viewBox="0 0 40 40" fill="white"><path d="M20 5 L20 25 M20 10 Q10 5, 8 12 Q14 8, 20 15 M20 10 Q30 5, 32 12 Q26 8, 20 15 M20 18 Q8 12, 5 22 Q12 15, 20 22 M20 18 Q32 12, 35 22 Q28 15, 20 22"/></svg>
              </div>
              <div>
                <div class="company-name">RootFlow</div>
                <div class="company-sub">HYDROPONICS</div>
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
            <div class="totals-row"><span>IVA (21%)</span><span>${formatCurrency(factura.iva)}</span></div>
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
                <h2 className="text-xl font-bold text-green-800">RootFlow</h2>
                <p className="text-xs text-neutral-500 uppercase tracking-wider">Hydroponics</p>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-black text-green-800">FACTURA</h1>
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
            <thead className="bg-green-800 text-white">
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
              <div className="flex justify-between py-2 border-b"><span>IVA (21%)</span><span>{formatCurrency(factura.iva)}</span></div>
              <div className="flex justify-between py-3 text-xl font-black text-green-800 border-t-2 border-green-800"><span>TOTAL</span><span>{formatCurrency(factura.total)}</span></div>
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
              
              const asunto = `Factura ${factura.id} - RootFlow Hydroponics`;
              const cuerpo = `Estimado/a ${cliente?.nombre},%0A%0AAdjunto encontrará la factura ${factura.id} correspondiente a su pedido.%0A%0ARESUMEN:%0A${itemsTexto}%0A%0ASubtotal: ${formatCurrency(factura.subtotal)}%0AIVA (21%): ${formatCurrency(factura.iva)}%0ATOTAL: ${formatCurrency(factura.total)}%0A%0AFecha vencimiento: ${formatDate(factura.fecha_vencimiento)}%0A%0ADatos de pago:%0AIBAN: ES00 0000 0000 0000 0000 0000%0AConcepto: ${factura.id}%0A%0AGracias por su confianza.%0A%0AAtentamente,%0ARootFlow Hydroponics SL%0A${EMPRESA.telefono}`;
              
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
    const facturasFiltradas = filtrarPorPeriodo(facturas, 'fecha', filtroFacturasMes);
    
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
          <StatCard icon={Clock} label="Pendiente" value={formatCurrency(facturasFiltradas.filter(f => f.estado === 'pendiente').reduce((sum, f) => sum + (f.total || 0), 0))} color="bg-amber-100 text-amber-600" />
          <StatCard icon={CheckCircle} label="Cobrado" value={formatCurrency(facturasFiltradas.filter(f => f.estado === 'pagada').reduce((sum, f) => sum + (f.total || 0), 0))} color="bg-blue-100 text-blue-600" />
          <StatCard icon={AlertCircle} label="Vencidas" value={facturasFiltradas.filter(f => f.estado === 'vencida').length} color="bg-red-100 text-red-600" />
        </div>

        {selectedFacturas.length > 0 && (
          <Card className="p-3 bg-orange-50 border-orange-200 flex items-center justify-between">
            <span className="font-semibold text-orange-700">{selectedFacturas.length} factura(s) seleccionada(s)</span>
            <Button variant="secondary" size="sm" onClick={() => setSelectedFacturas([])}>Limpiar selección</Button>
          </Card>
        )}

        <Card className="overflow-hidden">
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
                <th className="text-left px-5 py-4 text-sm font-bold">Factura</th>
                <th className="text-left px-5 py-4 text-sm font-bold">Cliente</th>
                <th className="text-left px-5 py-4 text-sm font-bold">Fecha</th>
                <th className="text-left px-5 py-4 text-sm font-bold">Total</th>
                <th className="text-left px-5 py-4 text-sm font-bold">Estado</th>
                <th className="text-right px-5 py-4 text-sm font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {facturasFiltradas.map(factura => {
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
                        {factura.estado === 'pendiente' && <button onClick={async () => { await supabase.from('facturas').update({ estado: 'pagada' }).eq('id', factura.id); refetchFacturas(); }} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Marcar como pagada"><Check size={16} /></button>}
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
    // Filtrar gastos por mes
    const gastosFiltradosPorMes = filtrarPorPeriodo(gastos, 'fecha', filtroGastosMes);
    
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
                <th className="text-left px-5 py-4 text-sm font-bold">Fecha</th>
                <th className="text-left px-5 py-4 text-sm font-bold">Concepto</th>
                <th className="text-left px-5 py-4 text-sm font-bold">Categoría</th>
                <th className="text-left px-5 py-4 text-sm font-bold">Proveedor</th>
                <th className="text-left px-5 py-4 text-sm font-bold">Importe</th>
                <th className="text-left px-5 py-4 text-sm font-bold">Factura</th>
                <th className="text-left px-5 py-4 text-sm font-bold">Estado</th>
                <th className="text-right px-5 py-4 text-sm font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {gastosFiltradosPorMes.map(gasto => {
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
                    <td className="px-5 py-4 text-sm">{gasto.proveedor || '-'}</td>
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

  const renderProduccion = () => {
    const exportColumns = [{ header: 'Lote', accessor: l => l.id },{ header: 'Producto', accessor: l => productos.find(p => p.id === l.producto_id)?.nombre },{ header: 'Siembra', accessor: l => formatDate(l.fecha_siembra) },{ header: 'Cosecha', accessor: l => formatDate(l.fecha_cosecha_prevista) },{ header: 'Bandejas', accessor: l => l.bandejas },{ header: 'Estado', accessor: l => estadoLoteConfig[l.estado]?.label }];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-black text-neutral-900">Producción</h1><p className="text-neutral-500 font-medium">{lotes.length} registros</p></div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => exportToExcel(lotes, 'produccion', exportColumns)}><FileSpreadsheet size={16} /> Excel</Button>
            <Button onClick={() => { setEditingItem(null); setShowModal('lote'); }}><Plus size={20} /> Nuevo Lote</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard icon={Sprout} label="Sembrados" value={lotes.filter(l => l.estado === 'sembrado').length} color="bg-amber-100 text-amber-600" />
          <StatCard icon={Sun} label="Creciendo" value={lotes.filter(l => l.estado === 'creciendo').length} color="bg-green-100 text-green-600" />
          <StatCard icon={Check} label="Cosechados" value={lotes.filter(l => l.estado === 'cosechado').length} color="bg-blue-100 text-blue-600" />
          <StatCard icon={Layers} label="Bandejas Activas" value={lotes.filter(l => ['sembrado', 'creciendo'].includes(l.estado)).reduce((sum, l) => sum + l.bandejas, 0)} color="bg-orange-100 text-orange-600" />
        </div>
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-900 text-white"><tr><th className="text-left px-5 py-4 text-sm font-bold">Lote</th><th className="text-left px-5 py-4 text-sm font-bold">Producto</th><th className="text-left px-5 py-4 text-sm font-bold">Siembra</th><th className="text-left px-5 py-4 text-sm font-bold">Cosecha</th><th className="text-left px-5 py-4 text-sm font-bold">Bandejas</th><th className="text-left px-5 py-4 text-sm font-bold">Estado</th><th className="text-right px-5 py-4 text-sm font-bold">Acciones</th></tr></thead>
            <tbody>
              {lotes.map(lote => {
                const producto = productos.find(p => p.id === lote.producto_id);
                const config = estadoLoteConfig[lote.estado];
                const Icon = config?.icon || Sprout;
                const diasRestantes = Math.ceil((new Date(lote.fecha_cosecha_prevista) - new Date()) / (1000*60*60*24));
                return (
                  <tr key={lote.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-5 py-4 font-black">{lote.id}</td>
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center text-white"><Leaf size={14} /></div><span className="font-semibold">{producto?.nombre}</span></div></td>
                    <td className="px-5 py-4 text-sm">{formatDate(lote.fecha_siembra)}</td>
                    <td className="px-5 py-4"><p className="text-sm">{formatDate(lote.fecha_cosecha_prevista)}</p>{lote.estado !== 'cosechado' && diasRestantes <= 2 && <p className="text-xs text-amber-600 font-bold">{diasRestantes <= 0 ? '¡Hoy!' : `En ${diasRestantes}d`}</p>}</td>
                    <td className="px-5 py-4 font-bold">{lote.bandejas}</td>
                    <td className="px-5 py-4"><Badge className={config?.color}><Icon size={12} />{config?.label}</Badge></td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        {lote.estado === 'creciendo' && <button onClick={() => handleCosecharLote(lote)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Cosechar (añade stock)"><Check size={16} /></button>}
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
          {lotes.length === 0 && <EmptyState icon={Sprout} title="No hay lotes" description="Crea un lote" action={<Button onClick={() => setShowModal('lote')}><Plus size={16} />Nuevo</Button>} />}
        </Card>
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
    
    // Agrupar por todas las zonas disponibles
    const zonasDisponibles = Object.keys(zonaConfig);
    const pedidosPorZona = {};
    zonasDisponibles.forEach(zona => {
      pedidosPorZona[zona] = pedidosDelDia.filter(p => {
        const cliente = clientes.find(c => c.id === p.cliente_id);
        return cliente?.zona === zona;
      });
    });

    const totalPedidos = pedidosDelDia.length;
    const totalImporte = pedidosDelDia.reduce((sum, p) => sum + (p.total || 0), 0);

    const imprimirHojaRuta = (zona) => {
      const pedidosZona = pedidosPorZona[zona] || [];
      if (pedidosZona.length === 0) return;
      
      const contenido = pedidosZona.map((p, idx) => {
        const cliente = clientes.find(c => c.id === p.cliente_id);
        const items = pedidoItems.filter(i => i.pedido_id === p.id);
        return `
${idx + 1}. ${cliente?.nombre || 'Cliente'}
   📍 ${cliente?.direccion || 'Sin dirección'}, ${cliente?.codigo_postal || ''} ${cliente?.ciudad || ''}
   📞 ${cliente?.telefono || 'Sin teléfono'}
   💰 Total: ${formatCurrency(p.total)}
   📦 Productos:
${items.map(i => `      - ${productos.find(pr => pr.id === i.producto_id)?.nombre || 'Producto'} x${i.cantidad}`).join('\n')}
   📝 Notas: ${p.notas || 'Ninguna'}
─────────────────────────────────`;
      }).join('\n');

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
═══════════════════════════════════

${contenido}

Firma repartidor: _________________
          </body>
        </html>
      `);
      ventana.document.close();
      ventana.print();
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
                    <button onClick={() => imprimirHojaRuta(zona)} className="p-2 hover:bg-white/20 rounded-lg" title="Imprimir hoja de ruta">
                      <Printer size={18} />
                    </button>
                  )}
                </div>
                <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
                  {pedidosZona.map((p, idx) => {
                    const cliente = clientes.find(c => c.id === p.cliente_id);
                    return (
                      <div key={p.id} className="p-3 bg-neutral-50 rounded-xl border-l-4 border-neutral-300">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                            <div>
                              <p className="font-semibold text-neutral-900">{cliente?.nombre || 'Cliente'}</p>
                              <p className="text-xs text-neutral-500">{cliente?.direccion || 'Sin dirección'}</p>
                              <p className="text-xs text-neutral-400">{cliente?.codigo_postal || ''} • {cliente?.telefono || ''}</p>
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
                      <p className="text-sm text-neutral-600">{producto?.nombre || 'Producto'} • Lote {m.lote_id}</p>
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

      const ivaRepercutido = facturasT.reduce((sum, f) => sum + (f.iva || 0), 0);
      const ivaSoportado = gastosT.reduce((sum, g) => sum + ((g.importe || 0) * 0.21), 0); // Estimación 21%
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

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black text-neutral-900">Contabilidad</h1>
          <p className="text-neutral-500 font-medium">Resumen fiscal y flujo de caja - Año {year}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Euro} label="Ingresos Año" value={formatCurrency(totalAnual.ingresos)} color="bg-green-100 text-green-600" />
          <StatCard icon={Wallet} label="Gastos Año" value={formatCurrency(totalAnual.gastos)} color="bg-red-100 text-red-600" />
          <StatCard icon={TrendingUp} label="IVA Repercutido" value={formatCurrency(totalAnual.ivaRepercutido)} color="bg-blue-100 text-blue-600" />
          <StatCard icon={TrendingDown} label="IVA Soportado" value={formatCurrency(totalAnual.ivaSoportado)} color="bg-amber-100 text-amber-600" />
        </div>

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
            <strong>⚠️ Nota:</strong> El IVA soportado es una estimación al 21%. Para datos exactos, asegúrate de registrar el IVA real en cada gasto.
          </p>
        </Card>
      </div>
    );
  };

  // ==================== MAIN RENDER ====================
  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-neutral-100 flex">
      {/* Sidebar Negro */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-neutral-900 p-4 flex flex-col transition-all duration-300 fixed h-full z-40`}>
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
        </nav>
        <div className="pt-4 border-t border-neutral-700 space-y-1">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-full flex items-center gap-3 px-4 py-3 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-xl"><Menu size={20} />{sidebarOpen && <span className="text-sm font-medium">Colapsar</span>}</button>
          <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-xl"><LogOut size={20} />{sidebarOpen && <span className="text-sm font-medium">Salir</span>}</button>
        </div>
      </aside>

      {/* Main */}
      <main className={`flex-1 ${sidebarOpen ? 'ml-64' : 'ml-20'} transition-all duration-300`}>
        <header className="bg-white border-b border-neutral-200 px-8 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900 capitalize">{activeSection}</h2>
            <div className="flex items-center gap-3">
              <button className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-xl relative"><Bell size={20} />{alertasNoLeidas > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{alertasNoLeidas}</span>}</button>
              <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 rounded-xl"><div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white text-sm font-bold">{userProfile?.nombre?.charAt(0) || 'U'}</div>{sidebarOpen && <span className="text-sm font-semibold text-neutral-700">{userProfile?.nombre?.split(' ')[0]}</span>}</div>
            </div>
          </div>
        </header>
        <div className="p-8">
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
