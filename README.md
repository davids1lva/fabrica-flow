# Fábrica Flow

Aplicação de registo e acompanhamento de produção, em português de Portugal. Inclui interface para tablets, API, persistência, administração, supervisão e relatórios.

## Experimentar em 3 passos (sem Docker)

Instale Node.js 22 ou 24 LTS, extraia o ZIP e abra um terminal dentro de `fabrica-flow`:

```sh
npm ci
npm run demo
```

Abra **http://localhost:3001**. O comando compila a interface, aplica a migration, carrega os dados de demonstração e inicia o servidor. Os dados ficam na pasta `.test-data` e permanecem depois de reiniciar. Não execute dois processos demo na mesma pasta.

Este modo usa PGlite, um motor PostgreSQL incorporado. É exclusivamente para experimentar e para testes automatizados; não é o modo de operação da fábrica. Não misture os dados de demonstração com os reais.

### Credenciais de demonstração

| Perfil | Número | PIN |
|---|---|---|
| Administrador | 9001 | 123456 |
| Supervisor | 8001 ou 8002 | 123456 |
| Funcionário | 1001 a 1020 | 123456 |

1. Entre como `9001`.
2. Abra **Configurações → Associar este tablet**, escolha um posto e dê um nome ao tablet.
3. Termine sessão. A associação permanece no navegador.
4. Entre como `1001`, escolha a ordem e o turno, e inicie produção.
5. Registe quantidades, faça uma pausa, retome e termine o turno.
6. Entre como supervisor para ver os postos ou consultar **Relatórios**.

Para testar dois tablets no mesmo computador, utilize dois perfis de navegador diferentes. Separadores do mesmo perfil partilham os cookies e a associação ao posto. Em cada dispositivo real a associação deve ser feita pelo administrador.

## Instalação local com PostgreSQL

Requisitos: Node.js 22/24 LTS, npm e PostgreSQL 17 (ou Docker Desktop com Compose).

```sh
npm ci
```

Copie `.env.example` para `.env` (`copy .env.example .env` no Windows; `cp .env.example .env` em macOS/Linux). O ficheiro contém:

```dotenv
DATABASE_URL=postgresql://fabrica:fabrica_dev@localhost:5432/fabrica
PORT=3001
APP_ORIGIN=http://localhost:5173
NODE_ENV=development
```

Depois:

```sh
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev
```

Abra **http://localhost:5173**. O processo de desenvolvimento inicia a API em 3001 e a interface em 5173. O Vite encaminha `/api` para a API. Se já tiver PostgreSQL, não precisa de Docker: crie uma base de dados e configure `DATABASE_URL`.

A migration é transacional e a sua versão fica em `schema_migrations`. Execute apenas um processo de migrations de cada vez. O seed é idempotente: se existirem utilizadores não insere novamente os dados. O seed recusa `NODE_ENV=production`.

### Build e execução do código compilado

```sh
npm run build
```

Altere `APP_ORIGIN` para `http://localhost:3001` no `.env`, mantenha `NODE_ENV=development` para testes locais sem HTTPS e execute:

```sh
npm start
```

A API serve a aplicação compilada. Para trabalhar novamente com Vite, reponha `APP_ORIGIN=http://localhost:5173`.

## Arquitetura

- **React + TypeScript + Vite**, CSS responsivo e ícones Lucide. Interface do operador com botões grandes e confirmação do fim do turno.
- **Node.js + Express**, API REST com validação Zod e consultas parametrizadas.
- **PostgreSQL**, cliente `pg`, pool de 20 ligações por processo, migrations SQL versionadas e transações.
- **SSE** para supervisores, com PostgreSQL `LISTEN/NOTIFY` entre processos. Atualização de segurança a cada 30 segundos. O operador atualiza a cada 15 segundos e após cada ação. Cronómetros correm na interface a partir do último valor do servidor.
- **PWA**: manifesto, ícone e service worker que guarda apenas a interface visitada. Não guarda respostas da API. Instalação requer HTTPS ou localhost; a disponibilidade do botão de instalação depende do navegador.

A stack do pedido era uma sugestão. Foi escolhido Express em vez de Next.js para executar frontend e API no mesmo servidor convencional; SQL parametrizado em vez de Prisma para tornar explícitos os bloqueios de linha, índices únicos parciais e checkpoints dos cálculos. Não depende de contas ou serviços externos para funcionar. O backend é JavaScript ESM e o frontend TypeScript.

### Pastas

```text
fabrica-flow/
  src/                  interface React e estilos
  server/               API, autenticação, métricas, migrations e seed
  db/001_init.sql       modelo relacional e índices
  public/               PWA e ícone
  tests/                testes de integração
  docker-compose.yml    PostgreSQL para desenvolvimento
  .env.example          exemplo de configuração
  package-lock.json     versões exatas de dependências
```

### Modelo de dados

