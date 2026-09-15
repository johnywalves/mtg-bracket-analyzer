# MTG Analyzer — Web (Next.js)

Interface alternativa em Next.js (App Router) para o [MTG Analyzer](../README.md). **Não
substitui** `../frontend/` (React + Vite) — os dois coexistem, e este diretório não modifica nada
fora dele.

## Por que server-side

O backend FastAPI (`../backend/mtg_analyzer/api/app.py`) pode exigir uma `API_KEY` via header
`X-API-Key`. Este app faz **todas** as chamadas ao backend a partir do servidor Next.js (Server
Components), nunca do navegador:

- `lib/api.ts` importa `server-only`, o que faz o build falhar se algum Client Component tentar
  importá-lo — garante que a chave nunca entra no bundle do browser.
- As variáveis de ambiente usadas (`MTG_API_URL`, `MTG_API_KEY`) **não** têm prefixo
  `NEXT_PUBLIC_`, então o Next não as expõe ao client por padrão.
- Como a comunicação é servidor→servidor, não é necessário adicionar este app em
  `ALLOWED_ORIGINS` (CORS) do FastAPI — isso é só para chamadas vindas do browser (caso do
  `frontend/` Vite atual).

## Rodando localmente

1. Backend (na raiz do repo):
   ```bash
   . .venv/bin/activate
   uvicorn mtg_analyzer.api.app:app --reload   # porta 8000
   ```
2. Este app:
   ```bash
   cd web
   npm install
   cp ../.env.example .env.local      # ajuste MTG_API_URL / MTG_API_KEY se necessário
   npm run dev -- -p 3001             # 3001 porque o frontend/ Vite usa 3000/5173
   ```
3. Abra `http://localhost:3001`.

## Estado atual

O backend hoje só expõe `/health` (ver `project-plan.md` na raiz, fase 3c/3d em andamento). A
página inicial (`app/page.tsx`) usa isso como prova de conectividade server-side; novas páginas
devem seguir o mesmo padrão: adicionar uma função em `lib/api.ts` e chamá-la de um Server
Component.

## Tema

Paleta fixa, dark-only (sem light mode — as cores só fazem sentido em fundo escuro), definida em
`app/globals.css` via `@theme` do Tailwind v4:

| Token                     | Cor       | Uso                              |
| -------------------------- | --------- | --------------------------------- |
| `--color-bg`               | `#0A0D1B` | Fundo da página                   |
| `--color-surface`          | `#050814` | Painéis/cards                     |
| `--color-accent-primary`   | `#FF007F` | Magenta/rosa — estados de erro/alerta |
| `--color-accent-secondary` | `#00FFFF` | Ciano — estados de sucesso/destaque   |
| `--color-fg`                | `#FFFFFF` | Texto sobre fundo escuro          |
