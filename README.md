# Tiulii

- Tiulii is an LSP server that lets you preview files in your browser
  with **live updates**, and is **configurable** via JavaScript
- Preview markdown with:
  - Synchronized scrolling between editor and browser
  - Math rendering via KaTeX
    - Custom KaTeX macros
  - Syntax highlighting

## Installation

To run `tiulii`, you need install [Node.js](https://nodejs.org).

### Build from the source

```bash
git clone https://github.com/st0chaos/tiulil.git --depth=1
cd tiulii
npm install
npm run build
ln --symbolic "$(realpath ./dist/tiulii)" /path/to/your/bin/tiulii
# Or you can run directly
node ./dist/tiulii --stdio
# Or you can copy tiulii to wherever you want
cp ./dist/tiulii /path/to/your/bin/tiulii
```

## Usage

### Neovim 0.11+

Copy the configuration below to `.config/nvim/lsp/tiulii.lua`,
or you can configure tiulii via `vim.lsp.config({ ... })`,
then enable the LSP server `vim.lsp.enable('tiulii')` in your init file.

```lua
local server_name = 'tiulii'
local group = vim.api.nvim_create_augroup(server_name, { clear = true })
---@type vim.lsp.Config
return {
  cmd = { server_name, '--stdio' },
  filetypes = { 'markdown' },

  on_init = function(client, _)
    vim.api.nvim_create_autocmd('BufEnter', {
      group = group,
      pattern = { '*.md' },
      callback = function(ctx)
        client:notify(server_name .. '/didChangeView', {
          uri = vim.uri_from_bufnr(ctx.buf),
        })
      end,
    })

    vim.api.nvim_create_autocmd('CursorHold', {
      group = group,
      pattern = { '*.md' },
      callback = function()
        client:notify(server_name .. '/didMoveCursor', {
          line = vim.fn.line('.') - 1,
        })
      end,
    })
  end,

  on_attach = function(client, bufnr)
    vim.keymap.set(
      'n',
      '<LocalLeader><LocalLeader>',
      function() client:notify(server_name .. '/openPreviewURL', {}) end,
      { buf = bufnr, desc = 'Live preview' }
    )
  end,

  on_exit = function() vim.api.nvim_clear_autocmds({ group = group }) end,
}
```

## Configuration

Tiulii tries to read the configuration file `~/.config/tiulii/config.js` which
should have a default export. Here is a example.

```javascript
export default {
  // Port on which the HTTP server listens.
  port: 0,
  // Path to your custom CSS, relative to the config directory.
  css: './style.css',
}
```
