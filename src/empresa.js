// V82: datos fijos de la empresa en un módulo propio para que los use también el área de cliente (src/AreaCliente.jsx)
// ==================== DATOS DE EMPRESA ====================
export const EMPRESA = {
  nombre: 'ROOTFLOW HYDROPONICS SL',
  direccion: 'C. Nueva, 16, P6',
  cp: '28231',
  ciudad: 'Las Rozas de Madrid, Madrid',
  telefono: '+34 638 161 990',
  email: 'info@rootflow.es',
  web: 'www.rootflow.es',
  cif: 'B27535137',
  iban: 'ES58 0182 4015 6002 0261 4010',
  banco: 'BBVA',
  swift: 'BBVAESMMXXX'
};

// ==================== ROOTFLOW LOGO OFICIAL ====================
export const LOGO_URL = 'https://www.rootflow.es/lovable-uploads/70262e87-198c-4788-b2e9-7b89bef45202.png';

// V82: dirección pública del área de cliente. Los enlaces de los emails llevan ?t=<clientes.portal_token>.
// Si la web rootflow.es pasa a tener su propia ruta /area-cliente (redirigiendo aquí), cambia esta URL.
export const PORTAL_CLIENTE_URL = 'https://rootflow-erp.vercel.app/area-cliente';
