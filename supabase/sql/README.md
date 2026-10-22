# SQL del ERP

- `historico/`: todos los scripts que se han ido entregando hasta la V80, tal cual (salvo el V71, que ya lleva puesto el project ref `deebnsbrvtmstakchxan`). Son solo de referencia: **la base de datos real ya tiene aplicados casi todos**. El V71 está sin ejecutar (ver `docs/PENDIENTES.md`).
- Los scripts nuevos van en esta carpeta como `ROOTFLOW-SQL-V81-<NOMBRE>.sql`, `ROOTFLOW-SQL-V82-…`, siguiendo las reglas de `CLAUDE.md` (idempotentes, RLS solo `authenticated`, realtime, `NOTIFY pgrst`).
- Se ejecutan a mano en Supabase → SQL Editor, en orden de versión, una sola vez.
- La foto actual de tablas y columnas está en `docs/ESQUEMA-BD.md`.