`users` reúne os funcionários e as contas de supervisão/administração, com `role` validado por CHECK. `machines`, `stations` e `devices` representam máquinas, postos e navegadores associados. `orders` contém as ordens. `work_sessions`, `production_records`, `pauses` e `pause_types` preservam a atividade. `target_changes` e `audit_logs` registam alterações. `auth_sessions` guarda hashes dos tokens; `login_limits` controla tentativas; `requests` garante idempotência; `settings` contém parâmetros da fábrica.

As relações usam chaves estrangeiras. Dois índices únicos parciais impedem simultaneamente dois turnos ativos por trabalhador ou posto, incluindo turnos em pausa. Os registos operacionais não têm endpoints de eliminação. Funcionários, máquinas, postos e motivos podem ser desativados sem apagar o histórico.

## Funcionalidades e regras

### Acessos

| Operação | Funcionário | Supervisor | Administrador |
|---|---|---|---|
| Iniciar/gerir o próprio turno num tablet associado | Sim | Sim | Sim |
| Ver todos os postos e relatórios | Não | Sim | Sim |
| Alterar a meta de um posto | Não | Sim | Sim |
| Gerir ordens, recursos, pessoas e perfis | Não | Consulta* | Sim |
| Associar/revogar tablets, configurações, auditoria | Não | Não | Sim |

\* Supervisores consultam postos, máquinas, ordens e motivos, mas não a lista administrativa de contas. A mudança de perfil ou PIN invalida as sessões dessa conta. Não é possível retirar o próprio acesso administrativo.

Os funcionários não conseguem aceder à API de administração alterando o URL. As permissões são verificadas em cada pedido. Sair não termina a produção; o turno permanece e pode ser retomado com o mesmo funcionário no mesmo posto. **Terminar turno** fecha também uma eventual pausa e regressa ao login.

### Produção e metas

- Incrementos `+1/+5/+10/+50` e substituição do total com confirmação.
- A substituição utiliza a versão do turno: recusa um total baseado num valor já desatualizado.
- Cada alteração de quantidade regista valor anterior, novo valor, delta, autor e data.
- Meta da ordem prevalece sobre a do posto; sem meta própria utiliza-se a do posto.
- Produção esperada = soma de `(tempo produtivo de cada segmento em horas × meta desse segmento)`.
- Eficiência = produção real / esperada × 100. Sem produção esperada apresenta-se “—”.
- Ao alterar uma meta, fecha-se o segmento anterior antes de aplicar o novo ritmo, preservando o passado. Mudanças na meta do posto não afetam ordens com meta própria.
- O estado da ordem muda para “Em produção” ao iniciar. Terminar um turno não termina automaticamente a ordem: pode haver mais quantidade por produzir ou outros turnos.
- Não se pode concluir, cancelar ou pausar uma ordem com turnos ativos. Não se pode trocar a máquina de um posto ocupado.
- Os estados “Parado”, “Manutenção” e “Problema” configurados no posto impedem novos turnos. Não encerram um turno em curso; a pausa deve ser registada pelo operador. No dashboard, um turno ativo prevalece sobre o estado configurado.
- Nomes de entidades são consultados no cadastro atual; o motivo de cada pausa, máquina da sessão e segmentos de metas são preservados.

### Falhas de ligação

Os incrementos ficam primeiro numa fila local, ligada ao utilizador e ao turno. A sincronização reutiliza o mesmo identificador UUID. Se a resposta se perder depois da gravação, a repetição não soma novamente.

A fila tenta sincronizar ao recuperar ligação e a cada 15 segundos. Quantidades pendentes aparecem no ecrã. Não é possível pausar ou terminar pela interface até serem sincronizadas. Substituição de total, login, início/fim e pausas exigem servidor disponível. Uma operação recusada pelo servidor fica pendente para não desaparecer silenciosamente; deve ser reconciliada com supervisão. Não limpar os dados do navegador nem mudar de dispositivo com registos pendentes. A fila não é um sistema offline integral: é preciso abrir a interface autenticada enquanto há rede.

### Relatórios

Filtros por funcionário, máquina, posto, produto, ordem, turno e período; gráficos de produção temporal (dia/semana/mês), produção por funcionário/máquina, eficiência e pausas. CSV UTF-8 compatível com Excel já implementado, incluindo proteção contra fórmulas. Exportação nativa XLSX/PDF pode ser adicionada depois, conforme previsto no pedido.

O período seleciona **turnos iniciados no intervalo**, incluindo o turno completo. Não reparte turnos que atravessam a meia-noite. Datas são guardadas em UTC; a interface mostra o fuso do navegador. O fuso nas configurações é uma referência informativa, não substitui o fuso do dispositivo. Eficiência agregada é ponderada por produção esperada, não a média simples das percentagens. Um relatório admite até 366 dias e 20 mil turnos; acima disso pede um intervalo menor.

## Segurança

PIN com scrypt e salt individual. Tokens aleatórios de 256 bits, hashes SHA-256 na base de dados, cookies HttpOnly e SameSite=Strict; Secure quando `NODE_ENV=production`. Sessões de 16 horas. A associação do tablet dura até um ano ou até revogação.

