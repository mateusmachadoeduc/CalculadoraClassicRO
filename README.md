# RO Classic Calc

Calculadora de dano de **Ragnarok Online Classic (pré-renewal)** com interface nova, em 4 etapas:

1. **Personagem**: classe (escolhida por linha de evolução, com sprites), níveis, atributos, status, janela de equipamentos estilo RO (clique no slot), refino, cartas com arte, encantamentos e buffs.
2. **Habilidades**: árvore de habilidades da classe, com ícones, níveis, pré-requisitos e pontos. As passivas que o motor usa entram no cálculo.
3. **Alvo**: galeria de monstros com sprites, busca em PT/EN, filtros, buffs e debuffs no alvo.
4. **Simulação**: ataque básico ou habilidade, dano mín./médio/máx., golpes pra matar, DPS e dano recebido.

## O cálculo

O motor é **o do [rocalc.com](https://rocalc.com)**, sem nenhuma alteração. São os arquivos `*_2026-04-06.js`, idênticos aos publicados no rocalc.com (verificado por SHA-256). A interface só preenche os campos que o motor lê e mostra os resultados que ele escreve. Links de build do rocalc.com podem ser importados em ⚙ Opções.

## Publicar no GitHub Pages

Todos os arquivos ficam **na raiz** do repositório (sem pastas):

1. No repositório: **Add file → Upload files**, arraste **todos os arquivos** desta pasta e clique em **Commit changes**. Os arquivos com o mesmo nome são substituídos.
2. **Settings → Pages**: Source = *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. Abra `https://SEU-USUARIO.github.io/NOME-DO-REPO/` e aperte Ctrl+F5.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | página (o formulário original do rocalc fica escondido dentro dela) |
| `*_2026-04-06.js` | motor original do rocalc.com (não editar) |
| `app.js` / `app.css` | interface nova e tema |
| `i18n-ptbr.js` | nomes em português (bRO) de itens, cartas, monstros e habilidades |
| `skilltree.js` | árvores de habilidade pré-renewal |
| `idmap.js` | ligação entre os ids da calc e os ids oficiais (imagens e traduções) |

## Créditos

Simulador original de ROratorio, traduzido e adaptado por Doddler, com atualizações de Gandi, Triper e kurimet ([rocalc.com](https://rocalc.com)). Nomes em PT e imagens de itens, monstros e habilidades: divine-pride.net. Sprites de classe: bROWiki. Árvores de habilidade: rAthena. Ragnarok Online © Gravity Co., Ltd.
