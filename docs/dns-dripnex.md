# dripnex.app DNS

`dripnex.app` is registered at **GoDaddy**. Nameservers already point at
Cloudflare (`jakub.ns.cloudflare.com` / `sima.ns.cloudflare.com`), so
**GoDaddy’s DNS panel does nothing**. Parking (`/lander`) comes from
leftover A/AAAA records in the Cloudflare zone.

## Do this in GoDaddy (once)

1. Domain → dripnex.app → **DNS** / **Nameservers**.
2. Confirm custom nameservers:
   - `jakub.ns.cloudflare.com`
   - `sima.ns.cloudflare.com`
3. Turn **off** Domain Forwarding / Parking / “Forward to lander”.
4. Leave the rest. Records live in Cloudflare.

## Do this in Cloudflare (the actual records)

Zone: `dripnex.app`

| Type  | Name  | Target                             | Proxy   |
| ----- | ----- | ---------------------------------- | ------- |
| CNAME | `@`   | `dripnex-web.pages.dev`            | Proxied |
| CNAME | `www` | `dripnex-web.pages.dev`            | Proxied |
| CNAME | `api` | _(leave the Worker custom domain)_ | Proxied |

Delete any extra **A / AAAA / CNAME on `@` or `www`** that do not point
at `dripnex-web.pages.dev`. Those are the GoDaddy parkweb origin.

Do **not** delete `api.dripnex.app`.

Pages custom domain: project `dripnex-web`, hostnames `dripnex.app` and
`www.dripnex.app`.

Until those A records are gone, magic links must use
`https://dripnex-web.pages.dev/auth/verify`.
