# @loop/db

Este paquete contiene el esquema de la base de datos, migraciones y seeds del proyecto Loop.

Reglas:
- Los eventos son append-only (no se editan ni se borran).
- La seguridad multi-tenant se valida con políticas (RLS o equivalente).
- El esquema understandible y versionado vive acá.
