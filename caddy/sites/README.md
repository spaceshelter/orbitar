# Extra Caddy sites

`caddy/Caddyfile.ssl.local` imports every `*.caddy` file in this directory, so other services on the same
host can sit behind Orbitar's Caddy (it owns port 443). Nothing here is required; without files Caddy only logs
a "No files matching import glob pattern" warning.

The deploy workflow copies `/opt/deployment-specific-files/caddy-sites/*.caddy` from the host into this directory.
Don't commit host-specific site files.

## Media hosting on the same host

[orbitar-media](https://github.com/spaceshelter/orbitar-media) has a colocated mode (its README, "Next to Orbitar on one
box") that serves plain HTTP on `172.17.0.1:8090` and leaves TLS to this Caddy. Orbitar links media through the
host in `MEDIA_HOSTING_URL` and its `b.` and `origin.` subdomains, so the site needs all three:

```
media.example.org, b.media.example.org, origin.media.example.org {
  reverse_proxy 172.17.0.1:8090
}
```

Point DNS for the three names at this host. Without a `tls` line Caddy gets certificates from Let's Encrypt
through the TLS-ALPN challenge on 443 and keeps them in the `caddy_data` volume. Then set
`MEDIA_HOSTING_URL=https://media.example.org` and `MEDIA_HOSTING_CLIENT_ID` (the media stack's `CLIENT_ID`) in
`.env` and rebuild: the frontend bakes the URL in at build time.
