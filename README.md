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

## Intervalo de almoço

A tela de registro mantém os dois botões. Depois da entrada, **Saída** permite escolher entre sair para almoço ou encerrar sem intervalo. Durante o almoço, **Retorno** registra a volta; em seguida, **Saída** encerra o expediente. Uma jornada aberta permanece vinculada à data de entrada mesmo após a meia-noite.

O formulário manual aceita os dois horários de almoço ou ambos vazios. Os totais são apurados ao encerrar a jornada, descontando o intervalo das horas trabalhadas e noturnas e calculando as extras sobre o tempo efetivo. Registros antigos sem intervalo mantêm o comportamento anterior. O CSV continua com quatro colunas e preserva o almoço existente ao atualizar uma data; horários incompatíveis são rejeitados.

Para bancos existentes, aplicar `supabase/migrations/20261102112153_add_lunch_punches.sql` antes de publicar esta versão. A migração adiciona apenas duas colunas opcionais e uma validação de ordem; não recalcula o histórico. O `supabase_schema.sql` já inclui essa estrutura para bancos novos.

Testes de cálculo (Node.js 24): `npm test`. Verificação de produção: `npm run build`.

## Correção de registros manuais

Em **Meus Registros → Ações → Editar**, o funcionário pode corrigir a data e os horários de um registro com origem **Manual**, inclusive jornadas em andamento. A correção atualiza o mesmo ID, recalcula os totais e rejeita datas futuras ou já ocupadas por outro registro do funcionário. Uma alteração de data pode mover o registro para outro período ou empresa; ajuste os filtros para encontrá-lo.

**Alterações** mostra os valores anteriores e novos de cada alteração registrada após a ativação desta funcionalidade. O banco guarda também o autor e a data da alteração. Usuários podem consultar seus históricos, mas não podem inserir, modificar ou apagar as versões. Correções concorrentes são rejeitadas para evitar sobrescrever uma batida mais recente.

Aplicar `supabase/migrations/20261102113947_manual_record_corrections.sql` após o schema inicial e a migração de almoço, inclusive em novas instalações, antes de disponibilizar a edição. Não há reconstrução de alterações anteriores à migração. O roteiro `tests/manual-corrections.sql` valida a auditoria e as permissões com dados temporários e rollback, sem modificar registros reais.

## Consulta do histórico

Os registros são apresentados em blocos responsivos, sem exigir rolagem horizontal. O filtro **Ciclo de fechamento** consulta do dia 20 ao dia 19; use as setas para navegar entre competências ou **Todo o histórico** para consultar todos os registros. A contagem mostra quantos registros correspondem aos filtros, e o PDF exporta esse mesmo conjunto. O carregamento busca todas as páginas da API, inclusive quando o servidor limita o tamanho de cada resposta.

O dia da semana e a indicação de fim de semana são informativos. A avaliação para classificação de feriados e futuras regras de apuração está em [docs/calendario-e-horas-extras.md](docs/calendario-e-horas-extras.md).
