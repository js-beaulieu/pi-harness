# Product Workspace

This private coordination repository contains canonical knowledge and configuration for product repositories under `projects/`.

## First use

Clone or initialize product repositories beneath `projects/`, then open Pi and ask it to onboard this workspace. Pi analyzes local checkouts only, proposes `workspace.yaml`, and applies it only after an explicit structured confirmation.

## Work

```text
/workspace:plan <subject>
/workspace:code
/workspace:code <review feedback>
/workspace:done
```

The parent session coordinates; workers edit product checkouts. The parent alone maintains canonical `docs/` through `workspace_knowledge`.
