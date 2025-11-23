/** @jsxImportSource hono/jsx */

import { raw } from 'hono/html'
import { css } from '../lib/styles'

type LayoutProps = {
  title: string
  children: any
  includeModal?: boolean
  includeAdmin?: boolean
}

export const Layout = ({ title, children, includeModal, includeAdmin }: LayoutProps) => (
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title}</title>
      <style>{raw(css)}</style>
      <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    </head>
    <body>
      {raw(children)}
      {(includeModal || includeAdmin) && (
        <script type="module" src="/js/client.mjs"></script>
      )}
    </body>
  </html>
)

export const Card = ({ children }: { children: any }) => (
  <div class="card">{children}</div>
)

export const FormGroup = ({ children }: { children: any }) => (
  <div class="form-group">{children}</div>
)

export const TopNav = ({ children }: { children: any }) => (
  <div class="top-nav">{children}</div>
)
