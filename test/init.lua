local server_name = 'tiulii'
local group = vim.api.nvim_create_augroup(server_name, { clear = true })
---@type vim.lsp.Config
local cfg = {
  cmd = { './src/server/dist/cli.js', '--stdio' },
  filetypes = { 'markdown', 'rmd', 'org' },

  on_init = function(client, _)
    vim.api.nvim_create_autocmd('BufEnter', {
      group = group,
      pattern = { '*.md', '*.rmd', '*.Rmd', '*.org' },
      callback = function(ctx)
        client:notify(server_name .. '/didChangeView', {
          uri = vim.uri_from_bufnr(ctx.buf),
        })
      end,
    })

    vim.api.nvim_create_autocmd('CursorHold', {
      group = group,
      pattern = { '*.md', '*.rmd', '*.Rmd', '*.org' },
      callback = function(ctx)
        client:notify(server_name .. '/didMoveCursor', {
          line = vim.fn.line('.'),
          maxLine = vim.api.nvim_buf_line_count(ctx.buf),
          uri = vim.uri_from_bufnr(ctx.buf),
        })
      end,
    })
  end,

  on_attach = function(client, bufnr)
    vim.keymap.set('n', 'gb', function()
      client:notify(server_name .. '/openPreviewURL', {})
    end, { buf = bufnr, desc = 'Live preview' })
  end,

  on_exit = function() vim.api.nvim_clear_autocmds({ group = group }) end,
}
vim.lsp.config(server_name, cfg)
vim.lsp.enable(server_name)

vim.lsp.log.set_level("debug")
vim.cmd[[set updatetime=400]]
