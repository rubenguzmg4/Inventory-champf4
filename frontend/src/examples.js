/**
 * TEXTOS DE EJEMPLO ("placeholders") DE TODO EL SISTEMA
 * =====================================================
 * Son los textos grises que aparecen dentro de los campos vacíos (por ejemplo "Ej. Perfumería").
 * Están todos aquí, en un solo lugar, para adaptarlos al tipo de negocio sin buscar en cada pantalla.
 *
 * Cómo cambiarlos:
 *   1. Edita el texto entre comillas (no cambies el nombre que está antes de los dos puntos).
 *   2. Guarda el archivo.
 *   3. Vuelve a construir la aplicación:  docker compose up -d --build
 *
 * Los textos que empiezan con "Ej." son solo una guía visual: nunca se guardan ni se usan como datos.
 * Los nombres de las secciones de abajo dicen en qué pantalla aparece cada texto.
 */
export const EXAMPLES = {
  // ---------- Productos (menú Productos) ----------
  productName: 'Ej. Shampoo reparador 400 ml', // Formulario de producto: nombre
  productBrand: 'Ej. Natura (opcional)', // Formulario de producto: marca
  productDescription: 'Ej. Fórmula con keratina para cabello dañado', // Formulario de producto: descripción
  productCategory: 'Elegir categoría', // Formulario de producto: categoría
  productListSearch: 'Buscar por nombre, marca o código', // Lista de productos: buscador
  productListCategory: 'Todas las categorías', // Lista de productos: filtro de categoría
  productListBrand: 'Todas las marcas', // Lista de productos: filtro de marca

  // ---------- Categorías (menú Categorías) ----------
  categoryName: 'Ej. Perfumería', // Formulario de categoría: nombre
  categoryDescription: 'Ej. Perfumes, colonias y body splash', // Formulario de categoría: descripción
  // Mensaje de la lista cuando todavía no hay categorías:
  categoryEmpty: 'Crea tu primera categoría (ej. Perfumería, Cuidado del cabello, Maquillaje, Cuidado de la piel).',

  // ---------- Entradas de mercancía y ajustes de stock ----------
  entryProduct: 'Buscar producto...', // Registrar entrada: producto
  entrySupplier: 'Ej. Distribuidora Belleza Total', // Registrar entrada: proveedor
  entryNote: 'Ej. Factura N° 00123 del proveedor', // Registrar entrada: nota
  adjustDetail: 'Ej. Se rompió un frasco al moverlo', // Ajustar stock: detalle
  // Motivos que se ofrecen al ajustar el stock a mano (puedes agregar o quitar):
  adjustReasons: [
    'Conteo físico',
    'Mercancía dañada',
    'Producto vencido',
    'Pérdida o robo',
    'Uso como probador (tester)',
    'Consumo interno',
    'Otro',
  ],

  // ---------- Clientes (menú Clientes) ----------
  clientId: 'Ej. V-12345678', // Formulario de cliente: cédula o RIF
  clientName: 'Ej. María', // Formulario de cliente: nombre
  clientLastname: 'Ej. Pérez', // Formulario de cliente: apellido
  clientPhone: 'Ej. 0414-1234567', // Formulario de cliente: teléfono
  clientEmail: 'Ej. maria@correo.com', // Formulario de cliente: correo
  clientAddress: 'Ej. Av. Principal, casa 12, Valencia', // Formulario de cliente: dirección
  clientListSearch: 'Buscar por cédula, nombre o apellido', // Lista de clientes: buscador
  clientPickerSearch: 'Buscar por cédula o nombre', // Facturar: buscador de cliente

  // ---------- Facturar y facturas ----------
  posSearch: 'Buscar por nombre o código de barras', // Facturar: buscador de productos
  posNote: 'Nota (opcional)', // Facturar: nota de la venta
  billSearch: 'N° de factura, cédula o cliente', // Lista de facturas: buscador
  billStatus: 'Estado', // Lista de facturas: filtro de estado
  dateRange: 'Elegir período', // Selector de fechas (facturas, reportes, entradas)

  // ---------- Reportes ----------
  reportCategory: 'Todas las categorías', // Reporte de productos más vendidos: filtro de categoría

  // ---------- Usuarios (menú Usuarios) ----------
  userName: 'Ej. ana', // Formulario de usuario: nombre de usuario
  userFullName: 'Ej. Ana Pérez', // Formulario de usuario: nombre completo

  // ---------- Configuración ----------
  businessName: 'Ej. Bella Estética y Cosméticos', // Datos del negocio: nombre
  businessTaxId: 'Ej. J-12345678-9', // Datos del negocio: RIF
  businessPhone: 'Ej. 0212-5551234', // Datos del negocio: teléfono
  businessEmail: 'Ej. contacto@minegocio.com', // Datos del negocio: correo
  businessAddress: 'Ej. Av. Principal, Local 4, Caracas', // Datos del negocio: dirección
  invoiceFooter: 'Ej. ¡Gracias por tu compra! Síguenos en @tunegocio', // Mensaje al pie de la factura
  sidebarColor: 'Neutro', // Color de la barra lateral cuando no se eligió ninguno
  exchangeRate: 'Ej. 874,73', // Tasa de cambio manual

  // ---------- Primera vez que se abre el sistema ----------
  setupBusinessName: 'Ej. Bella Estética y Cosméticos', // Pantalla de bienvenida: nombre del negocio
  setupFullName: 'Ej. Ana Pérez', // Pantalla de bienvenida: tu nombre
  setupUsername: 'Ej. admin', // Pantalla de bienvenida: usuario
};
