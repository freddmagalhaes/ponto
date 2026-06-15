# Ponto - Employee Time Tracking System

A comprehensive web-based and mobile-ready employee time tracking system built with React, Supabase, and Tailwind CSS.

## Funcionalidades Implementadas

- **Autenticação e Segurança (RLS):** Integrada ao Supabase, controlando acessos de administradores e funcionários.
- **Proteção de Rotas (Route Guards):** Bloqueio a nível de roteador no React Router para impedir que funcionários comuns acessem páginas administrativas (`/funcionarios` e `/importar`).
- **Painel/Dashboard:** Dashboard gráfico detalhado utilizando Recharts para visualização consolidada de métricas.
- **Gestão de Funcionários (CRUD Completo):** Permite ao Administrador criar (sem deslogar do sistema), editar e inativar contas (Soft-Delete) com segurança.
- **Registro de Ponto Geolocalizado (GPS):** Captura latitude e longitude exatas no momento da batida (Entrada e Saída). Compatível com GPS nativo em smartphones e fallback dinâmico em navegadores Web.
- **Auditoria de Localização:** O histórico exibe links integrados para o Google Maps apontando para a localização exata de cada registro de ponto.
- **Autenticação Biométrica Híbrida:** Suporte nativo a FaceID/TouchID no celular antes do registro das batidas de ponto.
- **Cálculo Trabalhista Automatizado:** Desconto automático de 1h12m fixos de almoço se houver intersecção; cálculo de Horas Extras e cálculo preciso de Adicional Noturno (das 22h às 05h).
- **Relatórios Isolados por Fuso:** Filtragem exata do mês para evitar problemas com conversores de fuso horário vindo do UTC.
- **Temas:** Suporte completo a Modo Claro e Modo Escuro persistidos localmente.
- **Exportação de PDF:** Geração de relatórios mensais estruturados com assinaturas de conformidade prontas para o RH.
- **Importação em Lote:** Importador de registros via arquivos CSV.

---

## Mock Credentials (Testing)

Para testar a interface sem configurar o backend do Supabase, você pode utilizar as seguintes credenciais de teste (mocks):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@teste.com` | `123456` |
| Regular User | `user@teste.com` | `123456` |

---

## Setup

1. **Configure as credenciais:** Duplique o arquivo `.env.example` para `.env.local` e configure as credenciais do seu Supabase (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`).
2. **Instale as dependências:**
   ```bash
   npm install
   ```
3. **Execute localmente:**
   ```bash
   npm run dev
   ```

---

## Capacitor (Build Mobile)

O projeto está configurado com o Capacitor para empacotar o código web como aplicativo móvel nativo.

### Comandos de Compilação Híbrida:

1. Gere o build de produção do React:
   ```bash
   npm run build
   ```
2. Adicione ou sincronize o build com as plataformas móveis:
   ```bash
   # Sincroniza assets e plugins nativos
   npx cap sync
   
   # Adiciona pastas nativas (se for a primeira execução)
   npx cap add android
   npx cap add ios
   ```
3. Abra as plataformas nativas nos IDEs correspondentes para compilação final:
   ```bash
   # Abre o projeto no Android Studio
   npx cap open android
   
   # Abre o projeto no Xcode (necessita de MacOS)
   npx cap open ios
   ```
