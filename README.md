# Sistema Pacho Taller - Workshop Management System

> Repositorio para el control de versiones del sistema de Pacho.  
> Sistema definitivo — cuidado con el commit y push en la terminal.

---

## Descripción

Sistema de gestión para taller de motos, construido con [Next.js](https://nextjs.org), Supabase y TypeScript.

## Getting Started

Primero, copia el archivo de entorno y configura tus variables:

```bash
cp .env.example .env
```

Luego instala las dependencias y corre el servidor de desarrollo:

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver el resultado.

## Stack Tecnológico

- **Framework**: Next.js (App Router)
- **Base de datos**: Supabase (PostgreSQL)
- **Lenguaje**: TypeScript
- **Autenticación**: Supabase Auth

## Módulos del Sistema

- 🔐 Autenticación (Login / Recuperación de contraseña)
- 👥 Clientes
- 📋 Órdenes de trabajo
- 🧾 Facturas
- 📦 Inventario

## Documentación

Consulta la carpeta `/docs` para ver:

- Esquema de base de datos
- Funciones y triggers SQL
- Manual de mantenimiento
- Prompt maestro del proyecto