Rate limiting persistente: 8 tentativas por código e 60 por IP em 15 minutos. Uma autenticação válida repõe o contador do código. Todas as mutações exigem JSON e `Origin` exatamente igual a `APP_ORIGIN`. Headers Helmet/CSP, consultas parametrizadas, validação e escaping React. Não há importação de HTML fornecido por utilizadores. O backend não regista PINs no audit log.

## Colocar num servidor da empresa

1. Prepare PostgreSQL dedicado e uma conta SQL exclusiva da aplicação. Configure backups automáticos e teste o restauro.
2. Copie o projeto, execute `npm ci`, configure `.env`, execute `npm run db:migrate` e `npm run build`.
3. Não carregue o seed demo num ambiente real. Crie o primeiro administrador com o script abaixo e cadastre os restantes no painel.
4. Configure `NODE_ENV=production`, `APP_ORIGIN=https://producao.empresa.pt`, `PORT=3001` e a `DATABASE_URL` real. Restrinja a API à rede/proxy autorizado.
5. Execute `npm start` sob um supervisor de processos. Coloque HTTPS à frente (Caddy/Nginx) e encaminhe `/` para a porta 3001. Em SSE desative buffering e configure timeout superior a 30 s. Não publique a porta PostgreSQL na rede dos tablets.
6. Abra o endereço HTTPS em cada tablet, associe o posto e instale a PWA pelo navegador, se disponível.
7. Valide regras de turnos, contagens e metas com a empresa antes de iniciar o piloto. Faça teste de carga no hardware/rede alvo e ensaie recuperação de falhas.

Não coloque o `.env` ou cópias da base de dados num repositório público. Num proxy, o exemplo não confia automaticamente em `X-Forwarded-For`; o limite por IP pode agrupar tablets pelo IP do proxy. Configure `trust proxy` apenas para o proxy efetivamente controlado antes do uso em escala; o limite por código permanece independente. Considere credenciais mais fortes/MFA para administradores se a aplicação for acessível pela Internet.

### Primeiro administrador (sem seed)

Prepare um ficheiro temporário local `admin.json` contendo `{"code":"9001","name":"Nome do administrador","pin":"PIN escolhido de 6 dígitos"}` com um PIN real que cumpra o formato. Não use literalmente o texto descritivo. Execute:

```sh
node --env-file=.env server/create-admin.js < admin.json
```

No PowerShell: `Get-Content admin.json | node --env-file=.env server/create-admin.js`. Depois elimine o ficheiro temporário. O script só insere uma conta; não redefine contas existentes. As contas seguintes são criadas pelo painel.

### Manutenção

Faça backups de todas as tabelas operacionais e de auditoria. Não elimine `requests` enquanto houver possibilidade de reenviar registos antigos: são necessários para a idempotência. `auth_sessions` expiradas e `login_limits` antigos podem ser limpos em tarefas de manutenção. Não configure encerramento automático de turnos sem uma regra da empresa.

## Testes e validação realizada

```sh
npm test
npm run build
```

5 testes automatizados de integração/unidade, com dezenas de verificações, executados com PGlite usando a mesma migration e a mesma API:

- seed e migrations idempotentes, PINs com hash, permissões e proteção da origem;
- fluxo completo do turno, exclusividade do posto, idempotência, conflitos do total, pausas, mudanças de meta e histórico;
- cadastro, desativação de contas, proteção do próprio administrador e revogação de tablets;
- bloqueio por tentativas de login;
- cálculo do tempo esperado e ausência de divisão por zero.

Build React/TypeScript validado. Ecrã de login inspecionado no navegador. Na demonstração pública, a entrada direta no painel administrativo e a alteração de uma meta foram verificadas no navegador. As áreas autenticadas foram verificadas pela API e pelo build; não foi completado um ensaio visual de todos os ecrãs nem em tablets físicos.

**Limites da validação:** não foi executado um teste com 100 tablets, nem um ensaio num servidor PostgreSQL externo. A arquitetura inclui pool, índices, transações, SSE e unicidade ao nível da base de dados, mas isto não equivale a uma certificação de capacidade ou prontidão de produção. O modo PGlite serializa transações e não valida concorrência real de múltiplos processos PostgreSQL. Antes do uso na empresa faltam teste de carga, piloto com operadores, backups/restauro e revisão do alojamento.

Demonstração pública: https://davids1lva.github.io/fabrica-flow/ — abre diretamente no painel administrativo e utiliza apenas dados fictícios guardados no navegador. A instalação com backend e base de dados reais continua a seguir as instruções acima.

## Demonstração pública do portefólio

`npm run build:public` gera a pasta `docs/`, pronta para GitHub Pages (branch `main`, pasta `/docs`). Abre diretamente como administrador, sem login, com dados fictícios. Toda a simulação e gestão da demonstração acontece no navegador: não existe ligação à API ou à base de dados da empresa. Alterações locais podem ser repostas pelo botão “Repor demonstração”. Nunca introduzir dados reais nesta demonstração.

O ficheiro `.env.public` contém apenas a opção pública de compilação; `.env` continua excluído. O arranque normal (`npm run build`/`npm start`) mantém autenticação e permissões no backend.
