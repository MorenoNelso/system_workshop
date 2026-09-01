/**
 * Tipos de la base de datos.
 *
 * Fase 1: tabla `usuarios` + RPC `get_user_role()`.
 * Fase 2: tablas de CRUD (clientes, motos, categorias_repuesto, proveedores,
 * repuestos, monedas). En fases posteriores se agregan las restantes o se
 * regeneran con la CLI de Supabase.
 */

/** Roles válidos en `usuarios.rol` (check constraint en la DB). */
export type Rol = "administrador" | "colaborador";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Row<T extends Record<string, unknown>> = T & { id: string };
type Insert<T extends Record<string, unknown>> = Partial<T> & { id?: string };
type Update<T extends Record<string, unknown>> = Partial<T>;

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: Row<{
          email: string;
          nombre: string;
          rol: Rol;
          activo: boolean;
          creado_en: string;
        }>;
        Insert: Insert<{
          email: string;
          nombre: string;
          rol: Rol;
          activo: boolean;
          creado_en: string;
        }>;
        Update: Update<{
          email: string;
          nombre: string;
          rol: Rol;
          activo: boolean;
          creado_en: string;
        }>;
        Relationships: [];
      };
      monedas: {
        Row: Row<{
          codigo: string;
          nombre: string;
          simbolo: string;
        }>;
        Insert: Insert<{ codigo: string; nombre: string; simbolo: string }>;
        Update: Update<{ codigo: string; nombre: string; simbolo: string }>;
        Relationships: [];
      };
      clientes: {
        Row: Row<{
          nombre: string;
          telefono: string;
          email: string | null;
          documento: string | null;
          direccion: string | null;
          creado_en: string;
        }>;
        Insert: Insert<{
          nombre: string;
          telefono: string;
          email: string | null;
          documento: string | null;
          direccion: string | null;
          creado_en: string;
        }>;
        Update: Update<{
          nombre: string;
          telefono: string;
          email: string | null;
          documento: string | null;
          direccion: string | null;
          creado_en: string;
        }>;
        Relationships: [];
      };
      motos: {
        Row: Row<{
          cliente_id: string;
          marca: string;
          modelo: string;
          anio: number | null;
          placa: string | null;
          cilindraje: string | null;
          color: string | null;
          notas: string | null;
        }>;
        Insert: Insert<{
          cliente_id: string;
          marca: string;
          modelo: string;
          anio: number | null;
          placa: string | null;
          cilindraje: string | null;
          color: string | null;
          notas: string | null;
        }>;
        Update: Update<{
          cliente_id: string;
          marca: string;
          modelo: string;
          anio: number | null;
          placa: string | null;
          cilindraje: string | null;
          color: string | null;
          notas: string | null;
        }>;
        Relationships: [];
      };
      categorias_repuesto: {
        Row: Row<{ nombre: string }>;
        Insert: Insert<{ nombre: string }>;
        Update: Update<{ nombre: string }>;
        Relationships: [];
      };
      proveedores: {
        Row: Row<{
          nombre: string;
          contacto: string | null;
          telefono: string | null;
          email: string | null;
          direccion: string | null;
        }>;
        Insert: Insert<{
          nombre: string;
          contacto: string | null;
          telefono: string | null;
          email: string | null;
          direccion: string | null;
        }>;
        Update: Update<{
          nombre: string;
          contacto: string | null;
          telefono: string | null;
          email: string | null;
          direccion: string | null;
        }>;
        Relationships: [];
      };
      repuestos: {
        Row: Row<{
          nombre: string;
          sku: string | null;
          categoria_id: string | null;
          proveedor_id: string | null;
          stock_actual: number;
          stock_minimo: number;
          precio_costo: number | null;
          precio_venta: number;
          moneda_id: string;
          activo: boolean;
        }>;
        Insert: Insert<{
          nombre: string;
          sku: string | null;
          categoria_id: string | null;
          proveedor_id: string | null;
          stock_actual: number;
          stock_minimo: number;
          precio_costo: number | null;
          precio_venta: number;
          moneda_id: string;
          activo: boolean;
        }>;
        Update: Update<{
          nombre: string;
          sku: string | null;
          categoria_id: string | null;
          proveedor_id: string | null;
          stock_actual: number;
          stock_minimo: number;
          precio_costo: number | null;
          precio_venta: number;
          moneda_id: string;
          activo: boolean;
        }>;
        Relationships: [];
      };
      empleados: {
        Row: Row<{
          usuario_id: string | null;
          nombre: string;
          documento: string | null;
          telefono: string | null;
          tipo_vinculacion: "salario_fijo" | "comision" | "mixto";
          salario_base: number | null;
          moneda_salario_id: string | null;
          porcentaje_comision: number | null;
          activo: boolean;
        }>;
        Insert: Insert<{
          usuario_id?: string | null;
          nombre: string;
          documento?: string | null;
          telefono?: string | null;
          tipo_vinculacion: "salario_fijo" | "comision" | "mixto";
          salario_base?: number | null;
          moneda_salario_id?: string | null;
          porcentaje_comision?: number | null;
          activo?: boolean;
        }>;
        Update: Update<{
          usuario_id?: string | null;
          nombre?: string;
          documento?: string | null;
          telefono?: string | null;
          tipo_vinculacion?: "salario_fijo" | "comision" | "mixto";
          salario_base?: number | null;
          moneda_salario_id?: string | null;
          porcentaje_comision?: number | null;
          activo?: boolean;
        }>;
        Relationships: [];
      };
      movimientos_inventario: {
        Row: Row<{
          repuesto_id: string;
          tipo: "entrada" | "salida" | "ajuste";
          cantidad: number;
          motivo: string | null;
          orden_id: string | null;
          usuario_id: string;
          fecha: string;
        }>;
        Insert: Insert<{
          repuesto_id: string;
          tipo: "entrada" | "salida" | "ajuste";
          cantidad: number;
          motivo?: string | null;
          orden_id?: string | null;
          usuario_id: string;
          fecha?: string;
        }>;
        Update: Update<{
          repuesto_id?: string;
          tipo?: "entrada" | "salida" | "ajuste";
          cantidad?: number;
          motivo?: string | null;
          orden_id?: string | null;
          usuario_id?: string;
          fecha?: string;
        }>;
        Relationships: [];
      };
      ordenes_servicio: {
        Row: Row<{
          moto_id: string;
          cliente_id: string;
          empleado_asignado_id: string | null;
          estado: "recibido" | "en_proceso" | "terminado" | "entregado";
          diagnostico: string | null;
          observaciones: string | null;
          fecha_ingreso: string;
          fecha_entrega_estimada: string | null;
          fecha_entrega_real: string | null;
        }>;
        Insert: Insert<{
          moto_id: string;
          cliente_id: string;
          empleado_asignado_id?: string | null;
          estado?: "recibido" | "en_proceso" | "terminado" | "entregado";
          diagnostico?: string | null;
          observaciones?: string | null;
          fecha_ingreso?: string;
          fecha_entrega_estimada?: string | null;
          fecha_entrega_real?: string | null;
        }>;
        Update: Update<{
          moto_id?: string;
          cliente_id?: string;
          empleado_asignado_id?: string | null;
          estado?: "recibido" | "en_proceso" | "terminado" | "entregado";
          diagnostico?: string | null;
          observaciones?: string | null;
          fecha_ingreso?: string;
          fecha_entrega_estimada?: string | null;
          fecha_entrega_real?: string | null;
        }>;
        Relationships: [];
      };
      orden_detalle_repuestos: {
        Row: Row<{
          orden_id: string;
          repuesto_id: string;
          cantidad: number;
          precio_unitario_aplicado: number;
          moneda_id: string;
        }>;
        Insert: Insert<{
          orden_id: string;
          repuesto_id: string;
          cantidad: number;
          precio_unitario_aplicado: number;
          moneda_id: string;
        }>;
        Update: Update<{
          orden_id?: string;
          repuesto_id?: string;
          cantidad?: number;
          precio_unitario_aplicado?: number;
          moneda_id?: string;
        }>;
        Relationships: [];
      };
      orden_detalle_mano_obra: {
        Row: Row<{
          orden_id: string;
          empleado_id: string;
          descripcion: string;
          monto: number;
          moneda_id: string;
          porcentaje_comision_aplicado: number | null;
          comision_calculada: number | null;
        }>;
        Insert: Insert<{
          orden_id: string;
          empleado_id: string;
          descripcion: string;
          monto: number;
          moneda_id: string;
          porcentaje_comision_aplicado?: number | null;
          comision_calculada?: number | null;
        }>;
        Update: Update<{
          orden_id?: string;
          empleado_id?: string;
          descripcion?: string;
          monto?: number;
          moneda_id?: string;
          porcentaje_comision_aplicado?: number | null;
          comision_calculada?: number | null;
        }>;
        Relationships: [];
      };
      tasas_cambio: {
        Row: Row<{
          moneda_origen_id: string;
          moneda_destino_id: string;
          tasa: number;
          fuente: string;
          actualizado_por: string | null;
          fecha: string;
        }>;
        Insert: Insert<{
          moneda_origen_id: string;
          moneda_destino_id: string;
          tasa: number;
          fuente?: string;
          actualizado_por?: string | null;
          fecha?: string;
        }>;
        Update: Update<{
          moneda_origen_id?: string;
          moneda_destino_id?: string;
          tasa?: number;
          fuente?: string;
          actualizado_por?: string | null;
          fecha?: string;
        }>;
        Relationships: [];
      };
      facturas: {
        Row: Row<{
          orden_id: string | null;
          cliente_id: string;
          numero_consecutivo: number;
          subtotal: number;
          total: number;
          moneda_id: string;
          tasa_aplicada: number | null;
          estado_pago: "pendiente" | "pagada" | "anulada";
          fecha_emision: string;
        }>;
        Insert: Insert<{
          orden_id?: string | null;
          cliente_id: string;
          numero_consecutivo?: number;
          subtotal: number;
          total: number;
          moneda_id: string;
          tasa_aplicada?: number | null;
          estado_pago?: "pendiente" | "pagada" | "anulada";
          fecha_emision?: string;
        }>;
        Update: Update<{
          orden_id?: string | null;
          cliente_id?: string;
          numero_consecutivo?: number;
          subtotal?: number;
          total?: number;
          moneda_id?: string;
          tasa_aplicada?: number | null;
          estado_pago?: "pendiente" | "pagada" | "anulada";
          fecha_emision?: string;
        }>;
        Relationships: [];
      };
      factura_detalle_repuestos: {
        Row: Row<{
          factura_id: string;
          repuesto_id: string;
          cantidad: number;
          precio_unitario_aplicado: number;
          moneda_id: string;
        }>;
        Insert: Insert<{
          factura_id: string;
          repuesto_id: string;
          cantidad: number;
          precio_unitario_aplicado: number;
          moneda_id: string;
        }>;
        Update: Update<{
          factura_id?: string;
          repuesto_id?: string;
          cantidad?: number;
          precio_unitario_aplicado?: number;
          moneda_id?: string;
        }>;
        Relationships: [];
      };
      factura_detalle_servicios: {
        Row: Row<{
          factura_id: string;
          empleado_id: string | null;
          descripcion: string;
          monto: number;
          moneda_id: string;
          porcentaje_comision_aplicado: number | null;
          comision_calculada: number | null;
        }>;
        Insert: Insert<{
          factura_id: string;
          empleado_id?: string | null;
          descripcion: string;
          monto: number;
          moneda_id: string;
          porcentaje_comision_aplicado?: number | null;
          comision_calculada?: number | null;
        }>;
        Update: Update<{
          factura_id?: string;
          empleado_id?: string | null;
          descripcion?: string;
          monto?: number;
          moneda_id?: string;
          porcentaje_comision_aplicado?: number | null;
          comision_calculada?: number | null;
        }>;
        Relationships: [];
      };
      pagos: {
        Row: Row<{
          factura_id: string;
          monto: number;
          moneda_id: string;
          metodo_pago: string | null;
          fecha: string;
        }>;
        Insert: Insert<{
          factura_id: string;
          monto: number;
          moneda_id: string;
          metodo_pago?: string | null;
          fecha?: string;
        }>;
        Update: Update<{
          factura_id?: string;
          monto?: number;
          moneda_id?: string;
          metodo_pago?: string | null;
          fecha?: string;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_user_role: {
        Args: Record<string, never>;
        Returns: Rol | null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
