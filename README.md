# Ponto - Sistema de Controle de Ponto Eletrônico

Um sistema completo de registro, auditoria e fechamento de ponto eletrônico para colaboradores e administradores, desenvolvido com **React 19**, **TypeScript**, **Tailwind CSS v4**, **Supabase (PostgreSQL + RLS)** e aplicativo móvel com **Expo (React Native)**.

---

## 🚀 Funcionalidades Principais

- **Autenticação e Segurança com RLS:** Controle estrito de acesso via Supabase Auth e PostgreSQL Row Level Security (RLS), separando papéis de Administrador e Funcionário.
- **Proteção de Rotas (Route Guards):** Bloqueio a nível de roteador com React Router v7 para restringir páginas administrativas (`/funcionarios` e `/importar`).
- **Dashboard e Métricas:** Painel gráfico consolidado utilizando Recharts para acompanhamento de horas trabalhadas, horas extras, adicional noturno e colaboradores ativos, com layout 100% responsivo para desktop e celular.
- **Registro de Ponto Geolocalizado (GPS):** Captura latitude e longitude no momento da batida (Entrada e Saída), com links diretos de auditoria no Google Maps.
- **Navegação Mobile Nativa:** Drawer lateral deslizante (Menu Hamburguer) e *Bottom Navigation Bar* para alternar telas com um toque no celular.
- **Registro Manual e Flexibilidade:** Suporte a batida em tempo real e formulário manual para lançamento de horários e datas retroativas com recálculo instantâneo.
- **Cálculo Trabalhista Preciso:**
  - Cômputo exato de horas trabalhadas entre entrada e saída;
  - Apuração de Horas Extras para excedente da jornada regular (8h diárias);
  - Apuração precisa de Adicional Noturno minuto a minuto (janela das 22h às 05h).
- **Gestão de Funcionários (CRUD Completo):** Criação de colaboradores pelo painel administrativo (sem encerrar a sessão do gestor), edição e inativação de contas (Soft-Delete).
- **Fechamento de Folha / Ciclo de Apuração:** Controle de competência mensal (dia 20 a 19 do mês seguinte) com liquidação e compensação (banco de horas) de horas extras e adicional noturno.
- **Exportação de PDF:** Geração de espelho de ponto mensal pronto para RH com campos de assinatura formal do colaborador e gestor.
- **Importação em Lote:** Importador de registros via planilhas CSV.
- **Temas:** Suporte completo a Modo Claro e Modo Escuro persistidos localmente.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Front-end Web** | React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, Lucide React, Recharts |
| **Back-end & DB** | Supabase (PostgreSQL, Auth, Triggers, RLS Policies) |
| **Mobile** | Expo, React Native, React Native WebView, React Native Safe Area Context |
| **Deploy & Hosting**| Vercel (Web / SPA), Expo Application Services - EAS (Mobile Build) |

---

## 📦 Como Executar o Projeto Localmente

### 1. Clonar o repositório e instalar dependências:
```bash
git clone https://github.com/freddmagalhaes/ponto.git
cd ponto
npm install
```

### 2. Configurar variáveis de ambiente:
Copie o arquivo `.env.example` para `.env.local` e preencha as credenciais do seu Supabase:
```env
VITE_SUPABASE_URL="https://seu-projeto.supabase.co"
VITE_SUPABASE_ANON_KEY="sua-chave-anon"
```

### 3. Iniciar o servidor web:
```bash
npm run dev
# Ou para permitir acesso na rede local:
npm run dev:host
```

---

## 📱 Aplicativo Mobile (Android e iOS)

O projeto mobile está localizado na pasta `mobile/` e utiliza **Expo** com uma casca nativa que encapsula a aplicação web com suporte nativo a permissões de GPS e navegação física (botão voltar do Android).

### Executar no celular via Expo Go (Desenvolvimento):
```bash
# Na raiz do projeto:
npm run mobile

# Ou com suporte a conexões externas via túnel:
cd mobile && npx expo start --tunnel
```
Escaneie o QR Code exibido no terminal utilizando o aplicativo **Expo Go** (Android ou iOS).

### Gerar arquivo instalador `.apk` para Android (EAS Build):
```bash
cd mobile

# 1. Instalar o EAS CLI (se não tiver instalado):
npm install -g eas-cli

# 2. Fazer login na conta Expo:
eas login

# 3. Configurar o build:
eas build:configure

# 4. Gerar o APK instalável para Android:
eas build -p android --profile preview
```

---

## 🌐 Deploy na Vercel

O projeto possui configuração nativa de Single Page Application em `vercel.json`:
- Os deploys de produção ocorrem automaticamente a cada `git push` na branch `main`.
- Variáveis de ambiente configuradas no painel da Vercel: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- URL oficial de produção: `https://ponto-fredericos-projects-208d7188.vercel.app`

---

## 📄 Licença

Este projeto está sob a licença [MIT](LICENSE).
