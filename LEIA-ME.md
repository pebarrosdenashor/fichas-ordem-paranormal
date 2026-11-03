# Ficha Ordem Paranormal — extensão para Owlbear Rodeo

## Como instalar (GitHub Pages)

1. No GitHub, crie um repositório **público** chamado `ficha-ordem-paranormal` (na conta `pebarrosdenashor`).
2. Envie para a pasta `ficha-ordem-paranormal` do repositório os arquivos: `manifest.json`, `index.html`, `app.js`, `style.css`, `icon.svg`, `background.html`, `background.js`.
3. Em **Settings → Pages**, escolha *Deploy from a branch* → `main` → `/ (root)` e salve.
4. Espere 1–2 minutos e confira se abre: `https://pebarrosdenashor.github.io/ficha-ordem-paranormal/ficha-ordem-paranormal/manifest.json`
5. No Owlbear Rodeo: **Perfil → Extensions → Add Extension**, cole o link do passo 4 e ative a extensão na sala.

> Usou outro nome de repositório ou de conta? Troque os dois links dentro do `manifest.json`.

## Como funciona

- Cada jogador cria a(s) própria(s) ficha(s) pelo botão **＋** e só vê as dele.
- O mestre vê suas fichas e as de todos os jogadores (agrupadas no seletor do topo) e pode editá-las; as mudanças voltam para o jogador.
- As fichas ficam salvas no navegador de cada pessoa, por sala. Use **⋯ → Exportar** para fazer backup (ou para levar a ficha a outro computador) e **Importar** para restaurar.
- O mestre recebe as fichas quando o jogador está conectado na sala (envio automático; também dá para usar **⋯ → Pedir fichas aos jogadores**).
- Clique na sigla de um atributo ou no 🎲 de uma perícia para rolar; o resultado aparece para todos da sala.
- **⤢** abre a ficha em tela grande.

## Novidades da versão 2

- Rolar ataques e armas (teste + dano, crítico multiplica os dados)
- Conjurar rituais e usar habilidades gastando PD, com controle do limite por rodada
- PV e Determinação sugeridos pela classe e NEX
- Penalidade de carga, perícias “somente treinada” bloqueadas, contador de munição
- Condições com efeitos aplicados nas rolagens e na Defesa; avisos de Morrendo/Enlouquecendo
- Trilha por NEX, afinidade (★ nos rituais do elemento), temas de cores
- Histórico de rolagens, rolagem oculta do mestre, aba Mesa (iniciativa, teste em grupo)
- Arrastar para reordenar, busca e filtros, aviso de backup
- Token: clique direito → “Vincular à ficha aberta” / “Abrir ficha”; barras de PV e PD embaixo do token

## Novidades da versão 2.2

- ↶ Desfazer a última alteração da ficha
- Dano e cura: RD geral e por tipo, PV temporários, dano mental na Determinação, batalha de intenções
- Aba Interlúdio: dormir conforme a condição de descanso e benefícios guardados para usar depois
- "Próxima rolagem": dados e bônus de ajuda somados à rolagem seguinte
- Dados animados com som (desliga no menu ⋯)
- Menu ⋯: versão para imprimir/PDF, backup de todas as fichas na cena do Owlbear, backup completo em arquivo

## Novidades da versão 3

- Prato de dados: toda rolagem joga os dados num prato animado (⋯ → Aparência dos dados e do prato: cores, estilo, prato, tamanho, tempo)
- Visual novo, no estilo das fichas oficiais (rótulos vermelhos, caixas pretas, faixas de papel)
- Fome e sede visíveis no cartão do Hexatombe
- Jogadores só criam uma ficha; para outra, o pedido vai ao mestre, que aceita ou recusa no topo da ficha

## Novidades da versão 3.1

- Aba "Pratos da mesa": as últimas rolagens de cada jogador, com os dados personalizados de cada um (opcional; o mestre e rolagens secretas não entram)
- 👁/🙈 no topo (jogador): rolagem secreta, só o mestre vê
- Subir de NEX guiado: mostra e aplica os aumentos de PV e Determinação
- Aba Mesa (mestre): "Mostrar ordem nos tokens" põe a ordem de iniciativa nos tokens vinculados e destaca quem está na vez

## Novidades da versão 3.3 (regras conferidas com o livro básico)

- Carga: Força 0 carrega 2 espaços; aviso quando passa do dobro do limite
- Patente: escolher a patente aplica crédito e limites de itens da Tabela 3.1; aviso quando o prestígio pede outra patente
- Armas sem proficiência sofrem −2d no ataque (táticas: combatente ou "tática" escrito em Proficiências; pesadas: "pesada")
- Condições: Vulnerável −2 na Defesa, Indefeso −10, Cego −2d em perícias de AGI/FOR, Surdo −2d em Iniciativa, Caído −2d em Luta; novas: Enredado, Fascinado, Indefeso
- Subir de NEX: lembretes por classe (Ataque Especial, Perito, Engenhosidade, círculos de ritual, quantas perícias no grau de treinamento)
- Biblioteca do livro básico (origens, poderes de classe e trilhas) para importar em ⋯ → Biblioteca

## Observação

A sincronização usa as mensagens da sala do Owlbear. A interface esconde as fichas dos outros jogadores, mas os dados passam pelo navegador de todos os participantes, então não é um sigilo à prova de quem souber abrir as ferramentas de desenvolvedor.
