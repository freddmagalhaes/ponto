# Ponto - Employee Time Tracking System

A comprehensive web-based employee time tracking system built with React, Supabase, and Tailwind CSS.

## Funcionalidades Implementadas
- **Autenticação e Segurança (RLS)** integrada ao Supabase, controlando acessos de administradores e usuários.
- **Painel/Dashboard** detalhado para visualização dos registros.
- **Gestão de Funcionários (CRUD Completo)**: Permite ao Administrador criar (sem deslogar do sistema), editar e inativar contas (Soft-Delete) com segurança.
- **Registro de Ponto Manual e Inteligente**: Reconhece automaticamente o avanço da madrugada se a saída for no dia seguinte (cruzamento do fluxo da meia-noite).
- **Relatórios Isolados por Fuso**: Filtro exato do mês pelo `date-fns`, removendo problemas de conversões fuso-horárias vindas de UTC que vazavam para o dia 1º.
- **Cálculo Trabalhista Automatizado**: Desconta 1h12m fixos de almoço; Calcula Extras acima da 8ª hora; Calcula minutos Noturnos precisos entre 22h e 05h.
- Importação de arquivos AFV (em desenvolvimento).
- **Temas**: Modo Escuro Moderno e Modo Claro Customizado (slate-50 premium) com bordas refinadas de alta visibilidade.

## Mock Credentials (Testing)
To test the interface without a real Supabase backend or to access the existing mock users, you can use the following mock credentials:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@teste.com` | `123456` |
| Regular User | `user@teste.com` | `123456` |

These credentials will mock a successful login flow and set up local state for testing purposes, allowing you to view the Dashboard and other pages.

## Setup

1. Configure `.env`: Use the provided `.env.example` file to configure your Supabase URL and Anon Key. Or skip this step if you just want to test using the mock credentials above without setting up the backend yet.
2. Install dependencies: `npm install`
3. Run locally: `npm run dev`
