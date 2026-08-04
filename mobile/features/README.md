# Feature Modules

Feature folders own screen-specific business logic. Expo Router files in `app/`
should gradually become thin route shells that render feature hooks and
components from this folder.

Each major feature should use this shape:

```txt
features/[feature-name]/
  components/
  hooks/
  services/
  types/
  utils/
  constants/
```

Cleanup rule: preserve behavior first, then improve structure.
