# Guia de Deploy para GitHub Pages

Este guia explica como fazer deploy da aplicação AR que está em `templates/app-base` para o GitHub Pages.

## 📋 Pré-requisitos

1. Ter uma conta no GitHub
2. Ter o repositório criado no GitHub
3. Ter o Git configurado localmente
4. Node.js 18+ instalado

## 🚀 Passo a Passo para Deploy

### 1. Preparar o Repositório no GitHub

1. Acesse [GitHub](https://github.com) e crie um novo repositório (ou use um existente)
2. Anote o nome do repositório (exemplo: `meu-usuario/meu-repositorio`)

### 2. Configurar o Repositório Local

Se ainda não tiver o repositório conectado ao GitHub:

```bash
# Adicionar o remote do GitHub (substitua pelo seu repositório)
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git

# Ou se já tiver um remote, altere para o GitHub
git remote set-url origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
```

### 3. Atualizar o package-lock.json (Recomendado)

Como `templates/app-base` foi adicionado aos workspaces, é recomendado atualizar o `package-lock.json`:

```bash
# Na raiz do projeto
npm install
```

Isso garantirá que o lockfile esteja sincronizado com as mudanças nos workspaces.

### 4. Atualizar o Base Path (Opcional)

O workflow já está configurado para usar automaticamente o nome do repositório. Se quiser usar um path customizado:

1. Edite o arquivo `.github/workflows/deploy.yml`
2. Na seção `Build application`, altere a variável `VITE_BASE_PATH`:
   ```yaml
   VITE_BASE_PATH: /seu-path-customizado/
   ```

### 5. Fazer Commit e Push

```bash
# Adicionar os arquivos
git add .

# Fazer commit
git commit -m "Configurar deploy para GitHub Pages"

# Fazer push para a branch main (ou master)
git push -u origin main
```

### 6. Habilitar GitHub Pages no Repositório

1. Acesse seu repositório no GitHub
2. Vá em **Settings** (Configurações)
3. No menu lateral, clique em **Pages**
4. Em **Source**, selecione:
   - **Source**: `GitHub Actions`
5. Salve as configurações

### 7. Verificar o Deploy

1. Após fazer o push, vá para a aba **Actions** no seu repositório GitHub
2. Você verá o workflow "Deploy to GitHub Pages" em execução
3. Aguarde a conclusão (pode levar alguns minutos)
4. Quando concluído, você verá um link para acessar o site

### 8. Acessar a Aplicação

A URL será no formato:
```
https://SEU-USUARIO.github.io/SEU-REPOSITORIO/
```

Exemplo: Se seu repositório for `joao/meu-app-ar`, a URL será:
```
https://joao.github.io/meu-app-ar/
```

## 🔄 Deploy Automático

O workflow está configurado para fazer deploy automaticamente quando:
- Você faz push para a branch `main` ou `master`
- Você dispara manualmente pela aba **Actions** → **Deploy to GitHub Pages** → **Run workflow**

## 🛠️ Troubleshooting

### Erro: "Workflow not found"
- Certifique-se de que o arquivo `.github/workflows/deploy.yml` está na branch `main` ou `master`
- Verifique se o arquivo está com a sintaxe YAML correta

### Erro: "Pages build failed"
- Verifique os logs na aba **Actions** para ver o erro específico
- Certifique-se de que todas as dependências estão no `package.json`
- Verifique se o caminho `templates/app-base` existe

### Aplicação não carrega corretamente
- Verifique se o `base` no `vite.config.ts` está correto
- Certifique-se de que o nome do repositório no GitHub corresponde ao usado no workflow
- Limpe o cache do navegador (Ctrl+Shift+R ou Cmd+Shift+R)

### Assets não carregam
- Verifique se os arquivos em `public/assets` estão sendo incluídos no build
- Certifique-se de que os caminhos relativos estão corretos

## 📝 Notas Importantes

1. **HTTPS obrigatório**: GitHub Pages só funciona com HTTPS, necessário para APIs de câmera e AR
2. **Primeiro deploy**: O primeiro deploy pode levar até 10 minutos
3. **Atualizações**: Deploys subsequentes são mais rápidos (2-5 minutos)
4. **Branch**: O workflow está configurado para `main` ou `master`. Se usar outra branch, edite o arquivo `.github/workflows/deploy.yml`

## 🔍 Verificar Status do Deploy

Para verificar o status do deploy:
1. Acesse a aba **Actions** no GitHub
2. Clique no workflow mais recente
3. Veja os logs de cada etapa para identificar problemas

## 📞 Suporte

Se encontrar problemas, verifique:
- Os logs na aba **Actions**
- A configuração do GitHub Pages em **Settings** → **Pages**
- Se o repositório é público (GitHub Pages gratuito requer repositório público)

