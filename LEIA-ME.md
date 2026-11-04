# Ficha Ordem Paranormal — extensão para Owlbear Rodeo

## Como instalar (GitHub Pages)

1. No GitHub, crie um repositório **público** chamado `fichas-ordem-paranormal` (na conta `pebarrosdenashor`).
2. Envie para a raiz do repositório (fora de qualquer pasta) os arquivos: `manifest.json`, `index.html`, `app.js`, `style.css`, `icon.svg`, `background.html`, `background.js`.
3. Em **Settings → Pages**, escolha *Deploy from a branch* → `main` → `/ (root)` e salve.
4. Espere 1–2 minutos e confira se abre: `https://pebarrosdenashor.github.io/fichas-ordem-paranormal/manifest.json`
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

## Novidades da versão 3.4

- Regra escolhida ao criar a ficha: **Determinação** (Sobrevivendo ao Horror) ou **PE + Sanidade** (livro básico). Com PE + Sanidade, a ficha ganha a barra de Sanidade, o dano mental vai para a SAN, dormir recupera PV e PE e relaxar recupera SAN. Dá para trocar no topo da aba Principal.
- Morrendo e enlouquecendo controlados pelo jogador: botão "Comecei meu turno morrendo" (avisa a mesa e conta 1/3, 2/3, 3/3), desfazer e "Fui estabilizado/acalmado".
- Efeitos com duração (aba Principal): por rodadas, até o fim da cena, até o próximo interlúdio ou sem prazo, com condição ligada opcional. "Nova rodada" e "Fim de cena" na ficha e, para o mestre, na aba Mesa para todas as fichas (a nova rodada também acontece quando a iniciativa volta ao primeiro).
- Itens nas bibliotecas: cada lista do inventário tem "📚 Do livro" para adicionar armas, proteções, itens gerais e amaldiçoados já preenchidos.

## Novidades da versão 3.6

- Aba **Dados**: rolagem livre, sem usar a ficha. Toque nos dados (d4 a d100), some um modificador, escolha somar tudo ou ficar com o maior/menor dado, ou escreva a rolagem (ex.: 2d6+1d4+3). Dá para guardar rolagens favoritas. Funciona mesmo sem ficha criada.
- Prato de dados fixo: marque "Deixar o prato na tela até eu fechar no ✕ ou rolar de novo" (na aba Dados ou em ⋯ → Aparência dos dados). Ele não some sozinho.
- Rolagens feitas pela janelinha do acesso rápido agora aparecem na aba Rolagens de quem rolou.

## Novidades da versão 3.5

- Acesso rápido: toque no ⚡ de até 4 ataques, armas, habilidades ou rituais. Eles aparecem num cartão no topo da aba Principal e numa janelinha aberta pelo botão vermelho ≡ ao lado do token vinculado (só o dono da ficha vê o botão). Clicar rola o ataque, gasta o PD da habilidade ou conjura o ritual (com Discente e Verdadeiro).
- Se o botão do token não abrir, use o clique direito no token → "⚡ Acesso rápido".
- Janelas da ficha com barra de rolagem própria (3.4.1).

## Novidades da versão 3.7 — importar da CRIS

- **☰ → Importar da CRIS:** cole o link da ficha no site da CRIS (crisordemparanormal.com/agente/…). Vêm nome, jogador, origem, classe, NEX, deslocamento, atributos, PV, PE e Sanidade (ou Determinação), perícias com treino e bônus, armas, proteções e itens, ataques, rituais, poderes e os textos de histórico, aparência, personalidade e objetivo.
- A ficha vira uma **cópia** aqui. O que você muda na extensão não volta para a CRIS.
- **☰ → Atualizar PV e recursos pela CRIS:** aparece nas fichas importadas. Traz de novo PV, PE/PD, Sanidade, NEX e atributos, sem mexer no resto.
- Se a classe da CRIS não existir aqui (ex.: Sobrevivente), a ficha fica como Combatente e um aviso vai para as Notas.
- Depende do jeito como a CRIS guarda as fichas hoje (leitura pública do banco dela). Se a CRIS mudar isso, a importação para de funcionar até ser ajustada.

## Observação

A sincronização usa as mensagens da sala do Owlbear. A interface esconde as fichas dos outros jogadores, mas os dados passam pelo navegador de todos os participantes, então não é um sigilo à prova de quem souber abrir as ferramentas de desenvolvedor.

## Novidades da versão 3.8 — efeitos na mesa
Arquivos novos: `efeitos.js`, `efeito.html` e os selos `selo-sangue.svg`, `selo-morte.svg`, `selo-conhecimento.svg`, `selo-energia.svg`, `selo-medo.svg`. Suba todos junto com os outros.

- **Visual por elemento:** rituais e itens amaldiçoados ganham a cor e o símbolo do elemento (na lista e no acesso rápido). Tema novo “Pela afinidade”, que muda sozinho com a afinidade. Cada tema tem um fundo animado (Sangue pulsa, Morte gira, Conhecimento sobe em pontos dourados, Energia faísca, Medo é névoa); desliga em ⋯.
- **Rolagem dramática:** 20 natural (ou crítico na margem da arma) e 1 natural ganham efeito depois que os dados param: tela tremendo, “CRÍTICO!” ou “1 NATURAL” e som. A mesa toda vê o efeito por cima do mapa e ouve pela caixa de som do Escudo do Mestre. Rolagens secretas e ocultas não aparecem para ninguém.
- **Conjurar ritual:** um selo do elemento se desenha na ficha de quem conjura, e o mesmo selo gira embaixo do token vinculado, para todos. Cada elemento tem o seu som.
- **O mestre desliga:** na aba Mesa (mestre) ou no Escudo do Mestre → Ferramentas: “Animação ao conjurar ritual” e “Críticos na tela de todos”. Vale para a sala toda na hora.
- Em ⋯, cada pessoa ainda escolhe: som, animações na própria ficha, ver os críticos dos outros e o fundo animado.

> Os símbolos dos elementos foram desenhados para a extensão (não são os oficiais).

## Novidades da versão 3.9 — trilhas dos livros

- **📚 Escolher trilha** (aba Principal, em “Trilha e afinidade”): lista as trilhas da classe que estão nas bibliotecas carregadas (livro básico, *Sobrevivendo ao Horror* e outras que forem importadas). Ao escolher, as habilidades da trilha até o NEX atual entram na aba Habilidades e nos campos de NEX 10/40/65/99, então uma ficha criada já com NEX alto recebe tudo de uma vez. Os próximos patamares aparecem como “Próxima: …”.
- **Subir de NEX:** a janela já oferece a habilidade de trilha do patamar novo (marcada para adicionar), também no “Só mudar o NEX”. Sem trilha escolhida, mostra o botão para escolher.
- **Trocar de trilha** remove as habilidades que a trilha anterior adicionou sozinha; “Ficar sem trilha” limpa tudo. Se faltar alguma habilidade da trilha, a ficha avisa com o botão “Adicionar”.
- **📚 Adicionar do livro:** a lista não para mais em 120 entradas (era isso que cortava as habilidades do livro básico) e mostra quantas entradas há.

Arquivos para trocar: `app.js`, `style.css`, `index.html`, `manifest.json` e este `LEIA-ME.md`.

### 3.9.1
- O botão **📚 Escolher** da trilha não perde mais o clique quando o nome da trilha acabou de ser digitado no campo ao lado (vale para os outros campos de texto que redesenham a ficha).
- Sem biblioteca no navegador, o botão explica como receber a do mestre.
