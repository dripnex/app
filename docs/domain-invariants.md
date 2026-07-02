# Domain Invariants

> Reglas fundamentales del dominio que deben respetarse en todo el sistema.

## 1. `updatedAt` Semantics

`updatedAt` representa la **última modificación del contenido semántico** de una nota.

### 1.1 Clasificación de Mutaciones

| Tipo          | Actualiza `updatedAt` | Ejemplos                                |
| ------------- | --------------------- | --------------------------------------- |
| **Content**   | **SÍ**                | Crear, editar contenido, cambiar título |
| **Metadata**  | **NO**                | Status, tags, notebook, pin             |
| **Lifecycle** | **SÍ** (debatible)    | Archive, trash, restore                 |
| **Destroy**   | **N/A**               | Hard delete (entidad deja de existir)   |
| **Infra**     | **NO**                | Cascadas, FKs, triggers                 |

### 1.2 Reglas por Función

#### Content (actualiza `updatedAt`)

```typescript
createNote(); // Nueva nota
updateNote(); // Cambio de contenido
updateTitle(); // Cambio de título
duplicateNote(); // Nueva nota (copia)
```

#### Metadata (NO actualiza `updatedAt`)

```typescript
setNoteStatus(); // Cambio de status (active, on_hold, etc.)
moveNoteToNotebook(); // Mover a otro notebook
pinNote(); // Fijar nota
unpinNote(); // Desfijar nota
setManualTags(); // Agregar/quitar tags manuales
```

#### Lifecycle (actualiza `updatedAt` - debatible)

```typescript
archiveNote(); // Archivar
restoreNote(); // Restaurar de archivo
softDeleteNote(); // Mover a papelera
restoreDeletedNote(); // Restaurar de papelera
```

#### Destroy (N/A)

```typescript
deleteNote(); // Hard delete - la entidad deja de existir
```

### 1.3 Rationale

Los usuarios esperan que "última edición" signifique **cambios de contenido**.

- Mover una nota a otra carpeta no es "editar"
- Cambiar el status de "Active" a "Completed" no es "editar"
- Agregar un tag no es "editar" el contenido

Estas son operaciones **organizacionales**, no editoriales.

### 1.4 Infraestructura

Las operaciones de infraestructura (cascadas, FKs, triggers) **nunca** deben actualizar `updatedAt` como efecto secundario.

```sql
-- Correcto: solo mueve notas
UPDATE notes SET notebook_id = 'inbox' WHERE notebook_id = ?

-- Incorrecto: actualiza timestamp innecesariamente
UPDATE notes SET notebook_id = 'inbox', updated_at = datetime('now') WHERE notebook_id = ?
```

---

## 2. Markdown es Sagrado

El markdown del usuario **nunca** debe ser modificado automáticamente.

- No auto-formatear
- No auto-corregir
- No normalizar whitespace
- No modificar links/wikilinks

El AST es **efímero** - se parsea para features, nunca se persiste como autoridad.

---

## 3. Core es Puro

El paquete `@dripnex/core` no debe tener dependencias de:

- Electron
- React
- Node.js APIs específicas
- SQLite

Debe ser ejecutable en cualquier runtime JavaScript.

---

## 4. Offline-First

Ninguna feature requiere conexión a internet.

- Todas las operaciones funcionan offline
- Sync es opcional y aditivo
- La app nunca bloquea esperando red
