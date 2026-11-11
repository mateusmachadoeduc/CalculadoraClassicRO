# RO Classic Calc

Calculadora de dano de **Ragnarok Online Classic (pré-renewal)** com interface nova, em três etapas:

1. **Personagem**: classe, níveis, atributos, status, equipamentos com refino, slots de carta (com a arte da carta), encantamentos, passivas, buffs e consumíveis.
2. **Alvo**: galeria com todos os monstros (busca, filtro por mapa, ordenação), detalhes do alvo, debuffs/buffs e edição manual.
3. **Simulação**: ataque básico ou habilidade (com nível), dano mín./médio/máx., barra de dano em relação ao HP, golpes pra matar, DPS, crítico, EXP por golpe e o dano que você recebe do alvo.

## O cálculo

O motor é **o do [rocalc.com](https://rocalc.com)**, sem nenhuma alteração. Os arquivos estão em `engine/` e são idênticos aos publicados no rocalc.com na versão 2026-04-06 (verificado por SHA-256). A interface nova só preenche os campos que o motor lê e mostra os resultados que ele escreve. Por isso os números batem com o rocalc.

- Links de build do rocalc.com podem ser importados (⚙ Opções → Importar link).
- A build atual fica salva no link da página e no navegador.

## Publicar no GitHub Pages

1. Crie um repositório (ex.: `ro-calc`) e envie **todo o conteúdo desta pasta** para a raiz dele (`index.html` precisa ficar na raiz).
2. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, pasta `/ (root)`. Salve.
3. Em 1 ou 2 minutos o site fica em `https://SEU-USUARIO.github.io/ro-calc/`.

Para testar sem publicar, é só abrir o `index.html` no navegador.

## Estrutura

```
index.html        página (o formulário original do rocalc fica escondido dentro dela)
engine/           motor original do rocalc.com (não editar)
assets/app.js     interface nova (lê e escreve no motor)
assets/app.css    tema
assets/idmap.js   id da calc → id oficial do item/monstro/carta (só para as imagens)
```

As imagens de itens, cartas e monstros vêm do divine-pride.net. Mais ou menos 75% dos itens e 80% dos monstros e cartas têm imagem. Os outros aparecem com as iniciais do nome.

## Próximos passos

- Sistema de runas dos equipamentos dropáveis (já tem um espaço reservado na aba Personagem).
- Ajustes finos de dano específicos do servidor.

## Créditos

Simulador original de ROratorio, traduzido e adaptado por Doddler, com atualizações de Gandi, Triper e kurimet ([rocalc.com](https://rocalc.com)). Imagens: divine-pride.net. Ragnarok Online © Gravity Co., Ltd.
